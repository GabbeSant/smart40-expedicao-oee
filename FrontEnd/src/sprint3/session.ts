import type { ExpeditionSnapshot, Origin, ProductionEvent } from "../processing/contracts.ts";
import { calculateOee } from "../processing/metrics.ts";
import { createExpeditionProcessor } from "../processing/processor.ts";
import { isRecord, isText, isUtcDate, parseProductionEvent } from "../processing/validation.ts";
import { createCumulativeMeter, readCumulativeSample } from "./cumulative.ts";
import type { AnalysisTimes, ProductionCounts } from "./cumulative.ts";
import { readRegisteredMagazine, readSlots, slotNumber } from "./magazine.ts";
import type { RegisteredMagazine, Slot } from "./magazine.ts";

export interface Criteria {
  nominalPerHour: number;
  inspection: string;
  reference: string;
}

export interface ResetEntry {
  author: string;
  at: string;
  unitId: string;
  assetId: string;
  totalBefore: number;
  referenceAt?: string;
  before?: {
    counts: ProductionCounts | null;
    times: AnalysisTimes | null;
    criteria: Criteria | null;
    indicators: ReturnType<typeof indicators>;
    magazine: Magazine | null;
  };
}

export interface Magazine {
  positions: Slot[];
  actuatorPosition: number | null;
  timestamp: string;
}

const unavailable = { availability: null, performance: null, quality: null, oee: null, ppm: null, downtimeSeconds: null };

function readCriteria(value: unknown): Criteria | null {
  if (!isRecord(value) || typeof value.nominalPerHour !== "number" || !Number.isFinite(value.nominalPerHour) ||
      value.nominalPerHour <= 0 || !isText(value.inspection) || !isText(value.reference)) return null;
  return { nominalPerHour: value.nominalPerHour, inspection: value.inspection, reference: value.reference };
}

export function readMagazine(value: unknown, timestamp: string): Magazine | null {
  const positions = readSlots(value);
  return positions ? { positions, actuatorPosition: null, timestamp } : null;
}

/** A Sprint 3 limita performance a 100%, preservando a fórmula original da Sprint 2. */
function indicators(counts: ProductionCounts | null, window: AnalysisTimes | null, criteria: Criteria | null) {
  if (!counts || !criteria || (counts.totalProduced === 0 && window === null)) return unavailable;
  const idealCycleSeconds = 3600 / criteria.nominalPerHour;
  if (!Number.isFinite(idealCycleSeconds)) return unavailable;
  const metrics = calculateOee(counts.totalProduced, counts.approved, window && { ...window, idealCycleSeconds });
  if (Object.values(metrics).some(value => value !== null && !Number.isFinite(value))) return unavailable;
  const performance = metrics.performance === null ? null : Math.min(metrics.performance, 100);
  const oee = performance !== null && metrics.quality !== null && metrics.availability !== null
    ? performance * metrics.quality * metrics.availability / 10000 : null;
  const ppm = window && window.operatingSeconds > 0 ? counts.totalProduced * 60 / window.operatingSeconds : null;
  return { availability: metrics.availability, performance, quality: metrics.quality, oee,
    ppm: ppm !== null && Number.isFinite(ppm) ? ppm : null,
    downtimeSeconds: window ? window.plannedSeconds - window.operatingSeconds : null };
}

