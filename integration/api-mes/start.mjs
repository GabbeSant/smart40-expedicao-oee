import fs from 'node:fs';
import { createPostgresDatabase } from './db.mjs';
import { createMesRepository } from './repository.mjs';
import { createMesHttpServer } from './http.mjs';

const envFile = new URL('./.env', import.meta.url);
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const env = process.env;
const db = createPostgresDatabase(env);
const repository = createMesRepository(db);
if (process.argv.includes('--migrate')) {
  try { await repository.initialize(); console.log('Schema smart40_mes preparado.'); }
  finally { await db.close(); }
} else {
  let principals;
  try { principals = JSON.parse(env.MES_TOKENS_JSON || '[]'); }
  catch { throw new Error('MES_TOKENS_JSON deve ser um array JSON de credenciais por unidade'); }
  const server = createMesHttpServer({ repository, principals,
    origins: (env.MES_ALLOWED_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean),
    onError: code => console.error(`API MES: ${code}`),
  });
  await repository.ping();
  server.listen(Number(env.PORT || 4321), env.MES_HOST || '127.0.0.1', () => console.log(`API MES ouvindo na porta ${server.address().port}`));
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true; await new Promise(resolve => server.close(resolve)); await db.close();
  };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
