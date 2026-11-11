# 02 — Inconsistências documentais

Referência: 11/11/2026. Os códigos L/D/G remetem aos nomes e links no [inventário](01-inventario-documental.md). Classificação distingue erro demonstrável, contradição entre fontes, hipótese de replanejamento e lacuna. Gravidade mede impacto potencial se a orientação for adotada; não afirma que o código atual reproduz o problema.

## Registro de achados

### INC-001 — Alta

**Natureza e confiança:** Erro técnico demonstrável · confirmado.

**Documentos envolvidos:** L08 FFE-Sprint2 p.9; L06 especificação p.4; L11 checklist pp.5–6,10.

**Evidência:** O exemplo usa aprovadas/total × 100; as outras fontes exigem Disponibilidade, Performance e Qualidade.

**Problema identificado:** A fórmula da Sprint 2 calcula o fator Qualidade e o chama de OEE.

**Impacto:** Indicador apresentado pode receber uma nota ou interpretação operacional incorreta.

**Possível interpretação:** O professor pode ter proposto simplificação didática; isso não transforma Q em OEE completo.

**Recomendação:** Confirmar a fórmula avaliada e os rótulos. Preservar Q separado de D×P×Q; na base já existem oeeSimplified e oee.

### INC-002 — Alta

**Natureza e confiança:** Contradição comprovada entre formatos; contrato oficial incompleto.

**Documentos envolvidos:** L06 p.4; L12 pp.3–4,9–10; L18 pp.3–4; L03; L20 p.4; L19!mock_server_smart40.js:37–72; FrontEnd/src/processing/contracts.ts:1.

**Evidência:** Há TelemetryData em inglês, MachineState reduzido, envelope v0.1, TelemetriaSmart40 em português, envelope escalar dos ZIPs e eventos v1 do G5. Juntas são tupla no L20 e objeto j1..j6 no simulador L19.

**Problema identificado:** O mesmo nome genérico de contrato não implica compatibilidade de campos, enums ou unidade.

**Impacto:** Módulos podem compilar isoladamente e falhar no Shell; tags escalares não se tornam eventos de peça automaticamente.

**Possível interpretação:** Parte são revisões/exemplos de etapas diferentes. Nenhuma evidência obtida aprova uma versão única final.

**Recomendação:** Obter contrato versionado do G1, fixtures de entrada/saída e mapa de conversão. Não renomear todos os modelos sem acordo.

### INC-003 — Alta

**Natureza e confiança:** Possível divergência ou mudança legítima de escopo · não verificada.

**Documentos envolvidos:** L02 p.12; L06 p.4; L08 p.9; L10 p.8; G01:5–7; G04:9.

**Evidência:** Os PDFs descrevem dashboard/cartões/gráficos do G5. O README afirma orientação verbal anterior para processamento sem tela.

**Problema identificado:** A dispensa de interface não está comprovada por ata, mensagem original do professor ou documento aprovado acessível.

**Impacto:** Uma biblioteca tecnicamente adequada pode não satisfazer 30% de funcionalidade e 15% de UX da rubrica original.

**Possível interpretação:** Pode ser redistribuição legítima: G5 processa e G1 apresenta. O relato dos autores não basta para confirmar.

**Recomendação:** Solicitar confirmação escrita de quem entrega UI, gráficos, relatório e evidência de demonstração. Não iniciar nova UI antes dessa decisão.

### INC-004 — Alta

**Natureza e confiança:** Possível mudança legítima de escopo; decisão incompleta.

**Documentos envolvidos:** L20 pp.1–5 versus pp.6–10; L15 pp.1,8; L17 pp.1,16–17.

**Evidência:** A primeira parte mantém Node-RED, Loja e Elipse; a segunda recomenda substituição por APIs próprias. L15 mantém fluxo completo local; L17 mantém apenas agente S7.

**Problema identificado:** Existem caminhos alternativos de arquitetura apresentados como recomendações fortes, sem ADR de escolha.

