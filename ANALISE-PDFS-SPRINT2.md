# O que os novos PDFs esclarecem — Grupo 5

Esta revisão considera `FFE-Sprint2.pdf`, `Roteiro completo de migração para a nuvem Smart 4.0 Caminho A.pdf` e `Código_completo-API-Broker.pdf`. Os exemplos foram tratados como referências técnicas, não como autorização para escrever em CLPs, publicar serviços ou usar as credenciais e URLs ilustrativas.

## O que muda na entrega

| Evidência | Consequência | Alteração implementada |
| --- | --- | --- |
| FFE, p.5; Caminho A, p.16: evento `smart40:telemetria`, conexão única no Shell | O Grupo 5 precisa consumir o barramento central | Listener compatível, adapter de snapshots e `dispatchSmart40Telemetry` para roteamento no Shell |
| FFE, p.9: exemplo chama aprovadas/total de OEE | É o fator qualidade, diferente de D×P×Q | `oeeSimplified` fornece a fórmula pedida; `oee` mantém o cálculo completo, com null quando faltam insumos |
| Caminho A, p.1–4: broker WSS na nuvem | Um broker WebSocket não aceita conexão de cliente MQTT | Ponte de saída Node-RED → WSS, com token por ambiente, TLS, reconexão e fila local persistida |
| Caminho A, p.16: API MES fica com Grupo 5 ou Grupo 1 | Há um serviço de dados que pode compor a entrega sem tela | Implementação opcional em `integration/api-mes`, com PostgreSQL, cinco eventos e três consultas |
| Caminho A, p.10–11: API de pedidos usa `status_id` | O DTO antigo ignorava esse campo | Aceita alias numérico e rejeita conflito com `productionOrderStatusId` |
| Agente dos PDFs: estados, magazine e pedido atual | Esses dados não informam todas as peças, inspeções e tempos | Adapter só converte o que existe; lacunas são sinalizadas sem fabricar produção ou OEE |

A orientação verbal mais recente do professor, informada pelo usuário, continua valendo: **Grupo 5 entrega processamento, sem tela própria**. As páginas do PDF que propõem cartões/gráficos não substituem essa orientação. O dashboard antigo permanece demonstrativo.

## Erros identificados nos exemplos

1. **Ordem de gravação viola chave estrangeira.** O evento é inserido antes da ordem referenciada. Corrigido criando a ordem primeiro e gravando evento/status na mesma transação.
2. **`/order/current` é capturada por `/order/:trackingCode`.** Corrigido registrando a consulta estática antes da rota variável.
3. **Retransmissões duplicam eventos.** Adicionados `eventId` estável, chave natural quando ele não existe e idempotência por unidade. Reutilizar um ID com conteúdo diferente retorna 409.
4. **Evento atrasado pode reabrir ordem concluída.** A conclusão agora é preservada, mantendo todos os eventos no rastreamento.
5. **Arquivos do exemplo estão trocados.** No PDF Código completo, `db.js` contém SQL e `elipse.js` repete o leitor de CLP, sem exportar `lerPedidoAtual`. O serviço novo separa SQL, driver, repositório e HTTP; o Caminho A já propõe substituir o Elipse.
6. **Indicadores MES contam ordens, não peças.** `/api/Events/metrics` retorna `scope: "orders"`. Suas conclusões não alimentam aprovadas/rejeitadas nem OEE de peças.
7. **Segurança descrita e código não coincidem.** O broker de exemplo aceita tokens previsíveis, não verifica Origin e permite encaminhar qualquer mensagem de grupo como comando. A API entregue usa tokens por unidade/papel e CORS explícito; o broker real permanece responsabilidade do Grupo 1. A ponte do Grupo 5 ignora comandos recebidos.
8. **Reconexão WebSocket não recupera o CLP.** O leitor S7 do PDF marca a conexão como perdida e não a refaz no ciclo. O agente real ainda precisa desse ajuste com a automação; os endereços DB mostrados são exemplos, não tags homologadas.

