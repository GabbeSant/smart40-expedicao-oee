import { randomUUID } from 'node:crypto';
import { connectAsync } from 'mqtt';

const env = process.env;
const unitId = env.UNIT_ID || 'UNIDADE-SP';
const assetId = env.ASSET_ID || 'N2-EXPEDICAO';
const topic = `smart40/${unitId}/${assetId}/telemetry`;
const client = await connectAsync(env.MQTT_URL || 'mqtt://127.0.0.1:1883', { connectTimeout: 5000, reconnectPeriod: 0 });
const streamId = `demo-${randomUUID()}`;
let seq = 0;
const publish = async fields => {
  const event = { schemaVersion: '1.0', eventId: `${streamId}:${seq}`, unitId, assetId, streamId, seq: seq++,
    timestamp: new Date().toISOString(), origin: 'simulado', quality: 'GOOD', ...fields };
  await client.publishAsync(topic, JSON.stringify(event), { qos: 1, retain: false });
  return event;
};
try {
  await publish({ type: 'station.state', status: 'RUNNING' });
  const pieceId = `${streamId}-piece-1`;
  const first = await publish({ type: 'piece.processed', pieceId, productionOrderId: '42', inspection: 'APPROVED' });
  await client.publishAsync(topic, JSON.stringify(first), { qos: 1 }); // QoS1 repetido, uma única peça.
  await publish({ type: 'piece.processed', pieceId: `${streamId}-piece-2`, productionOrderId: '42', inspection: 'REJECTED' });
  await publish({ type: 'piece.moved', pieceId, stage: 'IDENTIFIED' });
  await publish({ type: 'piece.moved', pieceId, stage: 'STORED', position: 1 });
  await publish({ type: 'piece.moved', pieceId, stage: 'DISPATCHED', position: 1 });
  console.log(`Demo publicada em ${topic}: 2 peças, 1 aprovada, 1 rejeitada e uma saída. Use DATA_ORIGIN=simulado no Node-RED.`);
} finally { await client.endAsync(); }
