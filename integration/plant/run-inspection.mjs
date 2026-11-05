import fs from 'node:fs';
import { inspectPlant, publishObservation } from './inspect.mjs';

const report = await inspectPlant({
  baseUrl: process.env.PLANT_NODE_RED_URL || 'http://192.168.150.200:1880',
  ordersBaseUrl: process.env.PLANT_ORDERS_URL || 'http://192.168.150.200:5678',
  plcAddress: process.env.PLANT_PLC_ADDRESS || '192.168.150.40',
});
fs.mkdirSync('.work/plant', { recursive: true });
fs.writeFileSync('.work/plant/live-observation.json', JSON.stringify(report, null, 2), { mode: 0o600 });
if (process.env.PLANT_OBSERVATION_MQTT_URL) await publishObservation(report, process.env.PLANT_OBSERVATION_MQTT_URL);
console.log(JSON.stringify(report, null, 2));
