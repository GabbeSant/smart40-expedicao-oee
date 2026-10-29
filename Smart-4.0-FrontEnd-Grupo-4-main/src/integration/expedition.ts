import type { OeeInputs } from "../domain/warehouse";
import type { Shipment } from "../domain/expedition";
import type {
  Batch,
  Movement,
  StoredBatch,
  WarehouseState,
} from "../domain/warehouse";
import { isTelemetriaSmart40 } from "../types/smart40";

/** Evento de entrada para a SPA hospedeira. O payload contém apenas dados; nunca comandos. */
export const SMART40_EXPEDITION_SNAPSHOT_EVENT = "smart40:expedition:snapshot";

export type MachineConnection = "CONNECTED" | "STALE" | "DISCONNECTED";
export type MachineDataQuality = "GOOD" | "UNCERTAIN" | "BAD";

export interface MachineSignal {
  id: string;
  label: string;
  value: boolean | null;
  quality: MachineDataQuality;
  timestamp: string | null;
}

export interface MachineTelemetryReading {
  tag: string;
  value: string | number | boolean | null;
  unit: string | null;
  quality: MachineDataQuality;
  timestamp: string | null;
}

export interface MachineActuator {
  id: "vertical" | "horizontal" | "rotary" | string;
  label: string;
  position: number | null;
  unit: "mm" | "°" | string;
  status: string | null;
  quality: MachineDataQuality;
  timestamp: string | null;
}

export interface MachineExpeditionSnapshot {
  schemaVersion: "1.0";
  eventId: string;
  unitId: string;
  assetId: string;
  componentId: string;
  timestamp: string;
  source: "machine" | "gateway" | "simulated";
  connection: MachineConnection;
  telemetry: import("../types/smart40").TelemetriaSmart40;
  readings: MachineTelemetryReading[];
  warehouse: Pick<WarehouseState, "rack" | "queue" | "receipt" | "movements" | "oeeInputs"> & {
    shipments: Shipment[];
  };
  digitalOutputs: MachineSignal[];
  actuators: MachineActuator[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const isText = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;
const isDate = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const isQuality = (value: unknown): value is MachineDataQuality =>
  value === "GOOD" || value === "UNCERTAIN" || value === "BAD";

function isBatch(value: unknown): value is Batch {
  return (
    isRecord(value) &&
    isText(value.orderCode) &&
    isText(value.product) &&
    isText(value.destination) &&
    isCount(value.pieces) &&
    value.pieces > 0
  );
}

function isStoredBatch(value: unknown): value is StoredBatch {
  return (
    isRecord(value) &&
    isText(value.orderCode) &&
    isText(value.product) &&
    isText(value.destination) &&
    isCount(value.pieces) &&
    value.pieces > 0 &&
    isText(value.id) &&
    isDate(value.receivedAt) &&
    isDate(value.identifiedAt) &&
    isDate(value.storedAt)
  );
}

function isMovement(value: unknown): value is Movement {
  return (
    isRecord(value) &&
    isText(value.id) &&
    isText(value.orderCode) &&
    isCount(value.pieces) &&
    isDate(value.timestamp) &&
    ["RECEBIDO", "IDENTIFICADO", "ARMAZENADO", "EXPEDIDO"].includes(
      String(value.stage),
    ) &&
    (value.position === undefined ||
      (isCount(value.position) && value.position > 0))
  );
}

function isShipment(value: unknown): value is Shipment {
  return (
    isRecord(value) &&
    isText(value.id) &&
    isText(value.orderCode) &&
    isText(value.product) &&
    isText(value.destination) &&
    isCount(value.pieces) &&
    value.pieces > 0 &&
    isDate(value.timestamp) &&
    isCount(value.position) &&
    value.position > 0
  );
}

function isSignal(value: unknown): value is MachineSignal {
  return (
    isRecord(value) &&
    isText(value.id) &&
    isText(value.label) &&
    (typeof value.value === "boolean" || value.value === null) &&
    isQuality(value.quality) &&
    (value.timestamp === null || isDate(value.timestamp))
  );
}

function isReading(value: unknown): value is MachineTelemetryReading {
  return (
    isRecord(value) &&
    isText(value.tag) &&
    /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(value.tag) &&
    (value.value === null ||
      typeof value.value === "string" ||
      typeof value.value === "boolean" ||
      (typeof value.value === "number" && Number.isFinite(value.value))) &&
    (typeof value.unit === "string" || value.unit === null) &&
    isQuality(value.quality) &&
    (value.timestamp === null || isDate(value.timestamp))
  );
}

function isActuator(value: unknown): value is MachineActuator {
  return (
    isRecord(value) &&
    isText(value.id) &&
    isText(value.label) &&
    ((typeof value.position === "number" && Number.isFinite(value.position)) ||
      value.position === null) &&
    isText(value.unit) &&
    (typeof value.status === "string" || value.status === null) &&
    isQuality(value.quality) &&
    (value.timestamp === null || isDate(value.timestamp))
  );
}

/** Valida o contrato recebido pela SPA antes de permitir que ele chegue à interface. */
export function isMachineExpeditionSnapshot(
  value: unknown,
): value is MachineExpeditionSnapshot {
  if (!isRecord(value) || !isRecord(value.warehouse)) return false;
  const warehouse = value.warehouse;
  const receipt = warehouse.receipt;
  const inputs = warehouse.oeeInputs as OeeInputs | undefined;
  const rack = warehouse.rack;
  return (
    value.schemaVersion === "1.0" &&
    isText(value.eventId) &&
    isText(value.unitId) &&
    isText(value.assetId) &&
    isText(value.componentId) &&
    isDate(value.timestamp) &&
    ["machine", "gateway", "simulated"].includes(String(value.source)) &&
    ["CONNECTED", "STALE", "DISCONNECTED"].includes(
      String(value.connection),
    ) &&
    isTelemetriaSmart40(value.telemetry) &&
    Array.isArray(value.readings) &&
    value.readings.every(isReading) &&
    Array.isArray(rack) &&
    [8, 12, 16, 24].includes(rack.length) &&
    rack.every((batch) => batch === null || isStoredBatch(batch)) &&
    Array.isArray(warehouse.queue) &&
    warehouse.queue.every(isBatch) &&
    isRecord(receipt) &&
    typeof receipt.orderCode === "string" &&
    isDate(receipt.receivedAt) &&
    (receipt.identifiedAt === null || isDate(receipt.identifiedAt)) &&
    Array.isArray(warehouse.movements) &&
    warehouse.movements.every(isMovement) &&
    Array.isArray(warehouse.shipments) &&
    warehouse.shipments.every(isShipment) &&
    isRecord(inputs) &&
    [inputs.plannedSeconds, inputs.stoppedSeconds, inputs.idealCycleSeconds].every(
      (number) => typeof number === "number" && Number.isFinite(number) && number >= 0,
    ) &&
    inputs.stoppedSeconds <= inputs.plannedSeconds &&
    inputs.idealCycleSeconds > 0 &&
    warehouse.queue.reduce((sum, batch) => sum + batch.pieces, 0) ===
      (value.telemetry as import("../types/smart40").TelemetriaSmart40)
        .metricasExpedicao.tamanhoFilaSaida &&
    Array.isArray(value.digitalOutputs) &&
    value.digitalOutputs.every(isSignal) &&
    Array.isArray(value.actuators) &&
    value.actuators.every(isActuator)
  );
}

