import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { telemetryMock, telemetryScenarios } from './mocks/telemetryMock'
import { isTelemetriaSmart40, SMART40_TELEMETRIA_EVENT, type TelemetriaSmart40 } from './types/smart40'
import './App.css'

function App() {
  const [telemetry, setTelemetry] = useState<TelemetriaSmart40>(telemetryMock)
  const [fromShell, setFromShell] = useState(false)
  const [notice, setNotice] = useState('')
  const [released, setReleased] = useState(false)
  const metrics = telemetry.metricasExpedicao
  const rejectedRate = metrics.pecasProcessadasTotal
    ? (metrics.pecasRejeitadasCount / metrics.pecasProcessadasTotal) * 100
    : 0

  useEffect(() => {
    const receiveTelemetry = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail
      if (isTelemetriaSmart40(detail)) {
        setTelemetry(detail)
        setFromShell(true)
        setReleased(false)
        setNotice('Telemetria atualizada pelo App Shell')
      }
    }
    window.addEventListener(SMART40_TELEMETRIA_EVENT, receiveTelemetry)
    return () => window.removeEventListener(SMART40_TELEMETRIA_EVENT, receiveTelemetry)
  }, [])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 3200)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const chart = useMemo(() => {
    const history = metrics.historico ?? []
    const max = Math.max(1, ...history.map((item) => item.aprovadas + item.rejeitadas))
    return history.map((item) => ({ ...item, height: ((item.aprovadas + item.rejeitadas) / max) * 100 }))
  }, [metrics.historico])

  const chooseScenario = (name: string) => {
    if (!name) return
    setTelemetry(telemetryScenarios[name])
    setFromShell(false)
    setReleased(false)
    setNotice(`Cenário de demonstração: ${name}`)
  }

  const exportCsv = () => {
    const rows = [
      ['Código', 'Produto', 'Meta', 'Produzido', 'Status'],
      ...telemetry.dadosExpedicao.ordens.map((order) => [order.codigo, order.produto, order.meta, order.produzido, order.status]),
    ]
    const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(';')).join('\r\n')}`
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'relatorio-expedicao.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const releasePallet = () => {
    if (released || telemetry.dadosExpedicao.palete.pecas === 0) return
    setReleased(true)
    setNotice(`${telemetry.dadosExpedicao.palete.codigo} liberado para expedição`)
  }

  const latestUpdate = new Date(telemetry.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="SMART 4.0 início">
          <span className="brand-mark">S<span>4</span></span>
          <span className="brand-copy"><strong>SMART 4.0</strong><small>PAINEL INDUSTRIAL</small></span>
        </a>
        <div className="topbar-right">
          <label className="scenario-picker"><span>AMBIENTE DE DEMONSTRAÇÃO</span>
            <select defaultValue="" onChange={(event) => chooseScenario(event.target.value)} aria-label="Selecionar cenário de telemetria">
              <option value="">Telemetria ao vivo / mock</option>
              {Object.keys(telemetryScenarios).map((scenario) => <option key={scenario}>{scenario}</option>)}
            </select>
          </label>
          <div className="live-status"><i /> {telemetry.estadoGlobal === 'EM_EXECUCAO' ? 'LINHA EM OPERAÇÃO' : telemetry.estadoGlobal === 'PRONTA' ? 'LINHA PRONTA' : 'PARADA DE EMERGÊNCIA'}</div>
        </div>
      </header>

      <div className="dashboard" id="inicio">
        <section className="page-heading">
          <div><div className="eyebrow">MONITORAMENTO · POSTO FINAL</div><h1>Expedição <span>&amp; OEE</span></h1><p>Acompanhe a eficiência e o fluxo de saída da produção em tempo real.</p></div>
          <div className="updated"><span className="pulse-dot" /> ATUALIZADO ÀS <strong>{latestUpdate}</strong></div>
        </section>

        <section className="overview-grid" aria-label="Indicadores de expedição">
          <article className="oee-card">
            <div className="card-label">EFICIÊNCIA GLOBAL <span className="info-mark" title="OEE: disponibilidade × performance × qualidade">i</span></div>
            <div className="gauge-wrap" style={{ '--gauge-value': `${Math.min(100, Math.max(0, metrics.oeePercentual))}%` } as CSSProperties}>
              <div className="gauge"><div className="gauge-inner"><strong>{metrics.oeePercentual.toFixed(1)}<small>%</small></strong><span>OEE ATUAL</span></div></div>
            </div>
            <div className="oee-footer"><span><i className="legend-dot green" /> Meta de referência</span><strong>85%</strong></div>
          </article>

          <div className="metric-grid">
            <MetricCard label="PEÇAS PRODUZIDAS" value={metrics.pecasProcessadasTotal.toLocaleString('pt-BR')} detail="total processado" icon="▦" tone="blue" />
            <MetricCard label="APROVADAS" value={metrics.pecasAprovadasCount.toLocaleString('pt-BR')} detail="conformes" icon="✓" tone="green" />
            <MetricCard label="REJEITADAS" value={metrics.pecasRejeitadasCount.toLocaleString('pt-BR')} detail={`${rejectedRate.toFixed(1)}% de refugo`} icon="×" tone="red" />
            <MetricCard label="RITMO DE PRODUÇÃO" value={metrics.ritmoProducaoPecasPorMinuto.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} detail="peças por minuto" icon="↗" tone="amber" />
          </div>
        </section>

        <section className="secondary-grid">
          <article className="panel efficiency-panel">
            <PanelTitle eyebrow="ÍNDICES DO OEE" title="Eficiência da linha" aside="META ≥ 85%" />
            <EfficiencyBar label="Disponibilidade" value={metrics.disponibilidadePercentual} color="blue" />
            <EfficiencyBar label="Performance" value={metrics.performancePercentual} color="violet" />
            <EfficiencyBar label="Qualidade" value={metrics.qualidadePercentual} color="green" />
            <div className="efficiency-note"><span>FILA DE SAÍDA</span><strong>{metrics.tamanhoFilaSaida}<small> peças aguardando</small></strong><div className="queue-track"><i style={{ width: `${Math.min(100, metrics.tamanhoFilaSaida * 4)}%` }} /></div></div>
          </article>

          <article className="panel chart-panel">
            <PanelTitle eyebrow="PRODUÇÃO POR HORA" title="Aprovadas × rejeitadas" aside={<span className="chart-legend"><i className="legend-dot green" /> Aprovadas <i className="legend-dot red" /> Rejeitadas</span>} />
            {chart.length > 0 ? <div className="chart" role="img" aria-label="Gráfico de barras de peças aprovadas e rejeitadas por hora">
              <div className="chart-axis"><span>40</span><span>30</span><span>20</span><span>10</span><span>0</span></div>
              <div className="chart-content"><div className="chart-guides"><i /><i /><i /><i /><i /></div>
                {chart.map((item) => <div className="chart-column" key={item.horario} title={`${item.horario}: ${item.aprovadas} aprovadas, ${item.rejeitadas} rejeitadas`}>
                  <div className="bars" style={{ height: `${item.height}%` }}><i className="approved-bar" style={{ flexGrow: item.aprovadas }} /><i className="rejected-bar" style={{ flexGrow: item.rejeitadas }} /></div><span>{item.horario}</span>
                </div>)}
              </div>
            </div> : <div className="empty-chart">Sem histórico de produção disponível.</div>}
          </article>

          <article className="panel shipping-panel">
            <PanelTitle eyebrow="SAÍDA DE MATERIAIS" title="Expedição" aside={<span className="queue-badge">FILA {metrics.tamanhoFilaSaida.toString().padStart(2, '0')}</span>} />
            <div className="pallet-heading"><div className="pallet-icon">▤</div><div><span>PALETE ATUAL</span><strong>{telemetry.dadosExpedicao.palete.codigo}</strong></div><span className="pallet-state"><i /> {released ? 'LIBERADO' : 'EM PREPARO'}</span></div>
            <div className="pallet-progress-copy"><span>OCUPAÇÃO DO PALETE</span><strong>{released ? 0 : telemetry.dadosExpedicao.palete.pecas}<small>/{telemetry.dadosExpedicao.palete.capacidade} peças</small></strong></div>
            <div className="pallet-track"><i style={{ width: `${released ? 0 : (telemetry.dadosExpedicao.palete.pecas / telemetry.dadosExpedicao.palete.capacidade) * 100}%` }} /></div>
            <div className="destination"><span>DESTINO</span><strong>⌖ &nbsp;{telemetry.dadosExpedicao.palete.destino}</strong></div>
            <button className="release-button" onClick={releasePallet} disabled={released || telemetry.dadosExpedicao.palete.pecas === 0}>{released ? 'PALETE LIBERADO' : 'LIBERAR PALETE'} <span>→</span></button>
          </article>
        </section>

        <section className="panel orders-panel">
          <PanelTitle eyebrow="ACOMPANHAMENTO DA PRODUÇÃO" title="Ordens de produção" aside={<div className="export-actions"><button onClick={exportCsv} className="export-button"><span>↓</span> Exportar CSV</button><button onClick={() => window.print()} className="export-button"><span>▣</span> Exportar PDF</button></div>} />
          <div className="table-scroll"><table><thead><tr><th>ORDEM</th><th>PRODUTO</th><th>META</th><th>PRODUZIDO</th><th>PROGRESSO</th><th>STATUS</th></tr></thead>
            <tbody>{telemetry.dadosExpedicao.ordens.map((order) => <tr key={order.codigo}><td className="order-code">{order.codigo}</td><td>{order.produto}</td><td>{order.meta.toLocaleString('pt-BR')} <small>un.</small></td><td>{order.produzido.toLocaleString('pt-BR')} <small>un.</small></td><td><div className="order-progress"><div><i style={{ width: `${order.meta ? Math.min(100, (order.produzido / order.meta) * 100) : 0}%` }} /></div><small>{order.meta ? Math.round((order.produzido / order.meta) * 100) : 0}%</small></div></td><td><span className={`status-tag ${order.status.toLowerCase()}`}><i />{order.status}</span></td></tr>)}</tbody>
          </table></div>
          <div className="table-foot"><span>EXIBINDO <strong>{telemetry.dadosExpedicao.ordens.length}</strong> ORDENS DE PRODUÇÃO</span><span>ÚLTIMA LEITURA <strong>{telemetry.ultimaPecaLida.idPeca}</strong> · {telemetry.ultimaPecaLida.statusInspecao}</span></div>
        </section>

        <footer className="footer"><span><span className="brand-mark mini">S<span>4</span></span> SMART 4.0 · EXPEDIÇÃO &amp; OEE</span><span>FONTE: {fromShell ? 'APP SHELL · smart40:telemetria' : 'MOCK LOCAL'} &nbsp;·&nbsp; MODO {telemetry.modoOperacao}</span></footer>
      </div>
      {notice && <div className="toast" role="status">✓ &nbsp;{notice}</div>}
    </main>
  )
}

function MetricCard({ label, value, detail, icon, tone }: { label: string; value: string; detail: string; icon: string; tone: string }) {
  return <article className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><div className="metric-label">{label}</div><strong className="metric-value">{value}</strong><div className="metric-detail">{detail}</div></article>
}

function PanelTitle({ eyebrow, title, aside }: { eyebrow: string; title: string; aside?: ReactNode }) {
  return <div className="panel-title"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div>{aside && <div className="panel-aside">{aside}</div>}</div>
}

function EfficiencyBar({ label, value, color }: { label: string; value: number; color: string }) {
  return <div className="efficiency-row"><div className="efficiency-copy"><span>{label}</span><strong>{value.toFixed(0)}<small>%</small></strong></div><div className="efficiency-track"><i className={color} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div></div>
}

export default App
