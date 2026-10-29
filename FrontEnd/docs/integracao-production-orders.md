# Integração de ordens · Planta N2 · somente leitura

## Análise da base antes das alterações

Foram revisados `src/types/smart40.ts`, todos os arquivos de `src/domain`, `src/mocks` e `src/components`, `App.tsx`, a entrada React, configurações, testes e documentação existente. A interface opera sobre `SimulationState`, criado com `TelemetriaSmart40`. O reducer coordena produção, ordens, fila, lotes, rack, movimentações e OEE; a persistência valida e restaura esse estado com a simulação pausada.

`OrdemProducao` exige `codigo`, `produto`, `meta`, `produzido`, `status` e `destino`. O domínio usa quantidade e status para avançar ordens; a UI calcula progresso com esses valores. Portanto, uma ordem externa incompleta não pode entrar nesse fluxo sem inventar dados. As 12 posições e os lotes de até 50 peças continuam premissas do mock.

A amostra versionada `productionOrders-real.json` contém 158 ordens, `productionLineId` também no envelope, processos com `productionOrderProcessId`/`processingTime` e parâmetros `key`/`value`. Os produtos são `BLOCO1` (Bloco Simples), `BLOCO2` (Bloco Duplo) e `BLOCO3` (Bloco Triplo). Todas as ordens dessa amostra têm `productionOrderStatusId: 3`; isso não documenta o significado do identificador. Não há quantidade planejada, quantidade produzida ou destino logístico confirmado.

O acesso a `GET http://192.168.150.200:5678/api/productionOrders` foi validado pelo usuário a partir do cliente `192.168.150.105`. Esta implementação foi verificada com o JSON salvo e respostas de rede controladas nos testes; não fez nova consulta à planta.

## Arquivos da etapa

| Ação | Arquivo | Responsabilidade |
| --- | --- | --- |
| Criar | `src/integration/productionOrdersApi.ts` | DTOs, validação estrutural, cliente GET e erros identificados |
| Criar | `src/adapters/productionOrderAdapter.ts` | Mapeamento parcial para campos do modelo interno e cópia do original |
| Criar | `src/integration/productionOrdersSource.ts` | Porta de leitura, seleção da origem e fallback mock |
| Criar | `src/integration/appShellContracts.ts` | Tipo externo preliminar `ExpeditionMetricsEvent` |
| Criar | `tests/productionOrdersApi.test.ts` | Payload real/incompleto, estrutura, GET, falhas, timeout e cancelamento |
| Criar | `tests/productionOrderAdapter.test.ts` | Correspondências seguras, lacunas e preservação |
| Criar | `tests/productionOrdersSource.test.ts` | Origem explícita, fallback e isolamento do mock |
| Criar | `docs/integracao-production-orders.md` | Análise, decisões, uso e pendências |
| Modificar | `README.md`, `docs/blueprint-dados.md`, `docs/plano-implementacao.md` | Atualizar a descrição da arquitetura e os próximos passos |

Nenhuma modificação em `App.tsx`, componentes, CSS, mocks, tipos internos, domínio ou persistência foi necessária. A aplicação continua iniciando com a simulação e restaurando sua sessão local. A camada está disponível para consumo explícito; ainda não existe seleção de API pela interface.

## Tabela de mapeamentos

