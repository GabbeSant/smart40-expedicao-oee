import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createExpeditionProcessor, calculatePpm, attachExpeditionToShell,
  EXPEDITION_TELEMETRY_EVENT, EXPEDITION_METRICS_EVENT, EXPEDITION_CONNECTION_EVENT,
  refreshProductionOrders, adaptSmart40Counters, calculateOee,
} from '../src/processing/index.ts';
import type { ProductionEvent, ProcessorOptions, ExpeditionSnapshot } from '../src/processing/index.ts';

const start = '2026-11-04T15:00:00.000Z';
const end = Date.parse(start) + 120000;
const options: ProcessorOptions = { unitId: 'SP', assetId: 'EXP', origin: 'medido', startedAt: start, now: () => end };
const event = (seq: number, data: Record<string, unknown> = {}) => ({
  schemaVersion: '1.0', unitId: 'SP', assetId: 'EXP', origin: 'medido', quality: 'GOOD',
  streamId: 'boot-1', seq, eventId: `event-${seq}`, timestamp: new Date(Date.parse(start) + seq * 1000).toISOString(),
  type: 'piece.processed', pieceId: `piece-${seq}`, productionOrderId: '42', inspection: 'APPROVED', ...data,
});
const applied = (p: ReturnType<typeof createExpeditionProcessor>, data: unknown) => assert.deepEqual(p.ingest(data), { status: 'applied' });

test('produção, OP, refugo e OEE D×P×Q usam a mesma sessão; sem insumos retorna null', () => {
  const p = createExpeditionProcessor(options);
  assert.equal(p.snapshot().oee, null);
  assert.equal(p.snapshot().quality, null);
  applied(p, event(1)); applied(p, event(2)); applied(p, event(3, { inspection: 'REJECTED' }));
  applied(p, event(4, { type: 'analysis.window', startedAt: start, plannedSeconds: 100, operatingSeconds: 80, idealCycleSeconds: 20 }));
  const s = p.snapshot();
  assert.equal(s.totalProduced, 3); assert.equal(s.approved, 2); assert.equal(s.rejected, 1);
  assert.equal(s.availability, 80); assert.equal(s.performance, 75);
  assert.ok(Math.abs(s.oee! - 40) < 1e-9);
  assert.equal(s.orders[0].id, '42'); assert.equal(s.orders[0].totalProduced, 3);
  assert.equal(s.history[0].approved, 2); assert.equal(s.history[0].rejected, 1);
  assert.equal(s.queue.length, 2);
});

test('QoS1, mesma peça com outro evento, ordem/qualidade/escopo inválidos não duplicam produção', () => {
  const p = createExpeditionProcessor(options);
  applied(p, event(1));
  assert.equal(p.ingest(event(1)).status, 'duplicate');
  assert.equal(p.ingest(event(2, { pieceId: 'piece-1' })).status, 'duplicate');
  assert.equal(p.ingest(event(0)).status, 'rejected');
  for (const data of [ { quality: 'BAD' }, { quality: 'UNCERTAIN' }, { assetId: 'OTHER' },
    { origin: 'simulado' }, { pieceId: '' }, { inspection: 'OK' }, { inspection: ['APPROVED'] }, { timestamp: 'ontem' },
    { timestamp: '2026-02-31T15:00:00Z' }, { type: 'station.state', status: ['RUNNING'] },
    { timestamp: '2026-11-04T18:00:00Z' }, { seq: -1 }, { productionOrderId: undefined } ]) {
    assert.equal(p.ingest(event(3, data)).status, 'rejected');
  }
  assert.equal(p.ingest('{').status, 'rejected');
  assert.equal(p.snapshot().totalProduced, 1);
});

test('PPM em janela móvel (t-60s,t], exclui futuro e decai quando para de chegar produção', () => {
  const samples = [0, 1, 60000, 60001].map(ms => ({ timestamp: new Date(Date.parse(start) + ms).toISOString(), count: 1 }));
  assert.equal(calculatePpm(samples, Date.parse(start) + 60000), 2);
  assert.equal(calculatePpm(samples, Date.parse(start) + 180000), 0);
  const p = createExpeditionProcessor(options);
  applied(p, event(90)); assert.equal(p.snapshot(end).ppm, 1); assert.equal(p.snapshot(end + 60000).ppm, 0);
});

test('contadores: baseline, delta, repetição, regressão e nova época; proíbe mistura de fontes', () => {
  const p = createExpeditionProcessor({ ...options, productionMode: 'counters' });
  const counters = (seq: number, total: number, approved: number, epoch = 'shift-1') => event(seq, {
    type: 'production.counters', counterEpoch: epoch, totalProduced: total, approved, rejected: total - approved,
  });
  applied(p, counters(1, 100, 95)); assert.equal(p.snapshot().totalProduced, 0);
  applied(p, counters(2, 103, 97)); assert.equal(p.snapshot().totalProduced, 3);
  applied(p, counters(3, 103, 97)); assert.equal(p.snapshot().totalProduced, 3);
  assert.equal(p.ingest(counters(4, 2, 2)).status, 'rejected');
  applied(p, counters(5, 0, 0, 'shift-2')); applied(p, counters(6, 1, 1, 'shift-2'));
  assert.equal(p.snapshot().totalProduced, 4); assert.equal(p.snapshot().rejected, 1);
  assert.equal(p.snapshot().ppmExact, false);
  assert.equal(p.ingest(event(7)).status, 'rejected');
  const pieces = createExpeditionProcessor(options);
  assert.equal(pieces.ingest(counters(8, 1, 1)).status, 'rejected');
});

