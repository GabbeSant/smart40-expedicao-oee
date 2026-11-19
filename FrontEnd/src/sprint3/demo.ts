import { createSprint3Session } from "./session.ts";

export function sprint3Demo() {
  const session = createSprint3Session("simulado");
  const origin = "simulado";
  const end = Date.now();
  const date = (secondsBefore: number) => new Date(end - secondsBefore * 1000).toISOString();
  const inicioSessao = date(90);
  const base = { origin, schemaVersion: "1.0", unitId: "LAB", assetId: "EXPEDICAO", streamId: "demo", quality: "GOOD" };
  const pieces = Array.from({ length: 8 }, (_, index) => ({ ...base, seq: index + 1, eventId: `demo-${index + 1}`,
    timestamp: date(75 - index * 8), type: "piece.processed", pieceId: `P-${index + 1}`, productionOrderId: "OP-DEMO",
    inspection: index === 2 ? "REJECTED" : "APPROVED" }));
  session.receive({ origin, timestamp: date(0), estacoes: { expedicao: {
    schemaVersion: "1.0", unitId: base.unitId, assetId: base.assetId,
    inicioSessao, modoProducao: "pieces", ocupacao: [true, true, false, null, false, true, false, false, null, false, false, false],
    posicaoAtuador: 6, criterios: { nominalPerHour: 300, inspection: "Resultado da inspeção sintética", reference: "Exemplo de desenvolvimento" },
    eventos: [...pieces, { ...base, seq: 9, eventId: "demo-9", timestamp: date(0), type: "analysis.window", startedAt: inicioSessao,
      plannedSeconds: 90, operatingSeconds: 72, idealCycleSeconds: 12 }],
  } } });
  return session;
}
