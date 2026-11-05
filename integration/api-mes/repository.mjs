import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export class MesError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 256 && !/[\x00-\x1f]/.test(value);
const iso = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(value) &&
  Number.isFinite(Date.parse(value)) && Number(value.slice(11, 13)) < 24 &&
  Number(value.slice(8, 10)) <= new Date(Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)), 0)).getUTCDate();

export function validateMesEvent(type, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || ![1, 2, 3, 4].includes(body.componentId) ||
    !text(body.trackingCode) || !iso(body.timeStamp)) throw new MesError(400, 'componentId, trackingCode ou timeStamp inválido');
  if (!['moved-in', 'start', 'finish', 'moved-out', 'completed'].includes(type)) throw new MesError(400, 'Tipo de evento inválido');
  if ((['start', 'finish'].includes(type) && !text(body.processCode)) ||
    (body.processCode != null && !text(body.processCode))) throw new MesError(400, 'processCode obrigatório e textual para eventos de processo');
  if (type === 'completed' && body.componentId !== 4) throw new MesError(400, 'completed só é válido na Expedição (componentId 4)');
  if (body.eventId !== undefined && !text(body.eventId)) throw new MesError(400, 'eventId inválido');
  const event = { type, componentId: body.componentId, trackingCode: body.trackingCode,
    processCode: body.processCode ?? null, timeStamp: new Date(body.timeStamp).toISOString() };
  const key = body.eventId ? `id:${body.eventId}` : `hash:${createHash('sha256').update(JSON.stringify(event)).digest('hex')}`;
  return { ...event, key };
}

/** db fornece query e transaction(callback), sempre no mesmo cliente PostgreSQL. */
export function createMesRepository(db) {
  return {
    async initialize() { await db.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8')); },
    async ping() { await db.query('SELECT 1'); },
    async register(unitId, type, body) {
      const e = validateMesEvent(type, body);
      return db.transaction(async tx => {
        // Ordem pai vem primeiro; o exemplo do PDF viola a FK na primeira mensagem.
        await tx.query(`INSERT INTO smart40_mes.ordens
          (unit_id, tracking_code, status, criada_em, last_event_at) VALUES ($1,$2,'CRIADA',$3,$3)
          ON CONFLICT (unit_id, tracking_code) DO NOTHING`, [unitId, e.trackingCode, e.timeStamp]);
        await tx.query('SELECT id FROM smart40_mes.ordens WHERE unit_id=$1 AND tracking_code=$2 FOR UPDATE', [unitId, e.trackingCode]);
        const inserted = await tx.query(`INSERT INTO smart40_mes.eventos
          (unit_id,event_key,tracking_code,tipo,component_id,process_code,time_stamp)
          VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (unit_id,event_key) DO NOTHING RETURNING id`,
        [unitId, e.key, e.trackingCode, e.type, e.componentId, e.processCode, e.timeStamp]);
        if (inserted.rows.length === 0) {
          const previous = (await tx.query(`SELECT tracking_code,tipo,component_id,process_code,time_stamp
            FROM smart40_mes.eventos WHERE unit_id=$1 AND event_key=$2`, [unitId, e.key])).rows[0];
          if (previous.tracking_code !== e.trackingCode || previous.tipo !== e.type || previous.component_id !== e.componentId ||
            previous.process_code !== e.processCode || new Date(previous.time_stamp).toISOString() !== e.timeStamp)
            throw new MesError(409, 'eventId já utilizado com conteúdo diferente');
          return { ok: true, duplicate: true };
        }
        // Conclusão é preservada mesmo que um evento antigo seja recebido depois.
        await tx.query(`UPDATE smart40_mes.ordens SET
          status=CASE WHEN status='CONCLUIDA' OR $3='completed' THEN 'CONCLUIDA' ELSE 'EM_PRODUCAO' END,
          criada_em=LEAST(criada_em,$4::timestamptz), last_event_at=GREATEST(last_event_at,$4::timestamptz),
          concluida_em=CASE WHEN $3='completed' THEN LEAST(COALESCE(concluida_em,$4::timestamptz),$4::timestamptz) ELSE concluida_em END
          WHERE unit_id=$1 AND tracking_code=$2`, [unitId, e.trackingCode, e.type, e.timeStamp]);
        return { ok: true, duplicate: false };
      });
    },
    async current(unitId) {
      const { rows } = await db.query(`SELECT tracking_code,status FROM smart40_mes.ordens
        WHERE unit_id=$1 AND status='EM_PRODUCAO' ORDER BY last_event_at DESC,id DESC LIMIT 1`, [unitId]);
      return rows.length ? { trackingCode: rows[0].tracking_code, status: rows[0].status } : null;
    },
    async tracking(unitId, trackingCode) {
      if (!text(trackingCode)) throw new MesError(400, 'trackingCode inválido');
      const { rows } = await db.query('SELECT * FROM smart40_mes.ordens WHERE unit_id=$1 AND tracking_code=$2', [unitId, trackingCode]);
      if (!rows.length) throw new MesError(404, 'Ordem não encontrada');
      const events = await db.query(`SELECT tipo,component_id,process_code,time_stamp FROM smart40_mes.eventos
        WHERE unit_id=$1 AND tracking_code=$2 ORDER BY time_stamp ASC,id ASC`, [unitId, trackingCode]);
      return { ordem: rows[0], eventos: events.rows };
    },
    async metrics(unitId) {
      const { rows } = await db.query(`SELECT status,COUNT(*)::int AS total FROM smart40_mes.ordens
        WHERE unit_id=$1 GROUP BY status`, [unitId]);
      const count = new Map(rows.map(row => [row.status, row.total]));
      return { criadas: count.get('CRIADA') ?? 0, emProducao: count.get('EM_PRODUCAO') ?? 0,
        concluidas: count.get('CONCLUIDA') ?? 0, scope: 'orders' };
    },
  };
}
