# SMART 4.0 · Expedição & OEE

Protótipo independente do **Grupo 5**, preparado para a aula 2. React, TypeScript e Vite, sem backend ou dependência do App Shell. A pasta mantém o nome antigo por compatibilidade com o checkout.

Todos os indicadores, ordens, lotes e saídas são simulados. Nenhum comando é enviado à planta. Os dados são salvos neste navegador e restaurados com a simulação pausada. Reiniciar ou trocar de cenário substitui os dados salvos.

## Rodar

Use **Node.js 24 LTS** e npm. O projeto utiliza o suporte nativo do Node a TypeScript nos testes; o requisito antigo de Node 18 nos guias não corresponde à base Vite atual.

```bash
npm ci
npm run dev
```

Abra **http://localhost:8084**. No PowerShell com execução de scripts bloqueada, use `npm.cmd` no lugar de `npm`.

## Demonstrar

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
| `tests/expedition.test.ts` | Verificação da lógica |
| `tests/warehouse.test.ts` | Fluxo completo, vínculos e persistência |

Veja [o blueprint dos dados](docs/blueprint-dados.md), [o plano de evolução](docs/plano-implementacao.md) e [o roteiro de apresentação](docs/roteiro-apresentacao.md).

Os materiais originais do professor em `docs/SMART40FFE/` são ignorados pelo Git. Nenhum arquivo dessa pasta é necessário para rodar o protótipo.