| Campo real | Campo interno | Transformação | Confiança |
| --- | --- | --- | --- |
| `code` | `codigo` | Copiar texto não vazio, sem normalizar seu conteúdo | Alta: equivalência direta de código da OP |
| `productName` | `produto` | Copiar texto não vazio | Alta: nome descritivo do produto |
| `id` | Nenhum | Preservar no original; não substituir `codigo` | Pendente |
| `productCode` | Nenhum | Preservar código do produto; não substituir seu nome | Pendente |
| `trackingCode` | Nenhum | Preservar; não inferir lote, peça ou código da OP | Pendente |
| `priority` | Nenhum | Preservar, sem mudar a ordem das OPs | Pendente |
| `dueDate` | Nenhum | Preservar string/nulo sem conversão de fuso | Pendente |
| `plannedStartTime`, `plannedFinishTime` | Nenhum | Preservar; não calcular meta, ciclo ideal ou disponibilidade | Pendente |
| `startTime`, `finishTime` | Nenhum | Preservar; não deduzir status, produção ou OEE | Pendente |
| `sequenceNumber` | Nenhum | Preservar sem ordenar ou ativar OP | Pendente |
| `productionOrderStatusId` | `status` indisponível | Não mapear identificadores para `ATIVA`/`AGUARDANDO`/`FINALIZADA` | Sem documentação |
| `productionLineId` na ordem e no envelope | Nenhum | Preservar, sem filtrar automaticamente a linha | Pendente |
| `processes[].productionOrderProcessId` | Nenhum | Preservar; não identificar automaticamente o posto de expedição | Pendente |
| `processes[].processingTime` | Nenhum | Preservar; unidade e significado não documentados para o cálculo interno | Pendente |
| `parameters`: `Posicao estoque N` | Nenhum | Preservar strings; não construir ocupação/capacidade do rack | Pendente |
| `parameters`: `Posicao expedicao` | `destino` indisponível | Preservar string; posição não comprova destino logístico | Pendente |
| `parameters`: `Andares` | Nenhum | Preservar string; não converter em quantidade ou capacidade | Pendente |
| `parameters`: cores, lâminas e padrões | Nenhum | Preservar chaves e valores sem decodificar | Pendente |
| Ausente | `meta` | Manter ausente e listar em `pendingFields` | Sem correspondência |
| Ausente | `produzido` | Manter ausente; não contar uma peça por OP nem usar zero | Sem correspondência |
| Campos desconhecidos futuros | Nenhum | Preservar no envelope, ordem, processos e parâmetros | Sem correspondência |

O adapter retorna `{ mapped, pendingFields, original }`. `mapped` é um subconjunto tipado de `OrdemProducao`, limitado a `codigo` e `produto`, e não pode ser passado diretamente ao reducer como uma ordem completa. `original` é uma cópia independente com os campos não mapeados, nulos e valores originais. Os nomes internos eventualmente presentes como extensões do payload também não são aceitos como um novo contrato.

## Fluxo disponível

```text
Consumidor (futuro controlador/UI ou App Shell)
    → ProductionOrdersSource.read()
        → modo mock (padrão): cópia das ordens simuladas
        → modo api: GET /api/productionOrders
            → validação do payload externo
            → productionOrderAdapter
            → campos internos parciais + pendências + original
        → falha de API: ordens mock + origem/motivo/erro explícitos

Fluxo atual da aplicação:
mock/sessão local → SimulationState → domínio → UI existente
```

O resultado com `source: "api"` contém `adaptations` e `originalPayload`; o resultado com `source: "mock"` contém `orders`, `reason` e, em caso de fallback, `error`. Essa união distingue ordens completas simuladas de dados reais parciais. Não há mescla por código, substituição de métricas, alteração automática de sessão nem preenchimento de lacunas usando ordens mock. Uma resposta válida vazia ou sem campos mapeáveis permanece identificada como API.

## Consumo explícito

```ts
import { createProductionOrdersSource } from "./src/integration/productionOrdersSource.ts";

const source = createProductionOrdersSource({ mode: "api" });
const result = await source.read();

if (result.source === "api") {
  // Consumir apenas os campos seguros; exibir/tratar pendingFields.
  console.log(result.adaptations);
} else {
  // Sinalizar a origem simulada e, quando houver, a falha de API.
  console.log(result.orders, result.reason, result.error?.kind);
}
```

Sem opções, `createProductionOrdersSource()` seleciona mock e não faz rede. Mesmo em modo API, a consulta só acontece em `read()`. É possível passar `fallbackOrders` com ordens da sessão local ao criar a fonte; elas são copiadas sem alterar a sessão. `read(signal)` permite descartar consultas quando um futuro consumidor for desmontado. Cancelamento é propagado como erro `cancelled`, sem publicar fallback de uma consulta descartada.

