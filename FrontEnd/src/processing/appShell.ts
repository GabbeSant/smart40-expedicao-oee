import type { ExpeditionSnapshot, IngestResult } from "./contracts.ts";
import type { ExpeditionProcessor } from "./processor.ts";
import { adaptProjectTelemetry, PROJECT_TELEMETRY_EVENT, type ProjectTelemetryOptions } from './projectTelemetry.ts';
import { isRecord, isUtcDate, parseProductionEvent } from './validation.ts';

export const EXPEDITION_TELEMETRY_EVENT = "smart40:expedition:telemetry";
export const EXPEDITION_METRICS_EVENT = "smart40:expedition:metrics";
export const EXPEDITION_CONNECTION_EVENT = "smart40:expedition:connection";
export const EXPEDITION_REQUEST_EVENT = "smart40:expedition:request";
export const EXPEDITION_DIAGNOSTIC_EVENT = "smart40:expedition:diagnostic";

/** Callback onmessage do Shell: eventos G5 não chegam aos listeners globais da IHM/robô. */
export function dispatchSmart40Telemetry(target: EventTarget, payload: unknown): 'event' | 'snapshot' {
  if (typeof payload === 'string') payload = JSON.parse(payload);
  if (!isRecord(payload)) throw new Error('Mensagem de telemetria inválida');
  if ('schemaVersion' in payload) {
    target.dispatchEvent(new CustomEvent(EXPEDITION_TELEMETRY_EVENT, { detail: parseProductionEvent(payload) }));
    return 'event';
  }
  if (!isUtcDate(payload.timestamp) || 'acao' in payload || payload.type === 'expedition.metrics')
    throw new Error('Mensagem não representa snapshot global de telemetria');
  target.dispatchEvent(new CustomEvent(PROJECT_TELEMETRY_EVENT, { detail: payload }));
  return 'snapshot';
}

/** O Shell possui a conexão WebSocket/MQTT. Este módulo só recebe/publica eventos locais. */
export function attachExpeditionToShell(options: {
  target: EventTarget;
  processor: ExpeditionProcessor;
  refreshMs?: number;
  onMetrics?: (snapshot: ExpeditionSnapshot) => void;
  projectTelemetry?: ProjectTelemetryOptions;
}) {
  const { target, processor } = options;
  const refreshMs = options.refreshMs ?? 1000;
  if (!Number.isFinite(refreshMs) || refreshMs < 0 || refreshMs > 2_147_483_647)
    throw new Error("Intervalo inválido");
  let disposed = false;
  let lastMissing = '';
  const publish = () => {
    if (disposed) return;
    const snapshot = processor.snapshot();
    target.dispatchEvent(new CustomEvent(EXPEDITION_METRICS_EVENT, { detail: snapshot }));
    options.onMetrics?.(snapshot);
  };
  const diagnose = (result: IngestResult) => target.dispatchEvent(
    new CustomEvent(EXPEDITION_DIAGNOSTIC_EVENT, { detail: result }),
  );
  const receive = (event: Event) => {
    try {
      const detail = (event as CustomEvent<unknown>).detail;
      const adapted = event.type === PROJECT_TELEMETRY_EVENT && options.projectTelemetry
        ? adaptProjectTelemetry(detail, options.projectTelemetry) : { events: [detail], missing: [] };
      const missing = adapted.missing.join(', ');
      if (missing && missing !== lastMissing) diagnose({ status: 'rejected', reason: `Telemetria parcial: faltam ${missing}` });
      lastMissing = missing;
      const inputs = adapted.events;
      for (const input of inputs) {
        const result = processor.ingest(input);
        if (result.status === "rejected") diagnose(result);
      }
      publish();
    } catch (error) {
      diagnose({ status: "rejected", reason: `Falha ao persistir/processar: ${(error as Error).message}` });
    }
  };
  const connection = (event: Event) => {
    const detail: unknown = (event as CustomEvent<unknown>).detail;
    if (detail === "CONNECTED" || detail === "DISCONNECTED") { processor.setConnection(detail); publish(); }
    else diagnose({ status: "rejected", reason: "Conexão deve ser CONNECTED ou DISCONNECTED" });
  };
  target.addEventListener(EXPEDITION_TELEMETRY_EVENT, receive);
  target.addEventListener(PROJECT_TELEMETRY_EVENT, receive);
  target.addEventListener(EXPEDITION_CONNECTION_EVENT, connection);
  target.addEventListener(EXPEDITION_REQUEST_EVENT, publish);
  const timer = refreshMs > 0 ? setInterval(publish, refreshMs) : null;
  publish();
  return {
    publish,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (timer !== null) clearInterval(timer);
      target.removeEventListener(EXPEDITION_TELEMETRY_EVENT, receive);
      target.removeEventListener(PROJECT_TELEMETRY_EVENT, receive);
      target.removeEventListener(EXPEDITION_CONNECTION_EVENT, connection);
      target.removeEventListener(EXPEDITION_REQUEST_EVENT, publish);
    },
  };
}
