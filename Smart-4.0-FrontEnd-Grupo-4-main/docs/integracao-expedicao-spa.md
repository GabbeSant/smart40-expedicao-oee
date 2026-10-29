# Integração da Expedição com a SPA

A SPA hospedeira entrega um snapshot completo à tela de Expedição por meio do
evento `smart40:expedition:snapshot`. O componente não abre conexão OPC UA/MQTT
nem conhece rotas do App Shell; o gateway ou a camada de integração da SPA é
responsável por converter a fonte da máquina para este contrato.

O contrato TypeScript e a validação estão em `src/integration/expedition.ts`.
Envie um snapshot somente depois de montar todos os campos obrigatórios:

```ts
import { SMART40_EXPEDITION_SNAPSHOT_EVENT } from "./integration/expedition";

window.dispatchEvent(
  new CustomEvent(SMART40_EXPEDITION_SNAPSHOT_EVENT, { detail: snapshot }),
);
```

## Campos recebidos

- `telemetry`: estado e modo da máquina, esteira, última peça, contadores,
  qualidade, OEE, ordens e palete.
- `readings`: leituras semânticas individuais (`tag`, `value`, `unit`, `quality`
  e `timestamp`) para preservar qualidade e horário por campo.
- `warehouse`: posições/lotes, fila, recebimento, movimentos, saídas e premissas
  de OEE.
- `digitalOutputs`: identificador e rótulo do sinal, valor `true`/`false`/`null`,
  qualidade e horário da leitura.
- `actuators`: identificador e rótulo, posição e unidade, estado, qualidade e
  horário da leitura.
- `connection`, `source` e timestamps: estado e proveniência do snapshot.
- `unitId`, `assetId`, `componentId` e `eventId`: identidade rastreável da
  unidade, do equipamento e do evento.

Qualidade aceita `GOOD`, `UNCERTAIN` ou `BAD`. Use `null` quando a leitura não
estiver disponível; não converta ausência de dado em `false` ou zero. O painel é
somente de leitura quando a origem é `machine` ou `gateway`. A simulação local
continua disponível com a origem `simulated`.

O payload é validado antes de atualizar a tela. Snapshots incompletos ou
inválidos são descartados e geram um aviso. Ao receber um snapshot da máquina, a
simulação é pausada e o snapshot não é salvo no armazenamento local do navegador.

## Limites do contrato

Este contrato prepara a fronteira entre a SPA e o módulo, mas não substitui o
contrato oficial do gateway/CLP. Os nomes semânticos, unidades, qualidade,
frequência de atualização, mapeamento de tags e regras para ordens, posições e
OEE ainda precisam ser confirmados com a equipe responsável pela máquina.

