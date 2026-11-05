import http from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { MesError } from './repository.mjs';

const hash = value => createHash('sha256').update(value).digest();
const routes = new Map([
  ['/api/Events/order/movedin', 'moved-in'], ['/api/Events/process/started', 'start'],
  ['/api/Events/process/finished', 'finish'], ['/api/Events/order/movedout', 'moved-out'],
  ['/api/Events/order/completed', 'completed'],
]);
async function jsonBody(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new MesError(415, 'Use application/json');
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size <= 65536) chunks.push(chunk); }
  if (size > 65536) throw new MesError(413, 'JSON acima de 64 KiB');
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new MesError(400, 'JSON inválido'); }
}

export function createMesHttpServer({ repository, principals, origins = [], onError = () => {} }) {
  if (!Array.isArray(principals) || !principals.length || principals.some(p => typeof p.token !== 'string' || p.token.length < 16 ||
    typeof p.unitId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(p.unitId) || !['read', 'write'].includes(p.role)) ||
    new Set(principals.map(p => p.token)).size !== principals.length) throw new Error('Configure tokens MES únicos com unidade, papel read/write e pelo menos 16 caracteres');
  const identities = principals.map(p => ({ digest: hash(p.token), unitId: p.unitId, role: p.role }));
  const allowedOrigins = new Set(origins);
  return http.createServer({ requestTimeout: 15000, headersTimeout: 10000 }, async (req, res) => {
    const send = (status, value) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value));
    };
    try {
      const url = new URL(req.url, 'http://localhost');
      const origin = req.headers.origin;
      if (origin && !allowedOrigins.has(origin)) throw new MesError(403, 'Origin não autorizado');
      if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); return send(204);
      }
      if (req.method === 'GET' && url.pathname === '/health') { await repository.ping(); return send(200, { service: 'smart40-api-mes', status: 'ok' }); }
      const auth = req.headers.authorization || '';
      const match = /^Bearer (\S+)$/.exec(auth);
      const credential = hash(match?.[1] || '');
      const identity = identities.find(p => timingSafeEqual(p.digest, credential));
      if (!identity) throw new MesError(401, 'Token inválido');
      if (url.searchParams.has('unitId') && url.searchParams.get('unitId') !== identity.unitId)
        throw new MesError(403, 'Unidade diferente da identidade autenticada');
      if (req.method === 'POST' && routes.has(url.pathname)) {
        if (identity.role !== 'write') throw new MesError(403, 'Token sem permissão de escrita');
        const body = await jsonBody(req);
        if (body?.unitId !== undefined && body.unitId !== identity.unitId) throw new MesError(403, 'Unidade diferente da identidade autenticada');
        const result = await repository.register(identity.unitId, routes.get(url.pathname), body);
        return send(result.duplicate ? 200 : 201, result);
      }
      // Rotas estáticas ANTES de :trackingCode, corrigindo o sombreamento do PDF.
      if (req.method === 'GET' && url.pathname === '/api/Events/order/current') return send(200, await repository.current(identity.unitId));
      if (req.method === 'GET' && url.pathname === '/api/Events/metrics') return send(200, await repository.metrics(identity.unitId));
      const tracking = /^\/api\/Events\/order\/([^/]+)$/.exec(url.pathname);
      if (req.method === 'GET' && tracking) return send(200, await repository.tracking(identity.unitId, decodeURIComponent(tracking[1])));
      return send(404, { erro: 'Rota não encontrada' });
    } catch (error) {
      if (!(error instanceof MesError)) onError(error.code || error.name);
      send(error instanceof MesError ? error.status : 503, { erro: error instanceof MesError ? error.message : 'Serviço MES indisponível' });
    }
  });
}
