import type { TelemetriaSmart40 } from "../types/smart40";

export interface Shipment {
  id: string;
  pieces: number;
  destination: string;
  timestamp: string;
}
export interface SimulationState {
  telemetry: TelemetriaSmart40;
  scenario: string;
  running: boolean;
  steps: number;
  shipments: Shipment[];
}
export type SimulationAction =
  | { type: "scenario"; name: string; telemetry: TelemetriaSmart40 }
  | { type: "toggle" }
  | { type: "piece"; timestamp: string }
  | { type: "release"; timestamp: string };

export function createSimulation(
  telemetry: TelemetriaSmart40,
  scenario = "Operação normal",
): SimulationState {
  return {
    telemetry: structuredClone(telemetry),
    scenario,
    running: false,
    steps: 0,
    shipments: [],
  };
}

export function simulationReducer(
  state: SimulationState,
  action: SimulationAction,
): SimulationState {
  if (action.type === "scenario")
    return createSimulation(action.telemetry, action.name);
  if (action.type === "toggle") return { ...state, running: !state.running };
  const telemetry = structuredClone(state.telemetry);
  const metrics = telemetry.metricasExpedicao;
  const pallet = telemetry.dadosExpedicao.palete;
  if (action.type === "release") {
    if (!pallet.pecas || telemetry.estadoGlobal !== "EM_EXECUCAO") return state;
    const shipment = {
      id: pallet.codigo,
      pieces: pallet.pecas,
      destination: pallet.destino,
      timestamp: action.timestamp,
    };
    pallet.codigo = `PAL-${String(Number(pallet.codigo.split("-")[1]) + 1).padStart(3, "0")}`;
    pallet.pecas = Math.min(pallet.capacidade, metrics.tamanhoFilaSaida);
    metrics.tamanhoFilaSaida -= pallet.pecas;
    telemetry.timestamp = action.timestamp;
    return { ...state, telemetry, shipments: [shipment, ...state.shipments] };
  }
  if (
    telemetry.estadoGlobal !== "EM_EXECUCAO" ||
    !telemetry.dadosExpedicao.ordens.some((order) => order.status === "ATIVA")
  )
    return state;
  const steps = state.steps + 1;
  const rejected = steps % (state.scenario === "Refugo elevado" ? 4 : 20) === 0;
  metrics.pecasProcessadasTotal++;
  if (rejected) metrics.pecasRejeitadasCount++;
  else {
    metrics.pecasAprovadasCount++;
    if (pallet.pecas < pallet.capacidade) pallet.pecas++;
    else metrics.tamanhoFilaSaida++;
    const orders = telemetry.dadosExpedicao.ordens;
    const active = orders.find((order) => order.status === "ATIVA");
    if (active) {
      active.produzido = Math.min(active.meta, active.produzido + 1);
      if (active.produzido === active.meta) {
        active.status = "FINALIZADA";
        const next = orders.find((order) => order.status === "AGUARDANDO");
        if (next) next.status = "ATIVA";
      }
    }
  }
  metrics.qualidadePercentual =
    (metrics.pecasAprovadasCount / metrics.pecasProcessadasTotal) * 100;
  metrics.oeePercentual =
    (metrics.disponibilidadePercentual *
      metrics.performancePercentual *
      metrics.qualidadePercentual) /
    10000;
  const last = metrics.historico?.at(-1);
  if (last) {
    if (rejected) last.rejeitadas++;
    else last.aprovadas++;
  }
  telemetry.timestamp = action.timestamp;
  telemetry.ultimaPecaLida = {
    ...telemetry.ultimaPecaLida,
    idPeca: `PECA-${metrics.pecasProcessadasTotal}`,
    timestampLeitura: action.timestamp,
    statusInspecao: rejected ? "REJEITADA" : "APROVADA",
    qualidadeSuperficie: rejected ? 71 : 98.5,
  };
  return { ...state, telemetry, steps };
}

export function getAlerts(telemetry: TelemetriaSmart40) {
  const m = telemetry.metricasExpedicao;
  const alerts: {
    tone: "red" | "amber" | "green";
    title: string;
    detail: string;
  }[] = [];
  if (
    !telemetry.dadosExpedicao.ordens.some((order) => order.status === "ATIVA")
  )
    alerts.push({
      tone: "amber",
      title: "Ordens concluídas",
      detail:
        "O planejamento deste cenário foi concluído. Reinicie para uma nova demonstração.",
    });
  if (telemetry.estadoGlobal !== "EM_EXECUCAO")
    alerts.push({
      tone: "amber",
      title: "Linha sem produção",
      detail:
        "Os contadores ficam estáveis até selecionar um cenário em operação.",
    });
  if (m.pecasProcessadasTotal && m.oeePercentual < 85)
    alerts.push({
      tone: "amber",
      title: "OEE abaixo da referência",
      detail:
        "Confira disponibilidade, performance e qualidade. Referência didática: 85%.",
    });
  if (
    m.pecasProcessadasTotal &&
    m.pecasRejeitadasCount / m.pecasProcessadasTotal > 0.05
  )
    alerts.push({
      tone: "red",
      title: "Refugo acima de 5%",
      detail: "Inspecione o lote e acompanhe a taxa de rejeição.",
    });
  if (
    telemetry.dadosExpedicao.palete.pecas >=
    telemetry.dadosExpedicao.palete.capacidade
  )
    alerts.push({
      tone: "amber",
      title: "Palete completo",
      detail: `Simule a liberação. ${m.tamanhoFilaSaida} peças aguardam na fila.`,
    });
  if (!m.pecasProcessadasTotal)
    alerts.push({
      tone: "amber",
      title: "Aguardando primeira amostra",
      detail: "Sem peças processadas, qualidade e OEE ainda não têm amostra.",
    });
  if (!alerts.length)
    alerts.push({
      tone: "green",
      title: "Fluxo dentro da referência",
      detail: "OEE ≥ 85%, refugo ≤ 5% e palete com espaço disponível.",
    });
  return alerts;
}

export function toCsv(rows: (string | number)[][]): string {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((cell) => {
            const text = String(cell);
            const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
            return `"${safe.replaceAll('"', '""')}"`;
          })
          .join(";"),
      )
      .join("\r\n")
  );
}
