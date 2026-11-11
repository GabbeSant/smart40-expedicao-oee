/**
 * SMART 4.0 / Planta N2 — contrato preliminar v0.1.0
 * Escopo: mock/local de Sprint 1. NÃO autoriza comandos em CLP, robô ou planta física.
 * Campos, unidades, enums e origem devem ser validados com o responsável técnico e Swagger.
 */
export const SCHEMA_VERSION = "0.1.0" as const;

export type ISODateTime = string;
export type EventSource = "mock" | "gateway";
export type ModuleId = "shell" | "ihm" | "robot" | "traceability" | "expedition";
export type MachineStatus =
  | "IDLE"
  | "RUNNING"
  | "ALARM"
  | "MAINTENANCE"
  | "EMERGENCY"
  | "SAFETY_FAULT"
  | "UNKNOWN";
export type OperatingMode = "MANUAL" | "AUTOMATIC" | "MAINTENANCE";

export interface EventEnvelope<TType extends string, TData> {
  schemaVersion: typeof SCHEMA_VERSION;
  eventId: string;
  type: TType;
  timestamp: ISODateTime;
  source: EventSource;
  data: TData;
}

export type MachineTelemetryEvent = EventEnvelope<
  "machine.telemetry",
  {
    status: MachineStatus;
    mode: OperatingMode;
    emergencyActive: boolean;
    safetyInterlockOk: boolean;
    cycleTimeMs?: number;
    alarmCodes: string[];
  }
>;

export type RobotProgramStatus = "IDLE" | "RUNNING" | "PAUSED" | "FAULT" | "UNKNOWN";
export type GripperState = "OPEN" | "CLOSED" | "UNKNOWN";

export type RobotTelemetryEvent = EventEnvelope<
  "robot.telemetry",
  {
    jointAnglesDeg: [number, number, number, number, number, number];
    cartesianMm: { x: number; y: number; z: number };
    gripper: GripperState;
    speedPercent: number;
    programStatus: RobotProgramStatus;
    programName?: string;
  }
>;

export type InspectionResult = "PENDING" | "APPROVED" | "REJECTED";
export type TraceabilityScanEvent = EventEnvelope<
  "traceability.piece-scanned",
  {
    pieceId: string;
    code: string;
    lotId?: string;
    scannedAt: ISODateTime;
    result: InspectionResult;
    reason?: string;
  }
>;

export type ExpeditionMetricsEvent = EventEnvelope<
  "expedition.metrics",
  {
    producedTotal: number;
    piecesPerMinute: number;
    outputQueue: number;
    activeOrders: number;
    pallet: { currentCount: number; capacity: number; occupiedSlots?: number };
  }
>;

export type CommandTarget = "machine" | "robot" | "traceability" | "expedition";
export type CommandAction =
  | "START"
  | "STOP"
  | "RESET"
  | "EMERGENCY_STOP"
  | "MOVE_LEFT"
  | "MOVE_RIGHT"
  | "ROBOT_START"
  | "ROBOT_PAUSE"
  | "SCAN_SIMULATED"
  | "ORDER_RELEASE"
  | "PALLETIZE";

/** Sprint 1: todas as solicitações precisam permanecer explicitamente simuladas. */
export type CommandRequestedEvent = EventEnvelope<
  "command.requested",
  {
    commandId: string;
    target: CommandTarget;
    action: CommandAction;
    sourceModule: Exclude<ModuleId, "shell">;
    simulation: true;
    parameters?: Record<string, string | number | boolean>;
  }
>;

export type CommandAckEvent = EventEnvelope<
  "command.ack",
  {
    commandId: string;
    result: "SIMULATED" | "ACCEPTED" | "REJECTED";
    message?: string;
  }
>;

export type ConnectionState = "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "STALE";
export type ConnectionStateEvent = EventEnvelope<
  "connection.state",
  { state: ConnectionState; latencyMs?: number; lastTelemetryAt?: ISODateTime }
>;

export type Smart40Event =
  | MachineTelemetryEvent
  | RobotTelemetryEvent
  | TraceabilityScanEvent
  | ExpeditionMetricsEvent
  | CommandRequestedEvent
  | CommandAckEvent
  | ConnectionStateEvent;

/** Mock ilustrativo para integração de interface; não representa leitura da Planta N2. */
export const mockMachineTelemetry: MachineTelemetryEvent = {
  schemaVersion: SCHEMA_VERSION,
  eventId: "mock-machine-001",
  type: "machine.telemetry",
  timestamp: "2026-10-07T15:00:00.000Z",
  source: "mock",
  data: {
    status: "IDLE",
    mode: "MANUAL",
    emergencyActive: false,
    safetyInterlockOk: true,
    cycleTimeMs: 0,
    alarmCodes: [],
  },
};
