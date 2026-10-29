import {
  useEffect,
  useReducer,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  telemetryMock,
  telemetryScenarios,
  scenarioDescriptions,
} from "./mocks/telemetryMock";
import { getAlerts, simulationReducer, toCsv } from "./domain/expedition";
import type { StatusOrdem } from "./types/smart40";
import "./App.css";
import { LogisticsPanel } from "./components/LogisticsPanel";
import { Modal } from "./components/Modal";
import {
  STORAGE_KEY,
  restoreSimulation,
  serializeSimulation,
} from "./domain/persistence";
import {
  isMachineExpeditionSnapshot,
  SMART40_EXPEDITION_SNAPSHOT_EVENT,
} from "./integration/expedition";

const number = (value: number, digits = 0) =>
  value.toLocaleString("pt-BR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
const time = (value: string) => new Date(value).toLocaleTimeString("pt-BR");
const statusNames: Record<StatusOrdem, string> = {
  ATIVA: "Em produção",
  AGUARDANDO: "Na fila",
  FINALIZADA: "Concluída",
};

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    box: (
      <>
        <path d="m12 3 9 5v8l-9 5-9-5V8l9-5Z M3 8l9 5 9-5 M12 13v8 M7.5 5.5l9 5" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12 M6 18 18 6" />,
    trend: (
      <>
        <path d="m3 17 6-6 4 3 8-10 M15 4h6v6" />
      </>
    ),
    download: <path d="M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    list: (
      <>
        <path d="M9 6h12 M9 12h12 M9 18h12 M3 6h1 M3 12h1 M3 18h1" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6 M12 7v1" />
      </>
    ),
    arrow: <path d="M4 12h16 m-6-6 6 6-6 6" />,
    play: <path d="m8 4 12 8-12 8V4Z" />,
    pause: (
      <>
        <path d="M8 5v14 M16 5v14" />
      </>
    ),
    reset: (
      <>
        <path d="M3 10a9 9 0 1 1 1 7 M3 4v6h6" />
      </>
    ),
    alert: (
      <>
        <path d="m12 3 10 18H2L12 3Z M12 9v5 M12 17v1" />
      </>
    ),
    print: (
      <>
        <path d="M6 9V3h12v6 M6 17H3V9h18v8h-3 M6 14h12v7H6Z" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.box}
    </svg>
  );
}

