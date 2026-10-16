export type EstadoGlobal = 'PRONTA' | 'EM_EXECUCAO' | 'PARADA_EMERGENCIA'
export type ModoOperacao = 'MANUAL' | 'AUTOMATICO' | 'MANUTENCAO'
export type StatusInspecao = 'APROVADA' | 'REJEITADA'
export type StatusOrdem = 'ATIVA' | 'AGUARDANDO' | 'FINALIZADA'

export interface MetricasExpedicao {
  pecasProcessadasTotal: number
  pecasAprovadasCount: number
  pecasRejeitadasCount: number
  tamanhoFilaSaida: number
  ritmoProducaoPecasPorMinuto: number
  oeePercentual: number
  disponibilidadePercentual: number
  performancePercentual: number
  qualidadePercentual: number
  historico?: HistoricoProducao[]
}

export interface HistoricoProducao {
  horario: string
  aprovadas: number
  rejeitadas: number
}

export interface UltimaPecaLida {
  idPeca: string
  codigoLote: string
  timestampLeitura: string
  qualidadeSuperficie: number
  statusInspecao: StatusInspecao
}

export interface OrdemProducao {
  codigo: string
  produto: string
  meta: number
  produzido: number
  status: StatusOrdem
}

export interface DadosExpedicao {
  ordens: OrdemProducao[]
  palete: {
    codigo: string
    pecas: number
    capacidade: number
    destino: string
  }
}

export interface TelemetriaSmart40 {
  timestamp: string
  estadoGlobal: EstadoGlobal
  modoOperacao: ModoOperacao
  velocidadeEsteiraAtual: number
  ultimaPecaLida: UltimaPecaLida
  metricasExpedicao: MetricasExpedicao
  dadosExpedicao: DadosExpedicao
}

export const SMART40_TELEMETRIA_EVENT = 'smart40:telemetria'

export function isTelemetriaSmart40(value: unknown): value is TelemetriaSmart40 {
  if (!value || typeof value !== 'object') return false
  const telemetry = value as Partial<TelemetriaSmart40>
  const metrics = telemetry.metricasExpedicao
  return Boolean(
    typeof telemetry.timestamp === 'string' &&
    metrics &&
    typeof metrics.pecasProcessadasTotal === 'number' &&
    typeof metrics.pecasAprovadasCount === 'number' &&
    typeof metrics.pecasRejeitadasCount === 'number' &&
    typeof metrics.tamanhoFilaSaida === 'number' &&
    typeof metrics.ritmoProducaoPecasPorMinuto === 'number' &&
    typeof metrics.oeePercentual === 'number' &&
    telemetry.dadosExpedicao &&
    Array.isArray(telemetry.dadosExpedicao.ordens)
  )
}
