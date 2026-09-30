import { telemetryMock } from './mocks/telemetryMock'

function App() {
  const expedicao = telemetryMock.metricasExpedicao

  return (
    <main>
      <h1>SMART 4.0 — Expedição & OEE</h1>

      <p>
        Status: {telemetryMock.estadoGlobal}
      </p>

      <p>
        OEE: {expedicao.oeePercentual}%
      </p>

      <p>
        Peças processadas: {expedicao.pecasProcessadasTotal}
      </p>

      <p>
        Aprovadas: {expedicao.pecasAprovadasCount}
      </p>

      <p>
        Rejeitadas: {expedicao.pecasRejeitadasCount}
      </p>
    </main>
  )
}

export default App