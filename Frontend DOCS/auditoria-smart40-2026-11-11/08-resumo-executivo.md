# 08 — Resumo executivo

**SMART 4.0 · Grupo 5 · 11/11/2026.** O projeto tem uma base de processamento e testes aproveitável, mas **não há evidência suficiente de entrega integrada, OEE operacional ou homologação acadêmica concluída**. A auditoria possui cobertura parcial do acervo, com fontes essenciais pendentes.

## Estado atual e melhor base

Recomenda-se **consolidacao-sprint2**, commit [d7f1182](https://github.com/GabbeSant/smart40-expedicao-oee/commit/d7f11828d0304c1a1088309715d04b00ef8ec356). Contém os avanços de teste, separa biblioteca TypeScript da demonstração React e acrescenta validação, deduplicação, expedição, OEE/PPM, checkpoint, Node-RED/MQTT/WSS e API MES opcional.

Foram confirmadas **quatro branches remotas e duas locais**. A branch local ativa é a própria consolidação, sem commits exclusivos ou alterações pendentes. main preserva a demonstração anterior; teste é ancestral da consolidação; teste2 é experimento com dois projetos e receptor de snapshots. Não são cinco versões independentes. [Comparação e ancestralidade](03-analise-branches.md).

O [CI do SHA atual](https://github.com/GabbeSant/smart40-expedicao-oee/actions/runs/41947097185) passou em testes e builds. Em contraste, o [status remoto desse commit](https://api.github.com/repos/GabbeSant/smart40-expedicao-oee/commits/d7f11828d0304c1a1088309715d04b00ef8ec356/status) registra **falha em dois deployments Vercel**. O conector de inspeção retornou404 inclusive com o time confirmado; a causa das falhas permanece desconhecida.

## Descobertas e riscos principais

| Conclusão | Confiança / evidência | Efeito sobre a entrega |
| --- | --- | --- |
| Exemplo da Sprint2 chama Qualidade de OEE | Confirmada: L08 p.9 versus L06 p.4/L11 pp.5–6 | Confirmar fórmula da avaliação. Código separa oeeSimplified de D×P×Q; dados físicos para o segundo faltam |
| Entrega “sem tela própria” não tem confirmação original acessível | Não verificada: relato G01/G04 versus vários PDFs exigindo dashboard | Risco de atender biblioteca e deixar funcionalidade/UX avaliadas sem dono |
| Contrato da turma não foi obtido | Confirmada como lacuna: vários formatos, v1 marcado proposto | Impede certificar integração com G1, mesmo com testes locais de contrato |
| Produtor contínuo por peça não está concluído | Confirmada no código: Link In preparado, observação UNCERTAIN e sem timestamp de origem | OP, estado e magazine não comprovam peças boas/rejeitadas nem OEE real |
| Backup de automação difere substancialmente do arquivo raiz | Confirmada: D02 tem 191 nós/uma aba; D03 tem 538/dez abas | Usar arquivo errado omite expedição; componente5 de movedout será recusado pelo MES novo 1–4 |
| Há segredos embutidos no acervo Drive | Confirmada em URLs de nós D03; valores omitidos | Custodiante precisa resolver exposição antes de uso real; validade atual não testada |
| Durabilidade da cadeia é incompleta | Confirmada como limite: checkpoint, fila e send sem ACK/replay integral | Queda pode exigir retransmissão externa; QoS1 não garante processamento final |
| MTBF e comprovação de históricos/turnos estão pendentes | Confirmada no modelo/código e nas fontes | Manter no backlog obrigatório até professor dispensar ou aprovar definição |

Há **18 inconsistências registradas**, incluindo erros executáveis nos exemplos, divergência de rede/rotas, SLAs, calendário e homologação impressa sem medições. Esses defeitos dos materiais não foram automaticamente atribuídos ao código atual. [Achados documentais](02-inconsistencias-documentais.md), [arquitetura](04-arquitetura-e-qualidade.md) e [expedição/OEE](05-expedicao-oee.md).

## Cinco ações prioritárias

1. **Formalizar escopo e calendário com o professor:** tela, relatórios, MTBF, fórmula OEE, responsável MES e aceites.
2. **Fixar contrato e arquitetura com G1:** versão, fixtures, eventos/resultados, uma conexão central e um publicador por unidade.
3. **Homologar fontes físicas com automação/G4:** identidade, inspeção, OP, movimento, tempos/ciclo, unidade e timestamps; não deduzir peças de ordens.
4. **Obter logs e resolver a publicação da revisão:** confirmar o artefato esperado e comprovar sua importação no Shell.
5. **Tratar credenciais expostas com o custodiante:** resolver validade/rotação/distribuição sem copiar segredos para novos artefatos.

O [backlog de 20 tarefas](07-plano-de-continuidade.md) contém responsáveis propostos, dependências e critérios de conclusão:5 P0,7 P1,5 P2 e3 P3. São recomendações para nova etapa, sem execução durante a auditoria.

## Riscos acadêmicos e pontos desconhecidos

A rubrica obtida pesa 30% funcionalidade,25% integração,20% qualidade,15% UX e10% documentação/apresentação (L06 p.5). O maior risco é apresentar sucesso de testes como integração concluída ou adotar a dispensa de UI sem confirmação.

No cronograma datado, integração ocorre 04–17/11 e teste real18–24/11; extensão até 09/12 é apenas proposta. Outros guias usam seis semanas e o runbook deixa datas da Sprint1 a definir. Prazo oficial da Sprint2 e concessão da extensão são desconhecidos.

Também faltam o Shell/contrato final, endpoint e política do broker da turma, insumos reais de OEE/MTBF, definição de responsabilidade MES, PostgreSQL alvo e medições de latência/reconexão no ambiente real.

## Cobertura, confiança e preservação

| Medida | Resultado |
| --- | --- |
| Fontes documentais catalogadas por origem |144:20 locais,111 arquivos Drive e13 documentos Git |
| Fontes efetivamente examinadas |40:18 completas em texto e22 parciais |
| Drive ainda não processado |104 arquivos catalogados; 35 subpastas não expandidas.111 arquivos é mínimo conhecido, não total definitivo |
| Arquivos grandes/binários | RAR de 3,11 GB, instaladores, projetos TIA/robô, simulador e vídeo não executados/analisados integralmente |
| Código e branches |4 pontas remotas + estado local; 91 arquivos na base,117 blobs distintos nas pontas; núcleo lido, testes/diffs e demais arquivos inspecionados seletivamente |
| Requisitos/decisões |32:22 expressos documentalmente e10 incertos; 5 capacidades verificadas em CI,14 parciais,2 não implementadas,1 não verificável e10 indefinidas |
| Execução nesta auditoria | Nenhum script/teste/build do projeto, instalação, conexão física, merge, commit, push ou deploy |
| Preservação | HEAD/branches/status mantidos; 91 arquivos rastreados tiveram SHA-256 conferido entre o registro anterior à escrita dos relatórios e a verificação final, sem mudança |

Somente os oito relatórios Markdown foram criados em `D:\Projetos\devilman\auditoria-smart40-2026-11-11`, fora do repositório. Nenhum original local ou remoto foi editado. O inventário distingue leitura textual completa, OCR, seleção de páginas/código e itens não processados.

**Limite da conclusão:** estes relatórios encerram a investigação possível com o material examinado. Não constituem auditoria integral dos gigabytes do Drive, teste atual da bancada nem aceite final. Fontes essenciais pendentes estão identificadas; nenhuma implementação foi iniciada.

## Relatórios

[01 Inventário](01-inventario-documental.md) · [02 Inconsistências](02-inconsistencias-documentais.md) · [03 Branches](03-analise-branches.md) · [04 Arquitetura e qualidade](04-arquitetura-e-qualidade.md) · [05 Expedição e OEE](05-expedicao-oee.md) · [06 Requisitos](06-matriz-requisitos.md) · [07 Continuidade](07-plano-de-continuidade.md).

