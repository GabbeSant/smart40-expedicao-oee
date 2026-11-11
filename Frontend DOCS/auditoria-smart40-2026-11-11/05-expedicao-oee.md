# 05 — Expedição e OEE

Referência: 11/11/2026. A finalidade documentada é acompanhar o posto final, relacionar produção e ordens, apresentar produtividade e eficiência, e integrar esses dados à aplicação da turma. **Não há evidência de que o G5 deva implementar sozinho o controle industrial, o robô, o leitor ou toda a infraestrutura.** Códigos de fontes em [01](01-inventario-documental.md); divergências em [02](02-inconsistencias-documentais.md).

## Responsabilidades e fronteiras

| Domínio | Responsabilidade documentada | Dependência do G5 |
| --- | --- | --- |
| Geral SMART 4.0 | Aplicação unificada, módulos desacoplados, contrato TS, comunicação central, ambiente de desenvolvimento/entrega e demonstração integrada | Cumprir interface de integração e produzir evidências do próprio módulo |
| G1 | Shell, navegação/carregamento, Design System e conexão central; broker/agente/APIs de pedidos/estoque no Caminho A | Fornecer contrato, conexão e apresentação caso aceite a entrega sem tela |
| G2 | IHM, botoeira e comandos de operação/estado | Origem de estado/tempos e comunicação de paradas; G5 não implementa E-Stop físico |
| G3 | Robô/Teach Pendant e telemetria espacial | Dados que componham o contexto produtivo; não é necessário ao G5 reproduzir eixos |
| G4 | Identificação, leitura/inspeção e rastreabilidade | Identidade e aprovação/rejeição por passagem, se forem a fonte escolhida |
| G5 | Posto de expedição, produtividade/PPM, fila/paletização, OPs, OEE e contadores; MTBF e exportação na especificação | Converter fontes acordadas em regras/indicadores e integrar com G1 |
| MES próprio | L17 p.16 atribui a G5 **ou** G1 | Dono indefinido; API existente é referência opcional, não obrigação exclusiva comprovada |

L06 p.4 e L12 pp.2,10 sustentam o escopo G5. L02 p.12 e L10 p.8 acrescentam dashboard e histórico. A dispensa de tela aparece em G01/G04 como relato de orientação verbal, sem a mensagem original acessível: decisão acadêmica **não verificada**.

## Expedição física documentada

L13 pp.17–20 descreve estação final com IHM/botoeira, magazine de **12 posições**, RFID, atuadores e esteiras. O CLP documentado é192.168.150.40; o notebook reúne serviços diferentes. Isso descreve a bancada, sem provar a conectividade atual e sem atribuir ao G5 a programação desses equipamentos.

O manual pp.196–211 fornece um fluxo de ordens e armazenamento:

1. Consultar catálogo `/api/productionOrders`; o exemplo seleciona uma ordem pendente em FIFO.
2. Acompanhar estados de OP:1 aguardando,2 em produção,3 finalizada. O texto da p.197 contém variação de nome; o código da p.198 e D01 usam `productionOrderStatusId`.
3. Consultar magazine de expedição por `GET /api/blocks/2`.
4. Registrar posição e ordem no gestor com `StorageId:2` e `productionOrder`; remover posição pela operação de saída documentada.
5. Registrar moved-in, start, finish e moved-out em cada estação; completed somente na última, com `componentId:4`.

Essas operações são **descritas**, não foram enviadas nesta auditoria. Os nomes de eventos MES se referem a ordens/processos, não comprovam uma unidade física aprovada a cada chamada.

D03 fornece evidência estática mais próxima da automação:São **59 tags** no endpoint de expedição, quatro endpoints S7 no fluxo global, variáveis de OP/estado/magazine e funções de entrada/saída. O mapa versionado `integration/plant/n2-expedition-tags.json` também registra59 tags em DB9/DB103 e Node-RED 3.0.2. É captura anterior de configuração; não se declarou leitura física atual.

