import test from "node:test";
import assert from "node:assert/strict";
import {
  createSimulation,
  simulationReducer,
} from "../src/domain/expedition.ts";
import { telemetryScenarios } from "../src/mocks/telemetryMock.ts";
import { validateOrder, validateOee } from "../src/domain/warehouse.ts";
import {
  serializeSimulation,
  restoreSimulation,
} from "../src/domain/persistence.ts";

const timestamp = "2026-10-16T14:00:00.000Z";
const draft = {
  codigo: "OP-TESTE",
  produto: "Produto B",
  meta: 2,
  destino: "Campinas",
};
const piece = { type: "piece", timestamp } as const;
const identify = { type: "identify", timestamp } as const;
const store = { type: "release", timestamp } as const;

test("nova OP valida código único, quantidade inteira, produto e destino", () => {
  const state = createSimulation(
    telemetryScenarios["Novo planejamento"],
    "Novo planejamento",
  );
  const created = simulationReducer(state, {
    type: "add-order",
    draft,
    timestamp,
  });
  assert.equal(created.telemetry.dadosExpedicao.ordens[0].status, "ATIVA");
  assert.equal(
    simulationReducer(created, { type: "add-order", draft, timestamp }),
    created,
  );
  assert.ok(validateOrder({ ...draft, meta: 1.5 }, []));
  assert.ok(validateOrder({ ...draft, meta: 0 }, []));
  assert.ok(validateOrder({ ...draft, meta: NaN }, []));
  assert.ok(validateOrder({ ...draft, destino: "" }, []));
  assert.ok(validateOrder({ ...draft, codigo: "=DANGER" }, []));
});

test("fluxo completo preserva OP, produto, destino e quantidade até expedir", () => {
  let state = createSimulation(
    telemetryScenarios["Novo planejamento"],
    "Novo planejamento",
  );
  state = simulationReducer(state, { type: "add-order", draft, timestamp });
  state = simulationReducer(state, piece);
  state = simulationReducer(state, piece);
  assert.equal(state.telemetry.dadosExpedicao.ordens[0].status, "FINALIZADA");
  assert.equal(state.receipt.orderCode, draft.codigo);
  assert.equal(simulationReducer(state, store), state, "não armazena sem RFID");
  state = simulationReducer(state, identify);
  state = simulationReducer(state, store);
  assert.equal(state.rack[0]!.pieces, 2);
  assert.equal(state.rack[0]!.orderCode, draft.codigo);
  assert.equal(state.rack[0]!.product, draft.produto);
  assert.equal(state.rack[0]!.destination, draft.destino);
  state = simulationReducer(state, { type: "ship", position: 0, timestamp });
  assert.equal(state.rack[0], null);
  assert.equal(state.shipments[0].pieces, 2);
  assert.equal(state.shipments[0].orderCode, draft.codigo);
  assert.equal(
    simulationReducer(state, { type: "ship", position: 0, timestamp }),
    state,
    "não duplica a saída",
  );
  assert.ok(
    ["RECEBIDO", "IDENTIFICADO", "ARMAZENADO", "EXPEDIDO"].every((stage) =>
      state.movements.some((m) => m.stage === stage),
    ),
  );
});

test("trocar OP não mistura ordens ou destinos no lote e fila", () => {
  let state = createSimulation(
    telemetryScenarios["Novo planejamento"],
    "Novo planejamento",
  );
  state = simulationReducer(state, {
    type: "add-order",
    draft: { ...draft, meta: 1 },
    timestamp,
  });
  state = simulationReducer(state, {
    type: "add-order",
    draft: { ...draft, codigo: "OP-NOVA", destino: "Santos" },
    timestamp,
  });
  state = simulationReducer(state, piece);
  state = simulationReducer(state, piece);
  assert.equal(state.receipt.orderCode, "OP-TESTE");
  assert.equal(state.telemetry.dadosExpedicao.palete.pecas, 1);
  assert.equal(state.queue[0].orderCode, "OP-NOVA");
  assert.equal(state.queue[0].destination, "Santos");
  state = simulationReducer(state, identify);
  state = simulationReducer(state, store);
  assert.equal(state.rack[0]!.destination, "Campinas");
  assert.equal(state.receipt.orderCode, "OP-NOVA");
  assert.equal(state.telemetry.dadosExpedicao.palete.destino, "Santos");
  assert.equal(state.telemetry.dadosExpedicao.palete.pecas, 1);
  assert.equal(state.telemetry.metricasExpedicao.tamanhoFilaSaida, 0);
});

