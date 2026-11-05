-- Schema próprio: não modifica tabelas ou dados de aplicações anteriores.
CREATE SCHEMA IF NOT EXISTS smart40_mes;
CREATE TABLE IF NOT EXISTS smart40_mes.ordens (
  id BIGSERIAL PRIMARY KEY,
  unit_id TEXT NOT NULL,
  tracking_code TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('CRIADA','EM_PRODUCAO','CONCLUIDA')),
  criada_em TIMESTAMPTZ NOT NULL,
  concluida_em TIMESTAMPTZ,
  last_event_at TIMESTAMPTZ NOT NULL,
  UNIQUE (unit_id, tracking_code)
);
CREATE TABLE IF NOT EXISTS smart40_mes.eventos (
  id BIGSERIAL PRIMARY KEY,
  unit_id TEXT NOT NULL,
  event_key TEXT NOT NULL,
  tracking_code TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('moved-in','start','finish','moved-out','completed')),
  component_id INTEGER NOT NULL CHECK (component_id BETWEEN 1 AND 4),
  process_code TEXT,
  time_stamp TIMESTAMPTZ NOT NULL,
  recebido_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (unit_id, tracking_code) REFERENCES smart40_mes.ordens(unit_id, tracking_code),
  UNIQUE (unit_id, event_key),
  CHECK (tipo <> 'completed' OR component_id = 4)
);
CREATE INDEX IF NOT EXISTS idx_smart40_mes_tracking
  ON smart40_mes.eventos (unit_id, tracking_code, time_stamp, id);