test('expedição: recebimento → identificação → posição exclusiva → saída; rejeitadas segregadas', () => {
  const p = createExpeditionProcessor(options);
  applied(p, event(1)); applied(p, event(2)); applied(p, event(3, { inspection: 'REJECTED' }));
  const move = (seq: number, pieceId: string, stage: string, position?: number) => event(seq, { type: 'piece.moved', pieceId, stage, ...(position ? { position } : {}) });
  assert.equal(p.ingest(move(4, 'piece-1', 'STORED', 1)).status, 'rejected');
  assert.equal(p.ingest(move(5, 'piece-3', 'IDENTIFIED')).status, 'rejected');
  applied(p, move(6, 'piece-1', 'IDENTIFIED')); applied(p, move(7, 'piece-1', 'STORED', 1));
  applied(p, move(8, 'piece-2', 'IDENTIFIED'));
  assert.equal(p.ingest(move(9, 'piece-2', 'STORED', 1)).status, 'rejected');
  assert.equal(p.ingest(move(10, 'piece-2', 'STORED', 13)).status, 'rejected');
  assert.equal(p.ingest(move(11, 'piece-1', 'DISPATCHED', 2)).status, 'rejected');
  applied(p, move(12, 'piece-1', 'DISPATCHED', 1)); applied(p, move(13, 'piece-2', 'STORED', 1));
  assert.equal(p.snapshot().rack[0], 'piece-2');
  assert.equal(p.snapshot().pieces.find(v => v.pieceId === 'piece-1')?.stage, 'DISPATCHED');
  assert.equal(p.snapshot().totalProduced, 3);
});

test('checkpoint mantém deduplicação após reload; falha de gravação não confirma evento', () => {
  let saved: string | null = null;
  const storage = { load: () => saved, save: (s: string) => { saved = s; } };
  const first = createExpeditionProcessor({ ...options, storage });
  applied(first, event(1));
  const reloaded = createExpeditionProcessor({ ...options, storage });
  assert.equal(reloaded.ingest(event(1)).status, 'duplicate');
  assert.equal(reloaded.snapshot().totalProduced, 1);
  const failing = createExpeditionProcessor({ ...options, storage: { load: () => null, save: () => { throw new Error('disk full'); } } });
  assert.throws(() => failing.ingest(event(1)), /disk full/); assert.equal(failing.snapshot().totalProduced, 0);
  assert.throws(() => createExpeditionProcessor({ ...options, storage: { ...storage, load: () => '{bad' } }));
  assert.throws(() => createExpeditionProcessor({ ...options, assetId: 'wrong', storage }), /incompatível/);
});

test('reset de métricas preserva identidades e posições; replay antigo não reconta a peça', () => {
  const p = createExpeditionProcessor(options);
  applied(p, event(1));
  applied(p, event(2, { type: 'piece.moved', pieceId: 'piece-1', stage: 'IDENTIFIED' }));
  applied(p, event(3, { type: 'piece.moved', pieceId: 'piece-1', stage: 'STORED', position: 1 }));
  p.resetSession(new Date(Date.parse(start) + 4000).toISOString());
  assert.equal(p.snapshot().totalProduced, 0); assert.equal(p.snapshot().rack[0], 'piece-1');
  assert.equal(p.ingest(event(1)).status, 'duplicate');
  assert.equal(p.ingest(event(5, { pieceId: 'piece-1' })).status, 'duplicate');
  assert.equal(p.ingest(event(2, { streamId: 'other', eventId: 'old' })).status, 'rejected');
  applied(p, event(6)); assert.equal(p.snapshot().totalProduced, 1); assert.equal(p.snapshot().oee, null);
});

test('conexão fica stale, depois disconnected; reconecta sem perder dados; snapshot é cópia', () => {
  let clock = Date.parse(start);
  const p = createExpeditionProcessor({ ...options, now: () => clock, staleAfterMs: 5000 });
  assert.equal(p.snapshot().connection, 'DISCONNECTED');
  p.setConnection('CONNECTED'); assert.equal(p.snapshot().connection, 'CONNECTED');
  clock += 6000; assert.equal(p.snapshot().connection, 'STALE');
  applied(p, event(1)); assert.equal(p.snapshot().connection, 'CONNECTED');
  p.setConnection('DISCONNECTED'); assert.equal(p.snapshot().connection, 'DISCONNECTED');
  p.setConnection('CONNECTED'); assert.equal(p.ingest(event(1)).status, 'duplicate');
  const snapshot = p.snapshot(); snapshot.pieces.length = 0; assert.equal(p.snapshot().pieces.length, 1);
});

