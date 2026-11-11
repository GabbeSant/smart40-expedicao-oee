# 06 — Matriz de rastreabilidade de requisitos

Referência: 11/11/2026. **32 requisitos/decisões catalogados:22 expressos nas fontes e10 com definição/atribuição incerta.** “Confirmado” significa presença inequívoca na documentação lida, não que a turma já aprovou uma versão canônica ou que o requisito foi entregue.

Fontes L/D/G: [inventário](01-inventario-documental.md). Branches: **M**=main@0918bde; **T**=teste@da36fe8; **T2**=teste2@44edf06; **C**=consolidacao-sprint2@d7f1182. Prefixo `C/` da coluna evidência abrevia `FrontEnd/src/processing/`; demais caminhos são relativos ao repositório. Referências de linhas usam a revisão indicada em [03](03-analise-branches.md).

## Critério de verificação

- **Implementado e verificado:** capacidade delimitada coberta por teste existente cuja suíte teve execução anterior confirmada no CI remoto do SHA auditado. Isso não significa teste local novo, browser ou bancada.
- **Implementado parcialmente:** há caminho funcional estático ou testes de parte da função, com integração, fonte real ou entrega restante.
- **Implementado, mas incompatível:** reservado a implementação demonstravelmente contrária a requisito já definido. Não se aplicou esse rótulo à entrega sem tela enquanto a mudança de escopo permanece incerta.
- **Não implementado:** caminho necessário ausente no escopo inspecionado, mesmo havendo nomes/comentários.
- **Não verificável:** falta evidência ou ambiente de teste necessário.
- **Contraditório ou indefinido:** contrato, responsabilidade, opção arquitetural ou critério ainda não resolvido.