function App() {
  const [initial] = useState(() => {
    try {
      return restoreSimulation(
        localStorage.getItem(STORAGE_KEY),
        telemetryMock,
      );
    } catch {
      return restoreSimulation(null, telemetryMock);
    }
  });
  const [state, dispatch] = useReducer(simulationReducer, initial.state);
  const [notice, setNotice] = useState(
    initial.invalid
      ? "Sessão salva inválida. Uma nova demonstração foi iniciada."
      : initial.restored
        ? "Demonstração restaurada. A simulação está pausada."
        : "",
  );
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [persistence, setPersistence] = useState(
    "Preparando salvamento local…",
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("TODAS");
  const [modal, setModal] = useState<"reset" | "help" | null>(null);
  const { telemetry, running, scenario, shipments } = state;
  const machineReadOnly =
    !!state.machineSnapshot && state.machineSnapshot.source !== "simulated";
  const metrics = telemetry.metricasExpedicao;
  const { ordens: orders, palete: pallet } = telemetry.dadosExpedicao;
  const hasProduction = metrics.pecasProcessadasTotal > 0;
  const canProduce =
    telemetry.estadoGlobal === "EM_EXECUCAO" &&
    orders.some((order) => order.status === "ATIVA");
  const rejectedRate = hasProduction
    ? (metrics.pecasRejeitadasCount / metrics.pecasProcessadasTotal) * 100
    : 0;
  const history = metrics.historico ?? [];
  const chartMax = Math.max(
    10,
    Math.ceil(
      Math.max(0, ...history.map((item) => item.aprovadas + item.rejeitadas)) /
        10,
    ) * 10,
  );
  const visibleOrders = orders.filter(
    (order) =>
      (filter === "TODAS" || order.status === filter) &&
      `${order.codigo} ${order.produto}`
        .toLocaleLowerCase("pt-BR")
        .includes(query.toLocaleLowerCase("pt-BR")),
  );
  const alerts = getAlerts(telemetry);
  const shippedPieces = shipments.reduce((sum, item) => sum + item.pieces, 0);
  const dataSourceLabel = state.machineSnapshot
    ? `${state.machineSnapshot.source} · ${state.machineSnapshot.connection}`
    : "Mock local · dados simulados";

  useEffect(() => {
    if (!running || !canProduce || modal || workflowOpen) return;
    const interval = window.setInterval(
      () => dispatch({ type: "piece", timestamp: new Date().toISOString() }),
      5000,
    );
    return () => window.clearInterval(interval);
  }, [running, canProduce, modal, workflowOpen]);

  useEffect(() => {
    const receiveSnapshot = (event: Event) => {
      const snapshot = (event as CustomEvent<unknown>).detail;
      if (!isMachineExpeditionSnapshot(snapshot)) {
        setNotice("Snapshot da Expedição inválido; os dados foram ignorados.");
        return;
      }
      dispatch({ type: "machine-snapshot", snapshot });
      setNotice(
        snapshot.connection === "CONNECTED"
          ? "Telemetria da Expedição recebida. Simulação local pausada."
          : `Snapshot recebido com conexão ${snapshot.connection.toLocaleLowerCase("pt-BR")}.`,
      );
    };
    window.addEventListener(SMART40_EXPEDITION_SNAPSHOT_EVENT, receiveSnapshot);
    return () =>
      window.removeEventListener(
        SMART40_EXPEDITION_SNAPSHOT_EVENT,
        receiveSnapshot,
      );
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (
      state.machineSnapshot &&
      state.machineSnapshot.source !== "simulated"
    ) {
      const timer = window.setTimeout(
        () =>
          setPersistence(
            "Telemetria conectada · dados da máquina não são salvos localmente",
          ),
        0,
      );
      return () => window.clearTimeout(timer);
    }
    let message =
      "Salvo neste navegador · ao reabrir, a simulação inicia pausada";
    try {
      localStorage.setItem(STORAGE_KEY, serializeSimulation(state));
    } catch {
      message =
        "Não foi possível salvar neste navegador. Mantenha esta página aberta para preservar os dados.";
    }
    const timer = window.setTimeout(() => setPersistence(message), 0);
    return () => window.clearTimeout(timer);
  }, [state]);

  const chooseScenario = (name: string) => {
    const next = structuredClone(telemetryScenarios[name]);
    next.timestamp = new Date().toISOString();
    dispatch({ type: "scenario", name, telemetry: next });
    setNotice(
      `Cenário “${name}” carregado. Simulação pausada e histórico de saídas reiniciado.`,
    );
  };

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ["SMART 4.0 · Grupo 5 · Relatório de Expedição"],
      ["Cenário", scenario],
      ["Atualização", telemetry.timestamp],
      ["Origem", dataSourceLabel],
      ["Conexão", state.machineSnapshot?.connection ?? "LOCAL"],
      ["Estado da máquina", telemetry.estadoGlobal],
      ["Modo de operação", telemetry.modoOperacao],
      ["Velocidade da esteira", telemetry.velocidadeEsteiraAtual],
      ["Indicador", "Valor"],
      ["Total processado", metrics.pecasProcessadasTotal],
      ["Aprovadas", metrics.pecasAprovadasCount],
      ["Rejeitadas", metrics.pecasRejeitadasCount],
      ["Refugo (%)", number(rejectedRate, 2)],
      [
        state.machineSnapshot ? "OEE (%)" : "OEE simulado (%)",
        hasProduction ? number(metrics.oeePercentual, 2) : "Sem amostra",
      ],
      ["Fila de saída", metrics.tamanhoFilaSaida],
      [
        state.machineSnapshot
          ? "Ritmo recebido (peças/min)"
          : "Ritmo nominal simulado (peças/min)",
        metrics.ritmoProducaoPecasPorMinuto,
      ],
      [
        state.machineSnapshot ? "Disponibilidade (%)" : "Disponibilidade simulada (%)",
        metrics.disponibilidadePercentual,
      ],
      [
        state.machineSnapshot ? "Performance (%)" : "Performance simulada (%)",
        metrics.performancePercentual,
      ],
      [
        "Qualidade (%)",
        hasProduction ? number(metrics.qualidadePercentual, 2) : "Sem amostra",
      ],
      [],
      ["Ordens: filtros aplicados", `${filter} · busca: ${query || "nenhuma"}`],
      ["Ordem", "Produto", "Meta", "Produzido", "Status", "Destino"],
      ...visibleOrders.map((order) => [
        order.codigo,
        order.produto,
        order.meta,
        order.produzido,
        statusNames[order.status],
        order.destino,
      ]),
      [],
      [state.machineSnapshot ? "Tempos e ciclo recebidos" : "Premissas simuladas"],
      ["Tempo planejado (s)", state.oeeInputs.plannedSeconds],
      ["Paradas (s)", state.oeeInputs.stoppedSeconds],
      ["Ciclo ideal (s)", state.oeeInputs.idealCycleSeconds],
      [],
      [state.machineSnapshot ? "Posições de expedição" : "Prateleira simulada", state.rack.length],
      ["Posição", "Lote", "OP", "Produto", "Peças", "Destino"],
      ...state.rack.map((batch, index) => [
        index + 1,
        batch?.id ?? "Livre",
        batch?.orderCode ?? "",
        batch?.product ?? "",
        batch?.pieces ?? 0,
        batch?.destination ?? "",
      ]),
      [],
      [state.machineSnapshot ? "Movimentações recebidas" : "Movimentações simuladas"],
      ["Etapa", "OP", "Peças", "Posição", "Horário"],
      ...state.movements.map((item) => [
        item.stage,
        item.orderCode,
        item.pieces,
        item.position ?? "",
        item.timestamp,
      ]),
      [],
      [state.machineSnapshot ? "Saídas recebidas" : "Saídas simuladas"],
      ["Lote", "Peças", "Destino", "Horário", "OP", "Posição"],
      ...shipments.map((item) => [
        item.id,
        item.pieces,
        item.destination,
        item.timestamp,
        item.orderCode,
        item.position,
      ]),
      [],
      ["Última peça lida"],
      ["ID", telemetry.ultimaPecaLida.idPeca],
      ["Lote", telemetry.ultimaPecaLida.codigoLote],
      ["Leitura em", telemetry.ultimaPecaLida.timestampLeitura],
      ["Qualidade de superfície", telemetry.ultimaPecaLida.qualidadeSuperficie],
      ["Inspeção", telemetry.ultimaPecaLida.statusInspecao],
      [],
      ["Leituras de telemetria"],
      ["Tag", "Valor", "Unidade", "Qualidade", "Atualização"],
      ...(state.machineSnapshot?.readings.map((reading) => [
        reading.tag,
        reading.value === null ? "Sem leitura" : String(reading.value),
        reading.unit ?? "",
        reading.quality,
        reading.timestamp ?? "",
      ]) ?? []),
      [],
      ["Saídas digitais"],
      ["Sinal", "Valor", "Qualidade", "Atualização"],
      ...(state.machineSnapshot?.digitalOutputs.map((signal) => [
        signal.label,
        signal.value === null ? "Sem leitura" : signal.value ? "Ligada" : "Desligada",
        signal.quality,
        signal.timestamp ?? "",
      ]) ?? []),
      [],
      ["Atuadores"],
      ["Atuador", "Posição", "Unidade", "Estado", "Qualidade", "Atualização"],
      ...(state.machineSnapshot?.actuators.map((actuator) => [
        actuator.label,
        actuator.position ?? "Sem leitura",
        actuator.unit,
        actuator.status ?? "",
        actuator.quality,
        actuator.timestamp ?? "",
      ]) ?? []),
    ];
    const url = URL.createObjectURL(
      new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = state.machineSnapshot
      ? "smart40-expedicao.csv"
      : "smart40-expedicao-demonstracao.csv";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(
      state.machineSnapshot
        ? "Relatório CSV gerado com dados recebidos da Expedição."
        : "Relatório CSV gerado com os indicadores, ordens filtradas e saídas simuladas.",
    );
  };

  return (
    <div className="application">
      <a className="skip-link" href="#conteudo">
        Pular para o painel
      </a>
      <aside className="sidebar" aria-label="Identidade e navegação do módulo">
        <a className="brand" href="#conteudo" aria-label="SMART 4.0, início">
          <span className="brand-mark">
            S<span>4</span>
          </span>
          <span>
            <strong>SMART 4.0</strong>
            <small>PLANTA N2 / SENAI</small>
          </span>
        </a>
        <span className="nav-label">ÁREA DE TRABALHO</span>
        <nav>
          <a className="nav-link active" href="#conteudo">
            <Icon name="grid" />
            Visão geral<span>05</span>
          </a>
          <a className="nav-link" href="#ordens">
            <Icon name="list" />
            Ordens de produção
          </a>
          <a className="nav-link" href="#saidas">
            <Icon name="box" />
            Histórico de saídas
          </a>
        </nav>
        <div className="sidebar-bottom">
          <div className="station-line">
            <span className="station-dot" />
            POSTO FINAL
          </div>
          <strong>Expedição & OEE</strong>
          <p>Grupo 5 · Protótipo acadêmico</p>
          <button className="help-link" onClick={() => setModal("help")}>
            <Icon name="info" size={17} />
            Como funciona
          </button>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            Operação <span>/</span> <strong>Expedição & OEE</strong>
          </div>
          <div className="topbar-right">
            <button
              className="icon-button"
              onClick={() => setModal("help")}
              aria-label="Ajuda da demonstração"
              title="Como funciona"
            >
              <Icon name="info" size={17} />
            </button>
            <span className="demo-tag">
              <span />
              {machineReadOnly ? "TELEMETRIA DA MÁQUINA" : "AMBIENTE SIMULADO"}
            </span>
            <span className="avatar" aria-label="Grupo 5">
              G5
            </span>
          </div>
        </header>
        <main className="dashboard" id="conteudo">
          <section className="page-heading">
            <div>
              <div className="eyebrow">VISIBILIDADE DO POSTO FINAL</div>
              <h1>
                Expedição <span>& OEE</span>
              </h1>
              <p>
                Da última peça à próxima entrega. Acompanhe o fluxo da sua
                produção.
              </p>
            </div>
            <div className={`line-status ${canProduce ? "green" : "amber"}`}>
              <span className="status-dot" />
              {canProduce ? "Linha em operação" : "Linha sem produção"}
              <small>
                {state.machineSnapshot
                  ? `${state.machineSnapshot.source} · ${state.machineSnapshot.connection}`
                  : "Estado simulado"}
              </small>
            </div>
          </section>

          <section
            className="simulation-bar"
            aria-label="Controles da demonstração"
          >
            <div className="simulation-select">
              <label htmlFor="scenario">
                {machineReadOnly ? "FONTE DE TELEMETRIA" : "CENÁRIO DE DEMONSTRAÇÃO"}
              </label>
              <select
                id="scenario"
                value={scenario}
                disabled={machineReadOnly}
                onChange={(event) => chooseScenario(event.target.value)}
              >
                {!telemetryScenarios[scenario] && (
                  <option value={scenario}>{scenario}</option>
                )}
                {Object.keys(telemetryScenarios).map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </div>
            <p>
              {machineReadOnly
                ? `${dataSourceLabel} · unidade ${state.machineSnapshot?.unitId} · ativo ${state.machineSnapshot?.assetId}`
                : scenarioDescriptions[scenario] ??
                  "Dados recebidos pela integração da SPA."}
              <small>
                {machineReadOnly
                  ? `Último snapshot: ${state.machineSnapshot?.timestamp}. A tela está em modo somente leitura.`
                  : "Trocar cenário substitui ordens, posições e dados salvos."}
              </small>
            </p>
            <div className="simulation-actions">
              <button
                className="button primary"
                disabled={machineReadOnly || !canProduce}
                onClick={() => dispatch({ type: "toggle" })}
              >
                <Icon name={running ? "pause" : "play"} size={15} />
                {machineReadOnly
                  ? "Telemetria conectada"
                  : running
                    ? "Pausar"
                    : "Iniciar simulação"}
              </button>
              <button
                className="button"
                disabled={machineReadOnly || !canProduce || running}
                onClick={() =>
                  dispatch({
                    type: "piece",
                    timestamp: new Date().toISOString(),
                  })
                }
              >
                + 1 peça
              </button>
              <button
                className="icon-button"
                aria-label="Reiniciar cenário"
                title="Reiniciar cenário"
                onClick={() => setModal("reset")}
              >
                <Icon name="reset" size={17} />
              </button>
            </div>
          </section>
          <div className="section-caption">
            <span>
              <span
                className={`status-dot ${running && canProduce ? "green" : "amber"}`}
              />
              {running && canProduce
                ? "Simulação ativa · 1 peça a cada 5 segundos"
                : "Simulação pausada · explore os cenários"}{" "}
            </span>
            <span>
              <Icon name="clock" size={13} />
              Última alteração: {time(telemetry.timestamp)}
            </span>
          </div>

          <p
            className={`persistence-note ${persistence.startsWith("Não") ? "error" : ""}`}
            role="status"
          >
            {persistence}
          </p>
          <section
            className="overview-grid"
            aria-label="Indicadores do turno demonstrativo"
          >
            <article className="oee-card">
              <div className="card-heading">
                <span className="eyebrow">EFICIÊNCIA GLOBAL</span>
                <span className="subtle-tag">
                  {state.machineSnapshot ? "DADO RECEBIDO" : "SIMULADO"}
                </span>
              </div>
              <div className="oee-body">
                <div
                  className={`gauge ${metrics.oeePercentual < 85 ? "warning" : ""}`}
                  style={
                    {
                      "--gauge-value": `${metrics.oeePercentual * 0.75}%`,
                    } as CSSProperties
                  }
                >
                  <div className="gauge-inner">
                    <strong>
                      {hasProduction ? number(metrics.oeePercentual, 1) : "—"}
                      {hasProduction && <small>%</small>}
                    </strong>
                    <span>{state.machineSnapshot ? "OEE RECEBIDO" : "OEE DO CENÁRIO"}</span>
                  </div>
                </div>
                <div className="oee-summary">
                  <span
                    className={`status-tag ${hasProduction && metrics.oeePercentual >= 85 ? "green" : "amber"}`}
                  >
                    {!hasProduction
                      ? "Sem amostra"
                      : metrics.oeePercentual >= 85
                        ? "Dentro da referência"
                        : "Abaixo da referência"}
                  </span>
                  <p>
                    Referência didática <strong>85%</strong>
                  </p>
                  <small>D × P × Q</small>
                </div>
              </div>
              <div className="oee-foot">
                {state.machineSnapshot
                  ? `Origem ${state.machineSnapshot.source} · ${state.machineSnapshot.connection}`
                  : "Valores de demonstração, sem leitura da planta."}
              </div>
            </article>
            <div className="metric-grid">
              <MetricCard
                label="TOTAL PROCESSADO"
                value={number(metrics.pecasProcessadasTotal)}
                detail="peças no turno demonstrativo"
                icon="box"
                tone="blue"
              />
              <MetricCard
                label="PEÇAS APROVADAS"
                value={number(metrics.pecasAprovadasCount)}
                detail={
                  hasProduction
                    ? `${number(metrics.qualidadePercentual, 1)}% de qualidade`
                    : "Aguardando produção"
                }
                icon="check"
                tone="green"
              />
              <MetricCard
                label="PEÇAS REJEITADAS"
                value={number(metrics.pecasRejeitadasCount)}
                detail={
                  hasProduction
                    ? `${number(rejectedRate, 1)}% de refugo`
                    : "Sem amostra de refugo"
                }
                icon="close"
                tone="red"
              />
              <MetricCard
                label="RITMO NOMINAL"
                value={number(metrics.ritmoProducaoPecasPorMinuto)}
                detail={state.machineSnapshot ? "peças/min · telemetria" : "peças/min · parâmetro simulado"}
                icon="trend"
                tone="amber"
              />
            </div>
          </section>

          <section className="secondary-grid">
            <article className="panel efficiency-panel">
              <PanelTitle
                eyebrow="ENTENDA O RESULTADO"
                title="Composição do OEE"
              />
              <EfficiencyBar
                label="Disponibilidade"
                value={metrics.disponibilidadePercentual}
                color="blue"
              />
              <EfficiencyBar
                label="Performance"
                value={metrics.performancePercentual}
                color="violet"
              />
              <EfficiencyBar
                label="Qualidade"
                value={hasProduction ? metrics.qualidadePercentual : undefined}
                color="green"
              />
              <div className="formula-note">
                <Icon name="info" size={15} />
                <span>
                  {state.machineSnapshot
                    ? "Componentes de OEE recebidos pela telemetria. "
                    : "D usa tempos simulados; P usa ciclo ideal e total. "}Q =
                  aprovadas ÷ total. OEE = D × P × Q.
                </span>
              </div>
              <div className="mtbf">
                <span>MTBF</span>
                <strong>Não disponível</strong>
                <small>Requer tempos e registros de falhas.</small>
              </div>
            </article>
            <article className="panel chart-panel">
              <PanelTitle
                eyebrow="TURNO DEMONSTRATIVO · 08H–14H"
                title="Produção por hora"
                aside={<span className="unit-label">peças</span>}
              />
              <div className="chart-legend">
                <span>
                  <i className="legend-dot green" />
                  Aprovadas
                </span>
                <span>
                  <i className="legend-dot red" />
                  Rejeitadas
                </span>
                <strong>
                  {number(metrics.pecasProcessadasTotal)} no total
                </strong>
              </div>
              <div
                className="chart"
                role="img"
                aria-label={`Produção por hora. ${history.map((item) => `${item.horario}: ${item.aprovadas} aprovadas e ${item.rejeitadas} rejeitadas`).join("; ")}`}
              >
                <div className="chart-axis">
                  {[1, 0.75, 0.5, 0.25, 0].map((fraction) => (
                    <span key={fraction}>
                      {number(chartMax * fraction, chartMax % 4 ? 1 : 0)}
                    </span>
                  ))}
                </div>
                <div className="chart-content">
                  <div className="chart-guides">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                  {history.map((item) => (
                    <div className="chart-column" key={item.horario}>
                      <div className="bar-space">
                        <div
                          className="bars"
                          style={{
                            height: `${((item.aprovadas + item.rejeitadas) / chartMax) * 100}%`,
                          }}
                          title={`${item.horario}: ${item.aprovadas} aprovadas, ${item.rejeitadas} rejeitadas`}
                        >
                          <span className="bar-value">
                            {item.aprovadas + item.rejeitadas}
                          </span>
                          <i
                            className="rejected-bar"
                            style={{ flexGrow: item.rejeitadas }}
                          />
                          <i
                            className="approved-bar"
                            style={{ flexGrow: item.aprovadas }}
                          />
                        </div>
                      </div>
                      <span className="bar-label">{item.horario}</span>
                    </div>
                  ))}
                </div>
              </div>
              <details className="chart-details">
                <summary>Ver valores do gráfico</summary>
                <table>
                  <caption className="sr-only">
                    Produção por hora
                  </caption>
                  <thead>
                    <tr>
                      <th>Hora</th>
                      <th>Aprovadas</th>
                      <th>Rejeitadas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => (
                      <tr key={item.horario}>
                        <td>{item.horario}</td>
                        <td>{item.aprovadas}</td>
                        <td>{item.rejeitadas}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
              <p className="chart-note">
                Novas peças entram na última faixa do turno didático.
              </p>
            </article>
            <article className="panel shipping-panel">
              <PanelTitle
                eyebrow="LOGÍSTICA DE SAÍDA"
                title="Palete em preparação"
                aside={<Icon name="box" />}
              />
              <div className="pallet-top">
                <strong>{pallet.codigo}</strong>
                <span
                  className={`status-tag ${pallet.pecas === pallet.capacidade ? "amber" : "blue"}`}
                >
                  {pallet.pecas === pallet.capacidade
                    ? "Completo"
                    : "Em preparo"}
                </span>
              </div>
              <div
                className="pallet-slots"
                role="img"
                aria-label={`${pallet.pecas} de ${pallet.capacidade} posições ocupadas`}
              >
                {Array.from({ length: pallet.capacidade }, (_, index) => (
                  <i
                    key={index}
                    className={index < pallet.pecas ? "filled" : ""}
                  />
                ))}
              </div>
              <div className="pallet-count">
                <strong>
                  {pallet.pecas}
                  <small> / {pallet.capacidade} peças</small>
                </strong>
                <span>{number((pallet.pecas / pallet.capacidade) * 100)}%</span>
              </div>
              <div className="destination">
                <span>DESTINO</span>
                <strong>{pallet.destino}</strong>
              </div>
              <div className="queue-row">
                <span>
                  <span className="status-dot amber" />
                  Fila de saída
                </span>
                <strong>{metrics.tamanhoFilaSaida} peças</strong>
              </div>
              <a className="button release-button" href="#mapa">
                Identificar e armazenar lote <Icon name="arrow" size={16} />
              </a>
              <p className="rack-note">
                {state.receipt.orderCode || "Sem OP"} ·{" "}
                {state.receipt.identifiedAt
                  ? "Identificado · lote fechado"
                  : "Em recebimento"}
              </p>
            </article>
          </section>

          <LogisticsPanel
            state={state}
            dispatch={dispatch}
            onDialogChange={setWorkflowOpen}
            notify={setNotice}
          />

          <section
            className="alerts-section"
            aria-label="Diagnóstico do cenário"
          >
            {alerts.map((alert) => (
              <div className={`alert-card ${alert.tone}`} key={alert.title}>
                <Icon
                  name={alert.tone === "green" ? "check" : "alert"}
                  size={19}
                />
                <div>
                  <strong>{alert.title}</strong>
                  <p>{alert.detail}</p>
                </div>
              </div>
            ))}
          </section>

          <section className="panel orders-panel" id="ordens">
            <PanelTitle
              eyebrow="PLANEJAMENTO E ACOMPANHAMENTO"
              title="Ordens de produção"
              aside={
                <div className="export-actions">
                  <button className="button" onClick={exportCsv}>
                    <Icon name="download" size={15} />
                    Exportar CSV
                  </button>
                  <button className="button" onClick={() => window.print()}>
                    <Icon name="print" size={15} />
                    Salvar PDF
                  </button>
                </div>
              }
            />
            <div className="table-toolbar">
              <div
                className="filter-tabs"
                role="group"
                aria-label="Filtrar ordens por status"
              >
                {["TODAS", "ATIVA", "AGUARDANDO", "FINALIZADA"].map((value) => (
                  <button
                    key={value}
                    className={filter === value ? "selected" : ""}
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                  >
                    {value === "TODAS"
                      ? "Todas"
                      : statusNames[value as StatusOrdem]}
                    <span>
                      {value === "TODAS"
                        ? orders.length
                        : orders.filter((order) => order.status === value)
                            .length}
                    </span>
                  </button>
                ))}
              </div>
              <label className="search-field">
                <span className="sr-only">Buscar ordem ou produto</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar ordem ou produto…"
                />
              </label>
            </div>
            <div className="table-scroll">
              <table>
                <caption className="sr-only">
                  Ordens da Expedição
                </caption>
                <thead>
                  <tr>
                    <th>ORDEM / PRODUTO</th>
                    <th>META</th>
                    <th>PRODUZIDO</th>
                    <th>PROGRESSO</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOrders.map((order) => (
                    <tr key={order.codigo}>
                      <td>
                        <strong className="order-code">{order.codigo}</strong>
                        <span className="product-name">{order.produto}</span>
                        <span className="product-name">
                          Destino: {order.destino}
                        </span>
                      </td>
                      <td>
                        {number(order.meta)} <small>un.</small>
                      </td>
                      <td>
                        <strong>{number(order.produzido)}</strong>{" "}
                        <small>un.</small>
                      </td>
                      <td>
                        <div className="order-progress">
                          <div
                            role="progressbar"
                            aria-label={`Progresso ${order.codigo}`}
                            aria-valuenow={order.produzido}
                            aria-valuemin={0}
                            aria-valuemax={order.meta}
                          >
                            <i
                              style={{
                                width: `${(order.produzido / order.meta) * 100}%`,
                              }}
                            />
                          </div>
                          <span>
                            {number((order.produzido / order.meta) * 100)}%
                          </span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`status-tag ${order.status === "ATIVA" ? "blue" : order.status === "FINALIZADA" ? "green" : "neutral"}`}
                        >
                          <span className="status-dot" />
                          {statusNames[order.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!visibleOrders.length && (
                <div className="empty-state">
                  <Icon name="list" size={28} />
                  <strong>Nenhuma ordem encontrada</strong>
                  <p>Tente outro produto ou status.</p>
                  <button
                    className="button"
                    onClick={() => {
                      setQuery("");
                      setFilter("TODAS");
                    }}
                  >
                    Limpar filtros
                  </button>
                </div>
              )}
            </div>
            <div className="table-foot">
              <span>
                {visibleOrders.length} de {orders.length} ordens · {dataSourceLabel}
              </span>
              <span>
                ÚLTIMA PEÇA <strong>{telemetry.ultimaPecaLida.idPeca}</strong> ·{" "}
                {hasProduction
                  ? telemetry.ultimaPecaLida.statusInspecao
                  : "SEM LEITURA"}
              </span>
            </div>
          </section>

          <section className="panel shipments-panel" id="saidas">
            <PanelTitle
              eyebrow={state.machineSnapshot ? "REGISTRO DA EXPEDIÇÃO" : "REGISTRO LOCAL DA DEMONSTRAÇÃO"}
              title="Histórico de saídas"
              aside={
                <span className="shipment-total">
                  {shipments.length} paletes <span>·</span> {shippedPieces}{" "}
                  peças
                </span>
              }
            />
            {!shipments.length ? (
              <div className="shipment-empty">
                <span className="empty-icon">
                  <Icon name="box" size={24} />
                </span>
                <div>
                  <strong>A próxima expedição começa este histórico.</strong>
                  <p>
                    Armazene um lote, selecione sua posição e confirme a
                    expedição.
                  </p>
                </div>
              </div>
            ) : (
              <div className="shipment-list">
                {shipments.map((shipment) => (
                  <div className="shipment-item" key={shipment.id}>
                    <span className="empty-icon">
                      <Icon name="check" size={19} />
                    </span>
                    <div>
                      <strong>
                        {shipment.id}{" "}
                        <span className="subtle-tag">
                          {state.machineSnapshot ? "SAÍDA RECEBIDA" : "SAÍDA SIMULADA"}
                        </span>
                      </strong>
                      <p>
                        {shipment.orderCode} · {shipment.product} ·{" "}
                        {shipment.pieces} peças → {shipment.destination} ·
                        posição {shipment.position}
                      </p>
                    </div>
                    <time dateTime={shipment.timestamp}>
                      {time(shipment.timestamp)}
                    </time>
                  </div>
                ))}
              </div>
            )}
          </section>
          <footer className="footer">
            <span>
              <strong>SMART 4.0</strong> · Grupo 5 / Expedição & OEE
            </span>
            <span>
              {state.machineSnapshot
                ? `SPA · Grupo 5 · ${dataSourceLabel}`
                : "Protótipo · Grupo 5 · mock local · dados salvos neste navegador"}
            </span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Icon name="check" size={19} />
          {notice}
          <button
            className="icon-button"
            aria-label="Fechar aviso"
            onClick={() => setNotice("")}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      {modal && (
        <Modal
          title={
            modal === "reset"
              ? "Reiniciar e limpar dados salvos?"
              : "Uma janela para a expedição"
          }
          onClose={() => setModal(null)}
        >
          {modal === "reset" ? (
            <>
              <p>
                As ordens cadastradas, posições, movimentações e dados salvos
                serão substituídos pelo início do cenário{" "}
                <strong>{scenario}</strong>. A simulação ficará pausada.
              </p>
              <div className="modal-actions">
                <button className="button" onClick={() => setModal(null)}>
                  Cancelar
                </button>
                <button
                  className="button primary"
                  onClick={() => {
                    chooseScenario(scenario);
                    setModal(null);
                  }}
                >
                  Reiniciar cenário
                </button>
              </div>
            </>
          ) : (
            <>
              <p>
                Este é o módulo independente de{" "}
                <strong>Expedição & OEE do Grupo 5</strong>, preparado para a
                segunda aula.
              </p>
              <ol className="help-steps">
                <li>
                  Escolha um cenário para demonstrar uma condição da linha.
                </li>
                <li>
                  Inicie a simulação ou avance uma peça por vez. A produção
                  automática é de 12 peças/minuto.
                </li>
                <li>
                  Compare OEE, refugo e fila; acompanhe a ordem em produção e a
                  ocupação do palete.
                </li>
                <li>
                  Cadastre uma OP, identifique o lote, armazene em uma posição
                  e confirme sua expedição. Exporte CSV ou PDF.
                </li>
              </ol>
              <div className="modal-note">
                Todos os valores são simulados. Edite tempos e ciclo ideal em
                Premissas do OEE. MTBF aguarda registros de falhas. A
                demonstração é salva neste navegador e restaurada pausada;
                trocar cenário ou reiniciar substitui os dados salvos.
              </div>
              <button
                className="button primary help-done"
                onClick={() => setModal(null)}
              >
                Entendi, explorar painel
              </button>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: string;
  tone: string;
}) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}>
        <Icon name={icon} size={19} />
      </div>
      <div className="metric-label">{label}</div>
      <strong className="metric-value">{value}</strong>
      <div className="metric-detail">{detail}</div>
    </article>
  );
}
function PanelTitle({
  eyebrow,
  title,
  aside,
}: {
  eyebrow: string;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="panel-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
      </div>
      {aside && <div className="panel-aside">{aside}</div>}
    </div>
  );
}
function EfficiencyBar({
  label,
  value,
  color,
}: {
  label: string;
  value?: number;
  color: string;
}) {
  return (
    <div className="efficiency-row">
      <div className="efficiency-copy">
        <span>
          <i className={`legend-dot ${color}`} />
          {label}
        </span>
        <strong>{value === undefined ? "—" : `${number(value, 1)}%`}</strong>
      </div>
      <div className="efficiency-track">
        <i className={color} style={{ width: `${value ?? 0}%` }} />
      </div>
    </div>
  );
}
export default App;
