/** Contrato proposto v1: confirmar o mapeamento industrial com automação e Grupo 1. */
export type Origin = "medido" | "calculado" | "simulado";
export type Connection = "CONNECTED" | "DISCONNECTED" | "STALE";
export interface EventBase {
  schemaVersion: "1.0";
  eventId: string;
  unitId: string;
  assetId: string;
  /** Nova identidade a cada reinício do produtor; seq nunca reinicia no mesmo stream. */
  streamId: string;
  seq: number;
  timestamp: string;
  origin: Origin;
  quality: "GOOD" | "UNCERTAIN" | "BAD";
}
export type ProductionEvent = EventBase & (
  | { type: "piece.processed"; pieceId: string; productionOrderId: string | null; inspection: "APPROVED" | "REJECTED" }
  | { type: "station.state"; status: "RUNNING" | "STOPPED" | "EMERGENCY" }
  | { type: "production.counters"; counterEpoch: string; totalProduced: number; approved: number; rejected: number }
  | { type: "analysis.window"; startedAt: string; plannedSeconds: number; operatingSeconds: number; idealCycleSeconds: number }
  | { type: "piece.moved"; pieceId: string; stage: "IDENTIFIED" | "STORED" | "DISPATCHED"; position?: number }
);
export interface OrderRecord {
  id: string;
  code: string | null;
  product: string | null;
  /** O status numérico é preservado; Caminho A documenta 1=fila, 2=produção, 3=finalizada. */
  sourceStatusId: number | null;
  plannedQuantity: number | null;
  destination: string | null;
}
export interface PieceRecord {
  pieceId: string;
  productionOrderId: string | null;
  inspection: "APPROVED" | "REJECTED";
  timestamp: string;
  stage: "RECEIVED" | "REJECTED" | "IDENTIFIED" | "STORED" | "DISPATCHED";
  position: number | null;
  lastMovement: string;
}
export interface MovementRecord {
  eventId: string;
  pieceId: string;
  productionOrderId: string | null;
  stage: PieceRecord["stage"];
  timestamp: string;
  position: number | null;
}
export interface ProcessorOptions {
  unitId: string;
  assetId: string;
  origin: Origin;
  /** Nunca somar eventos individuais e contadores acumulados na mesma instância. */
  productionMode?: "pieces" | "counters";
  startedAt?: string;
  rackCapacity?: number;
  staleAfterMs?: number;
  now?: () => number;
  storage?: { load(): string | null; save(serialized: string): void };
}
export interface ExpeditionSnapshot {
  schemaVersion: "1.0";
  unitId: string;
  assetId: string;
  origin: Origin;
  productionMode: "pieces" | "counters";
  sessionStartedAt: string;
  totalProduced: number;
  approved: number;
  rejected: number;
  quality: number | null;
  availability: number | null;
  performance: number | null;
  oee: number | null;
  /** Indicador chamado OEE no exemplo FFE-Sprint2 p.9; matematicamente é a qualidade. */
  oeeSimplified: number | null;
  /** Contagem de peças em (agora - 60s, agora], dividida por um minuto fixo. */
  ppm: number;
  ppmExact: boolean;
  metricWarnings: string[];
  station: "UNKNOWN" | "RUNNING" | "STOPPED" | "EMERGENCY";
  connection: Connection;
  lastUpdated: string | null;
  computedAt: string;
  lastReceivedAt: string | null;
  analysisWindow: { startedAt: string; updatedAt: string; plannedSeconds: number; operatingSeconds: number; idealCycleSeconds: number } | null;
  orders: (OrderRecord & { totalProduced: number; approved: number; rejected: number })[];
  unassociatedProduced: number;
  pieces: PieceRecord[];
  queue: string[];
  rack: (string | null)[];
  movements: MovementRecord[];
  history: { minute: string; approved: number; rejected: number }[];
}
export interface IngestResult {
  status: "applied" | "duplicate" | "rejected";
  reason?: string;
}
