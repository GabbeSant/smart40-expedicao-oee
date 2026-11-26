# Integração da Sprint 3 do G5 no G1

Destinatários: Elias e agente de desenvolvimento do Grupo 1. Data: 25/11/2026. Este documento basta para integrar e testar o módulo sem histórico de conversa. Nenhum arquivo do repositório G1 foi alterado pelo G5.

## Base confirmada

G5: branch `estabilizacao-sprint3`, baseada em `7968a14` de `consolidacao-sprint2`.

G1 consultado: [`eliasalmeidaa/SMART-4.0`, commit `1461a27bf9707001275787f8c05fae529375f977`](https://github.com/eliasalmeidaa/SMART-4.0/tree/1461a27bf9707001275787f8c05fae529375f977). Constatações no código:

- `apps/shell/src/mfe/registerModules.ts`: Single-SPA, rota `/expedicao`, props com `domElement`, preferência por módulos locais e fallback remoto SystemJS/ESM.
- `apps/shell/src/mfe/localModules.ts`: `@smart40/expedicao-oee` aponta para o pacote local.
- `apps/expedition/src/index.tsx`: monta em Shadow DOM o `grupos/g5-expedicao/FrontEnd/src/App.tsx`, a demonstração anterior. Não monta a Sprint 3.
- `apps/expedition/src/g5Bridge.ts` e `.test.ts`: ponte de testes v0.1 → processamento G5, explicitamente com origem `simulado`. Não fornece os tempos/premissas/ocupação necessários ao novo painel. O `index.tsx` atual não a conecta à Sprint 3.
- O contrato G1 usa eventos `smart40:<type>` com envelope `schemaVersion: "0.1.0"`, inclusive `smart40:connection.state`. O legado `smart40:telemetria` também existe.

O formato abaixo é uma **extensão proposta do G5**, implementada e testada localmente. Não foi aprovado como contrato global. Qualquer alteração no pacote compartilhado continua sob governança do G1 e dos grupos.

## Arquivos e comandos

No checkout G5, Node 24 LTS e npm:

```sh
npm ci
npm --prefix FrontEnd ci
npm test
npm run test:e2e
npm --prefix FrontEnd run lint
npm run build:release
npx playwright install chromium
npm run test:browser
```

Distribuição oficial: **todo o diretório `release/`**.

| Caminho publicado | Uso |
| --- | --- |
| `/assets/sprint3-module.js` | Módulo ESM visual; importa outros chunks do mesmo diretório |
| `/sprint3.html` e `/` | Dashboard standalone, aguardando barramento |
| `/manifest.json` | Mantém os campos anteriores da biblioteca e acrescenta `sprint3` |
| `/processing/index.js` | Biblioteca sem tela da Sprint 2; não é a entrada da UI |
| `/processing/index.d.ts` | Tipos da biblioteca |
| `/flows.local.json`, `/flows.cloud.json` | Fluxos de referência Sprint 2; não importar na bancada sem adaptar o runtime |

Sirva todo o diretório `release/`. O módulo depende dos chunks do Vite, e a distribuição reúne também a biblioteca e os fluxos da Sprint 2. O domínio da publicação precisa ser confirmado.

## Montagem recomendada: ESM compilado

Para teste entre origens, em terminais separados no G5:

```sh
npm run preview:release
node integration/browser/serve-host.mjs
```

Abra `http://127.0.0.1:4174`. O host contém aviso de teste sintético e uma área `#module`. No console desse host:

```js
const g5 = await import('http://127.0.0.1:4173/assets/sprint3-module.js');
await g5.bootstrap();
await g5.mount({
  domElement: document.getElementById('module'),
  onReset(entry) {
    // Notificação local após a auditoria e o reset, sem comando à planta.
    // Em modo por peça, prepare analysis.window.startedAt = entry.at
    // e os tempos da nova sessão. Não reutilize a janela anterior.
    console.info('Reset local do G5', entry.at);
  },
});
// Depois do teste: await g5.unmount();
```

`mount` resolve com listeners prontos; `unmount` remove o nó próprio, estilos, listeners e timer. Elementos anteriores do host são preservados. Um segundo mount sem unmount é recusado. O módulo espera um `HTMLElement` do mesmo documento/window do Shell.

No G1, a opção com menos acoplamento é um adaptador local de ciclo de vida que faça esse import dinâmico da URL configurada e encaminhe `bootstrap`, `mount` e `unmount`. Assim preserva as outras entradas de `LOCAL_MODULES`. Outra opção é remover apenas a entrada local G5 e apontar somente seu import-map para a URL ESM. Configurar o modo global `remote` também afeta os demais grupos; não é necessário para esta integração.

O ESM traz seu React compilado e tem isolamento visual. Importar os fontes no monorepo também é possível, mas requer copiar `src/sprint3` e suas dependências de processamento, suportar `?inline` e alinhar React/tipos/build do G1 (atualmente React 18) com a base G5 (React 19). Não montar o dashboard antigo junto do novo.

Hospedagem: servir todo o pacote com MIME JavaScript e CORS para **cada chunk**. `vercel.json` usa CORS `*` para assets públicos sem credenciais e revalidação de cache. Preferir URL de deployment imutável por revisão para não misturar módulos e chunks de versões diferentes. Node-RED, gestor e broker não rodam nessa hospedagem estática.

## Eventos recebidos

| Evento | `event.detail` |
| --- | --- |
| `smart40:telemetria` | Snapshot proposto abaixo com `origin`, `timestamp`, `estacoes.expedicao` |
| `smart40:expedition:telemetry` | Evento de produção normalizado G5 v1; também aceita o snapshot proposto |
| `smart40:connection.state` | Envelope existente G1 com `data.status`: CONNECTED, CONNECTING, DISCONNECTED ou STALE |
| `smart40:expedition:connection` | Alias G5: uma dessas strings diretamente |

O módulo **não abre WebSocket, não usa token e não envia comandos**. O callback `onReset` é opcional e não muda o contrato global. O evento antigo `smart40:expedition:metrics` e o G1 `smart40:expedition.metrics` não são entrada de produção desse painel; não redirecione indicadores agregados como se fossem peças.

Campos do snapshot:

| Campo | Regra |
| --- | --- |
| `origin` | `medido` no canal de produção; `simulado` somente na sessão DEV. A identidade do publicador deve ser validada pelo host. |
| `timestamp` | ISO UTC da fonte, não horário inventado pelo frontend; futuro >30 s é recusado. |
| `estacoes.expedicao.schemaVersion` | `"1.0"` da extensão proposta |
| `unitId`, `assetId` | Identidades acordadas com automação; a primeira identidade válida fixa o escopo da sessão. Não assumir que os nomes da fixture sejam industriais. |
| `inicioSessao`, `modoProducao` | Início ISO e `pieces` ou `counters`, quando usar `eventos` |
| `criterios` | `{ nominalPerHour: número positivo finito, inspection: texto, reference: texto }`; primeira configuração válida da sessão. Sem os três campos, indicadores ficam N/D. |
| `ocupacao` | Exatamente 12 valores `true` ocupada, `false` livre ou `null` desconhecida; vagas 1–4 inferior, 5–8 meio, 9–12 superior |
| `posicaoAtuador` | Inteiro 1–12 ou `null`; posição de armazenamento retida não prova posição atual do atuador |
| `estoqueRegistrado` | Opcional: `{ observedAt: ISO, complete: boolean, positions: [12 boolean/null] }`; completo exige ausência de null. Timestamp não pode ser posterior ao envelope. |
| `eventos` | Até 128 eventos v1 ordenados por stream/seq; não misturar peças e contadores acumulados |
| `amostraAcumulada` | Alternativa aos eventos; sincroniza contagens e tempos absolutos, descrita abaixo |

Ocupação vence em 15 s, registro do gestor em 45 s. Dados anteriores continuam visíveis com aviso; divergências não são afirmadas com fontes vencidas. Um heartbeat não transforma valor industrial antigo em leitura atual.

## Exemplo completo de replay por peça

**Somente teste sintético em host isolado.** `origin: medido` abaixo exercita a validação do canal de produção e não comprova medição. Os números 300/90/72 são fictícios, não premissas aprovadas pelo professor.

```js
const end = Date.now();
const date = secondsBefore => new Date(end - secondsBefore * 1000).toISOString();
const base = {
  schemaVersion: '1.0', unitId: 'FIXTURE-N2', assetId: 'EXPEDICAO',
  origin: 'medido', quality: 'GOOD', streamId: 'fixture-boot-1',
};
const start = date(90);
const payload = {
  origin: 'medido', timestamp: date(0),
  estacoes: { expedicao: {
    schemaVersion: '1.0', unitId: base.unitId, assetId: base.assetId,
    inicioSessao: start, modoProducao: 'pieces',
    criterios: {
      nominalPerHour: 300, inspection: 'Inspeção sintética',
      reference: 'FIXTURE; não representa aprovação do professor',
    },
    ocupacao: [true, true, false, null, false, true, false, false, null, false, false, false],
    posicaoAtuador: 6,
    estoqueRegistrado: {
      observedAt: date(0), complete: false,
      positions: [true, true, true, null, null, true, null, null, null, null, null, null],
    },
    eventos: [
      ...Array.from({ length: 8 }, (_, i) => ({
        ...base, type: 'piece.processed', seq: i + 1, eventId: `e-${i}`,
        pieceId: `p-${i}`, productionOrderId: null,
        timestamp: date(75 - i * 8), inspection: i === 2 ? 'REJECTED' : 'APPROVED',
      })),
      {
        ...base, type: 'analysis.window', seq: 9, eventId: 'window-1',
        timestamp: date(0), startedAt: start,
        plannedSeconds: 90, operatingSeconds: 72, idealCycleSeconds: 12,
      },
    ],
  } },
};
window.dispatchEvent(new CustomEvent('smart40:telemetria', { detail: payload }));
window.dispatchEvent(new CustomEvent('smart40:connection.state', {
  detail: { data: { status: 'CONNECTED' } },
}));
```

Resultado após até um segundo: 8 produzidas, 7 aprovadas, 1 rejeitada, D 80%, P 100%, Q 87,5%, OEE 70%, PPM produtivo 6,7. Vaga 3 divergente; vagas 4 e 9 desconhecidas. Repetir o mesmo payload não incrementa o total. Os testes reproduzíveis estão em `integration/browser/replay.mjs` e `sprint3.spec.mjs`.

O gráfico de fluxo mostra a etapa atual das peças rastreadas. Os eventos `piece.moved` atualizam identificação, armazenamento e expedição concluída. O gráfico de produção mostra aprovadas e rejeitadas por minuto quando há histórico e totais da sessão quando a fonte fornece amostras acumuladas. O diagnóstico local do Node-RED fica no standalone de desenvolvimento.

Eventos v1 exigem `eventId`, `pieceId` quando aplicável, `streamId`, `seq` inteiro crescente, `timestamp`, escopo, origem e qualidade GOOD. `productionOrderId` deve ser id da API ou `null`, nunca número da OP do CLP sem resolução. A automação deve emitir `piece.processed` apenas para conclusão válida da estação 4 (`componentId: 4` no evento industrial), com inspeção explícita. O contrato normalizado confia nessa validação do agente; não recebe automaticamente qualquer `completed` global.

`analysis.window` precisa representar a mesma sessão e cobrir a peça mais recente; tempos atrasados deixam OEE N/D. `operatingSeconds <= plannedSeconds`. A capacidade de `criterios`, e não um ciclo industrial suposto, determina a performance da Sprint 3. O campo `idealCycleSeconds` é requerido pelo envelope v1 anterior e deve ser coerente com a capacidade aprovada.

## Alternativa recomendada para contadores absolutos

No snapshot, substitua `eventos` por:

```js
amostraAcumulada: {
  epoch: 'identidade-real-do-turno-ou-reinicio', seq: 42,
  timestamp: timestampDoEnvelope, quality: 'GOOD',
  totalProduced: totalMedido, approved: aprovadasMedidas, rejected: rejeitadasMedidas,
  plannedSeconds: planejadoAcumulado, operatingSeconds: produtivoAcumulado,
}
```

Os identificadores acima são variáveis a preencher com dados da fonte, não endpoints ou medições inventados. Os três contadores e os tempos precisam representar o mesmo instante/intervalo. `totalProduced = approved + rejected`; tempos podem ser ambos null para informar ausência, deixando OEE/PPM N/D. A primeira amostra é baseline; a segunda calcula deltas. Repetição/regressão é recusada. Mudança de época suspende os indicadores até reset confirmado e nova amostra; épocas encerradas não retornam.

No modo v1 `production.counters`, a primeira leitura também é referência. O início da janela de análise deve coincidir com ela, não com um turno anterior. Para resets locais sem reiniciar contadores da planta, prefira `amostraAcumulada`, que recalcula a janela por diferenças sincronizadas. Não some essa amostra com eventos por peça ou com a ponte antiga.

## O que o G1 precisa adaptar

1. Montar o novo ESM em `/expedicao` e retirar a demonstração anterior dessa rota.
2. Manter sua conexão central; mapear dados reais para o formato proposto somente depois de validar proveniência, escopo, estação final e qualidade. Nunca converter `isMock: true`, `source: mock` ou `oeePercentMock` em dado medido.
3. Publicar os eventos/tempos e os estados das 12 vagas com timestamps de fonte. Snapshots de posição sem identidade/inspeção ficam apenas como observação.
4. Consultar o gestor no servidor/agente com credenciais autorizadas. Publicar `estoqueRegistrado` separado da ocupação física. O endpoint GET do Vite é diagnóstico local e não existe na Vercel.
5. Repassar `connection.state`; após mount/navegação, fornecer replay/checkpoint coerente dos eventos perdidos. O módulo preserva memória enquanto a página vive, mas fica sem listeners quando desmontado. Recarga completa exige estratégia de retomada do host; o painel isolado não persiste checkpoint de produção.
6. Em eventos por peça, usar `onReset(entry)` para fornecer novos tempos com `startedAt = entry.at`, sem mandar reset ao CLP. A ação já foi auditada e concluída quando o callback roda. Se ele falhar, o painel avisa; não repita automaticamente o reset.
7. Se exigir autoria autenticada e auditoria central, integrar a identidade/armazenamento do Shell. Hoje há autoria declarada, localStorage e dados anteriores; isso não é prova de identidade.

## Pendências e aceite conjunto

Professor/automação: capacidade nominal, critério objetivo ou declaração qualitativa, unidade/ativo, origem e qualidade, início/fim das paradas e turno, identidade por peça, conclusão na estação 4, 12 leituras físicas e posição atual do atuador. Gestor: confirmar endpoint, formato, completude e credenciais. G1: aprovar transporte sem alterar unilateralmente o contrato global, URL de publicação, replay, identidade/auditoria e janela após reset.

Aceitar a integração quando: `/expedicao` montar a Sprint 3; fixture produzir 70% e uma divergência; replay não duplicar; desconectar/reconectar preservar contagens com aviso; navegar 15 vezes não criar sockets/listeners extras; reset registrar autor/horário/estado anterior antes de limpar; simulação não aparecer na produção; dados reais autorizados forem confrontados com produção física e gestor. O último item permanece pendente da bancada.
