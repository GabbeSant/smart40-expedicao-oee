export type EstadoGlobal =
  | 'PRONTA'
  | 'EM_EXECUCAO'
  | 'PARADA_EMERGENCIA'

export type ModoOperacao =
  | 'MANUAL'
  | 'AUTOMATICO'
  | 'MANUTENCAO'

export type StatusInspecao =
  | 'APROVADA'
  | 'REJEITADA'

export interface MetricasExpedicao {
  pecasProcessadasTotal: number
  pecasAprovadasCount: number
  pecasRejeitadasCount: number
  tamanhoFilaSaida: number
  ritmoProducaoPecasPorMinuto: number
  oeePercentual: number
}

export interface UltimaPecaLida {
  idPeca: string
  codigoLote: string
  timestampLeitura: string
  qualidadeSuperficie: number
  statusInspecao: StatusInspecao
}

export interface TelemetriaSmart40 {
  timestamp: string

  estadoGlobal: EstadoGlobal
  modoOperacao: ModoOperacao

  velocidadeEsteiraAtual: number

  ultimaPecaLida: UltimaPecaLida

  metricasExpedicao: MetricasExpedicao
}