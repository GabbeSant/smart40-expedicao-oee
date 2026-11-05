import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectPlant, publishObservation } from '../plant/inspect.mjs';

test('inspeção usa somente GET e não fabrica contagens com flags e posição de armazenamento', async () => {
  const readings = { NumeroOP_expedicao: 1255, posicaoGuardado_expedicao: 9 };
  const methods = [];
  const report = await inspectPlant({ fetchImpl: async (url, options) => {
    methods.push(options.method);
    const path = new URL(url).pathname;
    let body;
    if (path === '/settings') body = { version: '3.0.2' };
    else if (path === '/flows') body = { flows: [
      { id: 'endpoint', type: 's7 endpoint', address: '192.168.150.40', port: '102', rack: '0', slot: '1', cycletime: '200', vartable: [] },
      { id: 'input', type: 's7 in', endpoint: 'endpoint', mode: 'all' },
    ] };
    else if (path === '/api/productionOrders') body = { productionOrders: [{ id: 710, code: 'OP1255', trackingCode: 'OP1255' }] };
    else if (path.startsWith('/context/global/')) {
      const key = decodeURIComponent(path.split('/').at(-1));
      body = key in readings ? { format: 'number', msg: String(readings[key]) } : { format: 'boolean', msg: 'false' };
    } else throw new Error('Rota inesperada');
    return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
  }, statusReader: async () => ({ online: true, text: 'online' }) });
  assert.ok(methods.every(method => method === 'GET'));
  assert.equal(report.association.productionOrderId, '710'); assert.equal(report.readings.posicaoGuardado_expedicao, 9);
  assert.equal(report.type, 'n2.observation'); assert.equal(report.sourceTimestamp, null);
  assert.equal(report.quality.status, 'UNCERTAIN'); assert.ok(!('totalProduced' in report));
  await assert.rejects(publishObservation(report, 'mqtt://127.0.0.1:1', 'smart40/UNIT/EXP/telemetry'));
});