**Impacto:** Risco de reescrever sistemas fora do G5 ou manter dois agentes com o mesmo token, derrubando conexões um do outro.

**Possível interpretação:** São opções pedagógicas, não obrigação cumulativa de executar todas.

**Recomendação:** Professor e G1 escolhem um caminho; atribuir MES ao G5 ou G1 e estabelecer um publicador por unidade.

### INC-005 — Alta

**Natureza e confiança:** Divergência documental comprovada; situação da rede atual não verificada.

**Documentos envolvidos:** L11 pp.1–2,5–6; L13 p.20; L20 pp.1–2; D03 endpoints S7.

**Evidência:** Checklist apresenta rede 192.168.0.x e servidor OEE :8084; manual e fluxos usam 192.168.150.x, CLP expedição .40:102 e notebook .200.

**Problema identificado:** IPs/portas de desenvolvimento, serviços sugeridos e equipamentos físicos estão misturados.

**Impacto:** Copiar o checklist literalmente pode apontar o cliente para uma rede/serviço que não corresponde à bancada.

**Possível interpretação:** 192.168.0.x pode ser desenho ilustrativo. Não foi demonstrada existência dos endpoints /api/metrics ou /oee-stream.

**Recomendação:** Registrar matriz ambiente→host→porta→protocolo→dono. Validar rede com o técnico, sem deduzir que porta 8084 implica API de métricas.

### INC-006 — Crítica

**Natureza e confiança:** Erro de orientação técnica e informação incompleta · confirmado no texto.

**Documentos envolvidos:** L20 p.9; L09 pp.3–4; L05 pp.17–18; L18 pp.7–9; D07 folha 3.

**Evidência:** Alguns exemplos aceitam EMERGENCY_STOP sem validar origem e escrevem bits; o runbook distingue emergência web de segurança física; o esquema contém circuito/relé de segurança.

**Problema identificado:** Aceitar comando remoto sem autenticação não demonstra segurança funcional nem substitui a parada física. O exemplo escreve tags ilustrativas, sem semântica homologada.

**Impacto:** Disponibilidade e integridade da bancada podem ser afetadas se exemplos forem adotados como procedimento real.

**Possível interpretação:** A intenção didática é priorizar parada, mas a fronteira entre comando supervisório e circuito de segurança foi mal definida.

**Recomendação:** Submeter qualquer comando ao responsável OT e ao G2/G1. G5 deve entregar processamento observacional. Nenhum comando físico foi testado aqui.

### INC-007 — Alta

**Natureza e confiança:** Contradição entre segurança descrita e exemplo · confirmada.

**Documentos envolvidos:** L08 pp.3–4; L12 pp.4–5; L05 pp.2–5; L17 pp.2–4; L19!mock_server_smart40.js:88–116.

**Evidência:** Descrição exige autenticação/Origin e isolamento; broker impresso aceita tokens literais, registra o token e encaminha qualquer mensagem de grupo como comando. O mock verifica Origin com prefixo/substrings.

**Problema identificado:** Checar um token de exemplo não equivale a autorização por ação; faltam validação de payload e política precisa de origem. x-api-key no handshake do navegador também não pode ser definido pelo construtor WebSocket padrão.

**Impacto:** Risco de acesso indevido, vazamento em logs e incompatibilidade entre o browser e o método de autenticação escolhido.

**Possível interpretação:** Podem ser demos locais; precisam ser explicitamente limitadas a esse uso.

**Recomendação:** Definir autenticação/ACL por papel e unidade no G1 e comparação exata de origens; nunca carregar tokens de escrita no frontend. Não reproduzir segredos dos materiais.

### INC-008 — Alta

**Natureza e confiança:** Erro técnico demonstrável · confirmado por inspeção estática.

**Documentos envolvidos:** L05 pp.10–12,22–24.

**Evidência:** leitores/elipse.js repete LeitorCLP, mas agente.js importa lerPedidoAtual; db.js contém SQL, enquanto server.js importa db.

