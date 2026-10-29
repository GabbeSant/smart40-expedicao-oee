import {
  createWarehouse,
  receivePiece,
  recalculateOee,
  identifyBatch,
  storeBatch,
  shipBatch,
  validateOrder,
  validateOee,
  type WarehouseState,
  type OrderDraft,
  type OeeInputs,
} from "./warehouse.ts";
import type { TelemetriaSmart40 } from "../types/smart40";
import type { MachineExpeditionSnapshot } from "../integration/expedition";

export interface Shipment {
  id: string;
  pieces: number;
  destination: string;
  timestamp: string;
  orderCode: string;
  product: string;
  position: number;
}
export interface SimulationState extends WarehouseState {
  telemetry: TelemetriaSmart40;
  machineSnapshot: MachineExpeditionSnapshot | null;
  scenario: string;
  running: boolean;
  steps: number;
  shipments: Shipment[];
}
export type SimulationAction =
  | { type: "machine-snapshot"; snapshot: MachineExpeditionSnapshot }
  | { type: "scenario"; name: string; telemetry: TelemetriaSmart40 }
  | { type: "toggle" }
  | { type: "piece"; timestamp: string }
  | { type: "release"; timestamp: string }
  | { type: "identify"; timestamp: string }
  | { type: "ship"; position: number; timestamp: string }
  | { type: "add-order"; draft: OrderDraft; timestamp: string }
  | { type: "oee"; inputs: OeeInputs }
  | { type: "resize-rack"; capacity: number };

export function createSimulation(
  telemetry: TelemetriaSmart40,
  scenario = "Operação normal",
): SimulationState {
  const state: SimulationState = {
    telemetry: structuredClone(telemetry),
    machineSnapshot: null,
    scenario,
    running: false,
    steps: 0,
    shipments: [],
    ...createWarehouse(telemetry),
  };
  recalculateOee(state);
  return state;
}

export function simulationReducer(
  state: SimulationState,
  action: SimulationAction,
): SimulationState {
  if (action.type === "machine-snapshot") {
    const snapshot = structuredClone(action.snapshot);
    return {
      ...state,
      telemetry: snapshot.telemetry,
      rack: snapshot.warehouse.rack,
      queue: snapshot.warehouse.queue,
      receipt: snapshot.warehouse.receipt,
      movements: snapshot.warehouse.movements,
      shipments: snapshot.warehouse.shipments,
      oeeInputs: snapshot.warehouse.oeeInputs,
      machineSnapshot: snapshot,
      scenario: snapshot.source === "simulated" ? "Simulação integrada" : "Expedição conectada",
      running: false,
    };
  }
  if (action.type === "scenario")
    return createSimulation(action.telemetry, action.name);
  if (action.type === "toggle") {
    if (state.machineSnapshot && state.machineSnapshot.source !== "simulated")
      return state;
    return { ...state, running: !state.running };
  }
  if (action.type === "identify") return identifyBatch(state, action.timestamp);
  if (action.type === "release") return storeBatch(state, action.timestamp);
  if (action.type === "ship")
    return shipBatch(state, action.position, action.timestamp);
  if (action.type === "resize-rack") {
    if (
      ![8, 12, 16, 24].includes(action.capacity) ||
      state.rack.slice(action.capacity).some(Boolean)
    )
      return state;
    return {
      ...state,
      rack: Array.from(
        { length: action.capacity },
        (_, i) => state.rack[i] ?? null,
      ),
    };
  }
  if (action.type === "add-order") {
    if (validateOrder(action.draft, state.telemetry.dadosExpedicao.ordens))
      return state;
    const next = structuredClone(state);
    next.telemetry.dadosExpedicao.ordens.push({
      ...action.draft,
      produzido: 0,
      status: next.telemetry.dadosExpedicao.ordens.some(
        (o) => o.status === "ATIVA",
      )
        ? "AGUARDANDO"
        : "ATIVA",
    });
    next.telemetry.timestamp = action.timestamp;
    return next;
  }
  if (action.type === "oee") {
    if (validateOee(action.inputs)) return state;
    const next = structuredClone(state);
    next.oeeInputs = action.inputs;
    recalculateOee(next);
    return next;
  }
  const next = structuredClone(state);
  const telemetry = next.telemetry;
  const metrics = telemetry.metricasExpedicao;
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

    const orders = telemetry.dadosExpedicao.ordens;
    const active = orders.find((order) => order.status === "ATIVA");
    if (active) {
      receivePiece(next, active, action.timestamp);
      active.produzido = Math.min(active.meta, active.produzido + 1);
      if (active.produzido === active.meta) {
        active.status = "FINALIZADA";
        const next = orders.find((order) => order.status === "AGUARDANDO");
        if (next) next.status = "ATIVA";
      }
    }
  }
  next.oeeInputs.plannedSeconds += 5;
  recalculateOee(next);
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
  if (
    !telemetry.dadosExpedicao.ordens.some((order) => order.status === "ATIVA")
  )
    next.running = false;
  return { ...next, telemetry, steps };
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
      title: "Nenhuma OP ativa",
      detail:
        "Cadastre uma nova OP para iniciar a produção ou reinicie a demonstração.",
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
      detail: `Identifique e armazene o lote. ${m.tamanhoFilaSaida} peças aguardam na fila.`,
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
