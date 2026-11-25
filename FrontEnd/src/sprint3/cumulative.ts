import { isCount, isRecord, isText, isUtcDate } from "../processing/validation.ts";

export interface ProductionCounts { totalProduced: number; approved: number; rejected: number }
export interface AnalysisTimes { plannedSeconds: number; operatingSeconds: number }

interface CumulativeSample extends ProductionCounts {
  epoch: string;
  seq: number;
  timestamp: string;
  times: AnalysisTimes | null;
}

function seconds(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function readCumulativeSample(value: unknown): CumulativeSample | null {
  if (!isRecord(value) || value.quality !== "GOOD" || !isText(value.epoch) || !isCount(value.seq) || !isUtcDate(value.timestamp) ||
    !isCount(value.totalProduced) || !isCount(value.approved) || !isCount(value.rejected) || value.totalProduced !== value.approved + value.rejected) return null;
  const { plannedSeconds, operatingSeconds } = value;
  const times = seconds(plannedSeconds) && seconds(operatingSeconds) && operatingSeconds <= plannedSeconds
    ? { plannedSeconds, operatingSeconds } : null;
  if (times === null && (plannedSeconds != null || operatingSeconds != null)) return null;
  return { epoch: value.epoch, seq: value.seq, timestamp: value.timestamp, totalProduced: value.totalProduced,
    approved: value.approved, rejected: value.rejected, times };
}

function newer(next: CumulativeSample, previous: CumulativeSample) {
  return next.seq > previous.seq && Date.parse(next.timestamp) > Date.parse(previous.timestamp) &&
    next.approved >= previous.approved && next.rejected >= previous.rejected;
}

function timesRegressed(next: AnalysisTimes | null, previous: AnalysisTimes | null) {
  return next !== null && previous !== null && (next.plannedSeconds < previous.plannedSeconds ||
    next.operatingSeconds < previous.operatingSeconds);
}

/** Mantém peças e tempos na mesma janela. A primeira amostra é apenas referência. */
export function createCumulativeMeter(first: CumulativeSample) {
  let baseline = first;
  let latest = first;
  let nextEpoch: CumulativeSample | null = null;
  let lastTimed = first.times;
  const closedEpochs = new Set<string>();

  return {
    ingest(sample: CumulativeSample) {
      if (closedEpochs.has(sample.epoch)) return;
      if (nextEpoch !== null) {
        if (sample.epoch === nextEpoch.epoch && newer(sample, nextEpoch) && !timesRegressed(sample.times, nextEpoch.times)) nextEpoch = sample;
        return;
      }
      if (sample.epoch !== latest.epoch) {
        if (Date.parse(sample.timestamp) > Date.parse(latest.timestamp)) nextEpoch = sample;
        return;
      }
      if (!newer(sample, latest)) return;
      if (timesRegressed(sample.times, lastTimed)) return;
      latest = sample;
      if (sample.times) lastTimed = sample.times;
    },
    view() {
      const counts = nextEpoch === null && latest !== baseline ? {
        totalProduced: latest.totalProduced - baseline.totalProduced,
        approved: latest.approved - baseline.approved, rejected: latest.rejected - baseline.rejected,
      } : null;
      const elapsed = baseline.times && latest.times ? {
        plannedSeconds: latest.times.plannedSeconds - baseline.times.plannedSeconds,
        operatingSeconds: latest.times.operatingSeconds - baseline.times.operatingSeconds,
      } : null;
      const times = counts && elapsed && elapsed.operatingSeconds <= elapsed.plannedSeconds ? elapsed : null;
      return { counts, times, observedAt: (nextEpoch ?? latest).timestamp, referenceAt: baseline.timestamp,
        state: nextEpoch ? "epoch-change" as const : counts ? "active" as const : "baseline" as const };
    },
    resetReference() {
      if (nextEpoch) closedEpochs.add(latest.epoch);
      baseline = latest = nextEpoch ?? latest;
      nextEpoch = null;
      lastTimed = baseline.times;
    },
    resetInfo: () => ({ totalBefore: latest.totalProduced - baseline.totalProduced, referenceAt: (nextEpoch ?? latest).timestamp,
      countsBefore: { totalProduced: latest.totalProduced - baseline.totalProduced,
        approved: latest.approved - baseline.approved, rejected: latest.rejected - baseline.rejected },
      timesBefore: baseline.times && latest.times ? { plannedSeconds: latest.times.plannedSeconds - baseline.times.plannedSeconds,
        operatingSeconds: latest.times.operatingSeconds - baseline.times.operatingSeconds } : null }),
  };
}
