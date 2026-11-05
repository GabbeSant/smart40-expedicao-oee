import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import tls from 'node:tls';
import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import aedes from 'aedes';
import { connectAsync } from 'mqtt';
import WebSocket, { WebSocketServer } from 'ws';
import { generate } from 'selfsigned';
import { createExpeditionProcessor, attachExpeditionToShell, dispatchSmart40Telemetry,
  EXPEDITION_METRICS_EVENT } from '../../FrontEnd/dist-processing/processing/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label, timeout = 18000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await check()) return; await delay(80); }
  throw new Error(`Timeout: ${label}`);
}
async function freePort() {
  const s = net.createServer(); s.listen(0, '127.0.0.1'); await once(s, 'listening');
  const port = s.address().port; await new Promise(resolve => s.close(resolve)); return port;
}

test('MQTT → Node-RED real → TLS autenticado → nuvem; WebSocket → Shell; restart idempotente', { timeout: 65000 }, async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'smart40-e2e-'));
  const localBroker = aedes(); const cloudBroker = aedes();
  const localServer = net.createServer(localBroker.handle);
  localServer.listen(0, '127.0.0.1'); await once(localServer, 'listening');
  const cert = await generate([{ name: 'commonName', value: 'localhost' }], {
    keySize: 2048, days: 1,
    extensions: [{ name: 'basicConstraints', cA: true }, { name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }] }],
  });
  const caFile = path.join(directory, 'test-ca.pem'); fs.writeFileSync(caFile, cert.cert);
  const brokerHttp = https.createServer({ key: cert.private, cert: cert.cert });
  const wssBroker = new WebSocketServer({ server: brokerHttp });
  const wssEvents = [];
  const agentToken = 'test-unit-agent-secret-with-entropy';
  const shellToken = 'test-unit-shell-secret-with-entropy';
  wssBroker.on('connection', (socket, req) => {
    const token = new URL(req.url, 'https://localhost').searchParams.get('token');
    if (![agentToken, shellToken].includes(token)) return socket.close(4001, 'Token inválido');
    socket.role = token === agentToken ? 'agent' : 'shell';
    if (socket.role === 'agent') socket.send(JSON.stringify({ acao: 'EMERGENCY_STOP' })); // Gateway Grupo 5 ignora comandos.
    socket.on('message', raw => {
      if (socket.role !== 'agent') return;
      const event = JSON.parse(raw.toString()); wssEvents.push(event);
      for (const client of wssBroker.clients) if (client.role === 'shell' && client.readyState === WebSocket.OPEN) client.send(raw.toString());
    });
  });
  brokerHttp.listen(0, '127.0.0.1'); await once(brokerHttp, 'listening');
  const cloudServer = tls.createServer({ key: cert.private, cert: cert.cert }, cloudBroker.handle);
  cloudServer.listen(0, '127.0.0.1'); await once(cloudServer, 'listening');
  let authenticated = false;
  cloudBroker.authenticate = (client, username, password, done) => {
    const valid = username === 'test-user' && password?.toString() === 'test-only-password';
    if (valid) authenticated = true;
    done(null, valid);
  };
  const cloudTelemetry = []; const cloudMetrics = [];
  cloudBroker.on('publish', (packet, client) => {
    if (!client || !packet.topic.startsWith('smart40/')) return;
    const payload = JSON.parse(packet.payload.toString());
    if (packet.topic.endsWith('/telemetry')) cloudTelemetry.push(payload);
    if (packet.topic.endsWith('/metrics')) cloudMetrics.push(payload);
  });
  const port = await freePort();
  const startedAt = new Date(Date.now() - 120000).toISOString();
  const environment = { ...process.env,
    NODE_RED_DATA_DIR: path.join(directory, 'data'), NODE_RED_PORT: String(port), NODE_RED_HOST: '127.0.0.1', NODE_RED_EDITOR: 'false',
    NODE_RED_LOG_LEVEL: 'warn', NODE_RED_LOAD_ENV: 'false', DATA_ORIGIN: 'simulado', UNIT_ID: 'TEST', ASSET_ID: 'EXP',
    PRODUCTION_MODE: 'pieces', SESSION_STARTED_AT: startedAt,
    MQTT_LOCAL_HOST: '127.0.0.1', MQTT_LOCAL_PORT: String(localServer.address().port),
    MQTT_CLOUD_ENABLED: 'true', MQTT_CLOUD_HOST: 'localhost', MQTT_CLOUD_PORT: String(cloudServer.address().port),
    MQTT_CLOUD_USERNAME: 'test-user', MQTT_CLOUD_PASSWORD: 'test-only-password',
    NODE_EXTRA_CA_CERTS: caFile,
    BROKER_URL: `wss://localhost:${brokerHttp.address().port}`, TOKEN_AGENTE: agentToken,
  };
  // O teste não usa a configuração da bancada nem acessa a rede externa.
  delete environment.PRODUCTION_ORDERS_BASE_URL;
  let child; let logs = ''; let ws; let rawWs; let centralWs; let publisher; let binding;
  const start = () => {
    child = spawn(process.execPath, ['integration/node-red/start.mjs'], { cwd: root, env: environment, windowsHide: true });
    child.stdout.on('data', b => { logs += b.toString(); }); child.stderr.on('data', b => { logs += b.toString(); });
  };
  const stop = async () => {
    if (!child || child.exitCode !== null) return;
    const exited = once(child, 'exit'); child.kill(); await exited;
  };
  t.after(async () => {
    binding?.dispose(); ws?.terminate(); rawWs?.terminate(); centralWs?.terminate(); await publisher?.endAsync(true); await stop();
    for (const client of wssBroker.clients) client.terminate();
    await new Promise(resolve => wssBroker.close(resolve)); await new Promise(resolve => brokerHttp.close(resolve));
    await new Promise(resolve => localBroker.close(resolve)); await new Promise(resolve => cloudBroker.close(resolve));
    await new Promise(resolve => localServer.close(resolve)); await new Promise(resolve => cloudServer.close(resolve));
  });
  const health = async () => {
    try { return await (await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(500) })).json(); }
    catch { return null; }
  };
  try {
    start();
    await until(async () => (await health())?.connection === 'CONNECTED', 'broker local conectado');
    await until(() => authenticated, 'TLS e credenciais MQTT da nuvem');
    publisher = await connectAsync(`mqtt://127.0.0.1:${localServer.address().port}`, { reconnectPeriod: 0 });
    ws = new WebSocket(`ws://127.0.0.1:${port}/ws/expedition`); await once(ws, 'open');
    const shellSnapshots = [];
    // Grupo 1 pode consumir o resultado pronto do gateway ou executar a biblioteca localmente.
    const target = new EventTarget();
    const shellProcessor = createExpeditionProcessor({ unitId: 'TEST', assetId: 'EXP', origin: 'simulado', startedAt });
    target.addEventListener(EXPEDITION_METRICS_EVENT, e => shellSnapshots.push(e.detail));
    binding = attachExpeditionToShell({ target, processor: shellProcessor, refreshMs: 0 });
    rawWs = new WebSocket(`ws://127.0.0.1:${port}/ws/telemetry`); await once(rawWs, 'open');
    const rawEvents = [];
    rawWs.on('message', b => rawEvents.push(JSON.parse(b.toString())));
    centralWs = new WebSocket(`wss://localhost:${brokerHttp.address().port}?token=${shellToken}`, { ca: cert.cert });
    await once(centralWs, 'open');
    centralWs.on('message', b => dispatchSmart40Telemetry(target, b.toString()));
    const received = [];
    ws.on('message', b => received.push(JSON.parse(b.toString())));
    let seq = 0;
    const events = [];
    const publish = async fields => {
      const event = { schemaVersion: '1.0', eventId: `e2e:${seq}`, unitId: 'TEST', assetId: 'EXP', origin: 'simulado', quality: 'GOOD',
        streamId: 'test-boot', seq: seq++, timestamp: new Date().toISOString(), ...fields };
      events.push(event);
      await publisher.publishAsync('smart40/TEST/EXP/telemetry', JSON.stringify(event), { qos: 1 });
      return event;
    };
    await publish({ type: 'station.state', status: 'RUNNING' });
    const piece = await publish({ type: 'piece.processed', pieceId: 'one', productionOrderId: '42', inspection: 'APPROVED' });
    await publisher.publishAsync('smart40/TEST/EXP/telemetry', JSON.stringify(piece), { qos: 1 });
    await publish({ type: 'piece.processed', pieceId: 'two', productionOrderId: '42', inspection: 'REJECTED' });
    await publish({ type: 'piece.moved', pieceId: 'one', stage: 'IDENTIFIED' });
    await publish({ type: 'piece.moved', pieceId: 'one', stage: 'STORED', position: 1 });
    await publish({ type: 'piece.moved', pieceId: 'one', stage: 'DISPATCHED', position: 1 });
    await publish({ type: 'analysis.window', startedAt, plannedSeconds: 120, operatingSeconds: 100, idealCycleSeconds: 40 });
    await publisher.publishAsync('smart40/TEST/EXP/telemetry', '{invalid', { qos: 1 });
    await until(() => cloudMetrics.some(e => e.data.totalProduced === 2 && e.data.oee !== null), 'métricas na nuvem');
    await until(() => received.some(e => e.data.movements.some(m => m.stage === 'DISPATCHED')), 'saída WebSocket');
    assert.equal(cloudTelemetry.length, events.length); // Repetição não é retransmitida como nova produção.
    assert.equal(rawEvents.length, events.length);
    await until(() => shellSnapshots.at(-1)?.oee !== null && shellSnapshots.at(-1)?.totalProduced === 2, 'WebSocket de eventos processado pelo Shell');
    const last = shellSnapshots.at(-1);
    assert.equal(last.totalProduced, 2); assert.equal(last.approved, 1); assert.equal(last.rejected, 1);
    assert.ok(Math.abs(last.oee - 100 / 3) < 1e-8);
    assert.equal(last.rack[0], null); assert.equal(last.orders[0].totalProduced, 2);
    assert.equal((await health()).cloud, 'CONNECTED');
    await until(async () => (await health())?.brokerWss?.pending === 0, 'fila WSS esvaziada');
    assert.ok((await health()).brokerWss.ignoredCommands >= 1);
    assert.ok(wssEvents.length >= events.length);
    ws.terminate(); ws = null; rawWs.terminate(); rawWs = null; centralWs.terminate(); centralWs = null;
    await stop();
    const prior = cloudMetrics.length;
    start(); await until(async () => (await health())?.connection === 'CONNECTED', 'restart do Node-RED');
    await publisher.publishAsync('smart40/TEST/EXP/telemetry', JSON.stringify(piece), { qos: 1 });
    await until(() => cloudMetrics.slice(prior).some(e => e.data.totalProduced === 2), 'checkpoint restaurado');
    assert.equal(cloudTelemetry.filter(e => e.type === 'piece.processed' && e.pieceId === 'one').length, 1);
    const serialized = fs.readFileSync(path.join(directory, 'data/checkpoint.json'), 'utf8');
    assert.ok(!serialized.includes('test-only-password'));
  } catch (error) { throw new Error(`${error.message}\nNode-RED: ${logs}`, { cause: error }); }
});
