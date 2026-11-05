import type { EventBase, ProductionEvent } from './contracts.ts';
import { isCount, isRecord, isUtcDate, parseProductionEvent } from './validation.ts';

/** Nome do barramento central em FFE-Sprint2, p.5, e Caminho A, p.16. */
export const PROJECT_TELEMETRY_EVENT = 'smart40:telemetria';
export interface ProjectTelemetryOptions {
  unitId: string;
  assetId: string;
  origin: EventBase['origin'];
  /** Declarar a qualidade da fonte legada; o PDF não a informa. */
  quality: EventBase['quality'];
  /** Obrigatório para converter contadores sem identidade de época no payload. */
  counterEpoch?: string;
}

/** Converte somente dados presentes. Magazine e pedidos concluídos não são peças produzidas. */
export function adaptProjectTelemetry(input: unknown, options: ProjectTelemetryOptions): {
  events: ProductionEvent[]; missing: string[];
} {
  if (typeof input === 'string') {
    try { input = JSON.parse(input); } catch { throw new Error('JSON global inválido'); }
  }
  if (!isRecord(input)) throw new Error('Telemetria global inválida');
  if (input.schemaVersion === '1.0') return { events: [parseProductionEvent(input)], missing: [] };
  if (input.type === 'expedition.metrics' || 'acao' in input)
    throw new Error('Resultados e comandos não são telemetria de entrada');
  if (!isUtcDate(input.timestamp)) throw new Error('Telemetria global sem timestamp ISO com timezone');
  const events: ProductionEvent[] = [];
  const missing: string[] = [];
  const timestamp = input.timestamp;
  const seq = Date.parse(timestamp);
  const base = (channel: string): EventBase => ({
    schemaVersion: '1.0', unitId: options.unitId, assetId: options.assetId,
    origin: options.origin, quality: options.quality,
    eventId: `global:${channel}:${seq}`, streamId: `global:${channel}`, seq, timestamp,
  });
  const stations = isRecord(input.estacoes) ? input.estacoes : null;
  const station = stations && isRecord(stations.expedicao) ? stations.expedicao : null;
  const statuses = new Map<string, 'RUNNING' | 'STOPPED' | 'EMERGENCY'>([
    ['OPERANDO', 'RUNNING'], ['AGUARDANDO', 'STOPPED'], ['EMERGENCIA', 'EMERGENCY'],
    ['EM_EXECUCAO', 'RUNNING'], ['PRONTA', 'STOPPED'], ['PARADA_EMERGENCIA', 'EMERGENCY'],
  ]);
  const statusValue = station?.status ?? input.estadoGlobal;
  if (typeof statusValue === 'string') {
    const status = statuses.get(statusValue);
    if (!status) throw new Error('Estado de expedição desconhecido');
    events.push(parseProductionEvent({ ...base('station'), type: 'station.state', status }));
  } else missing.push('estado da estação de expedição');

  const metrics = isRecord(input.metricasExpedicao) ? input.metricasExpedicao : null;
  const simple = isRecord(input.metricas) ? input.metricas : null;
  const approved = metrics?.pecasAprovadasCount ?? simple?.aprovadas;
  const rejected = metrics?.pecasRejeitadasCount ?? simple?.rejeitadas;
  if (approved !== undefined || rejected !== undefined) {
    if (!isCount(approved) || !isCount(rejected)) throw new Error('Contadores globais incompletos ou inválidos');
    const total = metrics?.pecasProcessadasTotal ?? approved + rejected;
    if (!options.counterEpoch) missing.push('counterEpoch para contadores acumulados');
    else events.push(parseProductionEvent({ ...base('counters'), type: 'production.counters',
      counterEpoch: options.counterEpoch, totalProduced: total, approved, rejected }));
  } else missing.push('contadores de peças aprovadas/rejeitadas ou eventos individuais');
  // O agente dos PDFs publica estados e pedidoAtual; não publica inspeção ou tempos de OEE.
  missing.push('tempos planejado/operação e ciclo ideal para OEE completo');
  return { events, missing };
}
