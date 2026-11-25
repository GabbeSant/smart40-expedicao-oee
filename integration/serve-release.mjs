import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../release');
const config = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const headers = Object.fromEntries(config.headers.flatMap(rule => rule.headers.map(({ key, value }) => [key, value])));
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer((request, response) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) { response.writeHead(405).end(); return; }
  if (request.method === 'OPTIONS') { response.writeHead(204, headers).end(); return; }
  let filename;
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    filename = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!filename.startsWith(`${root}${path.sep}`) || !fs.statSync(filename).isFile()) throw new Error('Not found');
  } catch { response.writeHead(404, headers).end(); return; }
  response.writeHead(200, { ...headers, 'Content-Type': types[path.extname(filename)] ?? 'application/octet-stream' });
  if (request.method === 'HEAD') response.end();
  else fs.createReadStream(filename).pipe(response);
});
server.listen(Number(process.env.RELEASE_PORT || 4173), '127.0.0.1', () => console.log(`Release: http://127.0.0.1:${server.address().port}/sprint3.html`));
