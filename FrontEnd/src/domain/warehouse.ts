import type { SimulationState, Shipment } from "./expedition.ts";
import type { TelemetriaSmart40, OrdemProducao } from "../types/smart40";

export interface OrderDraft {
  codigo: string;
  produto: string;
  meta: number;
  destino: string;
}
export interface OeeInputs {
  plannedSeconds: number;
  stoppedSeconds: number;
  idealCycleSeconds: number;
}
export interface Batch {
  orderCode: string;
  product: string;
  destination: string;
  pieces: number;
}
export interface StoredBatch extends Batch {
  id: string;
  receivedAt: string;
  identifiedAt: string;
  storedAt: string;
}
export interface Movement {
  id: string;
  stage: "RECEBIDO" | "IDENTIFICADO" | "ARMAZENADO" | "EXPEDIDO";
  orderCode: string;
  pieces: number;
  timestamp: string;
  position?: number;
}
export interface WarehouseState {
  rack: (StoredBatch | null)[];
  queue: Batch[];
  receipt: {
    orderCode: string;
    receivedAt: string;
    identifiedAt: string | null;
  };
  movements: Movement[];
  oeeInputs: OeeInputs;
}

export function createWarehouse(telemetry: TelemetriaSmart40): WarehouseState {
  const m = telemetry.metricasExpedicao;
  const pallet = telemetry.dadosExpedicao.palete;
  const order = telemetry.dadosExpedicao.ordens.find(
    (o) => o.status === "ATIVA",
  );
  const operating =
    (m.pecasProcessadasTotal * 5) / (m.performancePercentual / 100 || 1);
  const planned = operating / (m.disponibilidadePercentual / 100 || 1);
  return {
    rack: Array.from({ length: 12 }, () => null),
    queue:
      m.tamanhoFilaSaida && order
        ? [
            {
              orderCode: order.codigo,
              product: order.produto,
              destination: order.destino,
              pieces: m.tamanhoFilaSaida,
            },
          ]
        : [],
    receipt: {
      orderCode: pallet.pecas && order ? order.codigo : "",
      receivedAt: telemetry.timestamp,
      identifiedAt: null,
    },
    movements:
      pallet.pecas && order
        ? [
            {
              id: "MOV-1",
              stage: "RECEBIDO",
              orderCode: order.codigo,
              pieces: pallet.pecas,
              timestamp: telemetry.timestamp,
            },
          ]
        : [],
    oeeInputs: {
      plannedSeconds: planned,
      stoppedSeconds: planned - operating,
      idealCycleSeconds: 5,
    },
  };
}

export function recordMovement(
  state: SimulationState,
  stage: Movement["stage"],
  orderCode: string,
  pieces: number,
  timestamp: string,
  position?: number,
) {
  state.movements.unshift({
    id: `MOV-${state.movements.length + 1}`,
    stage,
    orderCode,
    pieces,
    timestamp,
    ...(position === undefined ? {} : { position }),
  });
}

export function receivePiece(
  state: SimulationState,
  order: OrdemProducao,
  timestamp: string,
) {
  const pallet = state.telemetry.dadosExpedicao.palete;
  const receipt = state.receipt;
  if (!pallet.pecas && !state.queue.length) {
    receipt.orderCode = order.codigo;
    receipt.receivedAt = timestamp;
    receipt.identifiedAt = null;
    pallet.destino = order.destino;
  }
  recordMovement(state, "RECEBIDO", order.codigo, 1, timestamp);
  if (
    receipt.orderCode === order.codigo &&
    !receipt.identifiedAt &&
    pallet.pecas < pallet.capacidade &&
    !state.queue.length
  )
    pallet.pecas++;
  else {
    const last = state.queue.at(-1);
    if (last?.orderCode === order.codigo) last.pieces++;
    else
      state.queue.push({
        orderCode: order.codigo,
        product: order.produto,
        destination: order.destino,
        pieces: 1,
      });
  }
  state.telemetry.metricasExpedicao.tamanhoFilaSaida = state.queue.reduce(
    (sum, batch) => sum + batch.pieces,
    0,
  );
}

export function recalculateOee(state: SimulationState) {
  const m = state.telemetry.metricasExpedicao;
  const { plannedSeconds, stoppedSeconds, idealCycleSeconds } = state.oeeInputs;
  const operating = plannedSeconds - stoppedSeconds;
  m.disponibilidadePercentual = plannedSeconds
    ? (operating / plannedSeconds) * 100
    : 0;
  m.performancePercentual = operating
    ? Math.min(
        100,
        ((m.pecasProcessadasTotal * idealCycleSeconds) / operating) * 100,
      )
    : 0;
  m.qualidadePercentual = m.pecasProcessadasTotal
    ? (m.pecasAprovadasCount / m.pecasProcessadasTotal) * 100
    : 0;
  m.oeePercentual =
    (m.disponibilidadePercentual *
      m.performancePercentual *
      m.qualidadePercentual) /
    10000;
}

