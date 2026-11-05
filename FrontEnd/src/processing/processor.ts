import type {
  Connection, ExpeditionSnapshot, IngestResult, MovementRecord, OrderRecord,
  PieceRecord, ProcessorOptions, ProductionEvent,
} from "./contracts.ts";
import { calculateOee, calculatePpm } from "./metrics.ts";
import { isCount, isRecord, isText, isUtcDate, parseProductionEvent } from "./validation.ts";

type Action = { kind: "event"; event: ProductionEvent } | { kind: "reset"; timestamp: string } |
  { kind: "orders"; orders: OrderRecord[] };
type Counters = Extract<ProductionEvent, { type: "production.counters" }>;
type Analysis = Extract<ProductionEvent, { type: "analysis.window" }>;
interface State {
  startedAt: string; total: number; approved: number; rejected: number;
  seen: Set<string>; piecesSeen: Set<string>; sequences: Map<string, number>;
  pieces: Map<string, PieceRecord>; movements: MovementRecord[];
  samples: { timestamp: string; count: number; approved: number; rejected: number; orderId: string | null }[];
  counters: Counters | null; counterEpochs: Set<string>; analysis: Analysis | null;
  station: ExpeditionSnapshot["station"]; lastUpdated: string | null; orders: OrderRecord[];
  stationTimestamp: string | null;
}

