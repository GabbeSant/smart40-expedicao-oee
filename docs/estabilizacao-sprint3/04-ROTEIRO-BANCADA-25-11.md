# Bancada — 25/11/2026, a partir das 18h45

Prioridade: obter dados confiáveis e guardar evidências da produção autorizada. As capturas existentes nesta pasta são de teste local sintético. Não comprovam operação física.

## P0 — abrir o checkout e o diagnóstico

PowerShell, na raiz do projeto:

```powershell
Set-Location 'D:\Projetos\devilman\smart40-expedicao-oee'
git status --short --branch
git log -3 --oneline
node --version
```

Branch esperada: `estabilizacao-sprint3`. Não reinstale dependências se este checkout já estiver pronto. Em outro computador, use Node 24 LTS e execute uma vez:

```powershell
npm.cmd ci
npm.cmd --prefix FrontEnd ci
npm.cmd run build:release
```

Conecte-se à rede autorizada da planta e confirme com o responsável os endereços. Os abaixo são os endereços já documentados; não são descoberta de rede feita hoje.

```powershell
Test-NetConnection 192.168.150.200 -Port 1880
Test-NetConnection 192.168.150.200 -Port 8080
```

São verificações TCP de conectividade, sem comando industrial. Falha no teste não exige alterar CLP ou fluxos. Não importe os fluxos de referência no Node-RED da bancada.

Configure apenas o servidor local:

```powershell
$env:S3_NODE_RED_URL = 'http://192.168.150.200:1880'
$env:S3_STOCK_URL = 'http://192.168.150.200:8080'
# Se o gestor exigir Basic, defina S3_STOCK_USER e S3_STOCK_PASSWORD
# neste processo/arquivo FrontEnd/.env.bancada.local autorizado.
# Não use prefixo VITE_, não cole segredos no console do navegador.
npm.cmd --prefix FrontEnd run dev -- --mode bancada --host 127.0.0.1 --port 8084 --strictPort
```

Abra **http://127.0.0.1:8084/sprint3.html**. O modo bancada inicia a leitura automaticamente. No desenvolvimento padrão, clique em **Ler bancada N2**. A consulta executa somente GET. O horário de consulta, OP, flags e últimas posições observadas não provam produção nova nem ocupação atual de todas as vagas. N/D nesse cenário é comportamento esperado.

Para inspeção ampliada, em outro terminal, sem configurar publicação MQTT:

```powershell
Remove-Item Env:PLANT_OBSERVATION_MQTT_URL -ErrorAction SilentlyContinue
npm.cmd run plant:inspect
```

O relatório fica em `.work/plant/live-observation.json`. Faz GET de settings/flows/contexto/catálogo, sem deploy ou escrita na planta. Não publique a saída bruta se contiver configuração local; registre somente os campos necessários à evidência.

## P1 — confirmar os insumos antes de tentar obter OEE real

Com o professor e a automação, registrar por escrito:

- Capacidade nominal em peças/h, critério de aprovação/rejeição e sua fonte. Se não houver critério objetivo, declarar classificação qualitativa; não presumir peças boas.
- Início do turno, tempo planejado, tempo produtivo e quais emergências/paradas entram no cálculo. Os tempos precisam vir da fonte na mesma janela da produção.
- Como identificar conclusão válida na Expedição: evento da estação final/componentId 4, identidade da peça, stream/seq, inspeção e OP resolvida.
- As tags e a ordem física das 12 vagas e a posição atual do atuador. `integration/plant/n2-expedition-tags.json` é um mapa observado, não autorização para escrever nas tags. Não usar `%I0.*` ilustrativo do PDF como tag confirmada.

Se faltarem esses dados, registrar o bloqueio e continuar com magazine/gestor/G1. Não preencher 300 peças/h ou qualidade da fixture como premissa real.

## P1 — validar o magazine e o gestor

1. Sem movimentar a máquina, conferir as 12 posições: inferior 1–4, intermediário 5–8, superior 9–12. Fotografar/capturar vagas livres, ocupadas e desconhecidas.
2. Confirmar que o G1 publica `ocupacao` com 12 boolean/null e timestamp. Sem leitura individual, manter N/D. A última posição armazenada não equivale ao atuador atual.
3. Verificar no diagnóstico o status do gestor. As rotas preparadas são GET `/api/blocks/2` e `/api/blocks`; pedir ao responsável um exemplo sanitizado do formato real. A primeira rota pode representar apenas a primeira vaga livre.
4. Distinguir estado físico de registro: o mapa do gestor é uma segunda fonte. Lista simples é parcial; só um envelope completo validado permite marcar ausências como livres. Uma consulta leva até cerca de 3,5 s; gestor é consultado no máximo a cada 30 s.
5. Em 401/403, conferir usuário/permissão no servidor. Em timeout, conferir serviço/porta/rede. Em resposta sem mapeamento, guardar JSON sanitizado e ajustar o adaptador antes de afirmar ocupação.
6. Comparar uma vaga ocupada e uma livre com a tela real do gestor e com o sensor. Registrar timestamp das duas fontes. Nenhuma comparação atual deve ser afirmada com dados vencidos.

