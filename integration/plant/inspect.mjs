import WebSocket from 'ws';
import { connectAsync } from 'mqtt';
import { getProductionOrders } from '../../FrontEnd/dist-processing/integration/productionOrdersApi.js';
import { resolveN2ProductionOrder } from '../../FrontEnd/dist-processing/processing/index.js';

const observedKeys = ['NumeroOP_expedicao','Aguardando_expedicao','Ocupado_expedicao',
  'Emergencia_expedicao','EmergenciaAtivada_expedicao','FinishOP_expedicao','OPGuardado_expedicao',
  'posicaoGuardado_expedicao','removerExpedicao','posicaoRemovidoExpedicao'];

async function readJson(base, path, fetchImpl) {
  const response = await fetchImpl(new URL(path, base), { method: 'GET', signal: AbortSignal.timeout(5000),
    headers: { Accept: 'application/json', 'Node-RED-API-Version': 'v2' }, redirect: 'error' });
  if (!response.ok) throw new Error(`Leitura ${path}: HTTP ${response.status}`);
  return response.json();
}
function scalar(envelope) {
  if (envelope?.format === 'number' && /^-?\d+(\.\d+)?$/.test(envelope.msg)) {
    const value = Number(envelope.msg); if (Number.isFinite(value)) return value;
  }
  if (envelope?.format === 'boolean' && ['true','false'].includes(envelope.msg)) return envelope.msg === 'true';
  throw new Error('Contexto Node-RED sem escalar tipado válido');
}

/** Mesmo canal de leitura de status usado pelo editor. Não envia comandos de nós ou de CLP. */
export async function readS7Status(baseUrl, inputId, timeoutMs = 1500) {
  const url = new URL('comms', baseUrl.endsWith('/') ? baseUrl : baseUrl + '/');
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(url, { handshakeTimeout: timeoutMs });
  return new Promise(resolve => {
    let result = null, finished = false;
    const done = () => { if (finished) return; finished = true; clearTimeout(timer); socket.terminate(); resolve(result); };
    const timer = setTimeout(done, timeoutMs);
    socket.on('open', () => socket.send(JSON.stringify({ subscribe: `status/${inputId}` })));
    socket.on('message', raw => {
      try {
        const packets = JSON.parse(raw.toString());
        for (const packet of Array.isArray(packets) ? packets : [packets]) if (packet.topic === `status/${inputId}`) {
          const data = packet.data;
          result = { online: data?.fill === 'green' && data?.text === 'online', text: String(data?.text || 'unknown') };
          done(); return;
        }
      } catch { /* Dados de outro formato não são usados como status. */ }
    });
    socket.on('error', done); socket.on('close', done);
  });
}

/** Inspeção estritamente GET. Mensagens publicadas são observações, não eventos de produção. */
export async function inspectPlant({ baseUrl = 'http://192.168.150.200:1880', plcAddress = '192.168.150.40',
  ordersBaseUrl = 'http://192.168.150.200:5678', fetchImpl = fetch, statusReader = readS7Status } = {}) {
  const [settings, flows] = await Promise.all([readJson(baseUrl, '/settings', fetchImpl), readJson(baseUrl, '/flows', fetchImpl)]);
  const nodes = Array.isArray(flows) ? flows : flows.flows;
  if (!Array.isArray(nodes)) throw new Error('Resposta de fluxos inválida');
  const endpoint = nodes.find(node => node.type === 's7 endpoint' && node.address === plcAddress);
  if (!endpoint) throw new Error('Endpoint S7 da expedição não encontrado');
  const input = nodes.find(node => node.type === 's7 in' && node.endpoint === endpoint.id && node.mode === 'all');
  const readings = {}, unavailable = [];
  await Promise.all(observedKeys.map(async key => {
    try { readings[key] = scalar(await readJson(baseUrl, '/context/global/' + encodeURIComponent(key), fetchImpl)); }
    catch { readings[key] = null; unavailable.push(key); }
  }));
  let association = null, ordersCount = null;
  try {
    const payload = await getProductionOrders({ baseUrl: ordersBaseUrl, fetchImpl, timeoutMs: 5000 });
    ordersCount = payload.productionOrders.length;
    if (readings.NumeroOP_expedicao !== null) association = resolveN2ProductionOrder(readings.NumeroOP_expedicao, payload.productionOrders);
  } catch { unavailable.push('productionOrders'); }
  return {
    type: 'n2.observation', observedAt: new Date().toISOString(), sourceTimestamp: null,
    quality: { status: 'UNCERTAIN', reason: 'Contexto global não informa timestamp de origem; leituras não são um snapshot atômico' },
    nodeRed: { version: settings.version },
    plc: { address: endpoint.address, port: Number(endpoint.port), rack: Number(endpoint.rack), slot: Number(endpoint.slot),
      cycleMs: Number(endpoint.cycletime), tagCount: endpoint.vartable?.length ?? 0,
      status: input ? await statusReader(baseUrl, input.id) : null },
    readings, ordersCount, association, unavailable,
    missing: ['identidade e inspeção por peça', 'tempos planejados/operação e ciclo ideal', 'timestamp de origem por leitura'],
  };
}

export async function publishObservation(observation, url, topic = 'smart40/UNIDADE-SP/N2-EXPEDICAO/observation') {
  if (observation?.type !== 'n2.observation' || !topic.endsWith('/observation'))
    throw new Error('Observações não podem ser publicadas como telemetria de produção');
  const client = await connectAsync(url, { reconnectPeriod: 0, connectTimeout: 5000 });
  try { await client.publishAsync(topic, JSON.stringify(observation), { qos: 1, retain: false }); }
  finally { await client.endAsync(); }
}
