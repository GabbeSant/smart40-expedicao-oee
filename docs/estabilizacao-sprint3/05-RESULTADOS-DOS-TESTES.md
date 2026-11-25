# Resultados reais dos testes — 25/11/2026

Ambiente local: Windows/PowerShell, Node **24.22.0**, Vite **8.3.8**, Node-RED de teste **4.1.18**, Playwright **1.65.1**, Chromium **159.0.8154.6**. Os comandos abaixo foram executados neste checkout. `npm.cmd` foi usado por compatibilidade com PowerShell.

## Linha de base e fechamento

| Verificação | Base `7968a14` | Resultado final |
| --- | --- | --- |
| `npm ci` | Instalação necessária | PASS, instalação limpa final; 343 pacotes adicionados, 539 auditados |
| `npm --prefix FrontEnd ci` | Instalação necessária | PASS, instalação limpa final; 161 pacotes adicionados, 162 auditados |
| `npm test` | 71 aprovados | **78 aprovados**, 0 falhas, 0 ignorados; 3,24 s no runner |
| `npm run test:e2e` | 4 aprovados | **4 aprovados**, 0 falhas, 0 ignorados; 4,73 s no runner |
| `npm --prefix FrontEnd run lint` | PASS | **PASS** |
| `npm --prefix FrontEnd run build` | PASS | **PASS**, TypeScript + Vite, 42 módulos |
| `npm run build:release` | Publicava somente Sprint 2 | **PASS**, biblioteca/fluxos e Sprint 3; 36 arquivos verificados |
| `npm run verify:release` | Inexistente | **PASS**, entradas, imports, assets, CORS e exclusões |
| `npx playwright install chromium` | Navegador não instalado | **PASS**, Chromium de testes instalado |
| `npm run test:browser` | Sem suíte reproduzível no repositório | **8 aprovados**, 0 falhas, 0 ignorados, 0 flaky; **18,52 s** |
| `git diff --check` | Limpo | PASS no fechamento |

Total final: **90 testes aprovados** (78 unitários/HTTP local + 4 integração + 8 navegador). Não houve remoção de testes nem enfraquecimento de critérios para obter aprovação.

A rodada final de navegador iniciou às **13h52min40s de São Paulo** (16:52:40 UTC). Logs brutos locais: `.work/final-unit-tests.log`, `final-integration-tests.log`, `final-lint.log`, `final-frontend-build.log`, `final-release-build.log`, `final-browser-tests.log`; relatório JSON em `test-results/browser-results.json`. Caches, logs e traces não entram na distribuição.

## O que foi exercitado

| Camada | Evidência |
| --- | --- |
| Cálculos e sessões | Três fatores, clamp de performance, PPM, zero/ausência/invalidade, baseline, deduplicação, épocas, janela temporal e reset com auditoria anterior. |
| Gestor intermediado | Servidores HTTP reais em loopback com fixtures: Basic somente no servidor, GET, rejeição de POST/origem externa, cache ≥30 s, 401, formato inesperado e timeout real de aproximadamente 2,5 s. |
| Runtime Sprint 2 | MQTT → Node-RED real → broker TLS autenticado local → WebSocket → binding Shell; reinício persistente/idempotente. Também WSS/outbox/bloqueio de comandos e API MES/PostgreSQL embarcado com transação/rollback. Tudo em laboratório local. |
| Standalone DEV | Alternância real/simulado, reset, 12 vagas e largura de 360 px sem rolagem horizontal. |
| Produção | `/` e `/sprint3.html` respondem com N/D sem telemetria; chave simulada e diagnóstico de bancada ausentes; API local retorna 404. |
| Módulo ESM | Host 4174 importa release 4173, CORS/MIME válidos, Shadow DOM protege host e painel; replay imediatamente após mount funciona. |
| Recursos | 15 ciclos de mount/unmount, estado preservado na navegação, host preservado, 0 listeners e 0 intervals após unmount, 0 WebSockets abertos pelo módulo. Mount duplicado é recusado. |
| Reset | Cancelamento mantém contagem; confirmação grava 8 peças e fatores anteriores antes de zerar, preserva 3 vagas ocupadas e notifica o host uma vez; replay não reconta. Falha de armazenamento mantém 8 peças e não notifica reset. |
| Conexão | Desconexão/reconexão preserva total; entrada simulada é recusada no modo real; após 15 s o painel avisa fonte vencida. |
| Contadores e cores | Primeira amostra N/D; faixas verde 85%, amarela 70%, vermelha 69,9%; mudança de época suspende OEE; reset preserva as contagens anteriores e próxima amostra retoma em 80% na fixture. |
| Desempenho visual | 20 envelopes a 10 Hz, contendo 40 eventos por peça/janela: **2 atualizações do DOM dos KPIs em 3 s**, limite de 3. O total chegou a 28 sem perda de eventos. Medição de cadência local, não benchmark industrial de latência. |

