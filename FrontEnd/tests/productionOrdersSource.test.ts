import test from "node:test";
import assert from "node:assert/strict";
import { createProductionOrdersSource } from "../src/integration/productionOrdersSource.ts";
import { telemetryMock } from "../src/mocks/telemetryMock.ts";

test("fonte padrão mantém mock sem rede e isola alterações entre leituras", async () => {
  let calls = 0;
  const source = createProductionOrdersSource({
    api: {
      fetchImpl: async () => {
        calls++;
        throw new Error("Não deveria consultar");
      },
    },
  });
  const snapshot = await source.read();
  assert.equal(snapshot.source, "mock");
  if (snapshot.source !== "mock") throw new Error("Esperado mock");
  assert.equal(snapshot.reason, "selected");
  assert.equal(snapshot.error, undefined);
  assert.deepEqual(snapshot.orders, telemetryMock.dadosExpedicao.ordens);
  snapshot.orders[0].produzido = 999;
  const next = await source.read();
  assert.equal(next.source, "mock");
  if (next.source !== "mock") throw new Error("Esperado mock");
  assert.deepEqual(next.orders, telemetryMock.dadosExpedicao.ordens);
  assert.equal(calls, 0);
});

test("modo API só consulta ao ler e retorna dados parciais separados do mock", async () => {
  const payload = {
    productionOrders: [{ code: "OP2", productName: "Bloco Simples" }],
    extra: true,
  };
  const before = structuredClone(telemetryMock);
  let calls = 0;
  const source = createProductionOrdersSource({
    mode: "api",
    api: {
      fetchImpl: async () => {
        calls++;
        return Response.json(payload);
      },
    },
  });
  assert.equal(calls, 0);
  const snapshot = await source.read();
  assert.equal(snapshot.source, "api");
  if (snapshot.source !== "api") throw new Error("Esperada API");
  assert.equal(calls, 1);
  assert.deepEqual(snapshot.originalPayload, payload);
  assert.deepEqual(snapshot.adaptations[0].mapped, {
    codigo: "OP2",
    produto: "Bloco Simples",
  });
  assert.deepEqual(snapshot.adaptations[0].pendingFields, [
    "meta",
    "produzido",
    "status",
    "destino",
  ]);
  assert.equal(Object.hasOwn(snapshot, "orders"), false);
  assert.deepEqual(
    telemetryMock,
    before,
    "não altera métricas, palete, ordens ou capacidades simuladas",
  );
});

test("ordens vazias ou sem campos mapeáveis mantêm a origem real sem fabricar ordens", async () => {
  for (const productionOrders of [
    [],
    [{}],
    [{ productionOrderStatusId: 3, productCode: "BLOCO1" }],
  ]) {
    const source = createProductionOrdersSource({
      mode: "api",
      api: { fetchImpl: async () => Response.json({ productionOrders }) },
    });
    const snapshot = await source.read();
    assert.equal(snapshot.source, "api");
    if (snapshot.source !== "api") throw new Error("Esperada API");
    assert.equal(snapshot.adaptations.length, productionOrders.length);
    for (const adaptation of snapshot.adaptations)
      assert.deepEqual(adaptation.mapped, {});
  }
});

test("servidor indisponível, HTTP inválido, payload inválido e timeout usam fallback identificado", async (t) => {
  const cases: { kind: string; fetchImpl: typeof fetch; timeoutMs?: number }[] =
    [
      {
        kind: "unavailable",
        fetchImpl: async () => {
          throw new TypeError("Failed to fetch");
        },
      },
      {
        kind: "http",
        fetchImpl: async () => new Response("", { status: 503 }),
      },
      { kind: "invalid-payload", fetchImpl: async () => Response.json({}) },
      {
        kind: "timeout",
        timeoutMs: 10,
        fetchImpl: async (_url, options) =>
          new Promise<Response>((_resolve, reject) => {
            options?.signal?.addEventListener(
              "abort",
              () => reject(new Error("abort")),
              { once: true },
            );
          }),
      },
    ];
  for (const { kind, ...api } of cases) {
    await t.test(kind, async () => {
      const source = createProductionOrdersSource({ mode: "api", api });
      const snapshot = await source.read();
      assert.equal(snapshot.source, "mock");
      if (snapshot.source !== "mock") throw new Error("Esperado fallback mock");
      assert.equal(snapshot.reason, "api-failure");
      assert.equal(snapshot.error?.kind, kind);
      assert.deepEqual(snapshot.orders, telemetryMock.dadosExpedicao.ordens);
    });
  }
});

test("fallback pode preservar ordens da sessão local sem alterar a sessão", async () => {
  const orders = [
    {
      codigo: "OP-LOCAL",
      produto: "Produto local",
      meta: 7,
      produzido: 2,
      status: "ATIVA" as const,
      destino: "Campinas",
    },
  ];
  const source = createProductionOrdersSource({
    mode: "api",
    fallbackOrders: orders,
    api: {
      fetchImpl: async () => {
        throw new TypeError("offline");
      },
    },
  });
  const snapshot = await source.read();
  if (snapshot.source !== "mock") throw new Error("Esperado fallback mock");
  assert.deepEqual(snapshot.orders, orders);
  snapshot.orders[0].meta = 100;
  assert.equal(orders[0].meta, 7);
});

test("cancelamento durante leitura é propagado sem publicar fallback de uma consulta descartada", async () => {
  const controller = new AbortController();
  const source = createProductionOrdersSource({
    mode: "api",
    api: {
      fetchImpl: async (_url, options) =>
        new Promise<Response>((_resolve, reject) => {
          options?.signal?.addEventListener(
            "abort",
            () => reject(new Error("abort")),
            { once: true },
          );
          controller.abort();
        }),
    },
  });
  await assert.rejects(source.read(controller.signal), {
    name: "ProductionOrdersApiError",
    kind: "cancelled",
  });
});