## P1 — integrar com Elias

Entregar **[03-INTEGRACAO-GRUPO1.md](03-INTEGRACAO-GRUPO1.md)** e o diretório `release/` completo. Pedir prioridade para substituir a tela anterior de `/expedicao`, mapear eventos/tempos/vagas e repassar `connection.state`. A ponte atual dele é simulada e não fornece sozinha os insumos reais da Sprint 3.

O módulo a importar é `assets/sprint3-module.js`, com bootstrap/mount/unmount. O G1 mantém a única conexão WebSocket. Para conferência local da build:

```powershell
npm.cmd run preview:release
```

Abra **http://127.0.0.1:4173/sprint3.html**. Esse standalone aguarda barramento; abrir a URL sozinha não conecta ao broker. A fonte de produção deve chegar pelo Shell. Para host técnico isolado, em outro terminal execute `node integration/browser/serve-host.mjs` e abra **http://127.0.0.1:4174**; instruções de import/replay estão no documento 03. Esse replay continua sendo sintético.

## P2 — produção real autorizada e evidências

Somente com autorização e operação a cargo do responsável:

1. Acompanhar uma pequena produção normal. Conferir uma a uma as identidades, inspeções e contagens da estação 4 com os eventos recebidos pelo Shell. Não iniciar ciclos ou alterar parâmetros pelo G5.
2. Na memória de cálculo, confrontar D = produtivo/planejado, P = min(total/(produtivo/3600 × capacidade), 1), Q = aprovadas/total e OEE = D×P×Q. PPM = total×60/produtivo. Conferir as faixas: verde ≥85%, amarelo ≥70% e <85%, vermelho <70%.
3. Gravar vídeo curto do OEE variando com produção real e capturar a memória com premissas aprovadas. Registrar escopo, horário e referência do professor.
4. Quando autorizado testar reset local: capturar estado anterior, abrir **Revisar reset**, preencher autor e confirmar. Conferir registro, contadores, magazine preservado e ausência de recontagem ao repetir eventos. Em eventos por peça, Elias deve receber `onReset` e alinhar a nova janela; sem novos tempos, OEE permanece N/D.
5. Testar queda/retomada somente da conexão do cliente/agente, combinada com Elias e sem interferir no controle da planta. Capturar aviso de desconexão/stale e retomada sem duplicação.
6. Salvar vídeo, captura das 12 vagas, comparação do gestor e registro do reset. Marcar claramente o que é medido e o que é teste sintético. Não incluir tokens, credenciais ou export completo de fluxos.

## Diagnóstico rápido

| Sintoma | Verificar primeiro |
| --- | --- |
| Porta 8084 ocupada | Encerrar o Vite antigo do próprio teste; usar `--strictPort` para não abrir a URL errada. |
| Diagnóstico 404 | Use o servidor de desenvolvimento do Vite. O preview e a Vercel servem a distribuição de produção. |
| Diagnóstico 403 | Usar `127.0.0.1` na URL e host em loopback; não acessar de origem externa. |
| OP/posição aparecem, produção N/D | São observações retidas; faltam eventos por peça, inspeção e tempos reais. |
| OEE N/D com peças contadas | Conferir `criterios`, `analysis.window` da mesma sessão/atualizado ou segunda amostra acumulada com tempos. |
| Vagas N/D | Falta leitura individual confiável; não completar com estado do gestor. |
| Valores antigos com aviso | Confirmar conexão e timestamp de origem; heartbeat não renova dados antigos. |
| Gestor indisponível/recusado | Rede/porta, serviço, credenciais e formato; aguardar o intervalo de 30 s entre consultas. |
| G1 ainda mostra a interface anterior | Entrada local G5 ainda aponta para App.tsx antigo; seguir documento 03. |
| Módulo falha ao importar | Publicar/copiar todo `release/`, conferir CORS, MIME e chunks da mesma revisão. |
| Reset bloqueado | Nome obrigatório; auditoria local precisa ser gravável e válida; relógio não pode estar atrás da fonte. Não apagar histórico para contornar erro sem guardar evidência. |

Ao terminar, seguir o procedimento de encerramento do laboratório com o responsável. O G5 não comanda a passagem das estações para manual. Publicação/deploy permanecem uma ação separada a autorizar após revisão.