test("identificação fecha o lote; novas peças seguem para fila", () => {
  let state = createSimulation(telemetryScenarios["Operação normal"]);
  state = simulationReducer(state, identify);
  state = simulationReducer(state, piece);
  assert.equal(state.telemetry.dadosExpedicao.palete.pecas, 37);
  assert.equal(state.queue[0].pieces, 1);
  assert.equal(state.telemetry.metricasExpedicao.tamanhoFilaSaida, 1);
});

test("prateleira cheia bloqueia armazenamento sem perder o lote; saída libera espaço", () => {
  let state = createSimulation(telemetryScenarios["Operação normal"]);
  state = simulationReducer(state, identify);
  state = simulationReducer(state, store);
  const batch = state.rack[0]!;
  state.rack = state.rack.map((_, i) => ({ ...batch, id: `PAL-${i}` }));
  state = simulationReducer(state, piece);
  state = simulationReducer(state, identify);
  assert.equal(simulationReducer(state, store), state);
  assert.equal(state.telemetry.dadosExpedicao.palete.pecas, 1);
  state = simulationReducer(state, { type: "ship", position: 3, timestamp });
  state = simulationReducer(state, store);
  assert.equal(state.rack[3]!.pieces, 1);
  assert.equal(state.rack.filter(Boolean).length, 12);
});

test("reduzir posições ocupadas é bloqueado e ampliar preserva os lotes", () => {
  let state = createSimulation(telemetryScenarios["Operação normal"]);
  state = simulationReducer(state, identify);
  state = simulationReducer(state, store);
  state.rack[11] = state.rack[0];
  assert.equal(
    simulationReducer(state, { type: "resize-rack", capacity: 8 }),
    state,
  );
  const larger = simulationReducer(state, {
    type: "resize-rack",
    capacity: 16,
  });
  assert.equal(larger.rack.length, 16);
  assert.deepEqual(larger.rack[11], state.rack[11]);
  assert.equal(
    simulationReducer(state, { type: "resize-rack", capacity: 7 }),
    state,
  );
});

test("OEE usa tempos, ciclo e contadores; rejeita parâmetros impossíveis", () => {
  const state = createSimulation(telemetryScenarios["Operação normal"]);
  const inputs = {
    plannedSeconds: 1000,
    stoppedSeconds: 100,
    idealCycleSeconds: 5,
  };
  const next = simulationReducer(state, { type: "oee", inputs });
  const m = next.telemetry.metricasExpedicao;
  assert.equal(m.disponibilidadePercentual, 90);
  assert.equal(m.performancePercentual, ((142 * 5) / 900) * 100);
  assert.ok(Math.abs(m.oeePercentual - 69) < 0.00001);
  assert.ok(validateOee({ ...inputs, stoppedSeconds: 1001 }));
  assert.ok(validateOee({ ...inputs, idealCycleSeconds: 0 }));
  assert.ok(validateOee({ ...inputs, plannedSeconds: Infinity }));
  assert.equal(
    simulationReducer(state, {
      type: "oee",
      inputs: { ...inputs, stoppedSeconds: 1001 },
    }),
    state,
  );
});

test("persistência restaura ordens, rack, fila, eventos e premissas com execução pausada", () => {
  let state = createSimulation(telemetryScenarios["Operação normal"]);
  state = simulationReducer(state, { type: "add-order", draft, timestamp });
  state = simulationReducer(state, identify);
  state = simulationReducer(state, piece);
  state = simulationReducer(state, store);
  state = simulationReducer(state, { type: "toggle" });
  const saved = restoreSimulation(
    serializeSimulation(state),
    telemetryScenarios["Operação normal"],
  );
  assert.equal(saved.restored, true);
  assert.equal(saved.state.running, false);
  assert.deepEqual(saved.state.rack, state.rack);
  assert.deepEqual(saved.state.queue, state.queue);
  assert.deepEqual(saved.state.movements, state.movements);
  assert.equal(
    saved.state.telemetry.dadosExpedicao.ordens.at(-1)!.codigo,
    draft.codigo,
  );
});

test("sessões inválidas ou versões antigas voltam ao mock sem quebrar a aplicação", () => {
  const fallback = telemetryScenarios["Operação normal"];
  for (const invalid of [
    "{",
    JSON.stringify({ version: 2 }),
    JSON.stringify({ version: 3, state: {} }),
  ]) {
    const result = restoreSimulation(invalid, fallback);
    assert.equal(result.invalid, true);
    assert.equal(result.restored, false);
    assert.equal(result.state.rack.length, 12);
  }
  const state = createSimulation(fallback);
  state.telemetry.dadosExpedicao.palete.pecas = 999;
  assert.equal(
    restoreSimulation(serializeSimulation(state), fallback).invalid,
    true,
  );
});
