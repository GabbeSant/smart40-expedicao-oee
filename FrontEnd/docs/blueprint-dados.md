# Blueprint · Grupo 5 · simulação independente

## Origem e modelo

Os cenários em `src/mocks/telemetryMock.ts` são demonstrações locais. Não há API, servidor, WebSocket ou consumo do Shell. `TelemetriaSmart40` é o modelo da interface local; o contrato preliminar em `contrato-smart40-v0.1.ts` permanece reservado para a futura integração e não é tratado como equivalente.

`SimulationState` contém telemetria, ordens, lote em recebimento, fila por ordem, prateleira, saídas, movimentações e premissas do OEE. O reducer atualiza o conjunto de forma atômica; suas funções não alteram o estado anterior.

## Premissas do armazenamento

- Padrão: 12 posições em três linhas de quatro, configurável para 8, 16 ou 24.
- Referência visual: [simulador de outros alunos](https://smart40.vercel.app/). A capacidade não está homologada para esta turma.
- Cada posição recebe **um lote de até 50 peças**, da mesma OP/produto/destino. Essa capacidade também é uma premissa didática do nosso protótipo, não uma característica confirmada da bancada.
- O lote usa o identificador legado `PAL-xxx`; os nomes de campos `palete`/`release` são internos. `release` agora significa armazenar o lote identificado, e somente `ship` confirma a saída.
- Os cenários preenchidos incluem produção anterior ao início da demonstração. A prateleira e o histórico de saídas começam vazios; não reconstituem as saídas anteriores do turno.

## Fluxo

1. A OP possui código único, produto, meta inteira e destino. Entra na fila, ou torna-se ativa se não houver outra ativa.
2. Cada peça processada aumenta exatamente um contador: aprovada ou rejeitada. Apenas aprovadas incrementam a OP e seguem ao recebimento.
3. O lote em recebimento aceita peças da mesma OP, até a capacidade. Peças de outra OP ou recebidas após identificação vão para uma fila separada por ordem/destino.
4. Identificação RFID **simulada** fecha o lote. Não se adicionam novas peças a ele.
5. Armazenar exige lote identificado, posição livre e linha em operação. Ocupa-se a primeira posição livre, da esquerda para a direita e de cima para baixo.
6. O próximo lote recebe até 50 peças do primeiro grupo da fila, mantendo o excedente e sem misturar ordens.
7. Selecionar uma posição mostra OP, produto, lote, quantidade, destino e horário. Expedir exige confirmação, registra a saída e libera essa posição. Repetir a ação em uma posição vazia não duplica a saída.

Prateleira cheia bloqueia armazenamento; as peças continuam na recepção/fila. Manutenção bloqueia produção, identificação, armazenamento e expedição. A simulação pausa durante modais. Ao concluir a última OP, a execução automática para.

As movimentações registram recebimento, identificação, armazenamento e expedição. Uma transferência da fila para o lote também gera um registro de recebimento; esses eventos descrevem etapas, não devem ser somados como produção adicional.

## OEE didático

O formulário permite editar tempo planejado, paradas acumuladas e ciclo ideal. Os valores iniciais são deduzidos dos percentuais e contadores dos cenários para manter a coerência do mock; não são leituras de sensores.

| Indicador | Cálculo |
| --- | --- |
| Tempo operacional | Planejado − paradas |
| Disponibilidade | Operacional / planejado × 100 |
| Performance | Total × ciclo ideal / operacional × 100, limitada a 100% neste modelo |
| Qualidade | Aprovadas / total × 100 |
| Refugo | Rejeitadas / total × 100 |
| OEE | D × P × Q / 10000, usando componentes percentuais |
| MTBF | Indisponível: não há registros de falhas |

Cada nova peça acrescenta cinco segundos ao relógio didático do turno. Pausa e etapas logísticas não aumentam esses tempos; esse modelo não mede tempos reais de movimentação ou disponibilidade. A simulação automática avança uma peça a cada cinco segundos de navegador, sujeita ao atraso de timers em abas em segundo plano.

Sem peças, qualidade e OEE aparecem sem amostra; divisões sem denominador usam zero internamente. O histórico de 08h–14h é didático, e novas peças entram na última faixa. Referências de OEE ≥ 85% e refugo ≤ 5% servem apenas para os alertas.

## Persistência e relatórios

O estado é salvo no `localStorage`, chave `smart40-expedition-v3`, com versão de formato e validação na leitura. Ao recarregar, os dados retornam com a execução pausada. Uma sessão inválida usa um novo cenário e mostra aviso; falhas de salvamento são informadas sem impedir a demonstração.

Reiniciar ou trocar cenário substitui ordens, rack, fila e históricos salvos. Não há sincronização entre dispositivos/abas nem persistência em servidor. Armazenamento bloqueado ou limpeza dos dados do navegador pode apagar a demonstração.

CSV inclui indicadores, premissas, ordens filtradas com destinos, posições, movimentações e saídas. PDF usa a impressão do navegador. A origem simulada é preservada em ambos.
