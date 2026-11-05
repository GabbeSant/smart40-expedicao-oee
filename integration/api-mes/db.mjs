import fs from 'node:fs';
import pg from 'pg';

/** TLS explícito, sem copiar rejectUnauthorized:false do material. */
export function createPostgresDatabase(env) {
  if (!env.DATABASE_URL) throw new Error('Configure DATABASE_URL no ambiente da API MES');
  const url = new URL(env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL deve usar PostgreSQL');
  if (['sslmode', 'sslcert', 'sslkey', 'sslrootcert'].some(key => url.searchParams.has(key)))
    throw new Error('Configure TLS via PG_SSL_MODE/PG_CA_FILE, sem parâmetros SSL na URL');
  const sslMode = env.PG_SSL_MODE || 'verify-full';
  if (!['verify-full', 'disable'].includes(sslMode)) throw new Error('PG_SSL_MODE deve ser verify-full ou disable');
  const pool = new pg.Pool({ connectionString: url.href,
    ssl: sslMode === 'disable' ? false : { rejectUnauthorized: true,
      ...(env.PG_CA_FILE ? { ca: fs.readFileSync(env.PG_CA_FILE, 'utf8') } : {}) },
    max: 5, connectionTimeoutMillis: 5000, statement_timeout: 10000,
  });
  pool.on('error', error => console.error(`PostgreSQL: ${error.code || 'CONNECTION_ERROR'}`));
  return {
    query: (sql, params) => pool.query(sql, params),
    async transaction(operation) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN'); const result = await operation(client); await client.query('COMMIT'); return result;
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
    close: () => pool.end(),
  };
}
