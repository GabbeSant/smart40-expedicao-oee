import test from "node:test";
import assert from "node:assert/strict";
import {
  createSimulation,
  simulationReducer,
  getAlerts,
  toCsv,
} from "../src/domain/expedition.ts";
import { telemetryScenarios } from "../src/mocks/telemetryMock.ts";

const timestamp = "2026-10-16T14:00:00.000Z";

test("todos os cenários fecham contadores, histórico, qualidade e OEE", () => {
  for (const telemetry of Object.values(telemetryScenarios)) {
    const m = telemetry.metricasExpedicao;
    assert.equal(
      m.pecasAprovadasCount + m.pecasRejeitadasCount,
      m.pecasProcessadasTotal,
    );
    assert.equal(
      m.historico!.reduce((n, h) => n + h.aprovadas, 0),
      m.pecasAprovadasCount,
    );
    assert.equal(
      m.historico!.reduce((n, h) => n + h.rejeitadas, 0),
      m.pecasRejeitadasCount,
    );
    assert.equal(
      telemetry.dadosExpedicao.ordens.reduce(
        (n, order) => n + order.produzido,
        0,
      ),
      m.pecasAprovadasCount,
    );
    assert.equal(
      m.oeePercentual,
      (m.disponibilidadePercentual *
        m.performancePercentual *
        m.qualidadePercentual) /
        10000,
    );
    assert.ok(Number.isFinite(m.oeePercentual));
  }
});

test("uma peça atualiza indicadores, ordem, palete e histórico sem alterar o cenário original", () => {
  const initial = createSimulation(telemetryScenarios["Operação normal"]);
  const next = simulationReducer(initial, { type: "piece", timestamp });
  assert.equal(initial.telemetry.metricasExpedicao.pecasProcessadasTotal, 142);
  assert.equal(next.telemetry.metricasExpedicao.pecasProcessadasTotal, 143);
  assert.equal(next.telemetry.dadosExpedicao.ordens[0].produzido, 99);
  assert.equal(next.telemetry.dadosExpedicao.palete.pecas, 38);
  assert.equal(
    next.telemetry.metricasExpedicao.historico!.at(-1)!.aprovadas,
    26,
  );
  assert.equal(next.telemetry.timestamp, timestamp);
});

test("refugo não entra na ordem ou no palete e preserva a soma total", () => {
  let state = createSimulation(
    telemetryScenarios["Refugo elevado"],
    "Refugo elevado",
  );
  for (let i = 0; i < 4; i++)
    state = simulationReducer(state, { type: "piece", timestamp });
  assert.equal(state.telemetry.metricasExpedicao.pecasProcessadasTotal, 146);
  assert.equal(state.telemetry.metricasExpedicao.pecasRejeitadasCount, 33);
  assert.equal(state.telemetry.metricasExpedicao.pecasAprovadasCount, 113);
  assert.equal(state.telemetry.dadosExpedicao.palete.pecas, 40);
  assert.equal(state.telemetry.ultimaPecaLida.statusInspecao, "REJEITADA");
});

test("palete cheio acumula fila e liberação conserva peças e registra destino", () => {
  let state = createSimulation(telemetryScenarios["Fila cheia"], "Fila cheia");
  state = simulationReducer(state, { type: "piece", timestamp });
  assert.equal(state.telemetry.metricasExpedicao.tamanhoFilaSaida, 26);
  state = simulationReducer(state, { type: "release", timestamp });
  assert.equal(state.shipments[0].id, "PAL-023");
  assert.equal(state.shipments[0].pieces, 50);
  assert.equal(state.shipments[0].destination, "Centro de Distribuição SP");
  assert.equal(state.telemetry.dadosExpedicao.palete.codigo, "PAL-024");
  assert.equal(state.telemetry.dadosExpedicao.palete.pecas, 26);
  assert.equal(state.telemetry.metricasExpedicao.tamanhoFilaSaida, 0);
});

test("fila acima de um palete não perde peças na liberação", () => {
  const initial = createSimulation(telemetryScenarios["Fila cheia"]);
  initial.telemetry.metricasExpedicao.tamanhoFilaSaida = 73;
  const state = simulationReducer(initial, { type: "release", timestamp });
  assert.equal(state.telemetry.dadosExpedicao.palete.pecas, 50);
  assert.equal(state.telemetry.metricasExpedicao.tamanhoFilaSaida, 23);
});

test("parada e palete vazio não produzem ou registram saída", () => {
  const stopped = createSimulation(telemetryScenarios["Produção parada"]);
  assert.equal(
    simulationReducer(stopped, { type: "piece", timestamp }),
    stopped,
  );
  assert.equal(
    simulationReducer(stopped, { type: "release", timestamp }),
    stopped,
  );
  const empty = createSimulation(telemetryScenarios["Início de turno"]);
  assert.equal(simulationReducer(empty, { type: "release", timestamp }), empty);
  const firstPiece = simulationReducer(empty, { type: "piece", timestamp });
  assert.equal(firstPiece.telemetry.metricasExpedicao.qualidadePercentual, 100);
  assert.equal(firstPiece.telemetry.metricasExpedicao.oeePercentual, 91.2);
});

test("concluir a ordem ativa inicia a próxima e respeita a meta", () => {
  const initial = createSimulation(telemetryScenarios["Operação normal"]);
  initial.telemetry.dadosExpedicao.ordens[0].produzido = 159;
  const next = simulationReducer(initial, { type: "piece", timestamp });
  assert.equal(next.telemetry.dadosExpedicao.ordens[0].produzido, 160);
  assert.equal(next.telemetry.dadosExpedicao.ordens[0].status, "FINALIZADA");
  assert.equal(next.telemetry.dadosExpedicao.ordens[1].status, "ATIVA");
});

test("trocar cenário reinicia a demonstração e isola alterações dos modelos", () => {
  let state = createSimulation(telemetryScenarios["Operação normal"]);
  state = simulationReducer(state, { type: "toggle" });
  state = simulationReducer(state, { type: "release", timestamp });
  state = simulationReducer(state, {
    type: "scenario",
    name: "Fila cheia",
    telemetry: telemetryScenarios["Fila cheia"],
  });
  assert.equal(state.running, false);
  assert.equal(state.shipments.length, 0);
  assert.equal(state.steps, 0);
  assert.equal(state.telemetry.dadosExpedicao.palete.pecas, 50);
  state.telemetry.dadosExpedicao.palete.pecas = 0;
  assert.equal(
    telemetryScenarios["Fila cheia"].dadosExpedicao.palete.pecas,
    50,
  );
});

test("diagnóstico identifica refugo, fila, eficiência e falta de amostra", () => {
  assert.ok(
    getAlerts(telemetryScenarios["Refugo elevado"]).some(
      (a) => a.title === "Refugo acima de 5%",
    ),
  );
  assert.ok(
    getAlerts(telemetryScenarios["Fila cheia"]).some(
      (a) => a.title === "Palete completo",
    ),
  );
  assert.ok(
    getAlerts(telemetryScenarios["OEE baixo"]).some(
      (a) => a.title === "OEE abaixo da referência",
    ),
  );
  assert.ok(
    getAlerts(telemetryScenarios["Início de turno"]).some(
      (a) => a.title === "Aguardando primeira amostra",
    ),
  );
});

test("CSV preserva acentos, separadores, aspas e neutraliza fórmulas", () => {
  const csv = toCsv([
    ["Expedição", 'Produto; "A"', "=1+1"],
    [142, "linha\nnova", "normal"],
  ]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"Produto; ""A"""'));
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes("\r\n"));
});