`api.baseUrl` pode configurar somente a origem HTTP(S); o caminho permanece `/api/productionOrders`. URLs com credenciais, caminho diferente de `/`, query ou fragmento são recusadas. O timeout padrão é de 5 segundos, configurável por `api.timeoutMs`. `fetchImpl` permite respostas controladas nos testes. Não há polling ou repetição automática.

Campos conhecidos opcionais/nulos permitem representar respostas incompletas; isso não afirma que a API sempre os omite ou aceita nulos. Quando presentes, seus tipos devem ser compatíveis com os tipos observados. Envelope sem `productionOrders`, itens sem estrutura de objeto, tipos conhecidos incompatíveis e JSON inválido geram `invalid-payload`. Campos desconhecidos são aceitos e preservados.

Erros `unavailable`, `http`, `invalid-payload`, `timeout` ou `configuration` retornam fallback identificado na fonte. O cliente isolado lança `ProductionOrdersApiError`, preservando `kind` e o status HTTP quando aplicável. Ausência, vazio e nulo não são convertidos em zero.

Para uso pelo navegador, a máquina precisa alcançar a rede da planta e o servidor precisa permitir a origem da aplicação por CORS. Uma página HTTPS pode bloquear o endpoint HTTP por conteúdo misto. Esses casos aparecem como falha de consulta/fallback; a camada não altera configurações de segurança do navegador ou servidor.

## App Shell e contrato externo

`src/integration/appShellContracts.ts` registra somente o `ExpeditionMetricsEvent` informado nesta etapa. Ele não substitui `TelemetriaSmart40`. O envelope mais completo em `docs/contrato-smart40-v0.1.ts` continua sendo referência preliminar distinta.

Ainda é preciso validar a equivalência de `producedTotal`, `piecesPerMinute`, `outputQueue`, `activeOrders`, `pallet.currentCount`, `pallet.capacity` e `occupiedSlots` com as métricas e unidades internas. Esse evento não fornece sozinho inspeção, histórico, D/P/Q/OEE, identificação do palete ou ordens completas. Nenhum cálculo ou atribuição de métricas foi implementado com ele.

A porta `ProductionOrdersSource` independe de React e deixa uma futura origem do Shell implementar a leitura de snapshots. A futura recepção de eventos precisará de validação em runtime, adapter próprio e decisão explícita sobre dados indisponíveis. Não há listener global, event bus, montagem/desmontagem Single-SPA ou assinatura de eventos nesta etapa.

## Pendências para integrar ordens ao domínio/UI

- Documentação dos identificadores de status e sua equivalência com os três status internos.
- Fonte e unidade da meta e da produção por OP; relação entre ordem, peça, produto montado e lote.
- Significado de posições de estoque/expedição, `Andares` e destino logístico.
- Configuração física, capacidade, ocupação real e identificação dos lotes/paletes.
- Unidade e semântica dos tempos de processos, datas e critérios para métricas/OEE reais.
- Contrato definitivo do App Shell e representação de campos indisponíveis na UI.

## Verificação e limites

Execute `npm test`, `npm run lint` e `npm run build` na pasta `FrontEnd` (ou `npm.cmd` no PowerShell). Os testes usam o payload real versionado e funções fetch controladas; não dependem da planta online. Também cobrem ausência/nulo, campos desconhecidos em todos os níveis, adapter sem equivalência segura, erros HTTP/JSON/rede, timeout, cancelamento, endpoint fixo, omissão de credenciais e preservação dos mocks.

A camada só envia GET, sem body, com `credentials: "omit"`, `redirect: "error"` e `cache: "no-store"`. Não utiliza credenciais da máquina, não acessa PLC/S7 e não implementa escrita ou comandos físicos. O cadastro e as operações existentes continuam sendo apenas simulação local. Nenhum commit é criado automaticamente.
