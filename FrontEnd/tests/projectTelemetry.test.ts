import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptProjectTelemetry, createExpeditionProcessor, attachExpeditionToShell,
  PROJECT_TELEMETRY_EVENT, refreshProductionOrders, dispatchSmart40Telemetry,
  EXPEDITION_TELEMETRY_EVENT, EXPEDITION_DIAGNOSTIC_EVENT } from '../src/processing/index.ts';
import { parseProductionOrdersPayload } from '../src/integration/productionOrdersApi.ts';

const at = '2026-11-04T15:30:00Z';
const options = { unitId: 'SP', assetId: 'EXP', origin: 'medido' as const, quality: 'GOOD' as const };
const snapshot = { timestamp: at, estacoes: { expedicao: { status: 'OPERANDO', magazine: 7 } },
  pedidoAtual: { trackingCode: 'OP1', status: 'EM_PRODUCAO' }, esteira: { pecaAtual: null, motorLigado: true } };

test('agente dos PDFs: estado é adaptado; magazine/pedido não inventam peças, inspeção ou OEE', () => {
  const result = adaptProjectTelemetry(snapshot, options);
  assert.equal(result.events.length, 1); assert.equal(result.events[0].type, 'station.state');
  assert.ok(result.missing.some(m => m.includes('contadores')));
  const processor = createExpeditionProcessor({ ...options, startedAt: at, now: () => Date.parse(at) });
  processor.ingest(result.events[0]);
  assert.equal(processor.snapshot().station, 'RUNNING'); assert.equal(processor.snapshot().totalProduced, 0);
  assert.equal(processor.snapshot().oee, null); assert.equal(processor.snapshot().oeeSimplified, null);
  assert.throws(() => adaptProjectTelemetry({ ...snapshot, acao: 'RESET' }, options));
});

test('barramento smart40:telemetria funciona com snapshots legados e limpa listeners ao desmontar', () => {
  const target = new EventTarget();
  let diagnostics = 0;
  target.addEventListener(EXPEDITION_DIAGNOSTIC_EVENT, () => { diagnostics++; });
  const processor = createExpeditionProcessor({ ...options, startedAt: at, now: () => Date.parse(at) });
  const binding = attachExpeditionToShell({ target, processor, refreshMs: 0, projectTelemetry: options });
  target.dispatchEvent(new CustomEvent(PROJECT_TELEMETRY_EVENT, { detail: snapshot }));
  assert.equal(processor.snapshot().station, 'RUNNING');
  target.dispatchEvent(new CustomEvent(PROJECT_TELEMETRY_EVENT, { detail: snapshot }));
  assert.equal(diagnostics, 1); // A mesma lacuna não gera notificações a cada 500 ms.
  binding.dispose();
  target.dispatchEvent(new CustomEvent(PROJECT_TELEMETRY_EVENT, { detail: { ...snapshot,
    timestamp: '2026-11-04T15:30:01Z', estacoes: { expedicao: { status: 'EMERGENCIA' } } } }));
  assert.equal(processor.snapshot().station, 'RUNNING');
});

test('roteador do Shell separa eventos G5 dos snapshots esperados pela IHM e pelo robô', () => {
  const target = new EventTarget(); let globalEvents = 0, productionEvents = 0;
  target.addEventListener(PROJECT_TELEMETRY_EVENT, () => { globalEvents++; });
  target.addEventListener(EXPEDITION_TELEMETRY_EVENT, () => { productionEvents++; });
  dispatchSmart40Telemetry(target, snapshot);
  dispatchSmart40Telemetry(target, adaptProjectTelemetry(snapshot, options).events[0]);
  assert.equal(globalEvents, 1); assert.equal(productionEvents, 1);
  assert.throws(() => dispatchSmart40Telemetry(target, { timestamp: at, acao: 'START' }));
});

test('contadores globais só convertem com época explícita; snapshots não somam acumulados novamente', () => {
  const input = { timestamp: at, metricas: { aprovadas: 95, rejeitadas: 5 } };
  assert.equal(adaptProjectTelemetry(input, options).events.length, 0);
  const processor = createExpeditionProcessor({ ...options, productionMode: 'counters', startedAt: at,
    now: () => Date.parse(at) + 1000 });
  const convert = (v: unknown) => adaptProjectTelemetry(v, { ...options, counterEpoch: 'shift-1' }).events;
  for (const event of convert(input)) processor.ingest(event);
  for (const event of convert({ ...input, timestamp: '2026-11-04T15:30:01Z', metricas: { aprovadas: 97, rejeitadas: 6 } })) {
    processor.ingest(event); processor.ingest(event);
  }
  assert.equal(processor.snapshot().totalProduced, 3); assert.equal(processor.snapshot().approved, 2);
  assert.ok(Math.abs(processor.snapshot().oeeSimplified! - 200 / 3) < 1e-9);
  assert.equal(processor.snapshot().oee, null);
  assert.throws(() => adaptProjectTelemetry({ ...input, metricas: { aprovadas: 1 } }, options));
  assert.throws(() => adaptProjectTelemetry({ timestamp: at, type: 'expedition.metrics', data: { criadas: 1, concluidas: 7 } }, options));
});

test('API pedidos Caminho A aceita status_id sem confundir cadastros ausentes ou tipos inválidos', async () => {
  assert.throws(() => parseProductionOrdersPayload({ productionOrders: [{ id: 1, status_id: '2' }] }));
  const processor = createExpeditionProcessor({ ...options, startedAt: at });
  await refreshProductionOrders(processor, { fetchImpl: async () => new Response(JSON.stringify({ productionOrders: [{ id: 1, status_id: 2 }] })) });
  assert.equal(processor.snapshot().orders[0].sourceStatusId, 2); assert.equal(processor.snapshot().orders[0].product, null);
  await assert.rejects(refreshProductionOrders(processor, { fetchImpl: async () => new Response(JSON.stringify({
    productionOrders: [{ id: 1, status_id: 2, productionOrderStatusId: 3 }],
  })) }));
  assert.equal(processor.snapshot().orders[0].sourceStatusId, 2);
});