O [CI consultado](https://github.com/GabbeSant/smart40-expedicao-oee/actions/runs/41947097185) comprova sucesso dos passos de testes/builds; nenhuma execução foi iniciada nesta auditoria. O status de cada linha é limitado à descrição específica do requisito.

| ID | Requisito e escopo | Documento de origem | Branch | Status | Evidência / limite | Definição |
| --- | --- | --- | --- | --- | --- | --- |
| REQ-001 | G5 · Acompanhar/controlar logicamente a saída no posto final | L06 p.4; L12 p.2 | M/T/T2/C | Implementado parcialmente | Demo logística e C/processor.ts:92–106; sem acionamento ou correlação física validada | confirmado |
| REQ-002 | G5 · Totalizar peças produzidas, aprovadas e rejeitadas | L06 p.4; L02 p.12; L08 p.9 | M/T/T2/C | Implementado parcialmente | C/processor.ts:52–79,108–114; testes de eventos sintéticos/CI; fonte real por peça ausente | confirmado |
| REQ-003 | G5 · Calcular peças por minuto a partir de produção | L12 p.2; L08 p.9 | C; demo em M/T/T2 | Implementado e verificado | C/metrics.ts:24–29; processing.test.ts:51. CI passa na convenção móvel implementada; UI antiga exibe ritmo nominal | confirmado |
| REQ-004 | G5 · Manter fila de saída e identificação/paletização | L12 p.2; L18 p.6 | M/T/T2/C | Implementado parcialmente | C/processor.ts:221 e domain/warehouse.ts:112–148; unidade lote/peça e eventos físicos pendentes | confirmado |
| REQ-005 | G5 · Representar armazenamento e posições do magazine | L13 pp.18,202–204; L12 p.2 | M/T/T2/C | Implementado parcialmente | C/processor.ts:26,98–103,203–204 usa 12 posições; D03 confirma tags, não atualização contínua no app | confirmado |
| REQ-006 | G5 · Calcular D, P, Q e OEE completo com insumos válidos | L06 p.4; L11 pp.5–6 | M/T/T2/C | Implementado e verificado | C/metrics.ts:7–21; processing.test.ts:20–33,170; CI remoto. Confirma algoritmo, não insumos físicos | confirmado |
| REQ-007 | G5 · Apresentar taxa de rejeito | L06 p.4 | M/T/T2; dados em C | Implementado parcialmente | App.tsx:149,520–527 calcula/exibe na demo; C fornece rejected/total, sem campo scrapRate nem UI final | confirmado |
| REQ-008 | G5 · MTBF | L06 p.4 | Nenhuma ponta com cálculo identificado | Não implementado | App.tsx:569–570 e blueprint G07 mantêm indisponível; contratos C sem eventos de falha/duração | confirmado |
| REQ-009 | G5 · OPs ativas e fila de espera | L06 p.4; L12 p.2; L13 pp.197–198 | M/T/T2/C | Implementado parcialmente | UI é mock; C/orders.ts:6–16 preserva status de origem e catálogo; não gerencia a produção real das OPs | confirmado |
| REQ-010 | G5 · Relatório sintético PDF/CSV | L06 p.4; L12 p.2 para gestão | M/T/T2; ausente do pacote C | Implementado parcialmente | App.tsx:207–293 geraCSV; :763 usa window.print paraPDF. Somente demonstração; aceite de ambos/formato a confirmar | confirmado |
| REQ-011 | G5 · Dashboard/gráficos e histórico de produtividade | L02 p.12; L06 p.4; L08 p.9 | M/T/T2; C publica dados | Implementado parcialmente | App.tsx e CSS gráficos; C/processor.ts:185–222 agrega minutos. UI final, persistência entre turnos e dispensa de tela pendentes | confirmado |
| REQ-012 | Geral/G1+G5 · Conexão única e distribuição smart40:telemetria | L08 p.5; L20 pp.4–5; L17 p.16 | C; experimento T2 | Implementado parcialmente | C/appShell.ts:13–23,27–90; projectTelemetry.ts:5. Binding testado em CI; Shell real não fornecido | confirmado |
| REQ-013 | Geral · Contrato de integração TypeScript comum | L06 pp.1,4; L08 p.3; L18 pp.3–4 | Todas; formatos diferentes | Contraditório ou indefinido | Tipos existem; C/contracts.ts:1 diz proposto. L03, L06, L20, ZIPs e T2 não são o mesmo formato (INC-002) | confirmado |
| REQ-014 | Geral/G5 · Remover listeners e timers ao desmontar | L20 p.5; L11 p.6 | C e T2 | Implementado e verificado | C/appShell.ts:80–87; processing.test.ts:132 e projectTelemetry.test.ts:24; CI. Não mede heap do browser | confirmado |
| REQ-015 | Sprint1 · Mocks explícitos e separação de simulação/controle físico | L18 pp.1–2,6–8 | M/T/T2/C | Implementado parcialmente | App.tsx:353–355 rotula simulação; C rejeita outra origem e não envia comandos. Integração mock dos cinco grupos não demonstrada | confirmado |
| REQ-016 | Sprint1/geral · Ambiente reproduzível, testes, lint e build em CI | L18 pp.2,7–8; L06 p.5 | C | Implementado parcialmente | CI atual passou testes/builds; workflow:23–28 não executa lint e não há devcontainer no repo auditado | confirmado |
| REQ-017 | Geral · UI responsiva e padrão industrial | L06 p.5; L08 p.3; L12 p.5 | M/T/T2; papel C indefinido | Implementado parcialmente | CSS/tema e componentes presentes; G11 relata testes antigos. Nenhum teste visual/manual atual foi repetido | confirmado |
| REQ-018 | Geral/Sprint2 · Entregar artefato na nuvem com publicação verificável | L08 pp.3,10; L12 pp.7–8 | C | Implementado parcialmente | vercel.json gera biblioteca; CI build:release passou; dois statuses Vercel failure no SHA. URL funcional da revisão não verificada | confirmado |
| REQ-019 | Geral/G5 · Indicar desconexão e dado vencido sem inventar medições | L18 pp.4,7; L20 p.5 | C; metadados T2 | Implementado e verificado | C/processor.ts:209–217 e teste:120; null para métricas ausentes; CI. Tempos padrão não homologam SLA físico | confirmado |
| REQ-020 | Etapa física/G5+automação · Detectar passagem real de peça na expedição | L11 p.5; L04 pp.6,10 | C preparado, nenhuma ponta completa | Não implementado | flow.mjs:8 é entrada sem produtor; inspect.mjs:69 produz observação UNCERTAIN. Não há coleta contínua homologada por peça | confirmado |
| REQ-021 | G5 · Persistir logs de lote e contadores/histórico | L11 p.6; L02 p.12 | M/T/T2/C | Implementado parcialmente | localStorage demo; log/checkpoint C e MES relacional. Não há serviço de séries temporais de métricas implantado | confirmado |
| REQ-022 | Integração/G5 · Cliente GET para catálogo de ordens | L13 pp.196–198; L20 p.2 | T/C | Implementado e verificado | productionOrdersApi.ts:138–186, testesAPI e amostra158; CI remoto. Verifica cliente com fontes de laboratório, não servidor industrial atual | confirmado |
| REQ-023 | Mudança · G5 entrega somente processamento, sem tela própria | G01:5–7; G04:9 versus L06/L08 | C | Contraditório ou indefinido | Biblioteca existe; origem verbal é apenas relato do projeto. Confirmação escrita original não obtida (INC-003) | incerto |
| REQ-024 | Geral · Escolher manter Node-RED/Elipse ou adotar Caminho A | L20 pp.1–10; L15; L17 | C implementa adaptação | Contraditório ou indefinido | Ponte Node-RED/MQTT/WSS não equivale ao agente literal dos PDFs. Falta decisão G1/professor (INC-004) | incerto |
| REQ-025 | MES · Atribuir e implantar cinco eventos e banco próprio | L17 pp.4–9,16 | C opcional | Contraditório ou indefinido | api-mes implementa cincoPOSTs e trêsGETs; testePGlite noCI. Dono G5 ouG1 e banco remoto indefinidos | incerto |
| REQ-026 | Qualidade/G4→G5 · Aplicar limiar de 80% ou receber veredito oficial | L08 p.8 versus contratos e manual | Nenhuma aprovação física verificada | Contraditório ou indefinido | 80% é exemplo de classificação G4. C recebe APPROVED/REJECTED e não impõe limiar inventado | incerto |
| REQ-027 | SLA · OEE<100 ms, fallback<200 ms e reconexão<3 s versus30 s | L11 pp.6,9–11; L17 p.16; L08 p.3 | Todas | Não verificável | Sem medição da fronteira física/evento/render ou perda de rede real; períodos de 500 ms/1 s não bastam para concluir violação (INC-011) | incerto |
| REQ-028 | Infra G5 · /api/metrics, /oee-stream, OAuth2 oee-write e banco de séries | L11 pp.5–6 versus demais arquiteturas | Não há essas rotas literais na base | Contraditório ou indefinido | Runtime expõe /health, /ws/telemetry e /ws/expedition; MES tem Bearer próprio. Exigência dessa topologia ainda não aprovada | incerto |
| REQ-029 | OEE · Calendário/turno, ciclo ideal, causas de parada e perdas | L06 p.4; L11 pp.5–6; lacunas L18 pp.3,8 | C aceita janela; não define calendário | Contraditório ou indefinido | analysis.window tem segundos, mas nenhuma regra aprovada de turno, mix, retrabalho ou parada por motivo foi obtida | incerto |
| REQ-030 | Infra · Tornar MQTT ou gateway OPCUA obrigatório para G5 | L01/L07/L14/L16; L17 usa S7/WSS | C tem MQTT; anexos são exemplos | Contraditório ou indefinido | Nenhum requisito inequívoco de exclusividade MQTT/OPCUA. Não exigir adoção cumulativa de todos os ZIPs | incerto |
| REQ-031 | Físico · Homologar unidade peça/lote/ordem, tags e capacidade | L13 p.18; D03; G04:59 | M/T/T2/C com modelos diferentes | Contraditório ou indefinido | Magazine12 documentado; palete50 e uma peça por posição são premissas diferentes. Mapear RFID/qualidade/OP por ocorrência | incerto |
| REQ-032 | Acadêmico · Calendário final, prazo Sprint2 e aceite do hardware | L06 p.5; L04 pp.7–10; L18 p.1 | Não depende de branch | Contraditório ou indefinido | Plano datado acaba24/11 com extensão proposta09/12; outros guias usam6 semanas. Nenhum aceite formal/novo prazo obtido | incerto |

## Cobertura da implementação

| Status | Quantidade |
| --- | ---: |
| Implementado e verificado | 5 |
| Implementado parcialmente | 14 |
| Implementado, mas incompatível | 0 |
| Não implementado | 2 |
| Não verificável | 1 |
| Contraditório ou indefinido | 10 |

As cinco capacidades verificadas têm escopo técnico restrito. **Nenhuma linha comprova OEE real, integração física completa ou aceite final da turma.** A topologia dos serviços e a mudança de UI não foram artificialmente transformadas em obrigações definitivas.

## Entregas por etapa e critérios acadêmicos

| Etapa | Entrega descrita | Evidência exigida | Situação da base |
| --- | --- | --- | --- |
| Sprint1 · L18 pp.1–2,5–8 |10 dias úteis; contrato v0.1, Shell e módulos com mocks, README, mapa, CI e demonstração; sem integração real | Contrato/ADR revisados, teste de eventos inválidos/duplicatas/queda, navegação5 áreas, comandos apenas simulados | Há protótipo G5 e contratos de referência; não há evidência da demonstração conjunta ou aprovação do contrato |
| Sprint2 · L08/L20 | Consumo do barramento único, integração da UI/processamento e ambiente de nuvem; funções especialistas | Fluxo de telemetria consistente, cleanup, origem simulada/real e artefato publicado | Biblioteca/testes existem; formato sem tela, Shell e publicação pendentes |
| Integração do cronograma · L04 pp.7–9 |04–17/11; módulos conectados no Shell, navegação com dados simulados | Demonstração integrada da turma | Não verificada |
| Teste real · L04 p.10 |18–24/11; Hardware in the Loop; extensão até 09/12 é proposta | Confronto dados físicos e estado do sistema | Não executado nesta auditoria |
| Aceite Caminho A · L17 p.16 | Desligar notebook: telas mantêm último estado/vazio sem quebrar; religar: agente reconecta até 30 s | Registro de queda/retomada e contagem sem duplicatas | Testes de laboratório de rede não equivalem ao aceite físico |

A rubrica de L06 p.5 é30% funcionalidade especialista,25% integração/contrato,20% qualidade/arquitetura,15% UX industrial e10% documentação/apresentação. Não se atribuiu nota estimada: faltam a regra aprovada após a possível redistribuição da UI, a avaliação do professor e a demonstração conjunta. Os itens de integração e comprovação devem preceder funcionalidades adicionais.

## Referências de implementação para revisão

- [Contrato v1](https://github.com/GabbeSant/smart40-expedicao-oee/blob/d7f11828d0304c1a1088309715d04b00ef8ec356/FrontEnd/src/processing/contracts.ts), [processador](https://github.com/GabbeSant/smart40-expedicao-oee/blob/d7f11828d0304c1a1088309715d04b00ef8ec356/FrontEnd/src/processing/processor.ts), [cálculos](https://github.com/GabbeSant/smart40-expedicao-oee/blob/d7f11828d0304c1a1088309715d04b00ef8ec356/FrontEnd/src/processing/metrics.ts) e [teste de processamento](https://github.com/GabbeSant/smart40-expedicao-oee/blob/d7f11828d0304c1a1088309715d04b00ef8ec356/FrontEnd/tests/processing.test.ts).
- [Binding do Shell](https://github.com/GabbeSant/smart40-expedicao-oee/blob/d7f11828d0304c1a1088309715d04b00ef8ec356/FrontEnd/src/processing/appShell.ts), [fluxo Node-RED](https://github.com/GabbeSant/smart40-expedicao-oee/blob/d7f11828d0304c1a1088309715d04b00ef8ec356/integration/node-red/flow.mjs) e [API MES](https://github.com/GabbeSant/smart40-expedicao-oee/blob/d7f11828d0304c1a1088309715d04b00ef8ec356/integration/api-mes/http.mjs).

