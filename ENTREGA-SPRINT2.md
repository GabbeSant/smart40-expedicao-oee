# Entrega técnica — Sprint 2 · Grupo 5

Atualização pelos três PDFs recebidos depois desta implementação: consultar [ANALISE-PDFS-SPRINT2.md](ANALISE-PDFS-SPRINT2.md). Foram acrescentados compatibilidade com `smart40:telemetria`, roteamento no Shell, OEE simplificado separado, ponte WSS autenticada e [API MES opcional](integration/api-mes/README.md).

Atualização após acesso à rede da bancada: [CONEXAO-BANCADA.md](CONEXAO-BANCADA.md) registra Node-RED acessível, leitura S7 online, mapa de 59 tags e catálogo real com 168 ordens. A observação real foi transportada por MQTT em teste local, sem modificar os fluxos da máquina. A emissão contínua de eventos por peça ainda precisa de integração específica.

## Escopo e fontes

A orientação mais recente do professor, reproduzida pelo usuário, define **processamento sem interface própria**. A entrega é TypeScript independente de React. A demonstração antiga não é carregada pelo processador.

Foram considerados a conversa colada pelo usuário, as branches locais, `Manual_Operacao_N2.pdf`, `Estrutura.zip` e `monorepo.zip`. Os documentos antigos de `FrontEnd/docs` não foram usados como requisito. O link compartilhado retornou apenas uma página de apresentação; o trecho enviado pelo usuário esclareceu o escopo.

O manual apresenta o magazine com **12 posições e RFID**, página 18. Na página 20 informa CLP da expedição `192.168.150.40`, Node-RED `192.168.150.200:1880` e TagoCore `192.168.150.200:8888`. São endereços documentados, não conectividade verificada nesta sessão. TagoCore não foi presumido como broker MQTT.

Os ZIPs fornecem esqueletos de envelope versionado, qualidade/origem, deduplicação, simuladores e composição MQTT. Não contêm um mapa de tags do CLP ou uma implementação completa da expedição. Porta 8883, sozinha, não configura TLS; a integração entregue configura verificação de certificado explicitamente.

## Consolidação

O checkout estava em `teste`, com a API de ordens e testes. Foi criada `consolidacao-sprint2` a partir dessa base. A branch `teste2` foi inspecionada e contém aplicações duplicadas; a recepção validada de snapshots foi reaproveitada conceitualmente em `snapshotAdapter.ts`, sem copiar essa estrutura. Isso é consolidação funcional seletiva, não merge integral nem aprovação externa do contrato.

## Contrato de entrada proposto v1

Exemplo ilustrativo:

```json
{
  "schemaVersion": "1.0",
  "eventId": "gateway-boot-001:42",
  "unitId": "UNIDADE-SP",
  "assetId": "N2-EXPEDICAO",
  "streamId": "gateway-boot-001",
  "seq": 42,
  "timestamp": "2026-11-04T15:30:00.000Z",
  "origin": "medido",
  "quality": "GOOD",
  "type": "piece.processed",
  "pieceId": "RFID-00042",
  "productionOrderId": "2",
  "inspection": "APPROVED"
}
```

| Tipo | Dados específicos | Regra |
| --- | --- | --- |
| `piece.processed` | `pieceId`, `productionOrderId` ou null, `inspection` APPROVED/REJECTED | Uma ocorrência física, uma contabilização |
| `station.state` | `status` RUNNING/STOPPED/EMERGENCY | Estado observado; não comando |
| `analysis.window` | `startedAt`, `plannedSeconds`, `operatingSeconds`, `idealCycleSeconds` | Tempos da mesma sessão, não regressivos |
| `production.counters` | `counterEpoch`, `totalProduced`, `approved`, `rejected` | Exclusivo do modo de contadores |
| `piece.moved` | `pieceId`, `stage` IDENTIFIED/STORED/DISPATCHED, `position` quando armazenada/expedida | Etapas físicas observadas |

Todos exigem envelope completo, timezone nas datas e inteiros não negativos em contagens/sequência. Unidade, ativo e origem coincidem com a instância. BAD/UNCERTAIN não entram nos indicadores. Cada produtor fornece `eventId` estável nas retransmissões, `seq` crescente e novo `streamId` ao reiniciar. Eventos futuros além de 30 segundos, sequências antigas e eventos anteriores à sessão são recusados. Retrabalho exige identificar uma nova passagem da peça em contrato com a automação.

`productionOrderId` usa o `id` da API convertido em string; sem id, usa o código. Meta, destino e status interno não são deduzidos de parâmetros desconhecidos. Uma peça de OP ainda não consultada mantém a associação pelo identificador, com campos cadastrais desconhecidos.

O adapter SMART40 exige metadados confiáveis e converte somente contadores; não interpreta `ultimaPecaLida` como nova produção em cada snapshot. O envelope escalar dos ZIPs exige um mapeamento adicional de tags pela automação antes de representar eventos de peças.

## Processos e indicadores

Peça aprovada percorre RECEIVED → IDENTIFIED → STORED → DISPATCHED. Rejeitadas são segregadas. Armazenamento exige identificação e posição livre de 1 a 12. Saída exige a mesma posição registrada, libera o magazine e preserva histórico com peça, OP, etapa e horário. O modelo novo é por peça/posição; os lotes didáticos do dashboard antigo não são tratados como capacidade física.

