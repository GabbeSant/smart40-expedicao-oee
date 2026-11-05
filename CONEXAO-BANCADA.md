# Conexão verificada com a bancada — 04/11/2026

## Acesso desta sessão

O computador do projeto conectou-se à rede Wi-Fi `Smart 4.0 (3)` e recebeu `192.168.150.105/24`. A interface Ethernet manteve o endereço `10.104.13.169`. O acesso ao notebook da bancada passou a sair pela interface Wi-Fi.

| Recurso | Resultado observado |
| --- | --- |
| Node-RED | `http://192.168.150.200:1880`, versão 3.0.2, editor e leituras de API acessíveis |
| CLP de expedição configurado | `192.168.150.40:102`, S7 ISO-on-TCP, rack 0, slot 1 |
| Leitura S7 | Nó de entrada da expedição com status `online` no canal do editor |
| Ciclo configurado | 200 ms; entrada geral com envio por diferença (`diff: true`) |
| Mapa do endpoint | 59 tags em DB9 e DB103, preservadas em `integration/plant/n2-expedition-tags.json` |
| API de ordens | GET `http://192.168.150.200:5678/api/productionOrders`, 168 registros nesta leitura |
| MQTT existente na bancada | Saída configurada para `mqtt.tago.io:1883`, tópico `smart40`; não foi alterada nem usada para o teste |

Esses resultados são observações desta sessão, não garantias de disponibilidade futura ou confirmação de todos os significados físicos das tags. A inspeção remota usou GET e assinatura de status do editor. Os fluxos existentes continuaram como estavam.

## Associação de OP confirmada

Na leitura realizada, `NumeroOP_expedicao` era `1255`. O catálogo retornou:

```json
{
  "id": 710,
  "code": "OP1255",
  "trackingCode": "OP1255",
  "productName": "Bloco Simples",
  "productionOrderStatusId": 3
}
```

Portanto, **o número da OP do CLP não é a chave id da API**. O novo `resolveN2ProductionOrder` resolve `1255 → OP1255 → 710`. Ambiguidade, ausência de cadastro ou número inválido não geram uma associação inventada. O catálogo indicava status 3; o número retido no CLP não prova que essa OP ainda esteja em produção.

Outras leituras do contexto foram OP armazenada `1255`, última posição armazenada `9`, flags de emergência desativadas e flags ocupado/aguardando desativadas. São valores observados, não o histórico de todas as peças da sessão.

## Repetir a inspeção

Na rede da bancada, executar na raiz:

```sh
npm run plant:inspect
```

No PowerShell, usar `npm.cmd` se necessário. O comando compila a biblioteca e consulta configuração, contexto da expedição, status S7 e catálogo de ordens. Ele salva um relatório em `.work/plant/live-observation.json`, fora do versionamento. O backup dos fluxos obtido nesta sessão também está em `.work/plant` e pode conter configurações privadas; somente o mapa de tags sem credenciais foi incorporado ao código.

Origens alternativas podem ser declaradas com `PLANT_NODE_RED_URL`, `PLANT_ORDERS_URL` e `PLANT_PLC_ADDRESS`. O comando não instala nós, não faz deploy no Node-RED e não envia comandos ao CLP.

Para publicar a observação em um broker autorizado, fornecer `PLANT_OBSERVATION_MQTT_URL` no ambiente. O tópico é `smart40/UNIDADE-SP/N2-EXPEDICAO/observation`. A publicação foi validada nesta sessão com os dados reais e um broker temporário em localhost; esse teste foi encerrado ao concluir a leitura. Não foi deixado um broker novo rodando nem ativada uma publicação de nuvem.

## Limites do dado disponível

O contexto global do Node-RED não traz timestamp de origem e os campos são lidos em chamadas separadas. Por isso, a saída tem tipo `n2.observation`, qualidade `UNCERTAIN` e `sourceTimestamp: null`. O horário da consulta não é apresentado como horário de medição do sensor.

O processo ainda precisa disponibilizar identidade/inspeção por peça e tempos/ciclo da análise para alimentar produção, rastreabilidade e OEE. O flag `finishOP`, o número de OP, uma mudança de posição ou o número de pedidos não substituem esses dados. O script não publica observações no tópico de eventos `/telemetry` e não incrementa contadores com elas.

Para a integração contínua, o próximo passo é acordar a emissão desses eventos a partir da leitura S7, em uma saída observacional própria. A nuvem e o App Shell reais continuam dependendo dos destinos e contratos definidos com o Grupo 1. Esta sessão verificou acesso real, mapa configurado, leituras existentes, associação de OP e transporte MQTT local de observações.
