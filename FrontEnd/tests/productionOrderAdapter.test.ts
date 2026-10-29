import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { adaptProductionOrder } from "../src/adapters/productionOrderAdapter.ts";
import { parseProductionOrdersPayload } from "../src/integration/productionOrdersApi.ts";

test("adapter mapeia apenas código e nome de produto em todas as ordens reais", () => {
  const payload = parseProductionOrdersPayload(
    JSON.parse(
      readFileSync(
        new URL("../productionOrders-real.json", import.meta.url),
        "utf8",
      ).replace(/^\uFEFF/, ""),
    ),
  );
  for (const order of payload.productionOrders) {
    const result = adaptProductionOrder(order);
    assert.deepEqual(result.mapped, {
      codigo: order.code,
      produto: order.productName,
    });
    assert.deepEqual(result.pendingFields, [
      "meta",
      "produzido",
      "status",
      "destino",
    ]);
    assert.deepEqual(result.original, order);
  }
});

test("sem correspondência segura não usa id, trackingCode, productCode ou datas como substitutos", () => {
  const result = adaptProductionOrder({
    id: 2,
    trackingCode: "OP2",
    productCode: "BLOCO1",
    productionOrderStatusId: 3,
    startTime: "2026-04-01T15:49:46.289-03:00",
    finishTime: "2026-04-01T15:56:18.038-03:00",
    parameters: [
      { key: "Posicao expedicao", value: "0" },
      { key: "Andares", value: "3" },
    ],
  });
  assert.deepEqual(result.mapped, {});
  assert.deepEqual(result.pendingFields, [
    "codigo",
    "produto",
    "meta",
    "produzido",
    "status",
    "destino",
  ]);
});

test("campos ausentes, nulos ou vazios não viram zero, status ou produto inferido", () => {
  for (const order of [
    {},
    { code: null, productName: null },
    { code: " ", productName: "" },
  ]) {
    assert.deepEqual(adaptProductionOrder(order).mapped, {});
  }
  const result = adaptProductionOrder({ code: "OP2" });
  assert.deepEqual(result.mapped, { codigo: "OP2" });
  assert.equal(Object.hasOwn(result.mapped, "produzido"), false);
  assert.equal(Object.hasOwn(result.mapped, "meta"), false);
  assert.equal(Object.hasOwn(result.original, "productName"), false);
});

test("preserva campos desconhecidos e parâmetros sem deduzir capacidade ou aceitar nomes internos externos", () => {
  const order = {
    code: " op2 ",
    productName: "Bloco Simples",
    priority: 0,
    startTime: null,
    meta: 99,
    produzido: 10,
    status: "ATIVA",
    destino: "externo não documentado",
    extra: { values: [0, null, "0"] },
    processes: [
      { productionOrderProcessId: 1, processingTime: 15, extra: true },
    ],
    parameters: [
      { key: "Posicao estoque 1", value: "24" },
      { key: "Andares", value: "3" },
    ],
  };
  const before = structuredClone(order);
  const result = adaptProductionOrder(order);
  assert.deepEqual(result.mapped, {
    codigo: " op2 ",
    produto: "Bloco Simples",
  });
  assert.deepEqual(order, before);
  assert.deepEqual(result.original, before);
  result.original.parameters![0].value = "alteração local";
  assert.deepEqual(
    order,
    before,
    "o original preservado não compartilha objetos mutáveis com a entrada",
  );
});
