import { isCount, isRecord, isUtcDate } from "../processing/validation.ts";

export type Slot = boolean | null;
export const slotNumber = (x: unknown): x is number => isCount(x) && x >= 1 && x <= 12;

export interface RegisteredMagazine {
  complete: boolean;
  positions: Slot[];
  observedAt: string;
}

export function readSlots(value: unknown): Slot[] | null {
  if (!Array.isArray(value) || value.length !== 12) return null;
  const positions = Array.from(value);
  return positions.every((slot: unknown) => slot === null || typeof slot === "boolean") ? positions : null;
}

export function readRegisteredMagazine(value: unknown): RegisteredMagazine | null {
  if (!isRecord(value) || typeof value.complete !== "boolean" || !isUtcDate(value.observedAt)) return null;
  const positions = readSlots(value.positions);
  if (!positions || (value.complete && positions.includes(null))) return null;
  return { complete: value.complete, positions, observedAt: value.observedAt };
}

/** GET /api/blocks: armazenamento 2 é Expedição. Ausência em lista parcial não confirma vaga livre. */
export function readRegisteredBlocks(value: unknown, observedAt: string): RegisteredMagazine | null {
  const rows = Array.isArray(value) ? value : isRecord(value) ? value.items : null;
  if (!Array.isArray(rows) || !isUtcDate(observedAt)) return null;
  const complete = isRecord(value) && value.complete === true;
  const occupied = new Set<number>();
  for (const row of rows as unknown[]) {
    if (!isRecord(row)) return null;
    const storage = row.storageId ?? row.StorageId;
    if (!isCount(storage) || storage < 1 || (row.storageId != null && row.StorageId != null && row.storageId !== row.StorageId)) return null;
    if (storage === 2) {
      if (!slotNumber(row.position) || occupied.has(row.position)) return null;
      occupied.add(row.position);
    }
  }
  return { complete, positions: Array.from({ length: 12 }, (_, index) => occupied.has(index + 1) ? true : complete ? false : null), observedAt };
}

export function reconcileSlot(sensor: Slot, registered: Slot) {
  if (sensor === null || registered === null) return "unknown";
  return sensor === registered ? "matches" : "differs";
}
