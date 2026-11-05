import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveN2ProductionOrder } from '../src/processing/n2OrderAdapter.ts';

test('OP numérica do CLP resolve por trackingCode, sem confundir com id da API', () => {
  const catalog = [{ id: 710, code: 'OP1255', trackingCode: 'OP1255' }, { id: 1255, code: 'OP999' }];
  assert.deepEqual(resolveN2ProductionOrder(1255, catalog), { status: 'matched', trackingCode: 'OP1255', productionOrderId: '710' });
  assert.equal(resolveN2ProductionOrder(1255, [{ id: 1255, code: 'OP999' }]).status, 'not-found');
});
test('OP ausente, duplicada ou inválida não recebe uma associação inventada', () => {
  assert.equal(resolveN2ProductionOrder(0, []).status, 'no-order');
  assert.equal(resolveN2ProductionOrder(1, [{ id: 2, code: 'OP1' }, { id: 3, code: 'OP1' }]).status, 'ambiguous');
  assert.equal(resolveN2ProductionOrder(1, [{ id: 2, code: 'OP1', trackingCode: 'OP9' }]).status, 'not-found');
  assert.throws(() => resolveN2ProductionOrder('1255', []));
  assert.throws(() => resolveN2ProductionOrder(-1, []));
});
