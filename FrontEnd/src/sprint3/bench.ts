import { isCount, isRecord, isUtcDate } from "../processing/validation.ts";
import { readRegisteredMagazine, slotNumber } from "./magazine.ts";
import type { RegisteredMagazine } from "./magazine.ts";

export interface BenchObservation {
  observedAt: string;
  order: number | null;
  busy: boolean | null;
  waiting: boolean | null;
  emergency: boolean | null;
  stored: number | null;
  removed: number | null;
  magazine: {
    status: "available" | "unauthorized" | "unavailable" | "unknown-format";
    firstFree: number | null;
    registered: RegisteredMagazine | null;
  };
}

export function readBenchObservation(value: unknown): BenchObservation {
  if (!isRecord(value) || !isUtcDate(value.observedAt) || !isRecord(value.magazine)) throw new Error("Resposta da bancada incompatível.");
  const { status, firstFree } = value.magazine;
  if (status !== "available" && status !== "unauthorized" && status !== "unavailable" && status !== "unknown-format") throw new Error("Status do gestor inválido.");
  return { observedAt: value.observedAt, order: isCount(value.order) ? value.order : null,
    busy: typeof value.busy === "boolean" ? value.busy : null,
    waiting: typeof value.waiting === "boolean" ? value.waiting : null,
    emergency: typeof value.emergency === "boolean" ? value.emergency : null,
    stored: slotNumber(value.stored) ? value.stored : null, removed: slotNumber(value.removed) ? value.removed : null,
    magazine: { status, firstFree: status === "available" && slotNumber(firstFree) ? firstFree : null,
      registered: status === "available" ? readRegisteredMagazine(value.magazine.registered) : null } };
}
