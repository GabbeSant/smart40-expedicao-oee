# SMART 4.0 · Expedição & OEE

> Sprint 3 estabilizada em 25/11/2026: painel em `/sprint3.html`, módulo ESM em `dist/assets/sprint3-module.js` e distribuição oficial em `../release/`. Consulte o [roteiro da bancada](../docs/estabilizacao-sprint3/04-ROTEIRO-BANCADA-25-11.md), o [guia da Sprint 3](docs/SPRINT3-EXPEDICAO.md) e a [integração com G1](../docs/estabilizacao-sprint3/03-INTEGRACAO-GRUPO1.md). A biblioteca da Sprint 2 continua em `src/processing`.

FrontEnd do **Grupo 5**, em React, TypeScript e Vite. O painel atual recebe a telemetria pelo barramento do App Shell, sem conexão WebSocket própria. Sem produção, tempos e premissas aprovadas, os indicadores ficam em N/D.

O painel anterior em `/` no Vite é uma demonstração inteiramente simulada: indicadores, ordens, lotes e saídas são fictícios. Seus recursos continuam disponíveis no desenvolvimento. A distribuição `release/` publica a Sprint 3 em `/` e `/sprint3.html` e exclui essa demonstração anterior. Nenhum painel envia comandos à planta.

A camada isolada em `src/integration` prepara a leitura de ordens da Planta N2 por GET, com adapter parcial e fallback mock identificado. Seu consumo é explícito; a interface continua usando a simulação. Veja [a análise, os mapeamentos e o uso da integração](docs/integracao-production-orders.md).

## Rodar

Use **Node.js 24 LTS** e npm. O projeto utiliza o suporte nativo do Node a TypeScript nos testes; o requisito antigo de Node 18 nos guias não corresponde à base Vite atual.

```bash
npm ci
npm run dev
```

Abra **http://localhost:8084**. No PowerShell com execução de scripts bloqueada, use `npm.cmd` no lugar de `npm`.

## Demonstrar

### Sprint 3 · Expedição e OEE

Abra `/sprint3.html` no Vite. Para validar as observações reais na bancada, inicie `npm --prefix FrontEnd run dev -- --mode bancada --host 127.0.0.1` na raiz e clique em **Ler bancada N2**. A fonte de produção do painel publicado é o barramento do App Shell. A simulação e o acesso de diagnóstico da bancada ficam no desenvolvimento. O [guia da Sprint 3](docs/SPRINT3-EXPEDICAO.md) registra o cálculo, a integração e as pendências de aceite.

OEE usa disponibilidade × performance × qualidade, com performance limitada a 100%. As cores são verde a partir de 85%, amarelo de 70% até antes de 85% e vermelho abaixo de 70%. A memória exibe tempos, capacidade e critério recebido. Os dados reais e simulados têm sessões separadas. O reset exige confirmação e grava autor declarado, horário e estado anterior antes de limpar; falha de armazenamento bloqueia a limpeza.

Para conferir a distribuição publicada, execute na raiz `npm run build:release` e `npm run preview:release`. Para testar o navegador, execute na raiz `npx playwright install chromium` e `npm run test:browser`. As fixtures são sintéticas e ficam em `../integration/browser/`; não comprovam produção física. O módulo visual conserva o estado na navegação SPA, mas precisa de replay do host para eventos emitidos enquanto desmontado. Um recarregamento completo inicia uma nova sessão em memória; o histórico de reset continua no armazenamento local.

### Demonstração anterior · somente desenvolvimento

- Sete cenários, incluindo **Novo planejamento** para cadastrar as próprias OPs e começar do zero.
- Cadastro de OP com produto, quantidade e destino; códigos duplicados são rejeitados.
- Simulação automática: uma peça a cada 5 segundos, ou avanço manual com `+ 1 peça` quando pausada.
- OEE calculado por tempos planejados, paradas e ciclo ideal simulados editáveis; qualidade e refugo pelos contadores.
- Gráfico com escala dinâmica, valores e alternativa em tabela.
- Mapa 2D: recebimento → identificação RFID simulada → armazenamento → expedição.
- Prateleira configurável de 12 posições por padrão. Cada posição recebe um lote de até 50 peças de uma única OP/destino; capacidades são premissas didáticas.
- Fila separada por ordem, seleção de posição, confirmação de armazenamento/expedição e histórico de movimentações.
- Ordens com busca, filtro, progresso e avanço automático da próxima ordem ao concluir a ativa.
- Alertas de eficiência, refugo, fila e ausência de amostra.
- Salvamento local versionado, restauração pausada, aviso em caso de falha e reinício com confirmação.
- CSV dos indicadores, premissas, OPs/destinos, posições, movimentações e saídas; PDF via impressão do navegador.
- Layout responsivo, navegação por teclado, modal com foco contido e estados vazios.

Para salvar PDF, clique em **Salvar PDF** e selecione **Salvar como PDF** no diálogo de impressão. CSV e PDF identificam a origem simulada dos dados.

## Verificar

```bash
npm test
npm run lint
npm run build
```

Os testes verificam conservação dos contadores, coerência do histórico/OEE, paletização, rejeição, conclusão de ordens, reinício e geração de CSV.

Os testes de integração verificam o JSON real salvo, payloads incompletos, campos desconhecidos, mapeamentos parciais e fallback em falhas de rede/HTTP/timeout. As respostas de rede são controladas nos testes; eles não consultam a planta.

## Organização

| Arquivo | Responsabilidade |
| --- | --- |
| `src/App.tsx` | Interface e interações da demonstração |
| `src/App.css` | Layout responsivo e impressão |
| `src/styles/theme.css` | Tokens adaptados do tema do professor |
| `src/mocks/telemetryMock.ts` | Cenários determinísticos |
| `src/domain/expedition.ts` | Transições, alertas e CSV |
| `src/domain/warehouse.ts` | Lotes por OP, rack, movimentações e premissas OEE |
| `src/domain/persistence.ts` | Salvamento versionado e validação de sessões |
| `src/components/LogisticsPanel.tsx` | Mapa 2D, cadastro e formulários |
| `src/types/smart40.ts` | Tipos do protótipo local |
| `src/integration/productionOrdersApi.ts` | DTOs, validação e cliente somente GET |
| `src/integration/productionOrdersSource.ts` | Porta de leitura com API optativa e fallback mock |
| `src/adapters/productionOrderAdapter.ts` | Campos internos seguros, pendências e original preservado |
| `src/integration/appShellContracts.ts` | Contrato externo preliminar, sem conexão com o Shell |
| `tests/expedition.test.ts` | Verificação da lógica |
| `tests/warehouse.test.ts` | Fluxo completo, vínculos e persistência |
| `tests/productionOrdersApi.test.ts` | Payload real, GET, validação e falhas |
| `tests/productionOrderAdapter.test.ts` | Mapeamentos parciais e campos não mapeados |
| `tests/productionOrdersSource.test.ts` | Origem dos dados, fallback e isolamento |

Veja [o blueprint dos dados](docs/blueprint-dados.md), [o plano de evolução](docs/plano-implementacao.md) e [o roteiro de apresentação](docs/roteiro-apresentacao.md).

Os materiais originais do professor em `docs/SMART40FFE/` são ignorados pelo Git. Nenhum arquivo dessa pasta é necessário para rodar o protótipo.
