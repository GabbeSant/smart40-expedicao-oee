import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { PGlite } from '@electric-sql/pglite';
import { createMesRepository } from '../api-mes/repository.mjs';
import { createMesHttpServer } from '../api-mes/http.mjs';

test('API MES: cinco eventos, FK, transação, rotas de consulta, isolamento e idempotência em PostgreSQL embarcado', { timeout: 30000 }, async t => {
  const pg = await PGlite.create();
  const db = {
    query: (sql, params) => params ? pg.query(sql, params) : pg.exec(sql).then(results => results.at(-1)),
    transaction: operation => pg.transaction(tx => operation({ query: (sql, params) => tx.query(sql, params) })),
  };
  const repository = createMesRepository(db);
  await repository.initialize();
  const reader = 'unit-a-reader-unique-test-token';
  const writer = 'unit-a-writer-unique-test-token';
  const other = 'unit-b-reader-unique-test-token';
  const server = createMesHttpServer({ repository, origins: ['https://shell.example'], principals: [
    { token: reader, unitId: 'UNIT-A', role: 'read' }, { token: writer, unitId: 'UNIT-A', role: 'write' },
    { token: other, unitId: 'UNIT-B', role: 'read' },
  ] });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await pg.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (route, token = reader, body, headers = {}) => fetch(base + route, {
    method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = (componentId = 1, extra = {}) => ({ componentId, trackingCode: 'OP1',
    timeStamp: '2026-11-04T10:00:00.000Z', ...extra });
  assert.equal((await fetch(base + '/health')).status, 200);
  assert.equal((await request('/api/Events/metrics', 'invalid')).status, 401);
  assert.equal((await request('/api/Events/metrics', reader, undefined, { Origin: 'https://wrong.example' })).status, 403);
  assert.equal((await request('/api/Events/metrics', reader, undefined, { Origin: 'https://shell.example' })).headers.get('Access-Control-Allow-Origin'), 'https://shell.example');
  const current = await request('/api/Events/order/current'); assert.equal(current.status, 200); assert.equal(await current.json(), null);
  assert.equal((await request('/api/Events/order/movedin', reader, data())).status, 403);
  assert.equal((await request('/api/Events/order/movedin', writer, data(1, { unitId: 'UNIT-B' }))).status, 403);

  for (const [path, body] of [
    ['/api/Events/order/movedin', data()],
    ['/api/Events/process/started', data(1, { processCode: '1', timeStamp: '2026-11-04T10:00:05Z' })],
    ['/api/Events/process/finished', data(1, { processCode: '1', timeStamp: '2026-11-04T10:00:30Z' })],
    ['/api/Events/order/movedout', data(1, { timeStamp: '2026-11-04T10:00:35Z' })],
    ['/api/Events/order/completed', data(4, { timeStamp: '2026-11-04T10:05:00Z' })],
  ]) assert.equal((await request(path, writer, body)).status, 201, path);
  assert.deepEqual(await (await request('/api/Events/metrics')).json(), { criadas: 0, emProducao: 0, concluidas: 1, scope: 'orders' });
  assert.deepEqual(await (await request('/api/Events/metrics', other)).json(), { criadas: 0, emProducao: 0, concluidas: 0, scope: 'orders' });
  assert.equal((await request('/api/Events/order/OP1', other)).status, 404);
  assert.equal((await request('/api/Events/order/OP1?unitId=UNIT-A', other)).status, 403);
  const tracking = await (await request('/api/Events/order/OP1')).json();
  assert.equal(tracking.eventos.length, 5); assert.equal(tracking.ordem.status, 'CONCLUIDA');
  const duplicate = await request('/api/Events/order/movedin', writer, data(1, { timeStamp: '2026-11-04T07:00:00-03:00' }));
  assert.equal(duplicate.status, 200); assert.equal((await duplicate.json()).duplicate, true);
  assert.equal((await (await request('/api/Events/order/OP1')).json()).eventos.length, 5);

  assert.equal((await request('/api/Events/order/completed', writer, data(3))).status, 400);
  assert.equal((await request('/api/Events/process/started', writer, data())).status, 400);
  assert.equal((await request('/api/Events/order/movedin', writer, data(8))).status, 400);
  assert.equal((await request('/api/Events/order/movedin', writer, data(1, { timeStamp: '2026-02-31T10:00:00Z' }))).status, 400);
  assert.equal((await request('/api/Events/order/movedin', writer, data(1, { trackingCode: 'OP2', eventId: 'fixed-event' }))).status, 201);
  assert.equal((await request('/api/Events/order/movedin', writer, data(1, { trackingCode: 'OP3', eventId: 'fixed-event' }))).status, 409);
  assert.equal((await request('/api/Events/order/OP3')).status, 404); // Ordem provisória revertida pela transação.
  assert.deepEqual(await (await request('/api/Events/order/current')).json(), { trackingCode: 'OP2', status: 'EM_PRODUCAO' });

  // Uma mensagem atrasada não desfaz conclusão já registrada.
  assert.equal((await request('/api/Events/order/movedout', writer, data(4, { timeStamp: '2026-11-04T10:04:00Z' }))).status, 201);
  assert.equal((await (await request('/api/Events/order/OP1')).json()).ordem.status, 'CONCLUIDA');

  const failing = createMesRepository({ ...db, transaction: operation => pg.transaction(tx => operation({
    query(sql, params) { if (sql.startsWith('UPDATE')) throw new Error('simulated storage failure'); return tx.query(sql, params); },
  })) });
  await assert.rejects(failing.register('UNIT-A', 'moved-in', data(1, { trackingCode: 'ROLLBACK' })));
  await assert.rejects(repository.tracking('UNIT-A', 'ROLLBACK'), error => error.status === 404);
});
