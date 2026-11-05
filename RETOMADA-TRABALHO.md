# Ponto de retomada — SMART 4.0 / Grupo 5

Registro de fechamento de 04/11/2026 para o próximo dia de trabalho.

## Onde estamos

O Grupo 5 entrega **processamento de expedição e indicadores, sem tela própria**, conforme a orientação mais recente do professor informada pelo usuário. O dashboard React existente continua como demonstração anterior; a biblioteca de entrega funciona sem React.

Repositório: `https://github.com/GabbeSant/smart40-expedicao-oee`.
Branch de trabalho e destino do envio: **`consolidacao-sprint2`**. O commit que contém este arquivo reúne o código, testes, configurações e documentação desta sessão. Consultar `git log -1` para identificar a revisão e verificar o GitHub Actions antes de considerar o CI remoto aprovado.

A base veio da branch `teste`. A `teste2` foi inspecionada e reaproveitada seletivamente, sem importar aplicações duplicadas. Não foi feito merge na `main`.

## O que está implementado

| Parte | Estado |
| --- | --- |
| Biblioteca TypeScript | `FrontEnd/src/processing`, com contratos, validação, deduplicação, expedição e snapshots para o Grupo 1 |
| Indicadores | Produção, aprovadas/rejeitadas, qualidade, PPM móvel de 60 s, OEE completo e `oeeSimplified` do exemplo da sprint |
| Persistência/reset | Checkpoint, restauração sem recontar peças e reset da análise preservando identidades e posições |
| Barramento do projeto | Consumo de `smart40:telemetria`; `dispatchSmart40Telemetry` separa eventos G5 dos snapshots dos demais módulos |
| Ordens REST | GET `/api/productionOrders`, timeout/cancelamento, preservação do catálogo em falha e suporte a `status_id` |
| Associação da OP do CLP | `resolveN2ProductionOrder`: resolve pelo código/trackingCode, não pelo número id da API |
| Node-RED de referência | Fluxo sem tela, MQTT, snapshots, WebSocket, diagnóstico e armazenamento local |
| Saída para a nuvem | Ponte WSS com token, TLS, reconexão, heartbeat e fila pendente em disco; MQTT de nuvem também configurável |
| API MES opcional | Cinco eventos e três consultas, PostgreSQL, transações, idempotência, autorização e isolamento por unidade |
| Inspeção da bancada | `npm run plant:inspect`, usando somente GET e assinatura do status S7 |
| Entrega/build | Biblioteca ESM e declarações em `release/`, fluxos JSON exportáveis e manifesto |
| Automação | Workflow GitHub Actions, configuração estática Vercel, Compose e Blueprint opcional da API MES para Render |

## O que foi verificado na bancada

O acesso funcionou depois de conectar o Wi-Fi à rede **`Smart 4.0 (3)`**. O computador recebeu `192.168.150.105/24` no Wi-Fi; a Ethernet manteve `10.104.13.169`. Esses endereços do computador podem mudar na próxima sessão.

| Recurso | Endereço / resultado observado |
| --- | --- |
| Node-RED da bancada | `http://192.168.150.200:1880`, versão **3.0.2** |
| CLP de expedição | `192.168.150.40:102`, S7 ISO-on-TCP, rack 0 / slot 1 |
| Leitura existente | Status **online** no Node-RED; ciclo configurado de 200 ms, entrada com `diff: true` |
| Mapa configurado | **59 tags** em DB9 e DB103, salvas em `integration/plant/n2-expedition-tags.json` |
| API de ordens | `http://192.168.150.200:5678/api/productionOrders`, **168 registros** na inspeção |
| MQTT já existente na bancada | `mqtt.tago.io:1883`, tópico `smart40`; configuração preservada, sem publicação adicional nessa conta |

**Associação observada:** o CLP informou número de OP `1255`; a API retornou `code: OP1255`, `trackingCode: OP1255` e **`id: 710`**. A última posição armazenada observada foi `9`. O status da API era `3`; esse número retido no CLP não prova que a ordem ainda esteja em produção.

Foi feito um teste com dados reais: leitura do Node-RED → publicação de `n2.observation` → broker MQTT temporário em localhost. O broker de teste foi encerrado ao terminar. A sessão não instalou nós nem fez deploy nos fluxos da bancada, e não enviou comandos ao CLP.

## Validação concluída

Última execução completa: **67 testes aprovados**, sendo 63 na suíte do projeto e 4 de integração. O build da biblioteca e o pacote de entrega passaram; a demonstração React também compilou na sessão.

Os testes integrados usam Node-RED real, brokers locais, MQTT, WSS com certificado/token e PostgreSQL embarcado PGlite. Foram verificados reinício, duplicatas, fila WSS, transações, rollback e isolamento. O PostgreSQL externo da turma e os serviços reais de nuvem ainda não foram configurados.

## O que ainda NÃO está concluído

