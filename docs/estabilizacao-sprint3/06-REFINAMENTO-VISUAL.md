# Refinamento visual — Expedição e OEE

Data: 25/11/2026. Base técnica preservada: `a16ea0b`, branch `estabilizacao-sprint3`. Skill aplicada: [`frontendSKILL.md`](../../frontendSKILL.md), fornecida na raiz do checkout. O arquivo da skill permanece como recebido, fora deste commit.

## Escopo e diagnóstico inicial

A interface foi aberta no Chromium antes das alterações, tanto standalone sem telemetria quanto montada no host de integração com replay sintético. Foram capturados desktop 1440 px, tablet 900 px, celular 360 px e desconexão.

As capturas mostraram título competindo com os indicadores, pouca diferença de tamanho entre OEE e fatores, barras curtas e espaços vazios entre os cartões de operação e memória. A matriz funcionava, mas precisava de maior destaque para identificação de vagas, contraste de estados e leitura das fontes. O histórico e a memória tinham pouco espaçamento entre dados de natureza diferente.

O trabalho ficou restrito ao CSS e ao agrupamento visual dos elementos existentes. Regras, fórmulas, contratos, coletores, APIs, integração, intervalos de atualização, confirmação e gravação do reset não foram alterados. Não há nova dependência, fonte externa, funcionalidade ou conexão de rede.

## Plano estético aplicado

Direção: painel industrial de supervisão e gestão, com superfícies planas, números alinhados e informação como elemento principal.

| Token | Valor-base | Papel |
| --- | --- | --- |
| Fundo | `#0f172a` | Base escura compatível com o Shell |
| Superfície | `#1e293b` | Seções e indicadores |
| Área interna | `#111d2e` | Fórmula, campos e estado desconhecido |
| Divisores | `#40516a` | Separação de dados e contornos |
| Texto principal | `#f4f8ff` | Valores e títulos |
| Texto secundário | `#b3c3d5` | Rótulos e informações de apoio |

Os fundos usam `--smart-bg-app` e `--smart-bg-surface` quando fornecidos pelo host, com os valores acima como fallback. O módulo não redefine os tokens globais do G1.

Tipografia: Segoe UI e fallback de sistema, sem downloads; título reduzido, OEE em maior escala, fatores secundários consistentes e algarismos tabulares para alinhar medições. Textos extensos de critério e fonte ocupam sua própria linha. Rótulos permanecem em caixa normal, sem novos marcadores decorativos.

Organização antes e depois:

```text
Antes: duas linhas compartilhando alturas
[ OEE | Disponibilidade | Performance | Qualidade | PPM ]
[ Magazine                         | Operação          ]
[ Memória de cálculo               | Resets            ]

Depois: duas colunas com fluxo independente
[ OEE maior | Disponibilidade | Performance | Qualidade | PPM ]
[ Magazine                         | Memória de cálculo ]
[ Operação logo abaixo             | Histórico de resets]
```

Na revisão do plano, o destaque foi concentrado no OEE; o cabeçalho ficou menor e o gradiente anterior foi removido. As colunas eliminam a lacuna imposta pela altura do magazine. O restante usa divisores, espaçamento e contraste, sem sombras decorativas, brilhos ou novas animações. No celular, a ordem original de leitura permanece: magazine, operação, memória e reset.

## Alterações implementadas

| Área | Refinamento |
| --- | --- |
| KPIs | OEE com maior número e contorno azul; fatores e PPM com escala secundária; barras ocupam a largura útil. A barra do OEE acompanha a faixa já calculada pela interface. |
| Cores industriais | Preservadas as faixas existentes: verde ≥85%, amarelo ≥70% e <85%, vermelho <70%. Vaga livre continua cinza, ocupada azul, desconhecida com N/D e contorno tracejado; atuador mantém contorno âmbar. Não há mudança nas condições que determinam esses estados. |
| Magazine | Identificação das posições mais legível, espaçamento regular por nível, maior separação entre estado físico e registro do gestor, divergência destacada e resumo separado por divisor. A matriz continua 3 × 4 em todas as larguras verificadas. |
| Memória de cálculo | Fórmula em área própria, valores alinhados à direita, linhas de tempo separadas e critério/referência em linhas completas. |
| Histórico e confirmação | Autor e horário mais distintos, registros separados por divisores e formulário de confirmação delimitado. Campos, ações, textos, ordem dos registros e efeitos do reset permanecem iguais. |
| Conexão | O estado existente ganha tratamento visual: conectado verde, desconectado vermelho, conectando/vencido âmbar e desconhecido neutro. O modo real fica em uma identificação azul neutra para não ser confundido com confirmação de conexão. Mensagens de indisponibilidade recebem fundo e borda de aviso. |
| Responsividade | Cinco indicadores no desktop, OEE destacado no tablet e redistribuição automática dos cartões conforme largura e tamanho de texto no celular. Sem alturas fixas para conteúdo variável. |
| Acessibilidade | Controles com mínimo de 44 px, foco visível de 3 px, contraste reforçado, quebra de textos longos, respeito a movimento reduzido e contorno do atuador preservado com cores forçadas. Legendas textuais continuam disponíveis. |

Arquivos de aplicação alterados:

