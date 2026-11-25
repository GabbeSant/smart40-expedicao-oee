# Estabilização da Sprint 3 — implementação

Data: 25/11/2026, America/Sao_Paulo. Grupo 5, Planta N2. Referência principal: `Frontend DOCS/Sprint3_Grupo5.pdf`, pp. 5–9. Esta sessão foi executada fora da rede industrial.

## Estado inicial

- Checkout limpo em `consolidacao-sprint2`, HEAD `7968a14f1c6f5d92c55e94c02e64d8911ef3b67c`. `git ls-remote` confirmou o mesmo commit no remoto.
- Branch local criada: `estabilizacao-sprint3`. Não houve reset destrutivo, descarte de mudanças, merge, push ou deploy.
- Linha de base: 71 testes unitários, 4 testes integrados, lint e build aprovados. Node local 24.22.0.
- A implementação anterior já continha painel, três fatores, magazine, observações de bancada e deltas de contadores. O trabalho preservou essa base.
- `build:release` compilava somente processamento; Vercel publicaria `release/` sem a interface da Sprint 3. READMEs e ponto de retomada ainda descreviam a entrega somente sem tela.

Foram lidos o PDF, guia da Sprint 3, READMEs, ponto de retomada, auditoria anterior, código em `src/sprint3`, processamento, integração, testes, mapa de tags e configurações de build/CI. O Drive complementar não foi necessário. O repositório G1 foi consultado em cópia separada ignorada pelo Git, sem modificações.

## Correções e arquivos

| Arquivos | Alteração e motivo |
| --- | --- |
| `FrontEnd/src/sprint3/mfe.tsx` | Monta um filho próprio em Shadow DOM, preserva os elementos do host, recusa montagem duplicada e remove o filho no unmount. `flushSync` deixa os listeners prontos quando mount resolve. Callback opcional `onReset` informa a sessão ao host. |
| `FrontEnd/src/sprint3/binding.ts` | Centraliza os quatro listeners de telemetria/conexão e a limpeza. Não cria socket nem timer. |
| `FrontEnd/src/sprint3/session.ts` | Reconhece estados de conexão do G1 e alias G5; marca fonte vencida após 15 s; valida resultados numéricos finitos; alinha o início dos contadores v1 à primeira referência. Auditoria inclui estado anterior completo. |
| `FrontEnd/src/sprint3/cumulative.ts` | Expõe contagens e tempos anteriores para auditar a época encerrada, inclusive durante suspensão por mudança de época. |
| `FrontEnd/src/sprint3/Dashboard.tsx` | Mostra desconexão/reconexão, tempo produtivo e explicação dos fatores; informa a identidade declarada e armazenamento local da auditoria. Notifica o host somente após reset auditado. |
| `FrontEnd/src/sprint3/sprint3.css` | Preserva o tema; evita extravasamento de textos nas vagas em 360 px, destaca divergências e adiciona transição curta com respeito a movimento reduzido. |
| `FrontEnd/sprint3-bench.ts` | Uma resposta 401/403 tem prioridade no diagnóstico, mesmo se a outra rota do gestor responder. Chamadas continuam somente GET, com timeout, cache e credenciais no servidor. |
| `FrontEnd/vite.config.ts` | Gera manifesto de chunks para empacotamento explícito da Sprint 3. |
| `integration/package-artifacts.mjs` | Gera distribuição limpa com biblioteca/fluxos da Sprint 2 e somente a interface/árvore de assets da Sprint 3. Não publica a demonstração antiga, observações locais, configurações de bancada ou dependências. |
| `integration/verify-artifacts.mjs` | Verifica os 36 arquivos da distribuição, imports, assets, manifesto, configuração CORS e ausência de arquivos locais/controles de desenvolvimento. Normaliza caminhos Windows. |
| `integration/serve-release.mjs` | Preview local da distribuição, com MIME e headers do `vercel.json`, 404 para API local e proteção de caminhos. |
| `vercel.json`, `.vercelignore` | Mantêm build oficial e output `release`; explicitam métodos CORS de leitura e excluem ambientes, caches e materiais locais do upload. Nenhuma configuração externa alterada. |
| `package.json`, dois lockfiles | Acrescentam Playwright somente para testes e scripts de validação/preview. Vite e dependências compatíveis receberam correções; Node-RED tem mínimo 4.1.18 para impedir downgrade inseguro pelo auditor. |
| `.github/workflows/ci.yml` | Inclui a branch de estabilização, Node 24, lint, Chromium e testes de navegador, com upload das evidências sintéticas. Não executa deploy. |
| `.gitignore` | Ignora ferramentas temporárias e resultados brutos de navegador. |
| `FrontEnd/tests/sprint3*.test.ts` | Regressões de auditoria, conexão, alinhamento temporal, entradas inválidas e ponte HTTP do gestor. |
| `integration/browser/*`, `playwright.config.mjs` | Host entre origens, replay identificado como sintético e testes de navegação, recursos, UI, reset, cores, contadores e desempenho. |
| READMEs, `RETOMADA-TRABALHO.md`, guia da Sprint 3 e esta pasta | Corrigem instruções antigas e distinguem implementação local, teste sintético e homologação física. |

