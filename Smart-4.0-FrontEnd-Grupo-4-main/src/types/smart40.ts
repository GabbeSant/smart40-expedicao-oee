export type EstadoGlobal = "PRONTA" | "EM_EXECUCAO" | "PARADA_EMERGENCIA";
export type ModoOperacao = "MANUAL" | "AUTOMATICO" | "MANUTENCAO";
export type StatusInspecao = "APROVADA" | "REJEITADA";
export type StatusOrdem = "ATIVA" | "AGUARDANDO" | "FINALIZADA";

export interface MetricasExpedicao {
  pecasProcessadasTotal: number;
  pecasAprovadasCount: number;
  pecasRejeitadasCount: number;
  tamanhoFilaSaida: number;
  ritmoProducaoPecasPorMinuto: number;
  oeePercentual: number;
  disponibilidadePercentual: number;
  performancePercentual: number;
  qualidadePercentual: number;
  historico?: HistoricoProducao[];
}

export interface HistoricoProducao {
  horario: string;
  aprovadas: number;
  rejeitadas: number;
}

export interface UltimaPecaLida {
  idPeca: string;
  codigoLote: string;
  timestampLeitura: string;
  qualidadeSuperficie: number;
  statusInspecao: StatusInspecao;
}

export interface OrdemProducao {
  codigo: string;
  produto: string;
  meta: number;
  produzido: number;
  status: StatusOrdem;
  destino: string;
}

export interface DadosExpedicao {
  ordens: OrdemProducao[];
  palete: {
    codigo: string;
    pecas: number;
    capacidade: number;
    destino: string;
  };
}

export interface TelemetriaSmart40 {
  timestamp: string;
  estadoGlobal: EstadoGlobal;
  modoOperacao: ModoOperacao;
  velocidadeEsteiraAtual: number;
  ultimaPecaLida: UltimaPecaLida;
  metricasExpedicao: MetricasExpedicao;
  dadosExpedicao: DadosExpedicao;
}

export const SMART40_TELEMETRIA_EVENT = "smart40:telemetria";

export function isTelemetriaSmart40(
  value: unknown,
): value is TelemetriaSmart40 {
  if (!value || typeof value !== "object") return false;
  const telemetry = value as Partial<TelemetriaSmart40>;
  const metrics = telemetry.metricasExpedicao;
  const orders = telemetry.dadosExpedicao?.ordens;
  const pallet = telemetry.dadosExpedicao?.palete;
  const piece = telemetry.ultimaPecaLida;
  const finite = (candidate: unknown) =>
    typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0;
  const count = (candidate: unknown) =>
    finite(candidate) && Number.isSafeInteger(candidate);
  return Boolean(
    typeof telemetry.timestamp === "string" &&
    Number.isFinite(Date.parse(telemetry.timestamp)) &&
    ["PRONTA", "EM_EXECUCAO", "PARADA_EMERGENCIA"].includes(
      String(telemetry.estadoGlobal),
    ) &&
    ["MANUAL", "AUTOMATICO", "MANUTENCAO"].includes(
      String(telemetry.modoOperacao),
    ) &&
    finite(telemetry.velocidadeEsteiraAtual) &&
    piece &&
    typeof piece.idPeca === "string" &&
    typeof piece.codigoLote === "string" &&
    typeof piece.timestampLeitura === "string" &&
    Number.isFinite(Date.parse(piece.timestampLeitura)) &&
    finite(piece.qualidadeSuperficie) &&
    ["APROVADA", "REJEITADA"].includes(String(piece.statusInspecao)) &&
    metrics &&
    count(metrics.pecasProcessadasTotal) &&
    count(metrics.pecasAprovadasCount) &&
    count(metrics.pecasRejeitadasCount) &&
    metrics.pecasAprovadasCount + metrics.pecasRejeitadasCount ===
      metrics.pecasProcessadasTotal &&
    count(metrics.tamanhoFilaSaida) &&
    finite(metrics.ritmoProducaoPecasPorMinuto) &&
    finite(metrics.oeePercentual) &&
    finite(metrics.disponibilidadePercentual) &&
    finite(metrics.performancePercentual) &&
    finite(metrics.qualidadePercentual) &&
    telemetry.dadosExpedicao &&
    Array.isArray(orders) &&
    orders.every(
      (order) =>
        typeof order.codigo === "string" &&
        typeof order.produto === "string" &&
        typeof order.destino === "string" &&
        count(order.meta) &&
        order.meta > 0 &&
        count(order.produzido) &&
        order.produzido <= order.meta &&
        ["ATIVA", "AGUARDANDO", "FINALIZADA"].includes(String(order.status)),
    ) &&
    pallet &&
    typeof pallet.codigo === "string" &&
    typeof pallet.destino === "string" &&
    count(pallet.pecas) &&
    count(pallet.capacidade) &&
    pallet.capacidade > 0 &&
    pallet.pecas <= pallet.capacidade,
  );
}
