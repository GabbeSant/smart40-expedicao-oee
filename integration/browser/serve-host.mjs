import http from 'node:http';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('./host.html', import.meta.url));
http.createServer((request, response) => {
  if (request.url === '/favicon.ico') { response.writeHead(204).end(); return; }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
}).listen(4174, '127.0.0.1', () => console.log('Host de teste: http://127.0.0.1:4174'));