## Decisões

1. OEE segue pp. 5–6 e rubrica p. 9: disponibilidade × performance × qualidade. Performance da Sprint 3 é limitada a 100%; a biblioteca da Sprint 2 mantém sua regra anterior. Zero de denominador, insumo ausente ou entrada inválida não vira medição fictícia: aparece N/D.
2. Capacidade, critério e referência chegam por `criterios`. A primeira configuração válida é conservada na sessão; não há capacidade industrial padrão. Alterar a configuração requer nova sessão/replay, sem mudança estrutural no código.
3. Eventos normalizados precisam de identidade/inspeção explícita; flags, posição, OP retida e `n2.observation` não contam peças. A automação/G1 deve normalizar somente conclusão válida da estação 4. Os endereços ilustrativos do PDF não substituem o mapa observado.
4. Ocupação física e registro do gestor continuam fontes distintas. `null` é desconhecido; ausência numa lista parcial não significa livre. Comparação exige fontes recentes. `/api/blocks/2` não é interpretado como mapa completo: o formato real precisa ser confirmado.
5. Nenhum contrato compartilhado do G1 foi alterado. A extensão G5 implementada é proposta; o guia de integração informa os ajustes necessários.
6. O módulo usa o barramento do host. Ao desmontar, limpa recursos e conserva apenas o estado em memória da sessão; o host deve oferecer replay para os intervalos sem assinatura. Não mantém uma conexão em segundo plano.
7. `release/` é a distribuição oficial. `FrontEnd/dist` conserva também a demonstração anterior para verificação local e não é o diretório a publicar na Vercel. O export principal e manifesto anterior da biblioteca continuam compatíveis; `manifest.sprint3` é aditivo.

## Limitações e dependências reais

- Sem rede da planta nesta sessão: não foram confirmados sensores, produção real, credenciais do gestor, completions da estação 4 ou tags adicionais. Nenhum comando foi enviado a CLP, robô ou atuador.
- Professor: confirmar capacidade nominal, critério de inspeção, turno/tempo planejado e quais emergências compõem a parada. O painel não deriva tempos de desconexão do navegador.
- Automação/G1: fornecer tempos coerentes e confiáveis junto da produção. O painel usa `analysis.window` ou deltas temporais de `amostraAcumulada`; não presume que flags locais isoladas representem todas as paradas.
- Reset: autor declarado e registro no localStorage, sem autenticação ou armazenamento central. Recarga completa perde a sessão em memória e sua deduplicação; exige checkpoint/replay coordenado pelo host. Não se promete retomada durável industrial pelo painel isolado.
- Por peça, depois de reset o host precisa fornecer a nova janela temporal alinhada a `entry.at`, recebida em `onReset`. Contadores acumulados sincronizados são preferíveis quando a fonte mantém uma janela absoluta contínua.
- CI remoto, integração no Shell real e publicação ainda não executados. A configuração preparada não prova deploy aprovado.
- Auditoria de dependências: FrontEnd sem avisos após correções compatíveis; ferramentas da raiz ainda têm avisos associados sobretudo a Node-RED/npm incorporado e Aedes. As correções completas indicadas exigem versões principais novas. O Aedes é usado somente em testes locais; o runtime Node-RED continua em loopback e editor desabilitado por padrão. Isso não autoriza expor esses serviços publicamente. Detalhes no documento 05.

## Estado final

Software pronto para revisão e validação na bancada: painel, cálculo, reset, montagem, pacote, preview e suíte reproduzível. Evidências reais de execução estão no [documento 05](05-RESULTADOS-DOS-TESTES.md); o alcance acadêmico e os bloqueios físicos estão na [matriz](02-MATRIZ-DE-ACEITE.md). As capturas desta pasta são de testes sintéticos ou de produção sem telemetria, nunca de homologação industrial.

## Controle de versão

- `6478f86` — montagem, conexão, reset e regressões de domínio/HTTP.
- `884f022` — distribuição Sprint 2 + Sprint 3, configuração e dependências.
- `032ee3f` — navegador, host de integração e CI.
- A documentação e as capturas são registradas em commit próprio posterior aos três acima; `git log -4 --oneline` identifica a sequência completa.

Todos os commits permanecem locais. A próxima publicação é o push da branch para revisão e execução do CI remoto. Isso pode acionar integrações de preview existentes; não houve push automático. Deploy de produção exige autorização separada.