export function validateOrder(
  draft: OrderDraft,
  orders: OrdemProducao[],
): string {
  if (!/^[A-Z0-9][A-Z0-9-]{1,23}$/.test(draft.codigo))
    return "Use um código de 2 a 24 letras, números ou hífens.";
  if (orders.some((o) => o.codigo.toUpperCase() === draft.codigo))
    return "Já existe uma ordem com esse código.";
  if (draft.produto.trim().length < 2 || draft.produto.length > 80)
    return "Informe um produto entre 2 e 80 caracteres.";
  if (
    !Number.isSafeInteger(draft.meta) ||
    draft.meta < 1 ||
    draft.meta > 100000
  )
    return "A quantidade deve ser um inteiro entre 1 e 100.000.";
  if (draft.destino.trim().length < 2 || draft.destino.length > 100)
    return "Informe um destino entre 2 e 100 caracteres.";
  return "";
}

export function validateOee(inputs: OeeInputs): string {
  if (!Object.values(inputs).every(Number.isFinite))
    return "Informe valores numéricos válidos.";
  if (inputs.plannedSeconds <= 0 || inputs.plannedSeconds > 86400)
    return "O tempo planejado deve estar entre 0 e 1.440 minutos.";
  if (
    inputs.stoppedSeconds < 0 ||
    inputs.stoppedSeconds > inputs.plannedSeconds
  )
    return "A parada deve estar entre zero e o tempo planejado.";
  if (inputs.idealCycleSeconds <= 0 || inputs.idealCycleSeconds > 3600)
    return "O ciclo ideal deve estar entre 0 e 3.600 segundos.";
  return "";
}

export function identifyBatch(
  state: SimulationState,
  timestamp: string,
): SimulationState {
  if (
    !state.telemetry.dadosExpedicao.palete.pecas ||
    state.receipt.identifiedAt ||
    state.telemetry.estadoGlobal !== "EM_EXECUCAO"
  )
    return state;
  const next = structuredClone(state);
  next.receipt.identifiedAt = timestamp;
  next.telemetry.timestamp = timestamp;
  recordMovement(
    next,
    "IDENTIFICADO",
    next.receipt.orderCode,
    next.telemetry.dadosExpedicao.palete.pecas,
    timestamp,
  );
  return next;
}

export function storeBatch(
  state: SimulationState,
  timestamp: string,
): SimulationState {
  const index = state.rack.indexOf(null);
  const pallet = state.telemetry.dadosExpedicao.palete;
  const order = state.telemetry.dadosExpedicao.ordens.find(
    (o) => o.codigo === state.receipt.orderCode,
  );
  if (
    index < 0 ||
    !order ||
    !pallet.pecas ||
    !state.receipt.identifiedAt ||
    state.telemetry.estadoGlobal !== "EM_EXECUCAO"
  )
    return state;
  const next = structuredClone(state);
  next.rack[index] = {
    id: pallet.codigo,
    orderCode: order.codigo,
    product: order.produto,
    destination: pallet.destino,
    pieces: pallet.pecas,
    receivedAt: state.receipt.receivedAt,
    identifiedAt: state.receipt.identifiedAt,
    storedAt: timestamp,
  };
  recordMovement(
    next,
    "ARMAZENADO",
    order.codigo,
    pallet.pecas,
    timestamp,
    index + 1,
  );
  const nextPallet = next.telemetry.dadosExpedicao.palete;
  nextPallet.codigo = `PAL-${String(Number(pallet.codigo.split("-")[1]) + 1).padStart(3, "0")}`;
  const first = next.queue[0];
  const pieces = first ? Math.min(first.pieces, pallet.capacidade) : 0;
  nextPallet.pecas = pieces;
  nextPallet.destino = first?.destination ?? "Aguardando próxima ordem";
  next.receipt = {
    orderCode: first?.orderCode ?? "",
    receivedAt: timestamp,
    identifiedAt: null,
  };
  if (first) {
    first.pieces -= pieces;
    recordMovement(next, "RECEBIDO", first.orderCode, pieces, timestamp);
    if (!first.pieces) next.queue.shift();
  }
  next.telemetry.metricasExpedicao.tamanhoFilaSaida = next.queue.reduce(
    (sum, item) => sum + item.pieces,
    0,
  );
  next.telemetry.timestamp = timestamp;
  return next;
}

export function shipBatch(
  state: SimulationState,
  position: number,
  timestamp: string,
): SimulationState {
  const batch = state.rack[position];
  if (!batch || state.telemetry.estadoGlobal !== "EM_EXECUCAO") return state;
  const next = structuredClone(state);
  const shipment: Shipment = {
    id: batch.id,
    orderCode: batch.orderCode,
    product: batch.product,
    pieces: batch.pieces,
    destination: batch.destination,
    timestamp,
    position: position + 1,
  };
  next.shipments.unshift(shipment);
  next.rack[position] = null;
  next.telemetry.timestamp = timestamp;
  recordMovement(
    next,
    "EXPEDIDO",
    batch.orderCode,
    batch.pieces,
    timestamp,
    position + 1,
  );
  return next;
}