A função `f4e9b03da0bda32c` envia `componentId:5` a movedout, em desacordo com a descrição de quatro estações e o novo MES (INC-016). A fonte D02 de nome flows.json contém só ESTOQUE; não substitui esse backup inteiro.

## Modelos implementados

| Aspecto | Demonstração React: main/teste/base atual | Experimento teste2 | Biblioteca consolidacao-sprint2 |
| --- | --- | --- | --- |
| Origem | Cenários estáticos e produção a cada5 s | Snapshot externo ou simulação | Evento v1 com origem/qualidade explícitas |
| Unidade logística | Lote/palete didático, capacidade50, rack configurável | Snapshot de warehouse completo | Uma peça por registro/posição; capacidade padrão12 |
| Fluxo | Recebido → identificado simulado → armazenado → expedido | Recebe estado pronto; ações locais bloqueadas para machine/gateway | RECEIVED → IDENTIFIED → STORED → DISPATCHED |
| Rejeição | Determinística por cenário; não segue à OP/palete | Recebida no snapshot | Inspeção obrigatória; REJECTED é segregada |
| Ordens | Mock; cadastro/ativação local simulados | Incluídas no snapshot | Catálogo REST e associação por identificador |
| Persistência | localStorage da demonstração | Dados machine/gateway evitam persistência da demo | Checkpoint do hospedeiro ou arquivo no runtime |
| Prova física | Nenhuma nesta auditoria | Nenhuma | Nenhuma nesta auditoria; relato anterior e observação UNCERTAIN |

O limite de 12 posições tem fundamento no manual; “uma peça por posição” no processador e “50 peças por palete” na demo são modelos de software que ainda exigem homologação semântica. Não são equivalentes entre si. A biblioteca exige identificação antes de armazenar e recusa posição ocupada, saída em posição diferente e movimentação de peça rejeitada.

Estados propostos da estação são UNKNOWN/RUNNING/STOPPED/EMERGENCY. O adaptador converte estados portugueses conhecidos, mas **não calcula tempo operacional a partir de qualquer estado automaticamente**. Ordem ativa, OP retida, sensor de presença ou número de posição não bastam para decidir quantidade final produzida.

## Fontes de ordens e limites da amostra

A amostra versionada `FrontEnd/productionOrders-real.json` contém **158 registros**, todos com status3. Ela não é um feed atual e não fornece casos reais ativos/pendentes nessa amostra. G05 relata168 ordens numa inspeção posterior: essa diferença pode refletir evolução do catálogo, sem contradição comprovada.

O código `resolveN2ProductionOrder` resolve número de OP por trackingCode/código OPn e não confunde isso com id da API. A associação “OP1255 ↔ id710” é um relato anterior em G02, não uma observação atual desta auditoria.

`adaptOrderCatalog` mantém meta e destino nulos quando não há equivalência segura. Campo de posição de estoque não foi convertido em destino logístico; parâmetros de andares não foram convertidos em quantidade de peças. Há suporte a `status_id` do exemplo Caminho A, com rejeição de conflito frente a `productionOrderStatusId`.

## OEE: definição e cálculo observado