Duplicatas de evento ou peça não somam. O checkpoint guarda identidades e sequências; uma falha de gravação impede confirmação da alteração. Snapshots de saída são cópias. `resetSession()` zera os indicadores/janela de análise e preserva identidades, baseline, magazine e rastreabilidade. Não envia reset, start, stop ou escrita ao CLP.

| Indicador | Cálculo e condição |
| --- | --- |
| Total | aprovadas + rejeitadas, inclusive rejeições vinculadas à OP |
| Qualidade | aprovadas / total × 100; null sem produção |
| Disponibilidade | operação / planejado × 100; null sem planejado positivo |
| Performance | total × ciclo ideal / operação × 100; null sem operação positiva |
| OEE | D × P × Q / 10000, com fatores percentuais; null se faltar fator |
| PPM | quantidade em `(agora − 60s, agora]` / um minuto fixo |

Tempos de OEE começam em `sessionStartedAt` e abrangem as peças contabilizadas. Produção mais recente que o último `analysis.window` deixa OEE indisponível até atualizar os tempos. Parada observada atualiza o estado; disponibilidade só muda com tempos válidos, sem presumir calendário. Performance acima de 100% é preservada e sinalizada. O snapshot informa `analysisWindow`, `lastUpdated` da origem e `computedAt` do cálculo.

No modo `counters`, primeira leitura é baseline e seguintes somam diferenças não negativas. Regressão exige nova `counterEpoch`; época encerrada não pode reaparecer. A nova época estabelece baseline, sem inventar produção na lacuna. Eventos individuais não podem ser somados nesse modo. `ppmExact=false` indica deltas atribuídos ao horário da leitura, sem timestamps individuais ou rastreabilidade RFID reconstruída.

Sem tempos/ciclo confiáveis, OEE completo permanece null. O PDF FFE-Sprint2 p.9 esclareceu o indicador simplificado exigido no exemplo: `oeeSimplified` fornece aprovadas/total × 100, igual à qualidade. A dispensa de tela informada pelo usuário permanece vigente.

## Integração e durabilidade

`attachExpeditionToShell` escuta os eventos de telemetria/conexão e publica `smart40:expedition:metrics`. `dispose()` remove listeners e timer; dados inválidos geram diagnóstico. O timer atualiza PPM e detecta dados antigos mesmo sem novas peças. O módulo não abre uma segunda conexão de rede.

O runtime usa Node-RED real, MQTT QoS 1, resultados MQTT retidos e WebSockets de eventos/resultados. A nuvem fica desativada até ser configurada. O teste de nuvem é local, TLS e autenticado; não valida o broker real da turma. A entrada industrial permanece como ponto de ligação para tags confirmadas.

A API reaproveitada faz GET `/api/productionOrders`, com origem configurável, timeout e cancelamento. `PRODUCTION_ORDERS_BASE_URL` habilita consulta a cada 60 segundos no Node-RED. Falha preserva o catálogo anterior e aparece em `/health`, sem fallback mock. No navegador, o acesso pode exigir proxy/CORS. O endpoint privado foi acessado depois da conexão à rede Smart 4.0; os resultados estão em [CONEXAO-BANCADA.md](CONEXAO-BANCADA.md).

O checkpoint do gateway usa arquivo atômico e um único escritor. O histórico é mantido integralmente para deduplicação; uso prolongado exige dimensionar arquivo/armazenamento com a equipe. A ponte WSS agora persiste uma fila pendente, removendo cada entrada após o callback de envio do socket. Isso não é ACK de aplicação e não constitui transação entre checkpoint, brokers e gateway. Não há replay completo da saída WebSocket para novos consumidores. Queda durante encaminhamento pode exigir retransmissão pela origem; a deduplicação permite repetir com segurança para as contagens.

## Critérios de aceite

| Item | Evidência local | Validação externa pendente |
| --- | --- | --- |
| Biblioteca sem tela | build sem React e pacote ESM | Importação no Shell real |
| Contratos | tipos, parser e testes | Aprovação por Grupo 1 e automação |
| Expedição e produção | aprovação, rejeição, OP, etapas e posições testadas | Tags e RFID da bancada |
| Idempotência/persistência | duplicata, reload, reset, falha de gravação e restart testados | Retenção e replay da turma |
| OEE/PPM | cálculos e janela móvel testados | Tempos, ciclo e fórmula da avaliação |
| Ordens REST | payload, falhas de API e consulta ao catálogo real verificados | Integração contínua no ambiente definitivo |
| MQTT/nuvem | Node-RED, TLS, autenticação e certificado verificados localmente | Host e credenciais do broker real |
| Shell | eventos reais por WebSocket e consumo da biblioteca testados | Aplicação principal da turma |
| CI/publicação | workflow, artefato estático e ponto de retomada preparados | Execução remota do CI e projeto de hospedagem |

O usuário confirmou que broker de nuvem e endereço/repositório do Shell ainda não estão disponíveis. Também faltam mapa de tags e aprovação formal do contrato. Por isso, a entrega de código é verificável localmente, mas a integração física e a publicação da turma não podem ser declaradas concluídas.

Referências técnicas: [MQTT no Node-RED](https://cookbook.nodered.org/mqtt/connect-to-broker), [variáveis de ambiente](https://nodered.org/docs/user-guide/environment-variables), [segurança do runtime](https://nodered.org/docs/user-guide/runtime/securing-node-red) e [deployments Vercel](https://vercel.com/docs/deployments).
