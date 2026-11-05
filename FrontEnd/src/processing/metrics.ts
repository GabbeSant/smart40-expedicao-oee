export function calculateQuality(approved: number, total: number): number | null {
  if (![approved, total].every(v => Number.isSafeInteger(v) && v >= 0) || approved > total)
    throw new Error("Contagem inválida para qualidade");
  return total > 0 ? approved / total * 100 : null;
}

export function calculateOee(total: number, approved: number, window: {
  plannedSeconds: number; operatingSeconds: number; idealCycleSeconds: number;
} | null) {
  const quality = calculateQuality(approved, total);
  if (window && (![window.plannedSeconds, window.operatingSeconds, window.idealCycleSeconds].every(v => Number.isFinite(v) && v >= 0) ||
    window.idealCycleSeconds <= 0 || window.operatingSeconds > window.plannedSeconds))
    throw new Error("Tempos ou ciclo ideal inválidos");
  const availability = window && window.plannedSeconds > 0
    ? window.operatingSeconds / window.plannedSeconds * 100 : null;
  const performance = window && window.operatingSeconds > 0
    ? total * window.idealCycleSeconds / window.operatingSeconds * 100 : null;
  // Performance >100% é mantida para revelar premissas incorretas, sem mascarar a medição.
  const oee = quality !== null && availability !== null && performance !== null
    ? availability * performance * quality / 10000 : null;
  return { quality, availability, performance, oee };
}

export function calculatePpm(samples: { timestamp: string; count: number }[], now: number): number {
  return samples.reduce((sum, item) => {
    const at = Date.parse(item.timestamp);
    return sum + (at > now - 60000 && at <= now ? item.count : 0);
  }, 0);
}
