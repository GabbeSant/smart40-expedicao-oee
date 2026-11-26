import type { ExpeditionSnapshot, PieceRecord } from "../processing/contracts.ts";
import type { ProductionCounts } from "./cumulative.ts";
import type { BenchObservation } from "./bench.ts";

const stages = [
  ["RECEIVED", "Recebimento"],
  ["IDENTIFIED", "Identificação"],
  ["STORED", "Armazenamento"],
  ["DISPATCHED", "Expedição concluída"],
  ["REJECTED", "Rejeitadas"],
] as const;

const minuteLabel = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
});

const signals = [
  ["busy", "Ocupado"],
  ["waiting", "Aguardando"],
  ["finished", "Fim de OP"],
  ["emergency", "Emergência"],
] as const;

const signalLabel = (value: boolean | null | undefined) => value == null ? "Sem leitura" : value ? "Ativo" : "Inativo";

function BenchTimeline({ observations }: { observations: BenchObservation[] }) {
  const samples = [...Array<undefined>(12 - observations.length).fill(undefined), ...observations];
  return (
    <section className="s3-card s3-signal-chart" aria-labelledby="s3-signal-title">
      <header className="s3-section"><h2 id="s3-signal-title">Sinais da Expedição</h2><span>Histórico das consultas ao Node-RED</span></header>
      <ul className="s3-chart-rows">
        {signals.map(([field, label]) => <li key={field} className="s3-chart-row s3-signal-row">
          <span>{label}</span>
          <span className="s3-signal-timeline" aria-hidden="true">
            {samples.map((sample, index) => {
              const state = sample?.[field];
              return <span key={index} data-state={state == null ? "missing" : state ? "active" : "inactive"}
                title={sample && `${minuteLabel.format(new Date(sample.observedAt))} · ${signalLabel(state)}`} />;
            })}
          </span>
          <strong>{signalLabel(observations.at(-1)?.[field])}</strong>
        </li>)}
      </ul>
      <p className="s3-signal-legend">
        <span><i data-state="active" />Ativo</span>
        <span><i data-state="inactive" />Inativo</span>
        <span><i data-state="missing" />Sem leitura</span>
        <span>Última consulta à direita</span>
      </p>
    </section>
  );
}

export function ProcessCharts({ snapshot, counts: sessionCounts, observations, showBench }: {
  snapshot: ExpeditionSnapshot | null;
  counts: ProductionCounts | null;
  observations: BenchObservation[];
  showBench: boolean;
}) {
  const pieces = snapshot?.pieces;
  const history = snapshot?.history.slice(-8) ?? [];
  const byMinute = history.length > 0;
  const production = byMinute ? history : sessionCounts ? [{ ...sessionCounts, minute: null }] : [];
  const counts = new Map<PieceRecord["stage"], number>();
  for (const piece of pieces ?? []) counts.set(piece.stage, (counts.get(piece.stage) ?? 0) + 1);
  const stageMax = Math.max(1, ...counts.values());
  const productionMax = Math.max(1, ...production.map(row => row.approved + row.rejected));

  return (
    <div className="s3-charts">
      {showBench && <BenchTimeline observations={observations} />}
      <section className="s3-card" aria-labelledby="s3-flow-title">
        <header className="s3-section"><h2 id="s3-flow-title">Fluxo da Expedição</h2><span>Peças por etapa atual</span></header>
        <ul className="s3-chart-rows">
            {stages.map(([stage, label]) => {
              const count = pieces?.length ? counts.get(stage) ?? 0 : null;
              return <li key={stage} className="s3-chart-row">
                <span>{label}</span>
                <span className="s3-chart-track" data-missing={count === null} aria-hidden="true">
                  {count !== null && <span className={stage === "REJECTED" ? "s3-chart-rejected" : "s3-chart-flow"}
                    style={{ width: `${count / stageMax * 100}%` }} />}
                </span>
                <strong>{count ?? "N/D"}</strong>
              </li>;
            })}
        </ul>
        {!pieces?.length && <p className="s3-chart-note">Aguardando eventos individuais de peças.</p>}
      </section>
      <section className="s3-card" aria-labelledby="s3-minute-title">
        <header className="s3-section">
          <h2 id="s3-minute-title">{byMinute ? "Produção por minuto" : "Produção da sessão"}</h2>
          {byMinute && <span>Até 8 minutos com registros</span>}
        </header>
        {production.length ? (
          <ul className="s3-chart-rows">
            {production.map(row => (
              <li key={row.minute ?? "session"} className="s3-chart-row s3-production-row">
                {row.minute ? <time dateTime={row.minute}>{minuteLabel.format(new Date(row.minute))}</time> : <span>Total</span>}
                <span className="s3-chart-track" aria-hidden="true">
                  <span className="s3-chart-approved" style={{ width: `${row.approved / productionMax * 100}%` }} />
                  <span className="s3-chart-rejected" style={{ width: `${row.rejected / productionMax * 100}%` }} />
                </span>
                <span className="s3-chart-values">
                  <span>{row.approved} <span className="s3-chart-approved-label">aprov.</span></span>
                  <span>{row.rejected} <span className="s3-chart-rejected-label">rejeit.</span></span>
                </span>
              </li>
            ))}
          </ul>
        ) : <>
          <ul className="s3-chart-rows">
            {["Aprovadas", "Rejeitadas"].map(label => <li key={label} className="s3-chart-row">
              <span>{label}</span><span className="s3-chart-track" data-missing="true" aria-hidden="true" /><strong>N/D</strong>
            </li>)}
          </ul>
          <p className="s3-chart-note">Aguardando contagens de produção.</p>
        </>}
      </section>
    </div>
  );
}