A especificação L06 e o checklist L11 exigem Disponibilidade, Performance e Qualidade. A referência técnica do fabricante confirma o produto desses fatores. [Siemens — fórmulas OEE](https://docs.industrial-operations-x.siemens.cloud/r/en-us/insights-hub-oee/oee-basics/oee-standard-formulas/oee-standard-formulas).

No código `FrontEnd/src/processing/metrics.ts:7–21`, os fatores são percentuais:

```text
D (%)   = tempo operacional / tempo planejado × 100
P (%)   = total produzido × ciclo ideal / tempo operacional × 100
Q (%)   = aprovadas / total produzido × 100
OEE (%) = D × P × Q / 10000
```

O ciclo ideal e os tempos usam segundos nesse contrato. Isso descreve a **fórmula implementada**, não fixa a regra ainda ausente de turnos, pausas, manutenção ou produto de referência da turma.

| Elemento | Evidência / estado real da implementação | Lacuna |
| --- | --- | --- |
| Disponibilidade | Aceita `analysis.window`; operação<=planejado; null sem denominador | Calendário, paradas planejadas e origem dos tempos não homologados |
| Performance | Total×ciclo ideal/operação; permite >100% com aviso | Ciclo por produto/mix e regra de revisão ainda não definidos |
| Qualidade | Aprovadas/total; null sem peças; inspeção por evento | Aprovação real do G4 e correlação por passagem não integradas |
| OEE completo | Produto coerente; tempo e produção da mesma sessão; se chegam peças depois da janela, aguarda tempos atualizados | Não há insumos físicos suficientes demonstrados para calcular valor operacional |
| “OEE” simplificado | `oeeSimplified=quality`, compatível numericamente com L08 p.9 | Nome acadêmico precisa ser esclarecido para evitar indicador enganoso |
| PPM | Peças em (agora−60 s,agora], por minuto fixo | Convenção da janela ainda não aprovada; no modo de contadores é aproximação explícita |
| Refugo | Quantidades e Q disponíveis; demo calcula rejeitadas/total | API de resultados não expõe campo scrapRate próprio; UI/consumidor final pendente |
| MTBF | Demo informa indisponível; contrato novo sem eventos de falha e retorno | Não implementado; definir falha, quantidade e tempo de operação antes de calcular |
| Motivos de parada/perdas | Estado STOPPED/EMERGENCY existe | Sem taxonomia de motivos, duração por motivo ou classificação de perdas |
| Histórico | Buckets por minuto da sessão, movimentos e log/checkpoint | Sem consulta multi-turno de KPIs, política de retenção ou armazenamento de séries implantado |

Exemplo do teste existente:3 peças,2 aprovadas,100 s planejados,80 s operando e20 s de ciclo → D80%,P75%,Q66,67%,OEE40%. Esse cenário foi identificado no teste e a suíte correspondente passou no CI remoto do SHA auditado; **não é medição da bancada**. Se Q fosse apresentada sozinha como OEE, o mesmo cenário mostraria66,67%.

A demo antiga usa premissas editáveis, limite de performance100% e histórico didático de faixas horárias; não se deve usar seu gráfico para provar histórico real da biblioteca.

## Qualidade dos dados, duplicatas e retomada

A biblioteca separa `quality` do envelope (confiabilidade da leitura) da Qualidade Q do OEE (resultado de inspeção). GOOD não significa peça aprovada; uma peça rejeitada pode ser um evento confiável.

IDs/eventos/seq e origem evitam somar duplicatas ou misturar simulação com medição. Contadores acumulados usam primeira leitura como baseline e exigem nova counterEpoch após regressão; não se somam peças individuais no mesmo modo. Isso é uma decisão implementada a acordar com o produtor, não característica presumida do CLP.

`n2.observation` preserva ausência de timestamp de origem e não atomicidade das leituras. O código impede publicar observação como tópico de produção. Assim, observação de contexto não comprova ciclo físico concluído ou OEE.

A saída da biblioteca não executa comandos. `resetSession()` zera análise, mas preserva identidades e posições; não equivale a reset do CLP. A entrega de eventos por toda a cadeia ainda carece de ACK/replay e de protocolo de retomada com G1.

## Conclusões de domínio

- **Confirmado:** existem especificações de expedição, OEE/PPM, ordens, contadores e apresentação; biblioteca implementa cálculo e regras testáveis com eventos artificiais.
- **Confirmado:** dados de estado/magazine/ordem dos exemplos não são suficientes para OEE completo nem MTBF.
- **Provável:** o melhor aproveitamento é G5 produzir resultados e G1 distribuí-los/apresentá-los, se professor confirmar a redistribuição da UI.
- **Não verificado:** produção real contínua, inspeção por peça, associação física em cada movimento, tempos de turno, integração ao Shell e indicadores operacionais.

Perguntas e critérios para resolver essas lacunas estão em [07](07-plano-de-continuidade.md); o status por requisito está em [06](06-matriz-requisitos.md).

