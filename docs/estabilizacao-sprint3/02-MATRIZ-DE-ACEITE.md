# Matriz de aceite — Sprint 3, Grupo 5

Referência: `Frontend DOCS/Sprint3_Grupo5.pdf`, p. 9; cálculo pp. 5–6; comportamento pp. 7–8. Revisão de 25/11/2026. Não foi atribuída nota estimada.

PASS significa evidência suficiente no escopo indicado. PASS WITH LIMITATION significa software validado com uma restrição explícita. BLOCKED exige dado, acesso ou acordo externo ainda ausente. FAIL significa falha observada sem correção. Nenhum teste sintético equivale a homologação física.

| Rubrica | Peso | Estado | Local / sintético | Homologação física / externa |
| --- | ---: | --- | --- | --- |
| OEE com três fatores | 25% | PASS WITH LIMITATION | `sprint3.test.ts`: D×P×Q, performance limitada, zero, tempos inválidos, falta de premissas e alinhamento dos contadores. Replay: D 80%, P 100%, Q 87,5%, OEE 70%. | Capacidade, inspeção e tempos reais pendentes de professor/fonte. |
| Coletores de produção | 20% | PASS WITH LIMITATION | Eventos por peça e amostras acumuladas, deduplicação, sequência, época, reset e rejeição de origem simulada. `processing.test.ts`, `sprint3.test.ts`, testes de navegador. Flags de observação não criam peças. | BLOCKED: vídeo do OEE variando com produção real; fluxo homologado de conclusão da estação 4 e inspeção. |
| Magazine 3 × 4 | 15% | PASS WITH LIMITATION | 12 vagas, livre/ocupada/N/D, atuador e contagens. Comparação física/registro parcial, divergência e staleness. Capturas desktop e 360 px. | BLOCKED: conferir cada posição com a peça física e confirmar a ordem das vagas/tags. |
| Integração com gestor | 15% | PASS WITH LIMITATION | Servidor intermediário GET; Basic somente no servidor; timeout, 401/403, payload inesperado, cache ≥30 s e lista parcial/completa. HTTP real local contra fixtures em `sprint3Bench.test.ts`. | BLOCKED: endpoint/formato, credenciais autorizadas e comparação com gestor real. Em produção, a consulta pertence ao agente/gateway do G1. |
| Visualização | 10% | PASS | KPIs e barras nativas, cores 85/70/<70, PPM produtivo, fonte vencida, tela sem dados e responsividade. Rajada de 10 Hz respeitou atualização visual ≤1 Hz. | Captura com produção real pode substituir/complementar a evidência sintética. |
| Reset auditável | 10% | PASS WITH LIMITATION | Confirmação/cancelamento; gravação antes da limpeza; autor, horário, escopo, contagens/tempos/premissas/indicadores anteriores. Falha de armazenamento bloqueia. Preserva magazine, histórico e deduplicação na sessão. Callback de notificação ao host. | Autor declarado, sem identidade autenticada e armazenamento central do Shell. Recarga total depende de checkpoint/replay; janela por peça após reset exige alinhamento pelo host. |
| Memória e chave de modo | 5% | PASS | Fórmula, capacidade, tempos e critério visíveis. Chave e fixture apenas DEV; origem simulada recusada na produção; artefatos publicados sem controles de desenvolvimento. | Premissas industriais ainda precisam ser fornecidas/aprovadas. |

## Aceite técnico complementar

| Verificação | Estado | Evidência / limite |
| --- | --- | --- |
| Instalação limpa, unitários, integração, lint, TypeScript e builds | PASS | Comandos e resultados no documento 05. |
| Consumo ESM entre origens | PASS | Host em 4174 importa assets em 4173; CORS/MIME válidos, sem socket próprio. |
| Montagem/desmontagem e isolamento | PASS | 15 ciclos, elementos do host preservados, 0 listeners e timers depois de unmount; rejeição de mount duplicado. |
| Distribuição Sprint 2 + Sprint 3 | PASS | 36 arquivos verificados; export anterior preservado; `/`, `/sprint3.html`, módulo e seus imports funcionais. |
| Simulação de desenvolvimento | PASS | Sessão e auditoria separadas; valores fictícios identificados; chave ausente na produção. |
| Configuração Vercel | PASS WITH LIMITATION | Build/output/headers preparados e testados por preview; sem deploy autorizado. |
| CI remoto e Vercel publicados | BLOCKED | Alterações permanecem locais para revisão/publicação posterior. Não foi disparado workflow remoto. |
| Integração no monorepo G1 | BLOCKED | Repositório de Elias não alterado; instruções completas no documento 03. |
| Homologação industrial | BLOCKED | Necessita bancada, professor e automação. Evidências antigas não foram reapresentadas como validação de 25/11. |
| Dependências de desenvolvimento da raiz | PASS WITH LIMITATION | Avisos remanescentes exigem migração principal de ferramentas; FrontEnd sem avisos no fechamento. Não afetam o conteúdo estático publicado, mas limitam a exposição do runtime local. |

Estado da estabilização local: **PASS WITH LIMITATION**. Não há FAIL conhecido na suíte final; o aceite industrial permanece BLOCKED até cumprir as verificações físicas.
