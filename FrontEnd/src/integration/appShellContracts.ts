/**
 * Contrato externo preliminar fornecido pelo Grupo 5.
 * Não equivale a TelemetriaSmart40 nem ao envelope versionado em docs/.
 * Um futuro consumidor precisará de validação e adapter próprios.
 */
export type ExpeditionMetricsEvent = {
  type: "expedition.metrics";
  data: {
    producedTotal: number;
    piecesPerMinute: number;
    outputQueue: number;
    activeOrders: number;
    pallet: {
      currentCount: number;
      capacity: number;
      occupiedSlots?: number;
    };
  };
};
