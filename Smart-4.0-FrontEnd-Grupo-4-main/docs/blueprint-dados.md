# Blueprint de dados — Expedição & OEE

## Fonte e integração

O microfrontend Grupo 5 consome `TelemetriaSmart40`. Em desenvolvimento isolado, a origem é `src/mocks/telemetryMock.ts`. Na integração, o App Shell publica o objeto em `window` com o evento `smart40:telemetria` e este módulo valida o payload antes de atualizar a tela. O módulo não abre um WebSocket próprio.

```ts
window.dispatchEvent(new CustomEvent('smart40:telemetria', { detail: telemetria }))
```

O evento deve carregar o objeto completo do contrato abaixo. Payloads sem as métricas de expedição ou sem a lista de ordens são ignorados para evitar que a interface passe a exibir dados incompletos.

## Contrato TypeScript

O contrato executável está em `src/types/smart40.ts`:

- `TelemetriaSmart40`: estado e modo da estação, velocidade, última peça, métricas e dados da expedição.
- `MetricasExpedicao`: produção aprovada/rejeitada, fila, ritmo, OEE, disponibilidade, performance, qualidade e histórico por hora.
- `DadosExpedicao`: ordens e palete em preparação.
- `OrdemProducao`: código, produto, meta, quantidade produzida e estado `ATIVA`, `AGUARDANDO` ou `FINALIZADA`.
- `SMART40_TELEMETRIA_EVENT`: nome compartilhado do evento global.

O módulo usa os nomes `metricasExpedicao`, `pecasProcessadasTotal` e demais campos do servidor mock citado na especificação da equipe. Os nomes finais devem ser conferidos com o App Shell/Grupo 1 antes da integração; a função `isTelemetriaSmart40` fornece uma verificação básica de formato em runtime.

## Indicadores apresentados

- OEE e seus componentes: disponibilidade, performance e qualidade.
- Peças processadas, aprovadas e rejeitadas.
- Refugo calculado como `rejeitadas / processadas × 100` (zero quando não há peças processadas).
- Ritmo em peças por minuto e tamanho da fila de saída.
- Histórico de aprovadas e rejeitadas por hora.
- Ordens de produção, ocupação do palete e destino.

O valor do OEE e seus três componentes são recebidos da telemetria. A aplicação não recalcula índices que dependem de parâmetros de ciclo ou tempo planejado que não fazem parte deste payload.

## Cenários locais

`telemetryScenarios` oferece situações de OEE alto e baixo, rejeição elevada, fila cheia e produção parada. O seletor no cabeçalho permite conferir esses dados sem backend. Para exercitar a integração, publique um `CustomEvent` com `detail` no formato `TelemetriaSmart40`.