O exemplo PostgreSQL com `rejectUnauthorized: false` não foi copiado. O serviço verifica o certificado TLS por padrão, e a desativação é uma escolha explícita para um banco local de teste.

## Como conciliar MQTT/Node-RED com o Caminho A

O Caminho A literal usa um agente Node.js/S7 como único componente local e WSS para a nuvem. Ele não exige MQTT ou Node-RED. Como o usuário solicitou Node-RED e MQTT, essa integração foi preservada como gateway de referência e ganhou saída WSS compatível com o transporte descrito.

Isso é uma **adaptação**, não uma reprodução literal de toda a infraestrutura do Caminho A. Se a turma adotar o agente do Grupo 1, reutiliza-se a biblioteca do Grupo 5 e, se atribuído a ele, a API MES. Não se devem manter dois publicadores com o mesmo `TOKEN_AGENTE`: o broker dos PDFs substitui a conexão anterior quando outro cliente usa o mesmo token.

A ponte nova envia eventos v1 de expedição. O broker dos exemplos apenas repassa JSON; ele não transforma esses eventos no snapshot completo da IHM/robô. O callback único do Shell deve usar `dispatchSmart40Telemetry(window, mensagem)`: eventos v1 seguem para `smart40:expedition:telemetry`, enquanto snapshots globais seguem para `smart40:telemetria`. Assim os outros módulos não recebem um formato incompleto no lugar de sua telemetria global. Essa extensão do payload precisa ser combinada com o Grupo 1 antes de habilitar a ponte na nuvem real.

`BROKER_URL` e `TOKEN_AGENTE` ficam no ambiente do Node-RED. A senha MQTT é diferente desse token. O nome `smart40-broker.onrender.com` nos PDFs é ilustrativo e não foi tratado como uma instância disponível ou autorizada da turma.

## O que foi testado

- Cálculo simplificado separado do OEE completo, adapter do barramento e descarte de comandos/resultados na entrada.
- Os cinco eventos MES, consultas, chave estrangeira, transação/rollback, duplicatas, conflito de ID, conclusão e isolamento entre unidades.
- SQL da API em PostgreSQL embarcado PGlite. Conexão com PostgreSQL externo via `pg` ainda depende de um banco real configurado.
- MQTT → Node-RED real → broker WSS local com certificado e token → conexão central do Shell → processador Grupo 5.
- Fila WSS pendente preservada durante queda/recriação da ponte, heartbeat e comandos recebidos ignorados.

A fila WSS é removida após a conclusão do envio pelo socket. O broker dos PDFs não fornece ACK de aplicação: isso não prova recebimento ou persistência pelo destinatário. Não existe transação única entre checkpoint, MQTT, WSS e MES. Uma garantia de recuperação completa exige um protocolo de confirmação/replay com o Grupo 1.

## O que ainda depende da turma

- Endereço do broker real, token da unidade e definição de quem será seu único publicador.
- Arquivo `contrato-global.ts` efetivo e mensagens de peças/inspeção/tempos da bancada, além dos estados ilustrados nos PDFs.
- Confirmação de quem hospeda a API MES, banco PostgreSQL, origem do Shell e credenciais por papel.
- Significado físico das tags e eventos por peça homologados, teste com notebook desligado/religado e integração com o Shell real. O acesso e o mapa configurado já foram verificados em [CONEXAO-BANCADA.md](CONEXAO-BANCADA.md).
- Validação do CI remoto e publicação dos serviços nos projetos confirmados; o ponto de retomada do código está em [RETOMADA-TRABALHO.md](RETOMADA-TRABALHO.md).

Referências de implementação: [transações node-postgres](https://node-postgres.com/features/transactions), [PGlite](https://pglite.dev/docs/api) e [WebSocket/heartbeat](https://github.com/websockets/ws#how-to-detect-and-close-broken-connections).
