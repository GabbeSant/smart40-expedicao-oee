# Blueprint de dados · Grupo 5 · aula 2

## Origem

Esta entrega funciona isoladamente com mocks locais. `src/mocks/telemetryMock.ts` fornece seis cenários; `src/domain/expedition.ts` controla sua evolução. O módulo não consome eventos externos nem abre WebSocket nesta etapa.

`TelemetriaSmart40`, em `src/types/smart40.ts`, é o modelo **local da demonstração**, não um contrato de integração aprovado. O evento/tipo auxiliar remanescente nesse arquivo fica reservado para trabalho futuro; não é usado pelo painel.

O contrato preliminar `docs/contrato-smart40-v0.1.ts` contém envelopes como `expedition.metrics` e `command.requested`, distintos do objeto local. A integração futura exigirá um adaptador e validação do payload, sem tratar esses formatos como equivalentes.

## Indicadores e premissas

| Indicador | Origem ou cálculo |
| --- | --- |
| Total processado | Aprovadas + rejeitadas no turno didático |
| Qualidade (%) | Aprovadas / total × 100 |
| Refugo (%) | Rejeitadas / total × 100 |
| Disponibilidade (%) | Parâmetro simulado, não medição de tempos reais |
| Performance (%) | Parâmetro simulado, não medição de ciclo real |
| OEE (%) | Disponibilidade × performance × qualidade / 10000 |
| Ritmo nominal | Parâmetro de 12 peças/min; 1 peça por intervalo de 5 s enquanto a simulação está ativa |
| MTBF | Não disponível: faltam tempos operacionais e registros de falhas |

Sem peças, a interface apresenta OEE/qualidade como “sem amostra”. Disponibilidade e performance são exibidas como premissas. Os limites de OEE ≥ 85% e refugo ≤ 5% são referências didáticas escolhidas para demonstrar alertas; não são limites homologados da planta.

## Transições da simulação

- Inicia pausada. O botão de avanço manual produz uma peça sem iniciar o temporizador.
- Operação normal rejeita a cada 20 novas peças; refugo elevado rejeita a cada 4. Essa sequência é determinística.
- Cada peça incrementa o total e exatamente um contador de aprovação/rejeição. Qualidade e OEE são recalculados.
- Uma aprovada incrementa a ordem ativa. Ao alcançar a meta, essa ordem conclui e a primeira aguardando torna-se ativa. Sem ordens ativas, a produção para.
- Aprovadas entram no palete até a capacidade. O excedente entra na fila. Rejeitadas não entram nas ordens/paletes.
- Liberar um palete exige confirmação e pelo menos uma peça. A linha em manutenção bloqueia essa ação. Registra-se quantidade, destino e horário; o próximo palete recebe até sua capacidade a partir da fila, preservando o excedente.
- Abertura de modal suspende o temporizador. Cancelar não altera os dados. Ao fechar, a simulação retoma se estava ativa.
- Trocar cenário/reiniciar limpa saídas, contador de passos e temporizador. Recarregar também descarta a sessão.

O histórico de 08h a 14h representa um turno **didático**, não o relógio da máquina. As novas peças entram na última faixa (13h–14h). A soma das barras corresponde aos contadores do cenário.

## Limites desta entrega

O mock Node do professor não fornece ordens, paletes, histórico ou todos os componentes do OEE exigidos pelo modelo local. Portanto não deve ser conectado diretamente à interface esperando equivalência. Quando a integração começar, separar os campos disponíveis dos demonstrativos, tratar indisponibilidade e validar todos os campos usados.

Não há persistência, conexão real, leitura de sensores ou envio de comandos. O simulador do navegador usa intervalos, sujeitos à limitação de timers em abas em segundo plano; não mede produtividade real.