**Problema identificado:** Os módulos impressos não fornecem os exports que o restante do exemplo exige; SQL não constitui módulo JavaScript válido.

**Impacto:** O exemplo não inicia se copiado literalmente como projeto ESM.

**Possível interpretação:** Erro de montagem/cópia do PDF, não uma arquitetura alternativa válida.

**Recomendação:** Professor deve fornecer artefatos corrigidos. A implementação da base separa driver, SQL e repositório e não reproduz esses blocos.

### INC-009 — Alta

**Natureza e confiança:** Erros técnicos demonstráveis · confirmados por inspeção estática.

**Documentos envolvidos:** L17 pp.5–8; L05 pp.21–28.

**Evidência:** FK de eventos aponta para ordens; registrar insere evento antes de criar ordem. A rota /order/:trackingCode precede /order/current.

**Problema identificado:** Primeiro evento de uma ordem nova viola FK; a rota dinâmica captura current no roteamento sequencial descrito.

**Impacto:** Falha na gravação inicial e leitura de ordem corrente incorreta.

**Possível interpretação:** Não há evidência de criação prévia obrigatória das ordens; o próprio exemplo cria a ordem depois.

**Recomendação:** Corrigir o exemplo e documentar criação/idempotência. Na base, repository.mjs:35 cria o pai e http.mjs:54 registra consultas estáticas antes da variável.

### INC-010 — Alta

**Natureza e confiança:** Informação incompleta · confirmada.

**Documentos envolvidos:** L06 p.4; L11 pp.5–6; L17 pp.11–14; L13 pp.205–211; D01 schemas de eventos.

**Evidência:** O agente transmite estado, magazine e pedidoAtual. O MES registra eventos de ordens. Não estão definidos tempos planejados/operação, ciclo ideal aprovado, qualidade por peça e janela de apuração.

**Problema identificado:** Esses dados não bastam para OEE completo, MTBF, perdas e produção por turno.

**Impacto:** É impossível validar OEE operacional apenas com as mensagens mostradas; uma ordem não equivale a uma peça aprovada.

**Possível interpretação:** O contrato pode precisar de eventos do G4 e parâmetros do professor/automação ainda não anexados.

**Recomendação:** Definir insumos, unidade, responsável e política de ausência. A base usa null para OEE sem tempos; não preencher lacunas com zero ou dados mock.

### INC-011 — Alta

**Natureza e confiança:** Possível divergência de critério e informação incompleta.

**Documentos envolvidos:** L11 pp.6,9–11; L08 p.3; L17 p.16; FrontEnd/src/processing/appShell.ts:35; processor.ts:27.

**Evidência:** Checklist exige atualização <100 ms, fallback <200 ms e reconexão <3 s; Sprint 2 publica a cada 500 ms; Caminho A permite reconexão até 30 s. A biblioteca usa refresh padrão 1 s e stale 15 s.

**Problema identificado:** SLAs de documentos diferentes não têm a mesma fronteira de medição. Publicação a cada 500 ms não invalida, por si, processamento <100 ms após receber o evento.

**Impacto:** Avaliação pode reprovar resiliência/latência mesmo com CI verde.

**Possível interpretação:** <100 ms pode medir só evento→render, enquanto 500 ms mede amostragem; <3 s e até 30 s permanecem metas diferentes.

**Recomendação:** Definir início/fim, percentil, carga, relógio e ambiente de cada medição. Não afirmar desempenho físico com base em teste unitário.

### INC-012 — Média

**Natureza e confiança:** Divergência de cronograma comprovada; prioridade oficial indefinida.

**Documentos envolvidos:** L06 p.5; L12 pp.2,5; L04 pp.1,7–10; L18 pp.1,5.

**Evidência:** Especificação/guia organizam seis semanas; cronograma define oito semanas de 30/09 a 24/11 e extensão proposta até 09/12; Sprint1 dura dez dias úteis com datas a definir.

**Problema identificado:** Não há calendário único aprovado nem prazo inequívoco da Sprint2.

