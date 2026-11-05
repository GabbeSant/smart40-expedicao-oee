import type { EventBase, ProductionEvent } from "./contracts.ts";
import { isCount, isRecord, parseProductionEvent } from "./validation.ts";

/**
 * Migração seletiva da recepção de snapshots da teste2, sem importar UI/pastas duplicadas.
 * Metadados confiáveis são obrigatórios; nunca contar ultimaPecaLida de todo snapshot.
 */
export function adaptSmart40Counters(snapshot: unknown,
  metadata: Omit<EventBase, "schemaVersion"> & { counterEpoch: string }): ProductionEvent {
  if (!isRecord(snapshot) || !isRecord(snapshot.metricasExpedicao)) throw new Error("Snapshot SMART40 inválido");
  const m = snapshot.metricasExpedicao;
  if (![m.pecasProcessadasTotal, m.pecasAprovadasCount, m.pecasRejeitadasCount].every(isCount))
    throw new Error("Contadores SMART40 inválidos");
  return parseProductionEvent({
    ...metadata, schemaVersion: "1.0", type: "production.counters",
    totalProduced: m.pecasProcessadasTotal, approved: m.pecasAprovadasCount, rejected: m.pecasRejeitadasCount,
  });
}
