import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { ViteDevServer } from "vite";
import { sprint3Bench } from "../sprint3-bench.ts";

/** Serviços HTTP locais e credenciais sintéticas; nenhuma conexão à bancada. */
async function harness(t: Parameters<Parameters<typeof test>[1]>[0], mode: "ok" | "auth" | "format" | "timeout") {
  const reads: { path: string; method?: string; auth?: string }[] = [];
  const source = http.createServer((request, response) => {
    reads.push({ path: request.url!, method: request.method, auth: request.headers.authorization });
    if (request.url!.startsWith("/api/blocks")) {
      if (mode === "timeout") return;
      if (mode === "auth" && request.url === "/api/blocks/2") { response.writeHead(401).end(); return; }
      const payload = mode === "format" ? { surprise: true } : request.url === "/api/blocks/2" ? { position: 4 } :
        { complete: true, items: [{ storageId: 2, position: 1 }, { storageId: 1, position: 5 }] };
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(payload));
    } else response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ format: "boolean", msg: "false" }));
  });
  await new Promise<void>(resolve => source.listen(0, "127.0.0.1", resolve));
  const address = source.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}`;
  const plugin = sprint3Bench({ S3_NODE_RED_URL: url, S3_STOCK_URL: url, S3_STOCK_USER: "fixture-user", S3_STOCK_PASSWORD: "fixture-password" });
  const configure = plugin.configureServer;
  assert.equal(typeof configure, "function");
  let handler: http.RequestListener | undefined;
  if (typeof configure === "function") configure({ middlewares: { use: (_route: string, next: http.RequestListener) => { handler = next; } } } as unknown as ViteDevServer);
  const server = http.createServer((request, response) => handler!(request, response));
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const local = server.address();
  assert.ok(local && typeof local !== "string");
  t.after(() => { source.closeAllConnections(); source.close(); server.closeAllConnections(); server.close(); });
  return { url: `http://127.0.0.1:${local.port}/__sprint3/observacao`, reads };
}

test("ponte de bancada só consulta por GET, mantém senha no servidor e limita consultas ao gestor", async t => {
  const { url, reads } = await harness(t, "ok");
  assert.equal(reads.length, 0);
  assert.equal((await fetch(url, { method: "POST" })).status, 405);
  assert.equal((await fetch(url, { headers: { Origin: "https://external.invalid" } })).status, 403);
  assert.equal(reads.length, 0);
  const response = await fetch(url);
  const body = await response.text();
  const data = JSON.parse(body);
  assert.equal(data.magazine.status, "available");
  assert.equal(data.magazine.firstFree, 4);
  assert.deepEqual(data.magazine.registered.positions, [true, ...Array(11).fill(false)]);
  assert.ok(!body.includes("fixture-user") && !body.includes("fixture-password") && !body.includes("Basic"));
  await fetch(url);
  assert.ok(reads.every(row => row.method === "GET"));
  const stock = reads.filter(row => row.path.startsWith("/api/blocks"));
  assert.equal(stock.length, 2);
  assert.ok(stock.every(row => row.auth === `Basic ${Buffer.from("fixture-user:fixture-password").toString("base64")}`));
  assert.ok(reads.filter(row => row.path.startsWith("/context")).every(row => row.auth === undefined));
});

for (const [mode, expected] of [["auth", "unauthorized"], ["format", "unknown-format"], ["timeout", "unavailable"]] as const) {
  test(`gestor ${mode}: resposta explícita sem fabricar ocupação`, async t => {
    const { url } = await harness(t, mode);
    const response = await fetch(url);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.magazine.status, expected);
    if (mode !== "auth") assert.equal(data.magazine.registered, null);
  });
}
