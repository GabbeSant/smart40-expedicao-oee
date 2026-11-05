import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import RED from 'node-red';
import { createRuntime, fileStorage } from './runtime.mjs';
import { createFlows } from './flow.mjs';
import { refreshProductionOrders } from '../../FrontEnd/dist-processing/processing/index.js';
import { createBrokerBridge } from './brokerBridge.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(here, '.env');
if (process.env.NODE_RED_LOAD_ENV !== 'false' && fs.existsSync(envFile)) process.loadEnvFile(envFile);
const env = process.env;
env.MQTT_LOCAL_HOST ||= '127.0.0.1';
env.MQTT_LOCAL_PORT ||= '1883';
env.MQTT_LOCAL_CLIENT_ID ||= `g5-local-${env.UNIT_ID || 'UNIDADE-SP'}-${env.ASSET_ID || 'N2-EXPEDICAO'}`;
env.MQTT_CLOUD_PORT ||= '8883';
env.MQTT_CLOUD_CLIENT_ID ||= `${env.MQTT_LOCAL_CLIENT_ID}-cloud`;
const cloud = env.MQTT_CLOUD_ENABLED === 'true';
if (cloud && (!env.MQTT_CLOUD_HOST || !env.MQTT_CLOUD_USERNAME || !env.MQTT_CLOUD_PASSWORD))
  throw new Error('Nuvem habilitada: informe host, usuário e senha do broker no ambiente');
if (cloud && env.MQTT_CLOUD_HOST === env.MQTT_LOCAL_HOST && env.MQTT_CLOUD_PORT === env.MQTT_LOCAL_PORT)
  throw new Error('Broker nuvem deve ser diferente do broker local para evitar ciclos');
const defaultScope = [env.UNIT_ID || 'UNIDADE-SP', env.ASSET_ID || 'N2-EXPEDICAO',
  env.DATA_ORIGIN || 'medido', env.PRODUCTION_MODE || 'pieces'].map(encodeURIComponent).join('__');
const data = path.resolve(env.NODE_RED_DATA_DIR || path.join(here, 'data', defaultScope));
fs.mkdirSync(data, { recursive: true });
const runtime = createRuntime(env, data);
if (env.BROKER_URL) runtime.wssBridge = createBrokerBridge({ url: env.BROKER_URL, token: env.TOKEN_AGENTE,
  storage: fileStorage(path.join(data, 'wss-outbox.json')) });
env.MQTT_TELEMETRY_TOPIC = `${runtime.topic}/telemetry`;
const flowFile = path.join(data, 'flows.json');
// A configuração declarativa é a fonte; exportações do editor não substituem silenciosamente o fluxo.
fs.writeFileSync(flowFile, JSON.stringify(createFlows({ cloud }), null, 2));
// Apenas referências ao ambiente; nenhuma senha é escrita no fluxo ou no disco.
fs.writeFileSync(path.join(data, 'flows_cred.json'), JSON.stringify(cloud ? {
  'cloud-broker': { user: '${MQTT_CLOUD_USERNAME}', password: '${MQTT_CLOUD_PASSWORD}' },
} : {}));
const server = http.createServer();
const host = env.NODE_RED_HOST || '127.0.0.1';
const editor = env.NODE_RED_EDITOR === 'true';
if (editor && !['127.0.0.1', 'localhost', '::1'].includes(host) && !env.NODE_RED_ADMIN_HASH)
  throw new Error('Editor fora de localhost exige NODE_RED_ADMIN_HASH (bcrypt)');
RED.init(server, {
  userDir: data, flowFile, uiHost: host,
  httpAdminRoot: editor ? '/red' : false,
  ...(env.NODE_RED_ADMIN_HASH ? { adminAuth: { type: 'credentials', users: [{
    username: env.NODE_RED_ADMIN_USER || 'admin', password: env.NODE_RED_ADMIN_HASH, permissions: '*',
  }] } } : {}),
  functionGlobalContext: { expedition: runtime },
  credentialSecret: env.NODE_RED_CREDENTIAL_SECRET,
  logging: { console: { level: env.NODE_RED_LOG_LEVEL || 'info', metrics: false, audit: false } },
  editorTheme: { projects: { enabled: false } },
  externalModules: { palette: { allowInstall: false } },
});
server.on('request', (req, res) => {
  if (editor && req.url.startsWith('/red')) RED.httpAdmin(req, res);
  else RED.httpNode(req, res);
});
await new Promise((resolve, reject) => {
  server.once('error', reject); server.listen(Number(env.NODE_RED_PORT || 1880), host, resolve);
});
await RED.start();
let orderTimer;
const ordersController = new AbortController();
let fetchingOrders = false;
const refreshOrders = async () => {
  if (fetchingOrders) return;
  fetchingOrders = true;
  try {
    await refreshProductionOrders(runtime.processor, { baseUrl: env.PRODUCTION_ORDERS_BASE_URL,
      signal: ordersController.signal, timeoutMs: 5000 });
    runtime.ordersStatus = 'UPDATED';
  } catch (error) {
    runtime.ordersStatus = 'UNAVAILABLE';
    if (!ordersController.signal.aborted) console.warn(`Consulta de ordens: ${error.message}. Catálogo anterior preservado.`);
  } finally { fetchingOrders = false; }
};
if (env.PRODUCTION_ORDERS_BASE_URL) {
  void refreshOrders();
  orderTimer = setInterval(refreshOrders, 60000);
}
console.log(`SMART40 Node-RED: http://${host}:${server.address().port}/health · cloud=${cloud}`);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  runtime.wssBridge?.close();
  clearInterval(orderTimer); ordersController.abort();
  await RED.stop(); server.close();
}
process.on('SIGINT', stop); process.on('SIGTERM', stop);
