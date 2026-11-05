import type { ProductionEvent } from "./contracts.ts";

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
export const isText = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= 256;
export const isUtcDate = (v: unknown): v is string => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(v) ||
    !Number.isFinite(Date.parse(v))) return false;
  const [year, month, day] = v.slice(0, 10).split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return month >= 1 && month <= 12 && day >= 1 && day <= lastDay && Number(v.slice(11, 13)) < 24;
};
export const isCount = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const nonNegative = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;
const oneOf = (value: unknown, values: readonly string[]): boolean =>
  typeof value === "string" && values.includes(value);

/** Sem coerções, defaults industriais ou deduções de status/qualidade. */
export function parseProductionEvent(input: unknown): ProductionEvent {
  let value = input;
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { throw new Error("JSON inválido"); }
  }
  if (!isRecord(value) || value.schemaVersion !== "1.0" ||
    ![value.eventId, value.unitId, value.assetId, value.streamId].every(isText) ||
    !isCount(value.seq) || !isUtcDate(value.timestamp) ||
    !oneOf(value.origin, ["medido", "calculado", "simulado"]) ||
    !oneOf(value.quality, ["GOOD", "UNCERTAIN", "BAD"])) {
    throw new Error("Envelope v1 incompleto ou inválido");
  }
  let valid = false;
  switch (value.type) {
    case "piece.processed":
      valid = isText(value.pieceId) && (value.productionOrderId === null || isText(value.productionOrderId)) &&
        oneOf(value.inspection, ["APPROVED", "REJECTED"]);
      break;
    case "station.state":
      valid = oneOf(value.status, ["RUNNING", "STOPPED", "EMERGENCY"]);
      break;
    case "production.counters":
      valid = isText(value.counterEpoch) && [value.totalProduced, value.approved, value.rejected].every(isCount) &&
        value.totalProduced === (value.approved as number) + (value.rejected as number);
      break;
    case "analysis.window":
      valid = isUtcDate(value.startedAt) && [value.plannedSeconds, value.operatingSeconds, value.idealCycleSeconds].every(nonNegative) &&
        (value.idealCycleSeconds as number) > 0 && (value.operatingSeconds as number) <= (value.plannedSeconds as number) &&
        Date.parse(value.startedAt) <= Date.parse(value.timestamp);
      break;
    case "piece.moved":
      valid = isText(value.pieceId) && oneOf(value.stage, ["IDENTIFIED", "STORED", "DISPATCHED"]) &&
        (value.stage === "IDENTIFIED" ? value.position === undefined : isCount(value.position) && (value.position as number) > 0);
      break;
  }
  if (!valid) throw new Error("Tipo de evento ou dados do processo inválidos");
  return structuredClone(value) as unknown as ProductionEvent;
}
