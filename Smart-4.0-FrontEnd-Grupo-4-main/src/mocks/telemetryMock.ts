import type { TelemetriaSmart40 } from '../types/smart40'

const historicoBase = [
  { horario: '08h', aprovadas: 24, rejeitadas: 2 },
  { horario: '09h', aprovadas: 31, rejeitadas: 1 },
  { horario: '10h', aprovadas: 28, rejeitadas: 3 },
  { horario: '11h', aprovadas: 36, rejeitadas: 2 },
  { horario: '12h', aprovadas: 19, rejeitadas: 1 },
  { horario: '13h', aprovadas: 34, rejeitadas: 2 },
]

const ordensBase = [
  { codigo: 'OP-001', produto: 'Carcaça A', meta: 500, produzido: 320, status: 'ATIVA' as const },
  { codigo: 'OP-002', produto: 'Eixo B', meta: 300, produzido: 0, status: 'AGUARDANDO' as const },
  { codigo: 'OP-003', produto: 'Suporte C', meta: 200, produzido: 200, status: 'FINALIZADA' as const },
]

function criarCenario(overrides: Partial<TelemetriaSmart40> = {}): TelemetriaSmart40 {
  return {
    timestamp: new Date().toISOString(),
    estadoGlobal: 'EM_EXECUCAO',
    modoOperacao: 'AUTOMATICO',
    velocidadeEsteiraAtual: 65,
    ultimaPecaLida: {
      idPeca: 'PECA-142',
      codigoLote: 'LOTE-2026-A9',
      timestampLeitura: new Date().toISOString(),
      qualidadeSuperficie: 98.5,
      statusInspecao: 'APROVADA',
    },
    metricasExpedicao: {
      pecasProcessadasTotal: 142,
      pecasAprovadasCount: 138,
      pecasRejeitadasCount: 4,
      tamanhoFilaSaida: 3,
      ritmoProducaoPecasPorMinuto: 12.4,
      oeePercentual: 88.5,
      disponibilidadePercentual: 99,
      performancePercentual: 92,
      qualidadePercentual: 97,
      historico: historicoBase,
    },
    dadosExpedicao: {
      ordens: ordensBase,
      palete: { codigo: 'PAL-023', pecas: 37, capacidade: 50, destino: 'Centro de Distribuição SP' },
    },
    ...overrides,
  }
}

export const telemetryMock = criarCenario()

export const telemetryScenarios: Record<string, TelemetriaSmart40> = {
  'OEE alto': criarCenario({
    metricasExpedicao: { ...telemetryMock.metricasExpedicao, oeePercentual: 96, disponibilidadePercentual: 99, performancePercentual: 98, qualidadePercentual: 99 },
  }),
  'OEE baixo': criarCenario({
    metricasExpedicao: { ...telemetryMock.metricasExpedicao, oeePercentual: 42, disponibilidadePercentual: 62, performancePercentual: 76, qualidadePercentual: 89 },
  }),
  'Muitas rejeitadas': criarCenario({
    metricasExpedicao: { ...telemetryMock.metricasExpedicao, pecasProcessadasTotal: 142, pecasAprovadasCount: 110, pecasRejeitadasCount: 32, qualidadePercentual: 77 },
    ultimaPecaLida: { ...telemetryMock.ultimaPecaLida, statusInspecao: 'REJEITADA', qualidadeSuperficie: 71 },
  }),
  'Fila cheia': criarCenario({
    metricasExpedicao: { ...telemetryMock.metricasExpedicao, tamanhoFilaSaida: 25 },
    dadosExpedicao: { ...telemetryMock.dadosExpedicao, palete: { ...telemetryMock.dadosExpedicao.palete, pecas: 50 } },
  }),
  'Produção parada': criarCenario({
    estadoGlobal: 'PRONTA', modoOperacao: 'MANUTENCAO', velocidadeEsteiraAtual: 0,
    metricasExpedicao: { ...telemetryMock.metricasExpedicao, ritmoProducaoPecasPorMinuto: 0, disponibilidadePercentual: 0, oeePercentual: 0 },
  }),
}
