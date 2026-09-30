import type { TelemetriaSmart40 } from '../types/smart40'

export const telemetryMock: TelemetriaSmart40 = {
  timestamp: new Date().toISOString(),

  estadoGlobal: 'EM_EXECUCAO',
  modoOperacao: 'AUTOMATICO',

  velocidadeEsteiraAtual: 65,

  ultimaPecaLida: {
    idPeca: 'PECA-142',
    codigoLote: 'LOTE-2026-A9',
    timestampLeitura: new Date().toISOString(),
    qualidadeSuperficie: 98.5,
    statusInspecao: 'APROVADA'
  },

  metricasExpedicao: {
    pecasProcessadasTotal: 142,
    pecasAprovadasCount: 138,
    pecasRejeitadasCount: 4,
    tamanhoFilaSaida: 3,
    ritmoProducaoPecasPorMinuto: 12.4,
    oeePercentual: 88.5
  }
}