Os testes de navegador falham se houver erro de console ou exceção da página. Resultado final: nenhum erro observado. Avisos do runner sobre `NO_COLOR`/`FORCE_COLOR` não são erros da aplicação.

## Evidências salvas

- [Produção sem telemetria](evidencias/producao-sem-telemetria.png).
- [Replay sintético no host](evidencias/host-replay-sintetico.png).
- [Layout 360 px com replay sintético](evidencias/host-mobile-sintetico.png).
- [Reset auditado da fixture](evidencias/reset-auditado-sintetico.png).
- [Medição da frequência visual](evidencias/frequencia-renderizacao.json).

As capturas do host têm aviso explícito de **dados sintéticos**. O campo `origin: medido` da fixture serve para testar o canal de produção num host isolado. Isso não transforma os dados de teste em telemetria industrial. Nenhuma captura desta sessão comprova sensor físico ou produção real.

## Falhas encontradas durante a execução e tratamento

- O sandbox inicialmente impediu rede no npm/Git; os comandos foram repetidos com acesso autorizado e concluídos. Uma tentativa de e2e antes do fim da instalação não encontrou `tsc`; a linha de base e o fechamento foram executados com a instalação completa.
- O verificador novo detectou diferença de separadores Windows e distinguiu o chunk `Dashboard-*` da Sprint 3 do `dashboard-*` da demonstração antiga. A seleção final usa o manifesto Vite e preserva todas as dependências necessárias.
- O primeiro teste de clock fake instalava o relógio depois de a sessão capturar `Date.now`; a instalação foi movida para antes do mount, mantendo a exigência de aviso stale. A versão final passa.
- A captura de 360 px revelou texto de divergência extravasando uma vaga. Foi corrigido com quebra de palavras e novamente capturado.
- `npm audit fix` da raiz chegou a selecionar Node-RED 4.1.8. A mudança foi corrigida para mínimo 4.1.18, nova instalação limpa e suíte integral aprovada. Não foi usado `--force`.

## Dependências

FrontEnd: auditoria final da instalação limpa com **0 vulnerabilidades**. Root: **46 avisos (29 moderados, 17 altos, 0 críticos)** no fechamento. A maior parte remanescente envolve o npm incorporado do Node-RED e seus consumidores; Aedes também tem aviso alto e é usado somente nos testes de broker local. A correção completa apontada pelo auditor exige migrações principais, incluindo Node-RED 5 e Aedes 1, que não foram misturadas à estabilização acadêmica. Alguns pacotes incorporados não podem ser corrigidos automaticamente pelo npm externo.

Essas ferramentas não entram no diretório estático `release/`. O runtime Node-RED local deve manter seu isolamento padrão (127.0.0.1/editor desligado) até revisão própria de exposição. Não se afirma que o repositório inteiro esteja sem avisos de dependências. Os alertas não invalidaram a suíte funcional, mas permanecem uma limitação documentada.

## Verificações não executadas

BLOCKED por acesso/acordo externo: produção física, sensores das 12 vagas, posição real do atuador, inspeção/capacidade do professor, resposta do gestor industrial, identidade autenticada do operador, eventos reais pelo Shell e vídeo industrial. O G1 foi consultado no commit `1461a27`; não foi modificado nem executado nesta sessão.

Sem publicação autorizada: push, CI remoto, deploy Vercel e mudanças externas não foram executados. A configuração foi validada localmente; o preview não representa teste de um deployment remoto. O [roteiro da bancada](04-ROTEIRO-BANCADA-25-11.md) concentra as verificações pendentes.
