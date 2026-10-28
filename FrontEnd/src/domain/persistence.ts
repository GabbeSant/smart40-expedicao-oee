import { createSimulation, type SimulationState } from "./expedition.ts";
import { recalculateOee } from "./warehouse.ts";
import type { TelemetriaSmart40 } from "../types/smart40";

export const STORAGE_KEY = "smart40-expedition-v3";
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string =>
  typeof v === "string" && v.length <= 200;
const date = (v: unknown) => text(v) && Number.isFinite(Date.parse(v));
const count = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const numeric = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;
const batch = (v: unknown) =>
  record(v) &&
  text(v.orderCode) &&
  text(v.product) &&
  text(v.destination) &&
  count(v.pieces) &&
  v.pieces > 0;

export function serializeSimulation(state: SimulationState): string {
  return JSON.stringify({ version: 3, state: { ...state, running: false } });
}

function validSnapshot(s: unknown): s is SimulationState {
  if (
    !record(s) ||
    !text(s.scenario) ||
    !count(s.steps) ||
    typeof s.running !== "boolean" ||
    !record(s.telemetry)
  )
    return false;
  const t = s.telemetry;
  if (
    ![
      "Novo planejamento",
      "Operação normal",
      "OEE baixo",
      "Refugo elevado",
      "Fila cheia",
      "Produção parada",
      "Início de turno",
    ].includes(s.scenario)
  )
    return false;
  if (
    !date(t.timestamp) ||
    !["PRONTA", "EM_EXECUCAO", "PARADA_EMERGENCIA"].includes(
      String(t.estadoGlobal),
    ) ||
    !["MANUAL", "AUTOMATICO", "MANUTENCAO"].includes(String(t.modoOperacao)) ||
    !numeric(t.velocidadeEsteiraAtual) ||
    !record(t.ultimaPecaLida) ||
    !record(t.metricasExpedicao) ||
    !record(t.dadosExpedicao)
  )
    return false;
  const last = t.ultimaPecaLida;
  if (
    !text(last.idPeca) ||
    !text(last.codigoLote) ||
    !date(last.timestampLeitura) ||
    !numeric(last.qualidadeSuperficie) ||
    !["APROVADA", "REJEITADA"].includes(String(last.statusInspecao))
  )
    return false;
  const m = t.metricasExpedicao;
  if (
    ![
      "pecasProcessadasTotal",
      "pecasAprovadasCount",
      "pecasRejeitadasCount",
      "tamanhoFilaSaida",
    ].every((key) => count(m[key]))
  )
    return false;
  if (
    ![
      "ritmoProducaoPecasPorMinuto",
      "oeePercentual",
      "disponibilidadePercentual",
      "performancePercentual",
      "qualidadePercentual",
    ].every((key) => numeric(m[key]))
  )
    return false;
  if (
    (m.pecasAprovadasCount as number) + (m.pecasRejeitadasCount as number) !==
    m.pecasProcessadasTotal
  )
    return false;
  if (
    !Array.isArray(m.historico) ||
    !m.historico.every(
      (h) =>
        record(h) &&
        text(h.horario) &&
        count(h.aprovadas) &&
        count(h.rejeitadas),
    )
  )
    return false;
  const data = t.dadosExpedicao;
  if (
    !Array.isArray(data.ordens) ||
    !data.ordens.every(
      (o) =>
        record(o) &&
        text(o.codigo) &&
        text(o.produto) &&
        text(o.destino) &&
        count(o.meta) &&
        o.meta > 0 &&
        count(o.produzido) &&
        o.produzido <= o.meta &&
        ["ATIVA", "AGUARDANDO", "FINALIZADA"].includes(String(o.status)),
    )
  )
    return false;
  if (
    new Set(data.ordens.map((o) => o.codigo)).size !== data.ordens.length ||
    data.ordens.filter((o) => o.status === "ATIVA").length > 1
  )
    return false;
  const codes = new Set(data.ordens.map((o) => o.codigo));
  const p = data.palete;
  if (
    !record(p) ||
    !text(p.codigo) ||
    !/^PAL-\d+$/.test(p.codigo) ||
    !text(p.destino) ||
    !count(p.capacidade) ||
    p.capacidade !== 50 ||
    !count(p.pecas) ||
    p.pecas > p.capacidade
  )
    return false;
  if (
    !record(s.receipt) ||
    !text(s.receipt.orderCode) ||
    (p.pecas > 0 && !codes.has(s.receipt.orderCode)) ||
    !date(s.receipt.receivedAt) ||
    !(s.receipt.identifiedAt === null || date(s.receipt.identifiedAt))
  )
    return false;
  if (
    !Array.isArray(s.queue) ||
    !s.queue.every((v) => batch(v) && codes.has(v.orderCode)) ||
    s.queue.reduce((sum, v) => sum + v.pieces, 0) !== m.tamanhoFilaSaida
  )
    return false;
  if (
    !Array.isArray(s.rack) ||
    ![8, 12, 16, 24].includes(s.rack.length) ||
    !s.rack.every(
      (v) =>
        v === null ||
        (batch(v) &&
          codes.has(v.orderCode) &&
          text(v.id) &&
          date(v.receivedAt) &&
          date(v.identifiedAt) &&
          date(v.storedAt)),
    )
  )
    return false;
  if (
    !Array.isArray(s.movements) ||
    !s.movements.every(
      (v) =>
        record(v) &&
        text(v.id) &&
        codes.has(v.orderCode) &&
        count(v.pieces) &&
        date(v.timestamp) &&
        ["RECEBIDO", "IDENTIFICADO", "ARMAZENADO", "EXPEDIDO"].includes(
          String(v.stage),
        ) &&
        (v.position === undefined ||
          (count(v.position) && v.position > 0 && v.position <= 24)),
    )
  )
    return false;
  if (
    !Array.isArray(s.shipments) ||
    !s.shipments.every(
      (v) =>
        record(v) &&
        text(v.id) &&
        codes.has(v.orderCode) &&
        text(v.product) &&
        text(v.destination) &&
        count(v.pieces) &&
        v.pieces > 0 &&
        date(v.timestamp) &&
        count(v.position) &&
        v.position > 0 &&
        v.position <= 24,
    )
  )
    return false;
  const inputs = s.oeeInputs;
  if (
    !record(inputs) ||
    !numeric(inputs.plannedSeconds) ||
    !numeric(inputs.stoppedSeconds) ||
    inputs.stoppedSeconds > inputs.plannedSeconds ||
    !numeric(inputs.idealCycleSeconds) ||
    inputs.idealCycleSeconds <= 0
  )
    return false;
  return true;
}

export function restoreSimulation(
  serialized: string | null,
  fallback: TelemetriaSmart40,
): { state: SimulationState; restored: boolean; invalid: boolean } {
  if (serialized) {
    try {
      const saved: unknown = JSON.parse(serialized);
      if (record(saved) && saved.version === 3 && validSnapshot(saved.state)) {
        const state = saved.state;
        state.running = false;
        recalculateOee(state);
        return { state, restored: true, invalid: false };
      }
    } catch {
      /* Uma sessão corrompida não impede abrir a demonstração. */
    }
  }
  return {
    state: createSimulation(fallback),
    restored: false,
    invalid: !!serialized,
  };
}
