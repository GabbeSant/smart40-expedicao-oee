# Sprint 3 — Posto de Expedição e OEE

Referência de requisitos: `Frontend DOCS/Sprint3_Grupo5.pdf`, páginas 1–10. O dashboard da Sprint 2 permanece em `/`. O painel desta entrega está em `/sprint3.html`.

## Rodar na bancada

```powershell
npm.cmd --prefix FrontEnd run dev -- --mode bancada --host 127.0.0.1 --port 8084 --strictPort
```

Abra `http://127.0.0.1:8084/sprint3.html` e clique em **Ler bancada N2**. A consulta GET ao contexto do Node-RED exibe os estados, a OP e as últimas posições registradas. O horário é o da consulta. O contexto pode reter valores e nenhum deles, isoladamente, confirma uma peça produzida ou a situação atual das outras vagas.

O servidor de desenvolvimento consulta por GET `/api/blocks/2` e `/api/blocks` em intervalos de pelo menos 30 segundos enquanto houver consultas. Os URLs configuráveis são `S3_NODE_RED_URL` e `S3_STOCK_URL`. Se o responsável fornecer credenciais do gestor, configure `S3_STOCK_USER` e `S3_STOCK_PASSWORD` apenas no ambiente do Vite. As credenciais ficam no servidor. Use o ambiente isolado autorizado se o gestor só oferecer HTTP.

`/api/blocks/2` é documentado como primeira vaga livre. O adaptador de `/api/blocks` aceita uma lista de registros com `storageId` ou `StorageId` e `position`, filtra a Expedição (`storageId` 2) e mostra as posições registradas em uma linha separada na matriz. Só um envelope que declare `{ complete: true, items: [...] }` permite interpretar posições ausentes como livres. Uma lista simples é tratada como parcial. O formato precisa ser confirmado quando a API real estiver acessível. A comparação aponta divergências somente entre valores disponíveis e recentes nas duas fontes. A leitura do gestor não substitui a ocupação física publicada pelo App Shell.

## Como o App Shell consome

`npm run build:release`, na raiz, gera a distribuição oficial `release/`: interface em `/` e `/sprint3.html`, módulo ESM em `/assets/sprint3-module.js`, biblioteca e fluxos da Sprint 2. `npm --prefix FrontEnd run build` continua gerando `dist/sprint3.html` e `dist/assets/sprint3-module.js` para verificação do FrontEnd. O módulo exporta `bootstrap`, `mount({domElement, onReset?})` e `unmount`, monta em Shadow DOM e termina a montagem com os listeners prontos. Hospede todo o `release/`, incluindo os chunks compartilhados. O CORS já está preparado em `vercel.json`; a configuração não realiza deploy.

O painel não abre socket. Ele escuta `smart40:telemetria` e o evento G5 existente `smart40:expedition:telemetry`. Para integrar as premissas e a grade de ocupação, o G1 e a automação precisam aprovar como transportar o seguinte formato proposto, por exemplo sob `event.detail.estacoes.expedicao`. Ele preserva o envelope de eventos v1 do processador G5 e não é um contrato global já aprovado.

```ts
window.dispatchEvent(new CustomEvent("smart40:telemetria", { detail: {
  timestamp, origin: "medido",
  estacoes: { expedicao: {
    schemaVersion: "1.0", unitId, assetId,
    inicioSessao, modoProducao: "pieces",
    criterios: { nominalPerHour, inspection, reference },
    ocupacao, // 12 entradas boolean | null, com ordem de vagas 1 a 12
    estoqueRegistrado, // opcional: { observedAt, complete, positions: [12 estados] }, enviado pelo host
    posicaoAtuador, // 1 a 12 ou null
    eventos, // eventos G5 v1 autenticados pelo host, sem agregados do painel
  } },
} }));
```

Para produzir indicadores, forneça `piece.processed` por peça inspecionada com IDs estáveis, ou `production.counters` com época e modo `counters`, mais `analysis.window` da sessão. O eixo de visualização de vagas é separado da contagem. Uma mudança de posição sem identidade e inspeção fica fora do total. O pacote recusa proveniência simulada no modo real. O App Shell atual do G1 precisa de adaptação do formato e montagem desse módulo em `/expedicao`.

### Alternativa para fonte com contadores acumulados

Se a fonte publicar contagem e tempos acumulados no mesmo instante, envie `amostraAcumulada` em `estacoes.expedicao` no lugar de `eventos`. Exemplo de campos da amostra:

```json
{
  "epoch": "turno-2026-11-18-A",
  "seq": 12,
  "timestamp": "2026-11-18T20:00:20Z",
  "quality": "GOOD",
  "totalProduced": 110,
  "approved": 100,
  "rejected": 10,
  "plannedSeconds": 180,
  "operatingSeconds": 120
}
```

Use o mesmo timestamp no envelope externo. A primeira amostra vira referência. A partir da segunda, os três contadores e os tempos são calculados por diferença desde essa mesma referência. Sequência repetida, timestamp antigo ou regressão implícita ficam fora do cálculo. Tempos ausentes ficam `null` e deixam PPM e OEE em N/D. Uma nova época suspende os indicadores até o operador confirmar o reset auditado. O histórico registra tanto o horário da confirmação como o da nova referência. O painel espera nova amostra dessa época antes de retomar o cálculo. Esse modo não soma eventos v1 e não exibe PPM móvel sem amostras por peça.

## Cálculo e decisões documentais

