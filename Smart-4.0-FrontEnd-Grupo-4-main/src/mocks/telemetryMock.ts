import type { TelemetriaSmart40 } from "../types/smart40";

export const scenarioDescriptions: Record<string, string> = {
  "Operação normal":
    "Produção estável, baixo refugo e espaço disponível no palete.",
  "OEE baixo": "Perdas de disponibilidade e performance reduzem a eficiência.",
  "Refugo elevado": "Uma em cada quatro novas peças é rejeitada neste cenário.",
  "Fila cheia": "Palete completo. Simule a liberação para escoar a fila.",
  "Produção parada": "Linha em manutenção: os contadores permanecem estáveis.",
  "Início de turno":
    "Sem produção ainda. Indicadores sem amostra aparecem como indisponíveis.",
};

function criarCenario(name: string): TelemetriaSmart40 {
  const empty = name === "Início de turno";
  const rejected = name === "Refugo elevado" ? 32 : 4;
  const total = empty ? 0 : 142;
  const approved = empty ? 0 : total - rejected;
  const availability =
    name === "Produção parada" ? 0 : name === "OEE baixo" ? 62 : 95;
  const performance = name === "OEE baixo" ? 76 : 96;
  const quality = total ? (approved / total) * 100 : 0;
  const now = new Date().toISOString();
  return {
    timestamp: now,
    estadoGlobal: name === "Produção parada" ? "PRONTA" : "EM_EXECUCAO",
    modoOperacao: name === "Produção parada" ? "MANUTENCAO" : "AUTOMATICO",
    velocidadeEsteiraAtual: name === "Produção parada" ? 0 : 65,
    ultimaPecaLida: {
      idPeca: empty ? "—" : "PECA-142",
      codigoLote: "LOTE-2026-A9",
      timestampLeitura: now,
      qualidadeSuperficie: 98.5,
      statusInspecao: "APROVADA",
    },
    metricasExpedicao: {
      pecasProcessadasTotal: total,
      pecasAprovadasCount: approved,
      pecasRejeitadasCount: empty ? 0 : rejected,
      tamanhoFilaSaida: name === "Fila cheia" ? 25 : 0,
      ritmoProducaoPecasPorMinuto: name === "Produção parada" ? 0 : 12,
      disponibilidadePercentual: availability,
      performancePercentual: performance,
      qualidadePercentual: quality,
      oeePercentual: (availability * performance * quality) / 10000,
      historico: [21, 24, 23, 26, 22, 26].map((count, i) => {
        const bad = empty
          ? 0
          : name === "Refugo elevado"
            ? [4, 6, 5, 6, 5, 6][i]
            : [0, 1, 0, 1, 1, 1][i];
        return {
          horario: `${8 + i}h`,
          aprovadas: empty ? 0 : count - bad,
          rejeitadas: bad,
        };
      }),
    },
    dadosExpedicao: {
      ordens: [
        {
          codigo: "OP-001",
          produto: "Carcaça A · lote A9",
          meta: 160,
          produzido: empty ? 0 : approved - 40,
          status: "ATIVA",
        },
        {
          codigo: "OP-002",
          produto: "Eixo B · lote B2",
          meta: 120,
          produzido: 0,
          status: "AGUARDANDO",
        },
        {
          codigo: "OP-003",
          produto: "Suporte C · lote C4",
          meta: 40,
          produzido: empty ? 0 : 40,
          status: empty ? "AGUARDANDO" : "FINALIZADA",
        },
      ],
      palete: {
        codigo: "PAL-023",
        pecas: empty ? 0 : name === "Fila cheia" ? 50 : 37,
        capacidade: 50,
        destino: "Centro de Distribuição SP",
      },
    },
  };
}

export const telemetryScenarios = Object.fromEntries(
  Object.keys(scenarioDescriptions).map((name) => [name, criarCenario(name)]),
);
export const telemetryMock = telemetryScenarios["Operação normal"];
