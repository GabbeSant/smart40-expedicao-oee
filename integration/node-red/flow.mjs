/** Gera o mesmo fluxo usado nos testes e no Node-RED instalado. Não contém tags/DBs do CLP. */
export function createFlows({ cloud = false } = {}) {
  const tab = 'expedition-flow';
  const node = (id, type, name, x, y, wires, extra = {}) => ({ id, z: tab, type, name, x, y, wires, ...extra });
  const fn = (id, name, x, y, wires, func, extra = {}) => node(id, 'function', name, x, y, wires, { func, outputs: wires.length, ...extra });
  return [
    { id: tab, type: 'tab', label: 'Grupo 5 · processamento sem tela', disabled: false },
    node('automation-entry', 'link in', 'Entrada da automação: JSON v1 normalizado', 70, 80, [['validate']], { links: [] }),
    fn('validate', 'Validar contrato antes de publicar', 290, 80, [['local-telemetry-out'], ['diagnostic']],
      `try { const rt = global.get('expedition'); msg.payload = rt.parseProductionEvent(msg.payload); msg.topic = rt.topic + '/telemetry'; return [msg, null]; } catch (e) { return [null, {payload:{status:'rejected',reason:e.message}}]; }`),
    node('local-telemetry-out', 'mqtt out', 'Publicar telemetria local QoS 1', 590, 80, [], { broker: 'local-broker', topic: '', qos: '1', retain: 'false' }),
    node('local-in', 'mqtt in', 'Telemetria MQTT normalizada', 170, 200, [['process']],
      { broker: 'local-broker', topic: '${MQTT_TELEMETRY_TOPIC}', qos: '1', datatype: 'utf8', nl: false, rap: true, rh: 0 }),
    fn('process', 'Processar e persistir antes de emitir', 470, 200, [['metrics', 'cloud-telemetry', 'raw-telemetry'], ['diagnostic']],
      `const rt = global.get('expedition');
try {
  const event = rt.parseProductionEvent(msg.payload);
  const result = rt.processor.ingest(event);
  if (result.status === 'rejected') return [null,{payload:result}];
  // Duplicatas também podem repetir um encaminhamento que falhou após o checkpoint.
  if (rt.wssBridge) rt.wssBridge.publish(event);
  return [{payload:event, publishTelemetry:result.status === 'applied'},null];
} catch(e) { return [null,{payload:{status:'rejected',reason:e.message}}]; }`),
    node('clock', 'inject', 'Atualizar PPM e estado a cada segundo', 180, 320, [['metrics']],
      { props: [], repeat: '1', once: true, onceDelay: '0.5' }),
    fn('metrics', 'Snapshot para o Grupo 1', 740, 280, [['local-metrics-out', 'cloud-metrics-out', 'websocket-out']],
      `const rt = global.get('expedition'); return {topic:rt.topic+'/metrics',payload:JSON.stringify({type:'expedition.metrics',data:rt.processor.snapshot()})};`),
    node('local-metrics-out', 'mqtt out', 'Resultados MQTT locais', 1080, 220, [],
      { broker: 'local-broker', topic: '', qos: '1', retain: 'true' }),
    node('websocket-out', 'websocket out', 'App Shell: /ws/expedition', 1080, 340, [], { server: 'shell-websocket', client: '' }),
    fn('raw-telemetry', 'Eventos para processamento no Shell', 740, 400, [['raw-websocket-out']],
      `if(!msg.publishTelemetry) return null; return {payload:JSON.stringify(msg.payload)};`),
    node('raw-websocket-out', 'websocket out', 'App Shell: /ws/telemetry', 1080, 400, [], { server: 'telemetry-websocket', client: '' }),
    fn('cloud-telemetry', 'Encaminhar telemetria sem ciclos', 740, 140, [['cloud-telemetry-out']],
      `if (!msg.publishTelemetry) return null; const rt=global.get('expedition'); return {topic:rt.topic+'/telemetry',payload:JSON.stringify(msg.payload)};`, { d: !cloud }),
    node('cloud-telemetry-out', 'mqtt out', 'Nuvem: telemetria TLS', 1080, 100, [],
      { broker: 'cloud-broker', topic: '', qos: '1', retain: 'false', d: !cloud }),
    node('cloud-metrics-out', 'mqtt out', 'Nuvem: resultados TLS', 1080, 280, [],
      { broker: 'cloud-broker', topic: '', qos: '1', retain: 'true', d: !cloud }),
    node('broker-status', 'status', 'Conexão do broker local', 170, 420, [['connection']], { scope: ['local-in'] }),
    fn('connection', 'Estado de transporte', 470, 420, [['metrics']],
      `const rt=global.get('expedition'); rt.processor.setConnection(msg.status && msg.status.fill === 'green' ? 'CONNECTED' : 'DISCONNECTED'); return msg;`),
    node('health-in', 'http in', 'Health check', 170, 520, [['health']], { url: '/health', method: 'get', upload: false }),
    fn('health', 'Estado do processamento', 470, 520, [['health-out']],
      `const rt=global.get('expedition'); const s=rt.processor.snapshot(); msg.statusCode=200; msg.payload={service:'smart40-expedition',connection:s.connection,origin:s.origin,unitId:s.unitId,assetId:s.assetId,lastUpdated:s.lastUpdated,cloud:rt.cloudConnection,brokerWss:rt.wssBridge ? rt.wssBridge.status() : {connection:'DISABLED'},orders:rt.ordersStatus||'NOT_CONFIGURED'}; return msg;`),
    node('health-out', 'http response', 'HTTP JSON', 740, 520, [], { statusCode: '', headers: { 'content-type': 'application/json' } }),
    node('catch', 'catch', 'Falhas do fluxo', 170, 620, [['diagnostic']], { scope: null, uncaught: false }),
    node('diagnostic', 'debug', 'Eventos rejeitados / erros', 740, 620, [], { active: true, tosidebar: true, console: true, complete: 'payload' }),
    { id: 'local-broker', type: 'mqtt-broker', name: 'Broker local', broker: '${MQTT_LOCAL_HOST}', port: '${MQTT_LOCAL_PORT}',
      clientid: '${MQTT_LOCAL_CLIENT_ID}', protocolVersion: '4', keepalive: '30', cleansession: true, autoConnect: true, usetls: false },
    ...(cloud ? [{ id: 'cloud-broker', type: 'mqtt-broker', name: 'Broker nuvem TLS', broker: '${MQTT_CLOUD_HOST}', port: '${MQTT_CLOUD_PORT}',
      clientid: '${MQTT_CLOUD_CLIENT_ID}', protocolVersion: '4', keepalive: '30', cleansession: true, autoConnect: true, usetls: true, tls: 'cloud-tls' },
    { id: 'cloud-tls', type: 'tls-config', name: 'TLS com validação do certificado',
      cert: '', key: '', ca: '', certname: '', keyname: '', caname: '',
      servername: '${MQTT_CLOUD_HOST}', verifyservercert: true, alpnprotocol: '' }] : []),
    { id: 'shell-websocket', type: 'websocket-listener', path: '/ws/expedition', wholemsg: 'false' },
    { id: 'telemetry-websocket', type: 'websocket-listener', path: '/ws/telemetry', wholemsg: 'false' },
    node('cloud-status', 'status', 'Conexão nuvem', 170, 700, [['cloud-connection']], { scope: ['cloud-metrics-out'], d: !cloud }),
    fn('cloud-connection', 'Estado da nuvem', 470, 700, [],
      `global.get('expedition').cloudConnection=msg.status && msg.status.fill==='green' ? 'CONNECTED' : 'DISCONNECTED'; return null;`, { d: !cloud }),
    node('description', 'comment', 'CLP: conectar leitura validada ao Link In. Sem escrita/reset de máquina.', 430, 20, []),
  ];
}
