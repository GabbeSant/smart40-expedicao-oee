# Validação da Expedição pelo Wi-Fi da bancada N2

Em 25/11/2026, às 20h49 (horário de Brasília), a inspeção confirmou acesso ao Node-RED pelo Wi-Fi e comunicação S7 com o CLP da Expedição. O OEE real ficou pendente dos dados de produção.

## Conectividade e leitura

| Checagem | Resultado |
| --- | --- |
| Wi-Fi do computador | Origem `192.168.150.105`, interface `Wi-Fi` |
| Node-RED | `192.168.150.200:1880`, TCP aprovado e versão `3.0.2` |
| CLP da Expedição | `192.168.150.40:102`, online pelo Node-RED, rack `0`, slot `1`, ciclo configurado de `200 ms` e `59` tags |
| Estado observado | `NumeroOP_expedicao`, OP guardada e últimas posições de armazenamento e remoção em `0`. Os sinais de ocupado, aguardando, emergência, fim de OP e solicitação de remoção estavam desativados. |
| Catálogo de ordens | `184` ordens retornadas. A leitura `0` da Expedição resultou em `no-order`. |

A inspeção retornou todos os campos consultados (`unavailable: []`). O contexto global do Node-RED fornece leituras separadas e sem timestamp de origem (`sourceTimestamp: null`). Por isso, o relatório marca a observação como `UNCERTAIN`.

## Insumos pendentes para o OEE real

- Identidade das peças concluídas na Expedição e resultado de inspeção de cada peça, ou contadores confiáveis de produzidas, aprovadas e rejeitadas.
- Tempos planejado e produtivo da mesma janela e capacidade nominal ou ciclo ideal validado.
- Timestamp de origem que permita alinhar as leituras. A validação do OEE depende de conferir esses dados no painel durante um ciclo de produção.

## Repetir a inspeção

No PowerShell, na raiz do projeto, com o Wi-Fi `Smart 4.0 (3)` conectado:

```powershell
Test-NetConnection 192.168.150.200 -Port 1880 -InformationLevel Detailed
Remove-Item Env:PLANT_OBSERVATION_MQTT_URL -ErrorAction SilentlyContinue
npm.cmd run plant:inspect
```

O relatório local é gravado em `.work/plant/live-observation.json`. Veja também o [roteiro de bancada](04-ROTEIRO-BANCADA-25-11.md).