**Impacto:** Planejamento de integração e evidências pode usar data errada.

**Possível interpretação:** São níveis de detalhamento/replanejamentos possíveis. Documento mais novo não é automaticamente superior.

**Recomendação:** Confirmar calendário com professor. Em 11/11, o plano datado situa integração em 04–17/11 e teste físico em 18–24/11; extensão não está concedida.

### INC-013 — Alta

**Natureza e confiança:** Alegação de homologação sem evidência · confirmada no documento, validade não verificada.

**Documentos envolvidos:** L11 pp.10–11, seção5.

**Evidência:** A matriz já imprime Aprovado em todos os requisitos e conclui homologação para produção industrial.

**Problema identificado:** Não há nessa matriz medições, execução identificada, versão testada, responsável ou assinatura que comprovem os resultados.

**Impacto:** Um modelo de checklist pode ser confundido com aceite já obtido ou certificação industrial.

**Possível interpretação:** Pode ser exemplo preenchido; não é evidência suficiente de aprovação deste repositório.

**Recomendação:** Reclassificar como modelo e solicitar resultados reais por SHA, data, cenário e responsável. Não transportar o rótulo Aprovado para a matriz da auditoria.

### INC-014 — Alta

**Natureza e confiança:** Erros técnicos demonstráveis em material de exemplo · confirmados estaticamente.

**Documentos envolvidos:** L01!Buffer.py:33–37,54–56; Orquestrador.py:39,58–60; configuração YAML:18–34; L14 estrutura do ZIP.

**Evidência:** next_sequence usa MAX(seq) da fila; acknowledge apaga a linha. tags está fora de opcua no YAML, mas coletor recebe cfg['opcua'] e espera cfg['tags'] nesse objeto. O ZIP monorepo referencia pacotes/schema que não contém.

**Problema identificado:** Sequências podem reiniciar após esvaziar a fila; configuração não corresponde à leitura; pacotes são esqueletos, não execução pronta.

**Impacto:** Perda de deduplicação após reinício e falha de configuração/importação.

**Possível interpretação:** Exemplos incompletos podem exigir montagem externa não documentada.

**Recomendação:** Não adotar esses anexos como contrato/runtime homologados. Corrigir num lote próprio, com confirmação de escopo; nada foi modificado.

### INC-015 — Alta

**Natureza e confiança:** Erros técnicos demonstráveis em material de exemplo · confirmados estaticamente.

**Documentos envolvidos:** L16!subscription.js:4–5,24; wsBridge.js:68–73; package1.json:6; árvore do ZIP.

**Evidência:** subscription usa AttributeIds sem importar. Quando o buffer está cheio, wsBridge remove o mais antigo e não acrescenta o evento novo. O manifesto se chama package1.json e aponta para src/index.js ausente no ZIP.

**Problema identificado:** O pipeline entregue não é executável como está e sua política de retenção não corresponde ao comentário.

**Impacto:** ReferenceError ao construir monitoramento e perda adicional de eventos sob desconexão.

**Possível interpretação:** Pode ser coleção de trechos que deveria ter passado por montagem/revisão.

**Recomendação:** Solicitar pacote de referência coerente; não confundir esse gateway com implementação da biblioteca atual do G5.

### INC-016 — Alta

**Natureza e confiança:** Divergência comprovada entre backups e contrato MES.

**Documentos envolvidos:** D02 NODERED/flows.json; D03 NODERED-BKP/flows.json; L13 pp.207–211; integration/api-mes/repository.mjs:13–18.

**Evidência:** D02 tem uma aba/191 nós; D03 tem dez abas/538 nós. Em D03, função f4e9b03da0bda32c envia componentId: 5 ao HTTP 5a509dc796482c9f (/api/Events/order/movedout). Outra função de completed usa 4.

**Problema identificado:** O arquivo de nome mais simples não é o fluxo completo da bancada; a saída com componentId: 5 conflita com as quatro estações descritas e será recusada pela nova API.

