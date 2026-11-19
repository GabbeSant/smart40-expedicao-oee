import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { EXPEDITION_TELEMETRY_EVENT } from "../processing/appShell.ts";
import { PROJECT_TELEMETRY_EVENT } from "../processing/projectTelemetry.ts";
import { isCount, isRecord, isText, isUtcDate } from "../processing/validation.ts";
import { createSprint3Session } from "./session.ts";
import type { ResetEntry } from "./session.ts";
import { readBenchObservation } from "./bench.ts";
import type { BenchObservation } from "./bench.ts";
import { sprint3Demo } from "./demo.ts";
import { reconcileSlot } from "./magazine.ts";

const liveSession = createSprint3Session("medido");
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const time = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Sao_Paulo" });
const text = (value: number | null | undefined, unit = "") => value == null ? "N/D" : `${decimal.format(value)}${unit}`;
const flag = (value: boolean | null | undefined) => value == null ? "N/D" : value ? "Sim" : "Não";
const stockStatus = { available: "Consulta disponível", unavailable: "Gestor indisponível",
  unauthorized: "Acesso recusado pelo gestor", "unknown-format": "Resposta do gestor ainda sem mapeamento" };

function readAudit(key: string): ResetEntry[] {
  const stored = localStorage.getItem(key);
  const rows: unknown = stored === null ? [] : JSON.parse(stored);
  if (!Array.isArray(rows) || !rows.every(row => isRecord(row) && isText(row.author) && isUtcDate(row.at) &&
    isText(row.unitId) && isText(row.assetId) && isCount(row.totalBefore))) throw new Error("Histórico de resets inválido.");
  return rows;
}

function showAudit(key: string) {
  try { return readAudit(key); } catch { return []; }
}