test('App Shell recebe resultados, publica diagnóstico e remove listeners no dispose', () => {
  const target = new EventTarget(); const processor = createExpeditionProcessor(options);
  let snapshot: ExpeditionSnapshot | null = null;
  target.addEventListener(EXPEDITION_METRICS_EVENT, e => { snapshot = (e as CustomEvent).detail; });
  const binding = attachExpeditionToShell({ target, processor, refreshMs: 0 });
  target.dispatchEvent(new CustomEvent(EXPEDITION_CONNECTION_EVENT, { detail: 'CONNECTED' }));
  target.dispatchEvent(new CustomEvent(EXPEDITION_TELEMETRY_EVENT, { detail: event(1) }));
  assert.equal((snapshot as unknown as ExpeditionSnapshot).totalProduced, 1);
  target.dispatchEvent(new CustomEvent(EXPEDITION_TELEMETRY_EVENT, { detail: event(1) }));
  assert.equal((snapshot as unknown as ExpeditionSnapshot).totalProduced, 1);
  binding.dispose(); binding.dispose();
  target.dispatchEvent(new CustomEvent(EXPEDITION_TELEMETRY_EVENT, { detail: event(2) }));
  assert.equal(processor.snapshot().totalProduced, 1);
});

test('API real: catálogo sem defaults; indisponibilidade preserva catálogo e associação', async () => {
  const processor = createExpeditionProcessor(options);
  await refreshProductionOrders(processor, { fetchImpl: async () => new Response(JSON.stringify({ productionOrders: [
    { id: 42, code: 'OP-42', productName: 'Bloco', productionOrderStatusId: 3 },
  ] }), { status: 200, headers: { 'Content-Type': 'application/json' } }) });
  applied(processor, event(1));
  assert.equal(processor.snapshot().orders[0].code, 'OP-42');
  assert.equal(processor.snapshot().orders[0].plannedQuantity, null);
  assert.equal(processor.snapshot().orders[0].sourceStatusId, 3);
  await assert.rejects(refreshProductionOrders(processor, { fetchImpl: async () => { throw new Error('offline'); } }));
  assert.equal(processor.snapshot().orders[0].totalProduced, 1);
});

test('snapshot SMART40 migra apenas contadores, sem recontar última peça', () => {
  const metadata = { ...event(1), counterEpoch: 'epoch' } as ProductionEvent & { counterEpoch: string };
  const converted = adaptSmart40Counters({ metricasExpedicao: {
    pecasProcessadasTotal: 10, pecasAprovadasCount: 9, pecasRejeitadasCount: 1,
  } }, metadata);
  assert.equal(converted.type, 'production.counters');
  const processor = createExpeditionProcessor({ ...options, productionMode: 'counters' });
  applied(processor, converted); assert.equal(processor.snapshot().totalProduced, 0);
});

test('OEE não usa tempos antigos com peças novas, nem limita performance acima de 100%', () => {
  const p = createExpeditionProcessor(options);
  applied(p, event(1));
  applied(p, event(2, { type: 'analysis.window', startedAt: start, plannedSeconds: 10, operatingSeconds: 5, idealCycleSeconds: 10 }));
  assert.equal(p.snapshot().performance, 200);
  assert.ok(p.snapshot().metricWarnings.some(w => w.includes('100%')));
  applied(p, event(3)); assert.equal(p.snapshot().oee, null);
  assert.equal(p.ingest(event(4, { type: 'analysis.window', startedAt: new Date(Date.parse(start) + 1000).toISOString(),
    plannedSeconds: 10, operatingSeconds: 5, idealCycleSeconds: 10 })).status, 'rejected');
  assert.throws(() => calculateOee(1, 2, null));
  assert.throws(() => calculateOee(1, 1, { plannedSeconds: 1, operatingSeconds: 2, idealCycleSeconds: 1 }));
});

test('reset de contadores preserva baseline e impede retorno a uma época encerrada', () => {
  const p = createExpeditionProcessor({ ...options, productionMode: 'counters' });
  const counter = (seq: number, total: number, counterEpoch = 'first') => event(seq, {
    type: 'production.counters', totalProduced: total, approved: total, rejected: 0, counterEpoch,
  });
  applied(p, counter(1, 100)); applied(p, counter(2, 102));
  p.resetSession(new Date(Date.parse(start) + 2000).toISOString());
  applied(p, counter(3, 103)); assert.equal(p.snapshot().totalProduced, 1);
  applied(p, counter(4, 0, 'second'));
  assert.equal(p.ingest(counter(5, 105)).status, 'rejected');
  applied(p, counter(6, 1, 'second')); assert.equal(p.snapshot().totalProduced, 2);
});

test('estado antigo de outro stream não desfaz a parada da estação', () => {
  const p = createExpeditionProcessor(options);
  applied(p, event(10, { type: 'station.state', status: 'STOPPED' }));
  assert.equal(p.ingest(event(9, { type: 'station.state', status: 'RUNNING', streamId: 'old-boot' })).status, 'rejected');
  assert.equal(p.snapshot().station, 'STOPPED');
});