**Impacto:** Escolha errada de backup omite expedição; migração literal rejeita parte dos eventos.

**Possível interpretação:** O5 pode ser remanescente de configuração antiga; o Swagger não limita por enum esse campo, portanto rejeição pelo Elipse antigo não foi comprovada.

**Recomendação:** Automação confirma backup e IDs canônicos; mapear nós antes de portar. Não alterar o fluxo ativo durante esta auditoria.

### INC-017 — Média

**Natureza e confiança:** Endpoint presumido e terminologia inconsistente.

**Documentos envolvidos:** L09 p.3; L05 p.7; L13 pp.196,206–211; D01 paths; D06.

**Evidência:** Exemplos usam :4321/api/Events/order/current; o manual separa portal4321 de servidor5678, e o Swagger fornecido não contém /api/Events/order/current nem /api/Events/metrics.

**Problema identificado:** Consulta corrente/métricas da API própria é apresentada perto de chamadas ao Elipse e pode parecer rota nativa existente.

**Impacto:** Cliente pode apontar ao portal errado ou receber404; substituição parcial não é equivalência da API F4 inteira.

**Possível interpretação:** São extensões da API nova; o material G1 já admite que a rota depende de validação.

**Recomendação:** Documentar baseURL por serviço e quais rotas são novas. Não atribuir a G5 substituição completa de todas as rotas F4.

### INC-018 — Média

**Natureza e confiança:** Divergência de ambiente e documentação desatualizada.

**Documentos envolvidos:** L18 p.3; L08 p.3; G01:15; G08:43; package.json:5; .github/workflows/ci.yml:18; L13 pp.197–198.

**Evidência:** Materiais sugerem Node 20; a base exige 22.18+. G01 sugere 24 para Vite, embora lockfile aceite 22.12+ e CI 22 tenha passado. G08 ainda diz status sem documentação, mas manual e Caminho A documentam 1/2/3.

**Problema identificado:** Recomendações de ambiente e pendências históricas não refletem integralmente a base e as fontes disponíveis.

**Impacto:** Onboarding confuso e trabalho repetido; não há prova de incompatibilidade atual das dependências.

**Possível interpretação:** Parte da documentação preserva o estado de etapas anteriores.

**Recomendação:** Consolidar um guia de execução por artefato e revisar pendências. Node 22 do CI está comprovado; não acusar dependências de obsolescência sem evidência.

## Referências externas usadas para conferir conceitos

A fórmula de OEE completo e seus fatores foi confrontada com a documentação do fabricante [Siemens — OEE Standard Formulas](https://docs.industrial-operations-x.siemens.cloud/r/en-us/insights-hub-oee/oee-basics/oee-standard-formulas/oee-standard-formulas). A proporção de aprovadas é Q; não incorpora perdas de disponibilidade e desempenho. Essa conferência não define os tempos ou a regra acadêmica que o professor escolherá.

O construtor WebSocket do navegador aceita URL e protocolos, sem parâmetro para cabeçalhos arbitrários; por isso a exigência literal de x-api-key precisa de outra solução acordada. [MDN — WebSocket()](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/WebSocket).

## Questões que não são contradições por si sós

- React, Vue e Svelte são opções sugeridas; a escolha de React no G5 não é defeito.
- Monorepo é organização do código; Single-SPA, Module Federation e Web Components tratam composição. Podem coexistir, mas não há motivo para exigir todas as opções simultaneamente.
- Magazine físico de 12 posições e palete didático de 50 peças medem entidades diferentes. A premissa de lote do protótipo precisa ser homologada; os números, isoladamente, não se contradizem.
- Sprint1 com mock e teste físico na fase final são etapas distintas. Não conexão à máquina na Sprint1 é limite explícito, não falha de entrega.
- MQTT, SQLite, PostgreSQL e Node-RED aparecem como exemplos/caminhos. Não se tornaram, todos, obrigações exclusivas do G5 por estarem anexados.

