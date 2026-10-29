import { useState, type Dispatch, type FormEvent } from "react";
import type { SimulationAction, SimulationState } from "../domain/expedition";
import { validateOrder, validateOee } from "../domain/warehouse";
import { Modal } from "./Modal";
import "./LogisticsPanel.css";

const stages = {
  RECEBIDO: "Recebido",
  IDENTIFICADO: "Identificado",
  ARMAZENADO: "Armazenado",
  EXPEDIDO: "Expedido",
};
const date = (value: string) => new Date(value).toLocaleString("pt-BR");
const format = (value: number) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export function LogisticsPanel({
  state,
  dispatch,
  onDialogChange,
  notify,
}: {
  state: SimulationState;
  dispatch: Dispatch<SimulationAction>;
  onDialogChange: (open: boolean) => void;
  notify: (message: string) => void;
}) {
  const [modal, setModal] = useState<
    "order" | "oee" | "store" | "ship" | "capacity" | null
  >(null);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState("");
  const [showAllEvents, setShowAllEvents] = useState(false);
  const pallet = state.telemetry.dadosExpedicao.palete;
  const machineSnapshot = state.machineSnapshot;
  const machineReadOnly =
    !!machineSnapshot && machineSnapshot.source !== "simulated";
  const selectedBatch = state.rack[selected];
  const occupied = state.rack.filter(Boolean).length;
  const stopped = state.telemetry.estadoGlobal !== "EM_EXECUCAO";
  const receiptOrder = state.telemetry.dadosExpedicao.ordens.find(
    (o) => o.codigo === state.receipt.orderCode,
  );
  const open = (value: typeof modal) => {
    setError("");
    setModal(value);
    onDialogChange(!!value);
  };
  const close = () => open(null);
  const blockMachineWrite = () => {
    if (!machineReadOnly) return false;
    const message = "Dados recebidos em modo somente leitura; a SPA não enviou comandos à máquina.";
    setError(message);
    notify(message);
    return true;
  };
  const createOrder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (blockMachineWrite()) return;
    const form = new FormData(event.currentTarget);
    const draft = {
      codigo: String(form.get("codigo")).trim().toUpperCase(),
      produto: String(form.get("produto")).trim(),
      meta: Number(form.get("meta")),
      destino: String(form.get("destino")).trim(),
    };
    const message = validateOrder(draft, state.telemetry.dadosExpedicao.ordens);
    if (message) {
      setError(message);
      return;
    }
    dispatch({ type: "add-order", draft, timestamp: new Date().toISOString() });
    close();
    notify(`${draft.codigo} cadastrada. A ordem entra na fila de produção.`);
  };
  const saveOee = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (blockMachineWrite()) return;
    const form = new FormData(event.currentTarget);
    const inputs = {
      plannedSeconds: Number(form.get("planned")) * 60,
      stoppedSeconds: Number(form.get("stopped")) * 60,
      idealCycleSeconds: Number(form.get("cycle")),
    };
    const message = validateOee(inputs);
    if (message) {
      setError(message);
      return;
    }
    dispatch({ type: "oee", inputs });
    close();
    notify(
      "Premissas simuladas aplicadas. OEE recalculado pelos tempos e contadores.",
    );
  };
  const resizeRack = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (blockMachineWrite()) return;
    const capacity = Number(new FormData(event.currentTarget).get("capacity"));
    if (state.rack.slice(capacity).some(Boolean)) {
      setError(
        "Expeça os lotes das posições que serão removidas antes de reduzir a capacidade.",
      );
      return;
    }
    dispatch({ type: "resize-rack", capacity });
    setSelected(0);
    close();
    notify(`Armazenamento configurado para ${capacity} posições simuladas.`);
  };
  const store = () => {
    if (blockMachineWrite()) return;
    const position = state.rack.indexOf(null);
    dispatch({ type: "release", timestamp: new Date().toISOString() });
    setSelected(position);
    close();
    notify(`${pallet.codigo} armazenado na posição ${position + 1}.`);
  };
  const ship = () => {
    if (!selectedBatch || blockMachineWrite()) return;
    dispatch({
      type: "ship",
      position: selected,
      timestamp: new Date().toISOString(),
    });
    close();
    notify(
      `${selectedBatch.id} expedido para ${selectedBatch.destination}. Posição liberada.`,
    );
  };
  return (
    <section
      className="panel logistics-panel"
      id="mapa"
      aria-labelledby="logistics-title"
    >
      <div className="panel-title">
        <div>
          <div className="eyebrow">
            DO RECEBIMENTO À SAÍDA · SIMULAÇÃO LOCAL
          </div>
          <h2 id="logistics-title">Mapa da expedição</h2>
        </div>
        <div className="logistics-actions">
          <button className="button primary" disabled={machineReadOnly} onClick={() => open("order")}>
            + Nova OP
          </button>
          <button className="button" disabled={machineReadOnly} onClick={() => open("oee")}>
            Premissas do OEE
          </button>
          <button className="button" disabled={machineReadOnly} onClick={() => open("capacity")}>
            Configurar posições
          </button>
        </div>
      </div>
      <p className="layout-premise">
        {state.rack.length} posições · lotes de até {pallet.capacidade} peças da
        mesma OP e destino. Configuração didática; não representa uma medição
        oficial da planta.
      </p>
      <nav className="station-nav" aria-label="Seções da estação de expedição">
        <a href="#expedition-positions">Posições e saídas</a>
        <a href="#expedition-digital-outputs">Saídas digitais</a>
        <a href="#expedition-actuators">Atuadores</a>
      </nav>
      <div className="process-flow" aria-label="Etapas da expedição">
        <div className={`process-step ${pallet.pecas ? "current" : ""}`}>
          <span className="step-number">01</span>
          <strong>Recebimento</strong>
          <small>
            {pallet.pecas
              ? `${pallet.codigo} · ${pallet.pecas} peças`
              : "Aguardando produção"}
          </small>
          <span className="conveyor-mini" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
        <span className="flow-arrow" aria-hidden="true">
          →
        </span>
        <div
          className={`process-step ${state.receipt.identifiedAt ? "current" : ""}`}
        >
          <span className="step-number">02</span>
          <strong>Identificação RFID</strong>
          <small>
            {state.receipt.identifiedAt
              ? `${state.receipt.orderCode} · identificado`
              : "Leitura simulada do lote"}
          </small>
          <button
            className="button"
            disabled={machineReadOnly || !pallet.pecas || !!state.receipt.identifiedAt || stopped}
            onClick={() => {
              dispatch({
                type: "identify",
                timestamp: new Date().toISOString(),
              });
              notify(
                "Lote identificado e fechado para novas peças. Novas peças seguem para a fila.",
              );
            }}
          >
            {state.receipt.identifiedAt
              ? "Lote identificado"
              : "Identificar lote"}
          </button>
        </div>
        <span className="flow-arrow" aria-hidden="true">
          →
        </span>
        <div className="process-step">
          <span className="step-number">03</span>
          <strong>Armazenamento</strong>
          <small>
            {occupied} de {state.rack.length} posições ocupadas
          </small>
          <button
            className="button"
            disabled={
              !pallet.pecas ||
              machineReadOnly ||
              !state.receipt.identifiedAt ||
              occupied === state.rack.length ||
              stopped
            }
            onClick={() => open("store")}
          >
            Armazenar lote
          </button>
        </div>
        <span className="flow-arrow" aria-hidden="true">
          →
        </span>
        <div className="process-step">
          <span className="step-number">04</span>
          <strong>Expedição</strong>
          <small>{state.shipments.length} lotes expedidos</small>
          <span className="step-hint">Selecione uma posição ocupada</span>
        </div>
      </div>
      {occupied === state.rack.length && (
        <div className="warehouse-warning" role="status">
          Armazenamento cheio. Expeça um lote para liberar uma posição; a fila
          permanece preservada.
        </div>
      )}
      <div className="warehouse-grid" id="expedition-positions">
        <div className="rack-area">
          <div className="rack-title">
            <span>PRATELEIRA SIMULADA</span>
            <span>
              <i className="legend-dot blue" />
              Ocupada <i className="legend-dot neutral" />
              Livre
            </span>
          </div>
          <div
            className="rack-grid"
            role="group"
            aria-label="Posições do armazenamento"
          >
            {state.rack.map((batch, index) => (
              <button
                key={index}
                id={`rack-position-${index}`}
                className={`rack-slot ${batch ? "occupied" : ""} ${selected === index ? "selected" : ""}`}
                aria-pressed={selected === index}
                aria-label={`Posição ${index + 1}, ${batch ? `${batch.orderCode}, ${batch.pieces} peças` : "livre"}`}
                onClick={() => setSelected(index)}
              >
                <span className="slot-address">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="slot-crate" aria-hidden="true">
                  {batch ? "▥" : "+"}
                </span>
                <strong>{batch?.orderCode ?? "Livre"}</strong>
                <small>{batch ? `${batch.pieces} peças` : "Disponível"}</small>
              </button>
            ))}
          </div>
          <p className="rack-note">
            Preenchimento da esquerda para a direita, de cima para baixo.
          </p>
        </div>
        <div className="slot-details" aria-live="polite">
          <div className="eyebrow">
            POSIÇÃO {String(selected + 1).padStart(2, "0")}
          </div>
          {selectedBatch ? (
            <>
              <h3>{selectedBatch.orderCode}</h3>
              <dl>
                <dt>Lote</dt>
                <dd>{selectedBatch.id}</dd>
                <dt>Produto</dt>
                <dd>{selectedBatch.product}</dd>
                <dt>Quantidade</dt>
                <dd>{selectedBatch.pieces} peças</dd>
                <dt>Destino</dt>
                <dd>{selectedBatch.destination}</dd>
                <dt>Armazenado em</dt>
                <dd>{date(selectedBatch.storedAt)}</dd>
              </dl>
              <button
                className="button primary"
                disabled={stopped || machineReadOnly}
                onClick={() => open("ship")}
              >
                Simular expedição →
              </button>
            </>
          ) : (
            <>
              <h3>Posição disponível</h3>
              <p>
                Identifique o lote recebido e confirme seu armazenamento. A
                primeira posição livre será preenchida.
              </p>
              <div className="receipt-detail">
                <span>LOTE EM RECEBIMENTO</span>
                <strong>{pallet.pecas ? pallet.codigo : "Sem peças"}</strong>
                <p>
                  {receiptOrder
                    ? `${receiptOrder.codigo} · ${receiptOrder.produto}`
                    : "Aguardando ordem"}
                </p>
                <p>
                  {pallet.pecas
                    ? `${pallet.pecas} peças → ${pallet.destino}`
                    : "Produza uma peça para iniciar o fluxo."}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
      {state.queue.length > 0 && (
        <div className="batch-queue">
          <strong>Fila preservada por ordem</strong>
          <div>
            {state.queue.map((batch, index) => (
              <span key={`${batch.orderCode}-${index}`}>
                {batch.orderCode} · {batch.pieces} peças · {batch.destination}
              </span>
            ))}
          </div>
        </div>
      )}
      <details className="oee-explanation">
        <summary>De onde vêm os números do OEE?</summary>
        <div>
          <p>
            Planejado:{" "}
            <strong>{format(state.oeeInputs.plannedSeconds / 60)} min</strong> ·
            Paradas:{" "}
            <strong>{format(state.oeeInputs.stoppedSeconds / 60)} min</strong> ·
            Operação:{" "}
            <strong>
              {format(
                (state.oeeInputs.plannedSeconds -
                  state.oeeInputs.stoppedSeconds) /
                  60,
              )}{" "}
              min
            </strong>{" "}
            · Ciclo ideal:{" "}
            <strong>{format(state.oeeInputs.idealCycleSeconds)} s/peça</strong>
          </p>
          <p>
            D = operação ÷ planejado. P = total × ciclo ideal ÷ operação,
            limitado a 100%. Q = aprovadas ÷ total. Cada nova peça acrescenta 5
            segundos ao relógio didático; pausa não acrescenta tempo. Sem
            amostra, OEE aparece indisponível.
          </p>
        </div>
      </details>
      <div className="movement-heading">
        <h3>Movimentações</h3>
        <button
          className="button"
          onClick={() => setShowAllEvents(!showAllEvents)}
        >
          {showAllEvents ? "Mostrar recentes" : "Ver todas"} (
          {state.movements.length})
        </button>
      </div>
      {!state.movements.length ? (
        <p className="rack-note">
          Nenhuma movimentação. Produza uma peça para iniciar.
        </p>
      ) : (
        <ol className="movement-log">
          {(showAllEvents ? state.movements : state.movements.slice(0, 6)).map(
            (item) => (
              <li key={item.id}>
                <span
                  className={`movement-stage stage-${item.stage.toLowerCase()}`}
                >
                  {stages[item.stage]}
                </span>
                <strong>{item.orderCode}</strong>
                <span>
                  {item.pieces} peças
                  {item.position ? ` · posição ${item.position}` : ""}
                </span>
                <time dateTime={item.timestamp}>{date(item.timestamp)}</time>
              </li>
            ),
          )}
        </ol>
      )}
      <section
        className="station-status-section"
        id="expedition-digital-outputs"
        aria-labelledby="digital-outputs-title"
      >
        <div className="station-section-heading">
          <div>
            <div className="eyebrow">INTERFACE COM A ESTAÇÃO</div>
            <h3 id="digital-outputs-title">Saídas digitais</h3>
          </div>
          <span className="station-connection-state">
            {machineSnapshot
              ? `${machineSnapshot.source} · ${machineSnapshot.connection}`
              : "Aguardando integração"}
          </span>
        </div>
        <p className="station-integration-note">
          {machineSnapshot
            ? `Origem: ${machineSnapshot.source} · atualização ${date(machineSnapshot.timestamp)} · ${machineSnapshot.readings.filter((reading) => reading.quality === "GOOD").length}/${machineSnapshot.readings.length} leituras GOOD. Saídas somente para visualização.`
            : "Sinais preparados para telemetria da IHM. Aguardando snapshot da máquina; nenhum estado foi presumido."}
        </p>
        <div className="station-signal-grid">
          {(machineSnapshot?.digitalOutputs ?? [
            "Avança manipulador",
            "Liga vácuo",
            "Motor esteira 1",
            "Motor esteira 2",
            "Stopper 1",
            "Stopper 2",
            "Saída de processo",
          ].map((label, index) => ({
            id: `output-${index + 1}`,
            label,
            value: null,
            quality: "BAD" as const,
            timestamp: null,
          }))
          ).map((signal) => (
            <div
              className={`station-signal ${signal.quality !== "GOOD" || signal.value === null ? "unavailable" : signal.value ? "active" : "inactive"}`}
              key={signal.id}
              title={signal.timestamp ? `Atualizado: ${date(signal.timestamp)} · Qualidade: ${signal.quality}` : `Qualidade: ${signal.quality}`}
            >
              <span className="station-signal-indicator" aria-hidden="true" />
              <strong>{signal.label}</strong>
              <small>
                {signal.quality !== "GOOD" || signal.value === null
                  ? "Leitura não confiável"
                  : signal.value
                    ? "Ligada"
                    : "Desligada"}
                {` · ${signal.quality}`}
              </small>
            </div>
          ))}
        </div>
      </section>
      <section
        className="station-status-section"
        id="expedition-actuators"
        aria-labelledby="actuators-title"
      >
        <div className="station-section-heading">
          <div>
            <div className="eyebrow">MOVIMENTOS DA ESTAÇÃO</div>
            <h3 id="actuators-title">Atuadores</h3>
          </div>
          <span className="station-connection-state">
            {machineSnapshot
              ? `${machineSnapshot.actuators.length} sinais · ${machineSnapshot.connection}`
              : "Aguardando telemetria"}
          </span>
        </div>
        <p className="station-integration-note">
          {machineSnapshot
            ? `Origem: ${machineSnapshot.source} · valores recebidos são somente para visualização. Comandos de movimento não são enviados por esta tela.`
            : "Posições, estados e unidades preparados para receber telemetria. Os comandos de movimento permanecem desabilitados."}
        </p>
        <div className="station-actuator-grid">
          {(machineSnapshot?.actuators ?? [
            { id: "vertical", label: "Atuador vertical", unit: "mm" },
            { id: "horizontal", label: "Atuador horizontal", unit: "mm" },
            { id: "rotary", label: "Atuador giratório", unit: "°" },
          ].map((actuator) => ({
            ...actuator,
            position: null,
            status: null,
            quality: "BAD" as const,
            timestamp: null,
          }))
          ).map((actuator) => (
            <article className="station-actuator" key={actuator.id}>
              <h4>{actuator.label}</h4>
              <dl>
                <dt>Posição atual</dt>
                <dd>
                  {actuator.position === null
                    ? "—"
                    : `${format(actuator.position)} ${actuator.unit}`}
                </dd>
                <dt>Estado</dt>
                <dd>{actuator.status ?? "Sem leitura"}</dd>
                <dt>Qualidade</dt>
                <dd>{actuator.quality}</dd>
              </dl>
              <div className="station-jog-controls" aria-label="Comandos indisponíveis">
                <button type="button" className="button" disabled>JOG −</button>
                <button type="button" className="button" disabled>JOG +</button>
              </div>
            </article>
          ))}
        </div>
      </section>
      {modal && (
        <Modal
          fallbackFocusId={`rack-position-${selected}`}
          title={
            {
              order: "Cadastrar ordem simulada",
              oee: "Premissas simuladas do OEE",
              store: "Armazenar lote identificado?",
              ship: "Confirmar expedição simulada?",
              capacity: "Configurar armazenamento",
            }[modal]
          }
          onClose={close}
        >
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {modal === "order" && (
            <form onSubmit={createOrder} className="workflow-form">
              <p>
                A ordem entra após a OP ativa. Se não houver produção em
                andamento, ela se torna ativa.
              </p>
              <label>
                Código da OP
                <input
                  name="codigo"
                  required
                  maxLength={24}
                  placeholder="OP-004"
                  autoComplete="off"
                />
              </label>
              <label>
                Produto
                <input
                  name="produto"
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="Carcaça modelo B"
                />
              </label>
              <div className="form-columns">
                <label>
                  Quantidade (peças)
                  <input
                    name="meta"
                    type="number"
                    required
                    min={1}
                    max={100000}
                    step={1}
                    defaultValue={20}
                  />
                </label>
                <label>
                  Destino
                  <input
                    name="destino"
                    required
                    minLength={2}
                    maxLength={100}
                    placeholder="Unidade Campinas"
                  />
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="button" onClick={close}>
                  Cancelar
                </button>
                <button className="button primary" type="submit">
                  Cadastrar OP
                </button>
              </div>
            </form>
          )}
          {modal === "oee" && (
            <form className="workflow-form" onSubmit={saveOee}>
              <p>
                Tempos acumulados do turno didático. As premissas iniciais foram
                deduzidas dos percentuais do mock e podem ser alteradas aqui.
              </p>
              <label>
                Tempo planejado (min)
                <input
                  name="planned"
                  type="number"
                  required
                  min={0.001}
                  max={1440}
                  step="any"
                  defaultValue={state.oeeInputs.plannedSeconds / 60}
                />
              </label>
              <label>
                Paradas acumuladas (min)
                <input
                  name="stopped"
                  type="number"
                  required
                  min={0}
                  step="any"
                  defaultValue={state.oeeInputs.stoppedSeconds / 60}
                />
              </label>
              <label>
                Ciclo ideal (segundos/peça)
                <input
                  name="cycle"
                  type="number"
                  required
                  min={0.001}
                  max={3600}
                  step="any"
                  defaultValue={state.oeeInputs.idealCycleSeconds}
                />
              </label>
              <div className="modal-note">
                São premissas simuladas. Performance acima de 100% é limitada no
                cálculo didático. MTBF continua indisponível sem registros de
                falhas.
              </div>
              <div className="modal-actions">
                <button type="button" className="button" onClick={close}>
                  Cancelar
                </button>
                <button className="button primary" type="submit">
                  Aplicar premissas
                </button>
              </div>
            </form>
          )}
          {modal === "capacity" && (
            <form className="workflow-form" onSubmit={resizeRack}>
              <p>
                O padrão de 12 posições é uma referência didática do site de
                outros alunos, sem confirmação da bancada desta turma. Cada
                posição recebe um lote de até 50 peças.
              </p>
              <label>
                Quantidade de posições
                <select name="capacity" defaultValue={state.rack.length}>
                  {[8, 12, 16, 24].map((n) => (
                    <option key={n} value={n}>
                      {n} posições
                    </option>
                  ))}
                </select>
              </label>
              <div className="modal-actions">
                <button type="button" className="button" onClick={close}>
                  Cancelar
                </button>
                <button className="button primary" type="submit">
                  Salvar capacidade
                </button>
              </div>
            </form>
          )}
          {modal === "store" && (
            <>
              <p>
                <strong>{pallet.codigo}</strong> · {state.receipt.orderCode} ·{" "}
                {pallet.pecas} peças → {pallet.destino}.
              </p>
              <div className="modal-note">
                O lote será guardado na posição {state.rack.indexOf(null) + 1}.
                O próximo lote recebe peças da primeira OP da fila, sem misturar
                ordens ou destinos.
              </div>
              <div className="modal-actions">
                <button className="button" onClick={close}>
                  Cancelar
                </button>
                <button className="button primary" onClick={store}>
                  Confirmar armazenamento
                </button>
              </div>
            </>
          )}
          {modal === "ship" && selectedBatch && (
            <>
              <p>
                <strong>{selectedBatch.id}</strong> · {selectedBatch.orderCode}{" "}
                · {selectedBatch.pieces} peças → {selectedBatch.destination}.
              </p>
              <div className="modal-note">
                Esta ação registra a saída simulada e libera a posição{" "}
                {selected + 1}. Nenhum comando é enviado à planta.
              </div>
              <div className="modal-actions">
                <button className="button" onClick={close}>
                  Cancelar
                </button>
                <button className="button primary" onClick={ship}>
                  Confirmar expedição
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </section>
  );
}