/** Processador sem React, DOM, sockets ou comandos de máquina. Uma instância por ativo/origem. */
export function createExpeditionProcessor(options: ProcessorOptions) {
  const now = options.now ?? Date.now;
  const mode = options.productionMode ?? "pieces";
  const capacity = options.rackCapacity ?? 12; // Manual N2, p.18: magazine de 12 posições.
  const staleAfter = options.staleAfterMs ?? 15000;
  const initialStart = options.startedAt ?? new Date(now()).toISOString();
  if (![options.unitId, options.assetId].every(isText) || !["medido", "calculado", "simulado"].includes(options.origin) ||
    !["pieces", "counters"].includes(mode) || !isCount(capacity) || capacity < 1 || capacity > 1000 ||
    !Number.isFinite(staleAfter) || staleAfter <= 0 || !isUtcDate(initialStart)) throw new Error("Configuração inválida");
  let log: Action[] = [];
  let initial = initialStart;
  let transport: Connection = "DISCONNECTED";
  let lastReceivedAt: string | null = null;
  let connectedAt: number | null = null;
  const empty = (): State => ({
    startedAt: initial, total: 0, approved: 0, rejected: 0, seen: new Set(), piecesSeen: new Set(),
    sequences: new Map(), pieces: new Map(), movements: [], samples: [], counters: null, analysis: null,
    counterEpochs: new Set(), station: "UNKNOWN", stationTimestamp: null, lastUpdated: null, orders: [],
  });
  let state = empty();

  function apply(s: State, event: ProductionEvent): IngestResult {
    if (event.unitId !== options.unitId || event.assetId !== options.assetId || event.origin !== options.origin)
      return { status: "rejected", reason: "Ativo, unidade ou origem diferente desta instância" };
    if (event.quality !== "GOOD") return { status: "rejected", reason: `Qualidade ${event.quality}: amostra não contabilizada` };
    if (s.seen.has(event.eventId)) return { status: "duplicate", reason: "eventId já processado" };
    if (event.seq <= (s.sequences.get(event.streamId) ?? -1)) return { status: "rejected", reason: "Sequência antiga ou fora de ordem" };
    if (Date.parse(event.timestamp) < Date.parse(s.startedAt)) return { status: "rejected", reason: "Evento anterior à sessão" };
    let count = 0, approved = 0, rejected = 0, orderId: string | null = null;
    if (event.type === "piece.processed") {
      if (mode !== "pieces") return { status: "rejected", reason: "Instância configurada para contadores" };
      if (s.piecesSeen.has(event.pieceId)) return { status: "duplicate", reason: "Peça já contabilizada" };
      approved = event.inspection === "APPROVED" ? 1 : 0;
      rejected = 1 - approved; count = 1; orderId = event.productionOrderId;
      const piece: PieceRecord = {
        pieceId: event.pieceId, productionOrderId: orderId, inspection: event.inspection,
        timestamp: event.timestamp, stage: approved ? "RECEIVED" : "REJECTED", position: null, lastMovement: event.timestamp,
      };
      s.piecesSeen.add(event.pieceId); s.pieces.set(event.pieceId, piece);
      s.movements.push({ eventId: event.eventId, pieceId: event.pieceId, productionOrderId: orderId,
        stage: piece.stage, timestamp: event.timestamp, position: null });
    } else if (event.type === "production.counters") {
      if (mode !== "counters") return { status: "rejected", reason: "Instância configurada para peças individuais" };
      const previous = s.counters;
      if (previous && Date.parse(event.timestamp) < Date.parse(previous.timestamp))
        return { status: "rejected", reason: "Snapshot de contadores anterior ao último aplicado" };
      if (previous && previous.counterEpoch === event.counterEpoch) {
        count = event.totalProduced - previous.totalProduced;
        approved = event.approved - previous.approved; rejected = event.rejected - previous.rejected;
        if ([count, approved, rejected].some(v => v < 0))
          return { status: "rejected", reason: "Contador regrediu sem nova counterEpoch" };
      } else if (s.counterEpochs.has(event.counterEpoch)) {
        return { status: "rejected", reason: "counterEpoch já encerrada" };
      }
      // Primeira leitura e nova época são referências, nunca produção fictícia.
      s.counters = event;
      s.counterEpochs.add(event.counterEpoch);
    } else if (event.type === "analysis.window") {
      if (Date.parse(event.startedAt) !== Date.parse(s.startedAt))
        return { status: "rejected", reason: "Tempos e contadores precisam representar a mesma sessão" };
      if (s.analysis && (Date.parse(event.timestamp) < Date.parse(s.analysis.timestamp) ||
        event.plannedSeconds < s.analysis.plannedSeconds || event.operatingSeconds < s.analysis.operatingSeconds))
        return { status: "rejected", reason: "Janela de análise regrediu" };
      s.analysis = event;
    } else if (event.type === "station.state") {
      if (s.stationTimestamp && Date.parse(event.timestamp) < Date.parse(s.stationTimestamp))
        return { status: "rejected", reason: "Estado da estação anterior ao último aplicado" };
      s.station = event.status;
      s.stationTimestamp = event.timestamp;
    } else {
      const piece = s.pieces.get(event.pieceId);
      if (!piece || piece.inspection === "REJECTED") return { status: "rejected", reason: "Peça desconhecida ou rejeitada" };
      if (Date.parse(event.timestamp) < Date.parse(piece.lastMovement)) return { status: "rejected", reason: "Movimentação anterior à última etapa" };
      const required = { IDENTIFIED: "RECEIVED", STORED: "IDENTIFIED", DISPATCHED: "STORED" };
      if (piece.stage !== required[event.stage]) return { status: "rejected", reason: "Transição de expedição inválida" };
      if (event.stage === "STORED" && (event.position! > capacity ||
        [...s.pieces.values()].some(p => p.stage === "STORED" && p.position === event.position)))
        return { status: "rejected", reason: "Posição indisponível no magazine" };
      if (event.stage === "DISPATCHED" && piece.position !== event.position)
        return { status: "rejected", reason: "Posição de saída diferente do armazenamento" };
      piece.stage = event.stage; piece.position = event.stage === "IDENTIFIED" ? null : event.position!;
      piece.lastMovement = event.timestamp;
      s.movements.push({ eventId: event.eventId, pieceId: event.pieceId, productionOrderId: piece.productionOrderId,
        stage: piece.stage, timestamp: event.timestamp, position: piece.position });
    }
    if (![s.total + count, s.approved + approved, s.rejected + rejected].every(Number.isSafeInteger))
      return { status: "rejected", reason: "Limite numérico da sessão excedido" };
    s.total += count; s.approved += approved; s.rejected += rejected;
    if (count) s.samples.push({ timestamp: event.timestamp, count, approved, rejected, orderId });
    s.seen.add(event.eventId); s.sequences.set(event.streamId, event.seq);
    if (!s.lastUpdated || Date.parse(event.timestamp) > Date.parse(s.lastUpdated)) s.lastUpdated = event.timestamp;
    return { status: "applied" };
  }

  const scope = () => ({ unitId: options.unitId, assetId: options.assetId, origin: options.origin, mode, capacity });
  function commit(next: State, action: Action) {
    const nextLog = [...log, action];
    // Persistir antes de publicar/confirmar. Erro de armazenamento não confirma uma peça.
    options.storage?.save(JSON.stringify({ version: 1, scope: scope(), initial, actions: nextLog }));
    state = next; log = nextLog;
  }
  function applyReset(s: State, timestamp: string) {
    if (!isUtcDate(timestamp) || Date.parse(timestamp) < Date.parse(s.lastUpdated ?? s.startedAt))
      throw new Error("Reset anterior à última atualização");
    s.startedAt = timestamp; s.total = 0; s.approved = 0; s.rejected = 0; s.samples = []; s.analysis = null;
    // Preserva identidades, baseline de contadores, posição física e rastreabilidade.
  }
  function validateOrders(orders: unknown): asserts orders is OrderRecord[] {
    if (!Array.isArray(orders) || !orders.every(o => isRecord(o) && isText(o.id) &&
      [o.code, o.product, o.destination].every(v => v === null || isText(v)) &&
      (o.sourceStatusId === null || isCount(o.sourceStatusId)) &&
      (o.plannedQuantity === null || isCount(o.plannedQuantity))) || new Set(orders.map(o => o.id)).size !== orders.length)
      throw new Error("Catálogo de ordens inválido ou duplicado");
  }
  const saved = options.storage?.load();
  if (saved !== null && saved !== undefined) {
    const data: unknown = JSON.parse(saved);
    if (!isRecord(data) || data.version !== 1 || JSON.stringify(data.scope) !== JSON.stringify(scope()) ||
      !isUtcDate(data.initial) || !Array.isArray(data.actions)) throw new Error("Checkpoint incompatível; não foi apagado");
    initial = data.initial; state = empty();
    for (const item of data.actions) {
      if (!isRecord(item)) throw new Error("Checkpoint corrompido");
      if (item.kind === "event") {
        const result = apply(state, parseProductionEvent(item.event));
        if (result.status !== "applied") throw new Error(`Checkpoint inválido: ${result.reason}`);
      } else if (item.kind === "reset" && isUtcDate(item.timestamp)) applyReset(state, item.timestamp);
      else if (item.kind === "orders") { validateOrders(item.orders); state.orders = structuredClone(item.orders); }
      else throw new Error("Ação desconhecida no checkpoint");
    }
    log = data.actions as Action[];
  }

  return {
    ingest(input: unknown): IngestResult {
      let event: ProductionEvent;
      try { event = parseProductionEvent(input); } catch (error) {
        return { status: "rejected", reason: (error as Error).message };
      }
      if (Date.parse(event.timestamp) > now() + 30000) return { status: "rejected", reason: "Timestamp futuro: verifique o relógio da origem" };
      const next = structuredClone(state);
      const result = apply(next, event);
      if (result.status === "applied") commit(next, { kind: "event", event });
      if (result.status !== "rejected") lastReceivedAt = new Date(now()).toISOString();
      return result;
    },
    setConnection(connection: Exclude<Connection, "STALE">) {
      if (!["CONNECTED", "DISCONNECTED"].includes(connection)) throw new Error("Estado de conexão inválido");
      transport = connection;
      connectedAt = now();
    },
    replaceOrders(orders: OrderRecord[]) {
      validateOrders(orders); const next = structuredClone(state); next.orders = structuredClone(orders);
      commit(next, { kind: "orders", orders: next.orders });
    },
    resetSession(timestamp = new Date(now()).toISOString()) {
      const next = structuredClone(state); applyReset(next, timestamp); commit(next, { kind: "reset", timestamp });
    },
    serialize: () => JSON.stringify({ version: 1, scope: scope(), initial, actions: log }),
    snapshot(at = now()): ExpeditionSnapshot {
      const latestProduction = state.samples.reduce((latest, sample) => Math.max(latest, Date.parse(sample.timestamp)), 0);
      const analysis = state.analysis && Date.parse(state.analysis.timestamp) >= latestProduction ? state.analysis : null;
      const metrics = calculateOee(state.total, state.approved, analysis);
      const history = new Map<string, { minute: string; approved: number; rejected: number }>();
      const byOrder = new Map<string, { totalProduced: number; approved: number; rejected: number }>();
      let unassociatedProduced = 0;
      for (const sample of state.samples) {
        const minute = new Date(sample.timestamp).toISOString().slice(0, 16) + ":00Z";
        const bucket = history.get(minute) ?? { minute, approved: 0, rejected: 0 };
        bucket.approved += sample.approved; bucket.rejected += sample.rejected; history.set(minute, bucket);
        if (sample.orderId === null) unassociatedProduced += sample.count;
        else {
          const total = byOrder.get(sample.orderId) ?? { totalProduced: 0, approved: 0, rejected: 0 };
          total.totalProduced += sample.count; total.approved += sample.approved; total.rejected += sample.rejected;
          byOrder.set(sample.orderId, total);
        }
      }
      const orders = state.orders.map(order => ({ ...order, ...(byOrder.get(order.id) ?? { totalProduced: 0, approved: 0, rejected: 0 }) }));
      for (const [id, counts] of byOrder) if (!orders.some(o => o.id === id)) orders.push({
        id, code: null, product: null, sourceStatusId: null, plannedQuantity: null, destination: null, ...counts,
      });
      const rack: (string | null)[] = Array.from({ length: capacity }, () => null);
      for (const piece of state.pieces.values()) if (piece.stage === "STORED") rack[piece.position! - 1] = piece.pieceId;
      const warnings: string[] = [];
      if (!analysis) warnings.push("OEE indisponível: faltam tempos e ciclo ideal atualizados da mesma sessão");
      if (metrics.performance !== null && metrics.performance > 100) warnings.push("Performance acima de 100%: confira o ciclo ideal e a janela de análise");
      if (mode === "counters") warnings.push("PPM e histórico aproximados: deltas atribuídos ao instante da leitura; primeira leitura é baseline");
      const lastContact = lastReceivedAt ? Date.parse(lastReceivedAt) : connectedAt;
      return structuredClone({
        schemaVersion: "1.0", unitId: options.unitId, assetId: options.assetId, origin: options.origin, productionMode: mode,
        sessionStartedAt: state.startedAt, totalProduced: state.total, approved: state.approved, rejected: state.rejected,
        ...metrics, oeeSimplified: metrics.quality,
        ppm: calculatePpm(state.samples, at), ppmExact: mode === "pieces", metricWarnings: warnings,
        station: state.station, connection: transport === "DISCONNECTED" ? "DISCONNECTED" :
          lastContact === null || at - lastContact > staleAfter ? "STALE" : "CONNECTED",
        lastUpdated: state.lastUpdated, computedAt: new Date(at).toISOString(), lastReceivedAt,
        analysisWindow: analysis ? { startedAt: analysis.startedAt, updatedAt: analysis.timestamp,
          plannedSeconds: analysis.plannedSeconds, operatingSeconds: analysis.operatingSeconds, idealCycleSeconds: analysis.idealCycleSeconds } : null,
        orders, unassociatedProduced,
        pieces: [...state.pieces.values()], queue: [...state.pieces.values()].filter(p => ["RECEIVED", "IDENTIFIED"].includes(p.stage)).map(p => p.pieceId),
        rack, movements: state.movements, history: [...history.values()].sort((a, b) => a.minute.localeCompare(b.minute)),
      });
    },
  };
}
export type ExpeditionProcessor = ReturnType<typeof createExpeditionProcessor>;
