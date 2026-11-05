import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { once } from 'node:events';
import { WebSocketServer } from 'ws';
import { createBrokerBridge } from '../node-red/brokerBridge.mjs';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
test('ponte WSS: fila persistida durante queda, retomada, deduplicação pendente e bloqueio de comandos', { timeout: 10000 }, async t => {
  const reservation = net.createServer().listen(0, '127.0.0.1'); await once(reservation, 'listening');
  const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
  let saved = null;
  const options = { url: `ws://127.0.0.1:${port}`, token: 'unidade1-agente', // Formato ilustrativo do PDF, somente no teste local.
    reconnectBaseMs: 25, reconnectMaxMs: 50, storage: { load: () => saved, save: value => { saved = value; } } };
  const offline = createBrokerBridge(options);
  offline.publish({ eventId: 'one', type: 'piece.processed' });
  offline.publish({ eventId: 'one', type: 'piece.processed' });
  offline.publish({ eventId: 'two', type: 'station.state' });
  assert.equal(offline.status().pending, 2); offline.close();
  assert.ok(!saved.includes(options.token));
  const broker = new WebSocketServer({ port, host: '127.0.0.1' }); await once(broker, 'listening');
  const received = [];
  broker.on('connection', (socket, req) => {
    assert.equal(new URL(req.url, 'http://localhost').searchParams.get('token'), options.token);
    socket.send(JSON.stringify({ acao: 'RESET' }));
    socket.on('message', raw => received.push(JSON.parse(raw.toString())));
  });
  const resumed = createBrokerBridge(options);
  t.after(async () => { resumed.close(); for (const socket of broker.clients) socket.terminate(); await new Promise(resolve => broker.close(resolve)); });
  for (let i = 0; i < 100 && received.length !== 2; i++) await delay(20);
  assert.deepEqual(received.map(e => e.eventId), ['one', 'two']);
  assert.equal(resumed.status().pending, 0);
  assert.equal(resumed.status().ignoredCommands, 1);
  assert.throws(() => resumed.publish({ eventId: 'command', type: 'station.state', acao: 'START' }));
  assert.throws(() => createBrokerBridge({ ...options, url: 'ws://external.example' }));
  assert.throws(() => createBrokerBridge({ ...options, url: 'wss://external.example?token=leaked' }));
});