export function createSprint3Session(origin: Origin, now = Date.now) {
  let processor: ReturnType<typeof createExpeditionProcessor> | null = null;
  let meter: ReturnType<typeof createCumulativeMeter> | null = null;
  let scope: { unitId: string; assetId: string } | null = null;
  let criteria: Criteria | null = null;
  let magazine: Magazine | null = null;
  let registered: RegisteredMagazine | null = null;
  let productionKnown = false;
  let transport: "UNKNOWN" | "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "STALE" = "UNKNOWN";

  function matchScope(unitId: string, assetId: string) {
    scope ??= { unitId, assetId };
    return scope.unitId === unitId && scope.assetId === assetId;
  }

  function ingest(input: unknown, startedAt?: string, mode?: "pieces" | "counters") {
    if (meter) return;
    let event: ProductionEvent;
    try { event = parseProductionEvent(input); } catch { return; }
    if (event.origin !== origin || event.quality !== "GOOD" || Date.parse(event.timestamp) > now() + 30_000 ||
      (startedAt && Date.parse(startedAt) > Date.parse(event.timestamp)) || !matchScope(event.unitId, event.assetId)) return;
    processor ??= createExpeditionProcessor({ unitId: event.unitId, assetId: event.assetId, origin, now,
      productionMode: mode ?? (event.type === "production.counters" ? "counters" : "pieces"),
      startedAt: event.type === "production.counters" ? event.timestamp :
        startedAt ?? (event.type === "analysis.window" ? event.startedAt : event.timestamp) });
    const result = processor.ingest(event);
    if (result.status === "applied" && (event.type === "piece.processed" || event.type === "production.counters")) productionKnown = true;
  }

  return {
    setConnection(value: unknown) {
      const status = isRecord(value) && isRecord(value.data) ? value.data.status : value;
      if (status === "CONNECTED" || status === "DISCONNECTED" || status === "CONNECTING" || status === "STALE") transport = status;
    },
    receive(value: unknown) {
      if (!isRecord(value)) return;
      if (value.schemaVersion === "1.0" && "streamId" in value) { ingest(value); return; }
      if (value.origin !== origin || !isUtcDate(value.timestamp) || Date.parse(value.timestamp) > now() + 30_000 ||
          !isRecord(value.estacoes) || !isRecord(value.estacoes.expedicao)) return;
      const station = value.estacoes.expedicao;
      if (station.schemaVersion !== "1.0" || !isText(station.unitId) || !isText(station.assetId) ||
        !matchScope(station.unitId, station.assetId)) return;
      const current = readMagazine(station.ocupacao, value.timestamp);
      if (current && (!magazine || Date.parse(current.timestamp) >= Date.parse(magazine.timestamp))) {
        magazine = { ...current, actuatorPosition: slotNumber(station.posicaoAtuador) ? station.posicaoAtuador : null };
      }
      const registry = readRegisteredMagazine(station.estoqueRegistrado);
      if (registry && Date.parse(registry.observedAt) <= Date.parse(value.timestamp) &&
        (!registered || Date.parse(registry.observedAt) >= Date.parse(registered.observedAt))) registered = registry;
      const declaredCriteria = readCriteria(station.criterios);
      if (declaredCriteria && criteria === null) criteria = declaredCriteria;
      if ("amostraAcumulada" in station) {
        const sample = readCumulativeSample(station.amostraAcumulada);
        if (processor || !sample || Date.parse(sample.timestamp) !== Date.parse(value.timestamp)) return;
        if (meter) meter.ingest(sample);
        else meter = createCumulativeMeter(sample);
        return;
      }
      if (Array.isArray(station.eventos) && station.eventos.length <= 128 && isUtcDate(station.inicioSessao) &&
          (station.modoProducao === "pieces" || station.modoProducao === "counters")) {
        for (const event of station.eventos) ingest(event, station.inicioSessao, station.modoProducao);
      }
    },
    view() {
      const snapshot: ExpeditionSnapshot | null = processor?.snapshot() ?? null;
      const cumulative = meter?.view() ?? null;
      const counts = cumulative ? cumulative.counts : productionKnown && snapshot ? {
        totalProduced: snapshot.totalProduced, approved: snapshot.approved, rejected: snapshot.rejected,
      } : null;
      const times = cumulative ? cumulative.times : snapshot?.analysisWindow ?? null;
      const observedAt = cumulative?.observedAt ?? snapshot?.lastUpdated ?? magazine?.timestamp ?? null;
      const stale = observedAt !== null && now() - Date.parse(observedAt) > 15_000;
      const connection = transport === "UNKNOWN" ? observedAt === null ? "UNKNOWN" : stale ? "STALE" : "CONNECTED" :
        transport === "CONNECTED" && stale ? "STALE" : transport;
      return { snapshot, criteria, magazine, registered, productionKnown, cumulative, counts, times,
        connection,
        canReset: cumulative ? cumulative.state !== "baseline" : productionKnown,
        indicators: indicators(counts, times, criteria) };
    },
    reset(author: string, record: (entry: ResetEntry) => void) {
      const name = author.trim();
      if (!name || name.length > 80) throw new Error("Informe o nome de quem solicita o reset.");
      const at = now();
      const previous = this.view();
      const before = structuredClone({ counts: previous.counts, times: previous.times, criteria,
        indicators: previous.indicators, magazine });
      if (meter && scope && meter.view().state !== "baseline") {
        const { totalBefore, referenceAt, countsBefore, timesBefore } = meter.resetInfo();
        if (at < Date.parse(referenceAt)) throw new Error("O relógio local está atrás da fonte de produção.");
        const alignedTimes = timesBefore && timesBefore.operatingSeconds <= timesBefore.plannedSeconds ? timesBefore : null;
        const entry = { author: name, at: new Date(at).toISOString(), ...scope, totalBefore, referenceAt,
          before: { ...before, counts: countsBefore, times: alignedTimes, indicators: indicators(countsBefore, alignedTimes, criteria) } };
        record(entry);
        meter.resetReference();
        return entry;
      }
      const state = processor?.snapshot(at);
      if (!processor || !state || !productionKnown) throw new Error("A sessão ainda não possui leitura de produção.");
      if (at < Date.parse(state.lastUpdated ?? state.sessionStartedAt)) throw new Error("O relógio local está atrás da fonte de produção.");
      const entry = { author: name, at: new Date(at).toISOString(), unitId: state.unitId, assetId: state.assetId, totalBefore: state.totalProduced, before };
      record(entry);
      processor.resetSession(entry.at);
      return entry;
    },
  };
}

export type Sprint3Session = ReturnType<typeof createSprint3Session>;
