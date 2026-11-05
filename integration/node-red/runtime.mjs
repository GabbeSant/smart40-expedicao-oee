import fs from 'node:fs';
import path from 'node:path';
import { createExpeditionProcessor, parseProductionEvent } from '../../FrontEnd/dist-processing/processing/index.js';

/** Escrita síncrona atômica antes de emitir resultados. Um escritor por arquivo. */
export function fileStorage(filename) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  return {
    load: () => fs.existsSync(filename) ? fs.readFileSync(filename, 'utf8') : null,
    save(serialized) {
      const temporary = `${filename}.tmp`;
      const fd = fs.openSync(temporary, 'w', 0o600);
      try { fs.writeFileSync(fd, serialized); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      fs.renameSync(temporary, filename);
    },
  };
}

export function createRuntime(env, directory) {
  const unitId = env.UNIT_ID || 'UNIDADE-SP';
  const assetId = env.ASSET_ID || 'N2-EXPEDICAO';
  if (![unitId, assetId].every(v => /^[a-zA-Z0-9_-]+$/.test(v))) throw new Error('Identidade inválida para tópicos MQTT');
  const processor = createExpeditionProcessor({
    unitId, assetId, origin: env.DATA_ORIGIN || 'medido',
    productionMode: env.PRODUCTION_MODE || 'pieces',
    ...(env.SESSION_STARTED_AT ? { startedAt: env.SESSION_STARTED_AT } : {}),
    rackCapacity: 12, staleAfterMs: Number(env.STALE_AFTER_MS || 15000),
    storage: fileStorage(path.join(directory, 'checkpoint.json')),
  });
  return { processor, parseProductionEvent, topic: `smart40/${unitId}/${assetId}`,
    cloudConnection: env.MQTT_CLOUD_ENABLED === 'true' ? 'DISCONNECTED' : 'DISABLED' };
}
