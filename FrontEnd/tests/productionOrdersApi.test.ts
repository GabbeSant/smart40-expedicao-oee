import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getProductionOrders,
  parseProductionOrdersPayload,
  ProductionOrdersApiError,
  PRODUCTION_ORDERS_BASE_URL,
  PRODUCTION_ORDERS_PATH,
} from "../src/integration/productionOrdersApi.ts";

const realPayload: unknown = JSON.parse(
  readFileSync(
    new URL("../productionOrders-real.json", import.meta.url),
    "utf8",
  ).replace(/^\uFEFF/, ""),
);

test("payload real completo: consulta somente GET no endpoint validado, sem credenciais ou body", async () => {
  let calls = 0;
  const payload = await getProductionOrders({
    fetchImpl: async (url, options) => {
      calls++;
      assert.equal(
        url,
        `${PRODUCTION_ORDERS_BASE_URL}${PRODUCTION_ORDERS_PATH}`,
      );
      assert.equal(options?.method, "GET");
      assert.equal(options?.credentials, "omit");
      assert.equal(options?.redirect, "error");
      assert.equal(options?.cache, "no-store");
      assert.equal(options?.body, undefined);
      assert.deepEqual(options?.headers, { Accept: "application/json" });
      assert.ok(options?.signal instanceof AbortSignal);
      return Response.json(realPayload);
    },
  });
  assert.equal(calls, 1);
  assert.ok(payload.productionOrders.length > 0);
  assert.deepEqual(payload, realPayload);
});

test("payload incompleto preserva ausência e null sem criar números ou parâmetros", async () => {
  const incomplete = {
    productionOrders: [{ code: "OP-PARCIAL" }, {}, { productName: null }],
  };
  const payload = await getProductionOrders({
    fetchImpl: async () => Response.json(incomplete),
  });
  assert.deepEqual(payload, incomplete);
  assert.equal(Object.hasOwn(payload.productionOrders[0], "priority"), false);
  assert.equal(Object.hasOwn(payload.productionOrders[0], "parameters"), false);
  assert.equal(payload.productionOrders[2].productName, null);
  assert.deepEqual(
    parseProductionOrdersPayload({ productionOrders: [] }).productionOrders,
    [],
  );
});

test("campos desconhecidos são preservados no envelope, na ordem, no processo e no parâmetro", () => {
  const payload = {
    revision: { name: "nova" },
    productionOrders: [
      {
        code: "OP2",
        extra: { values: [null, 0, "0"] },
        processes: [
          {
            productionOrderProcessId: 1,
            processingTime: 15,
            unit: "não validada",
          },
        ],
        parameters: [{ key: "Posicao expedicao", value: "0", extra: true }],
      },
    ],
  };
  assert.deepEqual(parseProductionOrdersPayload(payload), payload);
});

test("estrutura inválida e tipos incompatíveis são recusados sem aceitar casts como validação", () => {
  for (const payload of [
    null,
    [],
    {},
    { productionOrders: null },
    { productionOrders: {} },
    { productionOrders: [null] },
    { productionOrders: [[]] },
    { productionOrders: [{ code: 2 }] },
    { productionOrders: [{ productionOrderStatusId: "3" }] },
    { productionOrders: [{ startTime: 123 }] },
    { productionOrders: [{ id: Infinity }] },
    { productionOrders: [{ processes: {} }] },
    { productionOrders: [{ processes: [null] }] },
    { productionOrders: [{ processes: [{ processingTime: "15" }] }] },
    { productionOrders: [{ parameters: [null] }] },
    { productionOrders: [{ parameters: [{ key: "Andares", value: 3 }] }] },
    { productionOrders: [], productionLineId: "1" },
  ]) {
    assert.throws(() => parseProductionOrdersPayload(payload), {
      name: "ProductionOrdersApiError",
      kind: "invalid-payload",
    });
  }
});

test("servidor indisponível produz erro identificado", async () => {
  await assert.rejects(
    getProductionOrders({
      fetchImpl: async () => {
        throw new TypeError("Failed to fetch");
      },
    }),
    { name: "ProductionOrdersApiError", kind: "unavailable" },
  );
});

test("HTTP sem sucesso e JSON malformado não são tratados como ordens vazias", async () => {
  await assert.rejects(
    getProductionOrders({
      fetchImpl: async () => new Response("Indisponível", { status: 503 }),
    }),
    { name: "ProductionOrdersApiError", kind: "http", status: 503 },
  );
  await assert.rejects(
    getProductionOrders({
      fetchImpl: async () => new Response("{"),
    }),
    { name: "ProductionOrdersApiError", kind: "invalid-payload" },
  );
});

test("consulta pendente é abortada após o timeout", async () => {
  let signal: AbortSignal | undefined;
  await assert.rejects(
    getProductionOrders({
      timeoutMs: 10,
      fetchImpl: async (_url, options) =>
        new Promise<Response>((_resolve, reject) => {
          signal = options?.signal ?? undefined;
          signal?.addEventListener("abort", () => reject(new Error("abort")), {
            once: true,
          });
        }),
    }),
    { name: "ProductionOrdersApiError", kind: "timeout" },
  );
  assert.equal(signal?.aborted, true);
});

test("cancelamento prévio não consulta o servidor", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(
    getProductionOrders({
      signal: controller.signal,
      fetchImpl: async () => {
        calls++;
        return Response.json({ productionOrders: [] });
      },
    }),
    { name: "ProductionOrdersApiError", kind: "cancelled" },
  );
  assert.equal(calls, 0);
});

test("origem configurável mantém o caminho fixo; configuração inválida não inicia rede", async () => {
  await getProductionOrders({
    baseUrl: "http://localhost:5678/",
    fetchImpl: async (url) => {
      assert.equal(url, `http://localhost:5678${PRODUCTION_ORDERS_PATH}`);
      return Response.json({ productionOrders: [] });
    },
  });
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls++;
    return Response.json({ productionOrders: [] });
  };
  for (const baseUrl of [
    "inválida",
    "ftp://localhost",
    "http://user:secret@localhost",
    "http://localhost/other",
    "http://localhost/?token=secret",
    "http://localhost/#other",
  ]) {
    await assert.rejects(getProductionOrders({ baseUrl, fetchImpl }), {
      name: "ProductionOrdersApiError",
      kind: "configuration",
    });
  }
  for (const timeoutMs of [0, -1, NaN, Infinity, 2_147_483_648]) {
    await assert.rejects(
      getProductionOrders({ timeoutMs, fetchImpl }),
      ProductionOrdersApiError,
    );
  }
  assert.equal(calls, 0);
});