- **OEE:** três fatores conforme as páginas 5–6 e a rubrica da página 9. A taxa de aprovação da página 1 é exibida como qualidade. A performance fica limitada a 100%. Disponibilidade usa tempo produtivo/planejado. As peças esperadas usam capacidade nominal por hora e tempo produtivo. Qualidade usa aprovadas/total. Valores ausentes ou denominador zero aparecem como N/D.
- **PPM:** média no tempo produtivo conforme a página 7. A janela móvel de 60 s aparece separadamente. Em modo acumulado, a janela é uma estimativa, pois os deltas usam o instante da leitura.
- **Reset:** confirmação manual conforme as páginas 7–8. Registra autor declarado, horário, unidade, ativo e contagem anterior no navegador antes de zerar. Preserva a ocupação, a deduplicação e o histórico de resets. O autor ainda não é autenticado pelo Shell. Após um reset, os três fatores precisam de tempos da nova sessão. O reset local não muda a fonte industrial.
- **Auditoria ampliada:** o registro contém `before` com aprovadas/rejeitadas, tempos, premissas, indicadores e magazine. Em mudança de época acumulada, preserva a contagem da época anterior mesmo com a visualização suspensa. Falha na gravação impede o reset. `onReset(entry)` informa o host depois da gravação e da limpeza, sem comando à fonte. Em eventos por peça, o host deve alinhar o próximo `analysis.window.startedAt` com `entry.at`. Em amostras acumuladas, o painel calcula os deltas da nova referência sem mudar a fonte.
- **Conexão:** aceita `smart40:connection.state` com `detail.data.status` do G1 e `smart40:expedition:connection` com uma string. Mostra desconexão/reconexão e marca fonte vencida após 15 s, preservando os últimos valores. Estado em memória é preservado ao navegar; eventos durante desmontagem exigem replay do Shell. Recarregar toda a página cria uma nova sessão; não equivale à restauração de um checkpoint industrial.
- **Critério e capacidade:** o cenário de desenvolvimento usa valores explicitamente fictícios. Produção precisa das premissas informadas pelo instrutor e dos dados de tempo da fonte. O cálculo reutiliza o processador da Sprint 2 e adapta a regra de performance apenas para a Sprint 3.

## Aceite

| Item | Situação |
| --- | --- |
| Painel, matriz 3 × 4, barras de indicadores, memória de cálculo | Implementados. Sem leitura individual, as vagas exibem N/D |
| OEE, deduplicação e reset auditável | Validados com fixtures de teste. Produção real sem confirmação de dados suficientes |
| Comunicação com a bancada | GET no Node-RED comprovado. O contexto respondeu com OP, estados e última posição registrada |
| Gestor de estoque | GET da rota prevista preparado no servidor. O destino não respondeu na validação na bancada |
| App Shell, broker e ocupação física | Aguardam contrato aprovado, saída de telemetria e validação do G1/automação |
| Vercel e vídeo de OEE com produção real | Pendentes da integração e homologação |

### Evidência local em 18/11/2026

- Chrome na rede SMART 4.0. Duas consultas em `21:37:46` e `21:37:51` (horário de São Paulo) exibiram `OP1290` e posição registrada `2`. O gestor apareceu indisponível, as 12 vagas ficaram N/D e o OEE real permaneceu N/D.
- No modo de desenvolvimento, a fixture mostrou OEE **70%**, disponibilidade **80%**, performance **100%**, qualidade **87,5%** e **6,7 peças/min**. O reset registrou autor e horário, zerou o total anterior de oito peças e preservou a matriz. A tela coube em 360 px sem rolagem horizontal.
- O endpoint local recusou POST com `405` e uma origem externa com `403`. As consultas ao Node-RED e gestor são GET.
- O módulo ESM compilado montou em um host de teste no Chrome, recebeu replay por `smart40:telemetria`, exibiu OEE de 70% e 12 vagas, e desmontou sem abrir sockets. O build não contém os controles de desenvolvimento.
- `npm test`: 68 aprovados. `npm run test:e2e`: 4 aprovados. ESLint, TypeScript e build Vite aprovados.

### Verificação das melhorias de ocupação e contadores

- Na bancada, `/settings` e o contexto do Node-RED responderam. As tags `opPosicao1` e `opPosicao12` retornaram `undefined`, e as duas rotas do gestor expiraram. A leitura local continuou exibindo OP 1290 e última posição registrada 2, com ocupação do gestor indisponível.
- No Chrome, com gestor isolado e replay, a matriz marcou uma divergência entre vaga física livre e registro ocupado. Os contadores mostraram N/D na referência inicial, OEE de 70% no delta e N/D na troca de época. Após confirmação auditada, a próxima janela apresentou OEE de 80%.
- Com as melhorias, passaram 71 testes, 4 testes de integração, lint e build.

### Estabilização de 25/11/2026

O [relatório](../../docs/estabilizacao-sprint3/01-RELATORIO-IMPLEMENTACAO.md), a [matriz de aceite](../../docs/estabilizacao-sprint3/02-MATRIZ-DE-ACEITE.md) e os [resultados atuais](../../docs/estabilizacao-sprint3/05-RESULTADOS-DOS-TESTES.md) substituem os números históricos acima para esta revisão. O [guia para G1](../../docs/estabilizacao-sprint3/03-INTEGRACAO-GRUPO1.md) contém payloads completos e o [roteiro da bancada](../../docs/estabilizacao-sprint3/04-ROTEIRO-BANCADA-25-11.md) concentra as ações físicas pendentes. As capturas de 25/11 são de testes locais sintéticos, sem homologação industrial.
