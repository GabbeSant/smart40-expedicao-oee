/** Fixture SINTÉTICA. `medido` exercita o canal real no teste; não é evidência industrial. */
export function contractReplay(at = Date.now(), origin = 'medido') {
  const stamp = secondsBefore => new Date(at - secondsBefore * 1000).toISOString();
  const inicioSessao = stamp(90);
  const base = { schemaVersion: '1.0', unitId: 'FIXTURE-N2', assetId: 'EXPEDICAO', origin,
    quality: 'GOOD', streamId: 'fixture-stream' };
  return { origin, timestamp: stamp(0), estacoes: { expedicao: {
    schemaVersion: '1.0', unitId: base.unitId, assetId: base.assetId, inicioSessao, modoProducao: 'pieces',
    criterios: { nominalPerHour: 300, inspection: 'Inspeção sintética da fixture', reference: 'TESTE LOCAL; não usar como premissa real' },
    ocupacao: [true, true, false, null, false, true, false, false, null, false, false, false], posicaoAtuador: 6,
    estoqueRegistrado: { observedAt: stamp(0), complete: false,
      positions: [true, true, true, null, null, true, null, null, null, null, null, null] },
    eventos: [
      ...Array.from({ length: 8 }, (_, index) => ({ ...base, type: 'piece.processed', seq: index + 1,
        eventId: `fixture-${index}`, pieceId: `fixture-piece-${index}`, productionOrderId: null,
        inspection: index === 2 ? 'REJECTED' : 'APPROVED', timestamp: stamp(75 - index * 8) })),
      { ...base, type: 'analysis.window', seq: 9, eventId: 'fixture-window', timestamp: stamp(0),
        startedAt: inicioSessao, plannedSeconds: 90, operatingSeconds: 72, idealCycleSeconds: 12 },
    ],
  } } };
}
