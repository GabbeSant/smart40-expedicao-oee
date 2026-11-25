import { Buffer } from "node:buffer";
import type { Plugin } from "vite";
import type { BenchObservation } from "./src/sprint3/bench.ts";
import { readRegisteredBlocks, slotNumber } from "./src/sprint3/magazine.ts";

const tagFields = {
  order: "NumeroOP_expedicao", busy: "Ocupado_expedicao", waiting: "Aguardando_expedicao",
  emergency: "EmergenciaAtivada_expedicao", stored: "posicaoGuardado_expedicao", removed: "posicaoRemovidoExpedicao",
};
const loopback = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

function localHost(host: string | undefined) {
  return host !== undefined && /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);
}

/** Interface de leitura para validação local. O pacote publicado só escuta o barramento do App Shell. */
export function sprint3Bench(env: Record<string, string>): Plugin {
  const nodeRed = env.S3_NODE_RED_URL || "http://192.168.150.200:1880";
  const stockManager = env.S3_STOCK_URL || "http://192.168.150.200:8080";
  const authorization = env.S3_STOCK_USER && env.S3_STOCK_PASSWORD
    ? `Basic ${Buffer.from(`${env.S3_STOCK_USER}:${env.S3_STOCK_PASSWORD}`).toString("base64")}` : undefined;
  let managerResult: BenchObservation["magazine"] = { status: "unavailable", firstFree: null, registered: null };
  let lastManagerRead = 0;
  let current: Promise<unknown> | null = null;

  async function readTag(tag: string) {
    try {
      const result = await fetch(new URL(`/context/global/${tag}`, nodeRed), {
        method: "GET", redirect: "error", signal: AbortSignal.timeout(3500), headers: { Accept: "application/json" },
      });
      if (!result.ok) return null;
      const value = await result.json();
      if (!value || typeof value !== "object" || !("format" in value) || !("msg" in value) || typeof value.msg !== "string") return null;
      if (value.format === "boolean" && ["true", "false"].includes(value.msg)) return value.msg === "true";
      if (value.format === "number" && /^\d+$/.test(value.msg)) {
        const number = Number(value.msg);
        return Number.isSafeInteger(number) ? number : null;
      }
    } catch { /* O campo ausente continua indisponível. */ }
    return null;
  }

  async function managerGet(path: string) {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (authorization) headers.Authorization = authorization;
    try {
      const result = await fetch(new URL(path, stockManager), {
        method: "GET", redirect: "error", signal: AbortSignal.timeout(2500), headers,
      });
      const body: unknown = result.ok ? await result.json().catch(() => null) : null;
      return { code: result.status, body, ok: result.ok };
    } catch { /* Serviço indisponível; não há ocupação presumida. */ }
    return { code: 0, body: null, ok: false };
  }

  async function readManager(): Promise<BenchObservation["magazine"]> {
    const [free, blocks] = await Promise.all([managerGet("/api/blocks/2"), managerGet("/api/blocks")]);
    const value = free.body;
    const position = typeof value === "number" ? value : value && typeof value === "object" && "position" in value ? value.position : null;
    const firstFree = slotNumber(position) ? position : null;
    const registered = blocks.ok ? readRegisteredBlocks(blocks.body, new Date().toISOString()) : null;
    const status = [free.code, blocks.code].some(code => code === 401 || code === 403) ? "unauthorized" :
      firstFree !== null || registered ? "available" : free.ok || blocks.ok ? "unknown-format" : "unavailable";
    return { status, firstFree, registered };
  }

  async function observe() {
    const reads = Promise.all(Object.entries(tagFields).map(async ([field, tag]) => [field, await readTag(tag)]));
    if (Date.now() - lastManagerRead >= 30_000) {
      managerResult = await readManager();
      lastManagerRead = Date.now();
    }
    return { ...Object.fromEntries(await reads), observedAt: new Date().toISOString(), magazine: managerResult };
  }

  return {
    name: "smart40-sprint3-bench-readonly",
    configureServer(server) {
      server.middlewares.use("/__sprint3/observacao", async (request, response) => {
        if (request.method !== "GET") { response.writeHead(405).end(); return; }
        const origin = request.headers.origin;
        if (!loopback.has(request.socket.remoteAddress ?? "") || !localHost(request.headers.host) ||
          request.headers["sec-fetch-site"] === "cross-site" || (origin && origin !== `http://${request.headers.host}`)) {
          response.writeHead(403).end(); return;
        }
        current ??= observe().finally(() => { current = null; });
        const result = await current;
        response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }).end(JSON.stringify(result));
      });
    },
  };
}