export function Dashboard({ standalone = false }: { standalone?: boolean }) {
  const [session, setSession] = useState(() => liveSession);
  const [simulated, setSimulated] = useState(false);
  const [current, setCurrent] = useState(() => ({ view: liveSession.view(), now: Date.now() }));
  const [reading, setReading] = useState(false);
  const [bench, setBench] = useState<BenchObservation | null>(null);
  const [benchError, setBenchError] = useState<string | null>(null);
  const [reviewingReset, setReviewingReset] = useState(false);
  const [notice, setNotice] = useState("");
  const [audit, setAudit] = useState(() => showAudit("smart40-sprint3-reset-medido"));
  const { view, now } = current;
  const { snapshot, indicators, criteria, cumulative, counts, times } = view;

  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (event.type === EXPEDITION_TELEMETRY_EVENT || (isRecord(detail) && "estacoes" in detail)) session.receive(detail);
    };
    if (!simulated) {
      window.addEventListener(PROJECT_TELEMETRY_EVENT, receive);
      window.addEventListener(EXPEDITION_TELEMETRY_EVENT, receive);
    }
    const interval = window.setInterval(() => setCurrent({ view: session.view(), now: Date.now() }), 1000);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(PROJECT_TELEMETRY_EVENT, receive);
      window.removeEventListener(EXPEDITION_TELEMETRY_EVENT, receive);
    };
  }, [session, simulated]);

  useEffect(() => {
    if (!import.meta.env.DEV || !reading) return;
    const abort = new AbortController();
    let timer: number | undefined;
    async function refresh() {
      try {
        const response = await fetch("/__sprint3/observacao", { signal: abort.signal, headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const observation = readBenchObservation(await response.json());
        if (!abort.signal.aborted) { setBench(observation); setBenchError(null); }
      } catch {
        if (!abort.signal.aborted) setBenchError("Leitura indisponível. Confira a rede Smart 4.0 e o Vite no modo bancada.");
      } finally {
        if (!abort.signal.aborted) timer = window.setTimeout(refresh, 4000);
      }
    }
    void refresh();
    return () => { abort.abort(); window.clearTimeout(timer); };
  }, [reading]);

  function switchSource() {
    const target = !simulated;
    const next = target ? sprint3Demo() : liveSession;
    setReading(false);
    setBench(null);
    setSimulated(target);
    setSession(next);
    setCurrent({ view: next.view(), now: Date.now() });
    setReviewingReset(false);
    setNotice("");
    setAudit(showAudit(`smart40-sprint3-reset-${target ? "simulado" : "medido"}`));
  }

  function reset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const author = String(new FormData(event.currentTarget).get("actor") ?? "");
    const key = `smart40-sprint3-reset-${simulated ? "simulado" : "medido"}`;
    try {
      session.reset(author, entry => localStorage.setItem(key, JSON.stringify([...readAudit(key), entry])));
      setAudit(showAudit(key));
      setCurrent({ view: session.view(), now: Date.now() });
      setReviewingReset(false);
      setNotice(cumulative ? "Reset registrado. Nova referência salva; aguardando amostra." : "Reset registrado e contadores da sessão zerados.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Reset indisponível."); }
  }

  const slots = view.magazine?.positions ?? Array<boolean | null>(12).fill(null);
  const free = slots.filter(slot => slot === false).length;
  const occupied = slots.filter(slot => slot === true).length;
  const benchAge = bench ? now - Date.parse(bench.observedAt) : 0;
  const measuredAt = cumulative?.observedAt ?? snapshot?.lastUpdated;
  const measurementStale = !simulated && measuredAt != null && now - Date.parse(measuredAt) > 15_000;
  const magazineStale = !simulated && view.magazine && now - Date.parse(view.magazine.timestamp) > 15_000;
  const registered = view.registered ?? (reading ? bench?.magazine.registered : null);
  const registryCurrent = registered && now - Date.parse(registered.observedAt) <= 45_000;
  const comparableSlots = slots.map((slot, i) => reconcileSlot(magazineStale ? null : slot,
    registryCurrent ? registered.positions[i] : null));
  const metrics = [["OEE completo", indicators.oee], ["Disponibilidade", indicators.availability],
    ["Performance", indicators.performance], ["Qualidade", indicators.quality]] as const;

  return (
    <div className="s3">
      <header className="s3-top">
        <div className="s3-brand"><span aria-hidden="true">S4</span><div><strong>SMART 4.0</strong><small>Planta N2 · Bancada 4</small></div></div>
        {standalone && <a href="./">Painel anterior <span aria-hidden="true">↗</span></a>}
      </header>
      <main className="s3-main">
        <header className="s3-hero">
          <div><p className="s3-kicker">Grupo 5 · Sprint 3</p><h1>Expedição e OEE</h1><p>Eficiência de produção e ocupação do magazine.</p></div>
          <div className="s3-actions">
            <span className={`s3-badge ${simulated ? "s3-demo" : ""}`}>{simulated ? "Simulação · desenvolvimento" : "Modo real · somente leitura"}</span>
            {import.meta.env.DEV && <button type="button" onClick={switchSource} aria-pressed={simulated}>{simulated ? "Voltar ao modo real" : "Simular no desenvolvimento"}</button>}
            {import.meta.env.DEV && import.meta.env.MODE === "bancada" && !simulated && <button type="button" aria-pressed={reading}
              onClick={() => { setBench(null); setBenchError(null); setReading(!reading); }}>{reading ? "Parar leitura" : "Ler bancada N2"}</button>}
          </div>
        </header>

        <section className="s3-kpis" aria-label="Indicadores de produção">
          {metrics.map(([label, value], index) => (
            <article className={`s3-card s3-kpi ${index === 0 ? "s3-oee" : ""}`} key={label}>
              <h2>{label}</h2><strong>{text(value, "%")}</strong>
              {value !== null && <meter min={0} max={100} value={value} aria-label={label} />}
              {index === 0 && value !== null && <span className={`s3-band ${value >= 85 ? "s3-high" : value >= 70 ? "s3-mid" : "s3-low"}`}>
                {value >= 85 ? "Excelente" : value >= 70 ? "Atenção" : "Crítico"}
              </span>}
            </article>
          ))}
          <article className="s3-card s3-kpi"><h2>Peças por minuto</h2><strong>{text(indicators.ppm)}</strong><small>Média no tempo produtivo</small></article>
        </section>

        <div className="s3-grid">
          <section className="s3-card s3-magazine" aria-labelledby="s3-magazine-title">
            <header className="s3-section"><h2 id="s3-magazine-title">Magazine de expedição</h2><span>3 níveis × 4 vagas</span></header>
            {magazineStale && <p className="s3-warning">Última ocupação recebida há mais de 15 s.</p>}
            {[3, 2, 1].map(level => <div className="s3-level" key={level}>
              <h3>Nível {level}</h3>
              <ol className="s3-slots">{slots.slice((level - 1) * 4, level * 4).map((state, index) => {
                const id = (level - 1) * 4 + index + 1;
                const active = view.magazine?.actuatorPosition === id;
                const registration = registryCurrent ? registered.positions[id - 1] : null;
                const comparison = comparableSlots[id - 1];
                return <li key={id} className={`s3-slot ${state === true ? "s3-occupied" : state === false ? "s3-free" : ""}${active ? " s3-actuator" : ""}`}>
                  <strong>{String(id).padStart(2, "0")}</strong><small>{state === true ? "Ocupada" : state === false ? "Livre" : "N/D"}</small>{active && <small>Atuador</small>}
                  {registration !== null && <small>Gestor: {registration ? "ocupada" : "livre"}</small>}
                  {comparison === "differs" && <small className="s3-difference">Divergência</small>}
                </li>;
              })}</ol>
            </div>)}
            <p className="s3-caption">{view.magazine ? `${free} livres · ${occupied} ocupadas · ${12 - free - occupied} sem leitura` : "12 vagas sem leitura individual"}</p>
            {registryCurrent && <p className="s3-caption">Registro do gestor {registered.complete ? "completo" : "parcial"} · {comparableSlots.filter(slot => slot === "matches").length} coincidem · {comparableSlots.filter(slot => slot === "differs").length} divergem · {time.format(new Date(registered.observedAt))}</p>}
            {registered && !registryCurrent && <p className="s3-warning">Registro do gestor vencido.</p>}
          </section>

          <section className="s3-card" aria-labelledby="s3-source-title">
            <header className="s3-section"><h2 id="s3-source-title">Dados da operação</h2></header>
            <dl className="s3-dl">
              <div><dt>Telemetria de produção</dt><dd>{measurementStale ? "Último valor vencido" : measuredAt ? time.format(new Date(measuredAt)) : "Aguardando App Shell"}</dd></div>
              <div><dt>Peças processadas</dt><dd>{text(counts?.totalProduced)}</dd></div>
              <div><dt>Aprovadas / rejeitadas</dt><dd>{text(counts?.approved)} / {text(counts?.rejected)}</dd></div>
              {!cumulative && <div><dt>PPM móvel · últimos 60 s</dt><dd>{text(view.productionKnown && criteria ? snapshot?.ppm : null)}{view.productionKnown && criteria && snapshot && !snapshot.ppmExact ? " · estimativa" : ""}</dd></div>}
              {cumulative && <div><dt>Referência dos contadores</dt><dd>{time.format(new Date(cumulative.referenceAt))}</dd></div>}
            </dl>
            {cumulative?.state === "baseline" && <p className="s3-caption">Referência recebida. Aguardando a próxima amostra para calcular deltas.</p>}
            {cumulative?.state === "epoch-change" && <p className="s3-warning">A fonte reiniciou os contadores. Revise o reset local para aceitar a nova referência.</p>}
            {import.meta.env.DEV && import.meta.env.MODE === "bancada" && reading && !simulated && <div className="s3-bench" aria-label="Observações reais da bancada">
              <h3>Observação do Node-RED</h3>
              {benchError && <p className="s3-warning" role="status">{benchError}</p>}
              {benchAge > 15_000 && <p className="s3-warning">Última consulta vencida.</p>}
              <dl className="s3-dl">
                <div><dt>Consulta local · sem timestamp do CLP</dt><dd>{bench ? time.format(new Date(bench.observedAt)) : "Aguardando"}</dd></div>
                <div><dt>OP lida</dt><dd>{bench?.order ? `OP${bench.order}` : "N/D"}</dd></div>
                <div><dt>Última posição de armazenamento</dt><dd>{text(bench?.stored)}</dd></div>
                <div><dt>Última posição de remoção</dt><dd>{text(bench?.removed)}</dd></div>
                <div><dt>Ocupado / aguardando</dt><dd>{flag(bench?.busy)} / {flag(bench?.waiting)}</dd></div>
                <div><dt>Emergência ativa</dt><dd>{flag(bench?.emergency)}</dd></div>
                <div><dt>Primeira vaga livre · gestor</dt><dd>{text(bench?.magazine.firstFree)}</dd></div>
              </dl>
              <p className="s3-caption">{bench ? stockStatus[bench.magazine.status] : "Aguardando o gestor"}</p>
            </div>}
          </section>

          <section className="s3-card" aria-labelledby="s3-calc-title">
            <header className="s3-section"><h2 id="s3-calc-title">Memória de cálculo</h2></header>
            <p className="s3-formula">OEE = Disponibilidade × Performance × Qualidade</p>
            <dl className="s3-dl">
              <div><dt>Capacidade nominal</dt><dd>{text(criteria?.nominalPerHour, " peças/h")}</dd></div>
              <div><dt>Tempo planejado</dt><dd>{text(counts ? times?.plannedSeconds : null, " s")}</dd></div>
              <div><dt>Tempo parado</dt><dd>{text(indicators.downtimeSeconds, " s")}</dd></div>
              <div><dt>Critério de aprovação</dt><dd>{criteria?.inspection ?? "Pendente com o instrutor"}</dd></div>
              <div><dt>Fonte das premissas</dt><dd>{criteria?.reference ?? "N/D"}</dd></div>
            </dl>
            {indicators.oee === null && <p className="s3-caption">OEE em N/D até receber produção válida, tempo produtivo e premissas aprovadas.</p>}
          </section>

          <section className="s3-card" aria-labelledby="s3-reset-title">
            <header className="s3-section"><h2 id="s3-reset-title">Reset auditável</h2>
              <button type="button" disabled={!view.canReset} onClick={() => setReviewingReset(!reviewingReset)} aria-expanded={reviewingReset}>
                {reviewingReset ? "Cancelar" : "Revisar reset"}
              </button>
            </header>
            {reviewingReset && <form className="s3-reset" onSubmit={reset}>
              <p>{cumulative ? "Adota a última amostra como referência e aguarda a próxima para calcular deltas. A ocupação é preservada." : "Zera os contadores da sessão. A ocupação e o histórico de resets são preservados."}</p>
              <label htmlFor="s3-actor">Quem solicitou</label><input id="s3-actor" name="actor" required maxLength={80} autoComplete="name" />
              <button type="submit">Confirmar reset</button>
            </form>}
            <p role="status" className="s3-caption">{notice}</p>
            {audit.length ? <ol className="s3-log">{audit.slice(-10).reverse().map((row, index) => (
              <li key={`${row.at}-${index}`}><strong>{row.author}</strong><span>{time.format(new Date(row.at))} · {row.totalBefore} peças antes do reset</span></li>
            ))}</ol> : <p className="s3-caption">Nenhum reset registrado neste navegador.</p>}
          </section>
        </div>
      </main>
    </div>
  );
}