1. **Coleta contínua de eventos físicos por peça.** A inspeção atual lê valores já disponíveis no contexto do Node-RED. Ainda não existe emissão homologada de identidade da peça, inspeção, OP e movimentações para alimentar a biblioteca continuamente.
2. **Qualidade e tempos reais.** Faltam resultado de inspeção por peça, tempo planejado, tempo de operação e ciclo ideal confiável. OEE completo permanece indisponível quando esses insumos faltam.
3. **Contrato efetivo do Grupo 1.** Obter `contrato-global.ts`, confirmar unidade/ativo, nomes de campos e a forma de consumir os resultados. A conexão central continua pertencendo ao Shell.
4. **Definição da arquitetura de publicação.** O Caminho A dos PDFs usa agente Node.js/S7 e broker WSS; o pedido do usuário inclui Node-RED/MQTT. A ponte entregue é uma adaptação. Definir quem será o único publicador da unidade e onde rodará o processamento.
5. **Serviços reais.** Faltam URL/token do broker, destino do Shell, definição de quem hospeda a API MES e PostgreSQL com credenciais apropriadas. As URLs e tokens dos PDFs são exemplos.
6. **Confirmação/replay de ponta a ponta.** A fila WSS melhora a retomada, mas o broker dos PDFs não fornece ACK de aplicação. O callback de envio do socket não comprova processamento no destino.
7. **Aceite integrado.** Rodar com a bancada, testar desconexão/religamento do notebook, conferir as contagens com o processo físico e verificar o CI remoto. Publicar os serviços nos projetos confirmados.

## Cuidados para a próxima sessão

- **`n2.observation` não é evento de produção.** O contexto global não tem timestamp de origem e as leituras não são atômicas. A observação tem qualidade `UNCERTAIN` e `sourceTimestamp: null`; não deve incrementar produção nem ocupar o tópico `/telemetry`.
- Não deduzir peças produzidas a partir de `finishOP`, número de OP, posição do magazine ou quantidade de pedidos concluídos. Também não marcar automaticamente uma peça como aprovada.
- `oeeSimplified` é aprovadas/total, como no exemplo FFE p.9; `oee` é D×P×Q. Os dois campos têm propósitos distintos.
- Preservar a lógica existente da bancada. O Node-RED real é 3.0.2; os fluxos de referência do repositório usam `functionGlobalContext.expedition` preparado pelo runtime próprio, não estão prontos para importação sem adaptação em qualquer instância.
- Não usar o mesmo `TOKEN_AGENTE` em dois publicadores simultâneos: o broker descrito nos PDFs substitui a conexão anterior.

## Por onde começar no próximo dia

1. Ler este arquivo, conferir `git status` e o resultado do GitHub Actions da branch.
2. Manter a conexão de internet e conectar o Wi-Fi à `Smart 4.0 (3)` para acessar a bancada. Conferir novamente os endereços locais.
3. Executar `npm run plant:inspect` e conferir status S7, catálogo de ordens e associação da OP. A inspeção é de leitura.
4. Com o Grupo 1 e a automação, obter um exemplo real de evento de peça/inspeção e definir a saída observacional que o emitirá, sem alterar o controle da máquina.
5. Ajustar o adapter ao contrato combinado e testar produção/expedição com eventos reais identificáveis, incluindo repetição e reconexão.
6. Configurar os serviços reais somente depois de confirmar destinos, responsabilidades e credenciais; então realizar o aceite integrado e a publicação.

## Comandos úteis

Na raiz do repositório; no PowerShell desta máquina, usar `npm.cmd` se `npm.ps1` estiver bloqueado:

```sh
git status
npm test
npm run test:e2e
npm run build:release
npm run plant:inspect
```

Em outro checkout, instalar antes com `npm ci` e `npm --prefix FrontEnd ci`. O projeto usa Node.js 22.18+; nesta máquina o Node 26 executou os testes. Para a demonstração Vite, preferir Node 24+.

Comandos opcionais, que dependem de ambiente configurado: `npm run node-red`, `npm run demo:mqtt`, `npm run mes:migrate` e `npm run mes:start`. As configurações de exemplo ficam em `integration/node-red/.env.example` e `integration/api-mes/.env.example`.

## Arquivos para consultar

- [README](README.md): execução, biblioteca e integração com o Shell.
- [Entrega da sprint](ENTREGA-SPRINT2.md): processos, contratos e critérios de aceite.
- [Análise dos PDFs](ANALISE-PDFS-SPRINT2.md): decisões do Caminho A e correções dos exemplos.
- [Conexão da bancada](CONEXAO-BANCADA.md): evidências e limites da inspeção real.
- [API MES](integration/api-mes/README.md): rotas, ambiente, banco e publicação opcional.
- `FrontEnd/src/processing/`: implementação principal sem tela.
- `integration/plant/`: inspeção e mapa configurado da expedição.

Os documentos antigos de `FrontEnd/docs` são históricos e não foram usados como requisito desta entrega. Os PDFs originais estão em `C:/Users/Aluno/Downloads`, fora do versionamento. Backups completos dos fluxos, leituras brutas, caches, relatórios locais e pacote `.tgz` estão em `.work/`; essa pasta é ignorada pelo Git. `release/` é gerado pelo build e também é ignorado. Credenciais reais ficam em ambiente local, não no repositório.