- `FrontEnd/src/sprint3/sprint3.css`: todos os estilos do refinamento, escopados no módulo; única regra de body permanece a regra standalone preexistente.
- `FrontEnd/src/sprint3/Dashboard.tsx`: dois agrupadores de coluna, classes de apresentação e atributo `data-connection` que expõe o estado já existente ao CSS. Nenhum handler, efeito ou cálculo foi modificado.

Também foram adicionados este documento, dez capturas comparativas e dois relatórios JSON em `evidencias/refinamento-visual/`. As evidências técnicas anteriores foram preservadas. Nenhum fonte de processamento, sessão, API, ciclo de vida, configuração ou dependência foi alterado. A distribuição e seus manifestos gerados foram regenerados pelos comandos existentes.

## Evidências de antes e depois

As mesmas fixtures, horários e dimensões foram usados nas duas versões. Horário fixo da fixture: `2026-11-25T18:00:00Z`; os resets apresentados no comparativo são registros sintéticos preparados para inspeção visual. Não representam operação ou autoria industrial real.

| Cenário | Antes | Depois |
| --- | --- | --- |
| Desktop, 1440 px | [Captura](evidencias/refinamento-visual/antes-desktop.png) | [Captura](evidencias/refinamento-visual/depois-desktop.png) |
| Tablet, 900 px | [Captura](evidencias/refinamento-visual/antes-tablet.png) | [Captura](evidencias/refinamento-visual/depois-tablet.png) |
| Celular, 360 px | [Captura](evidencias/refinamento-visual/antes-mobile.png) | [Captura](evidencias/refinamento-visual/depois-mobile.png) |
| Sem telemetria, standalone | [Captura](evidencias/refinamento-visual/antes-sem-telemetria.png) | [Captura](evidencias/refinamento-visual/depois-sem-telemetria.png) |
| Desconexão com últimos valores preservados | [Captura](evidencias/refinamento-visual/antes-desconexao.png) | [Captura](evidencias/refinamento-visual/depois-desconexao.png) |

Os hosts de replay exibem aviso explícito de teste sintético. O caso sem telemetria mostra N/D, sem inventar medições.

## Validação funcional e de build

Comandos executados novamente nesta etapa, com `npm.cmd` no PowerShell:

| Comando | Resultado |
| --- | --- |
| `npm test` | PASS — 78 testes, 0 falhas, 0 ignorados |
| `npm run test:e2e` | PASS — 4 testes, 0 falhas, 0 ignorados |
| `npm run test:browser` | PASS — 8 testes, 0 falhas, 0 ignorados, 0 flaky |
| `npm --prefix FrontEnd run lint` | PASS |
| `npm --prefix FrontEnd run build` | PASS — TypeScript e Vite |
| `npm run build:release` | PASS — distribuição com 36 arquivos e verificador de imports/assets |
| `git diff --check` | PASS |

Total: **90 testes aprovados**. O navegador verificou novamente replay, deduplicação, reset, falha de auditoria, modos, cores 85/70/69,9, desconexão, atualização visual ≤1 Hz, ESM entre origens e quinze ciclos de montagem/desmontagem sem listeners/timers restantes ou WebSocket próprio. A suíte manteve a exigência de ausência de erros de console/página.

Logs locais em `.work/visual-unit-tests.log`, `.work/visual-integration-tests.log`, `.work/visual-lint.log`, `.work/visual-frontend-build.log` e `.work/visual-release-build.log`. A execução de navegador gera `test-results/browser-results.json`. [Resumo desta rodada](evidencias/refinamento-visual/resultados-validacao.json).

## Inspeção visual e de acessibilidade

- Larguras de 320, 360, 768, 900, 1280 e 1440 px: sem rolagem horizontal ou conteúdo extravasando os cartões; 12 vagas e quatro colunas mantidas.
- Texto ampliado em 200%, a 360 e 1440 px: sem extravasamento. A primeira inspeção encontrou KPIs largos no celular; o ajuste foi feito exclusivamente com dimensionamento intrínseco e flex-wrap no CSS, antes da validação final.
- 102 trechos visíveis de texto verificados contra o fundo efetivo no replay: menor contraste medido **6,18:1**, sem falhas nos limites aplicados (4,5:1 para texto comum e 3:1 para texto grande). Essa medição não equivale a certificação integral de acessibilidade.
- Foco de teclado sólido de 3 px e botão de reset com altura de 44 px. Com movimento reduzido, duração de transição das vagas: 0 s. Em cores forçadas, o atuador mantém contorno sólido de 3 px.
- Host com o tema de referência do G1 e regras externas conflitantes: controles do host permaneceram inalterados e o título do painel manteve sua escala. O Shadow DOM e os ciclos de vida existentes não foram modificados. A integração visual no Shell real continua sujeita à montagem pelo G1.
- Comparação do código anterior e atual: preâmbulo funcional do componente idêntico; todas as expressões JSX existentes preservadas. A única expressão adicional é a leitura do estado já calculado para o atributo visual de conexão.

Resultados detalhados: [verificacoes-visuais.json](evidencias/refinamento-visual/verificacoes-visuais.json). As verificações foram locais no Chromium; não houve acesso à bancada, modificação do repositório do G1, push ou deploy.

## Controle de versão

Esta etapa tem um único commit específico de refinamento visual, após os quatro commits da estabilização. Identificá-lo com `git log -1 --oneline`. O arquivo `frontendSKILL.md` já estava não rastreado ao iniciar e foi preservado fora do commit.
