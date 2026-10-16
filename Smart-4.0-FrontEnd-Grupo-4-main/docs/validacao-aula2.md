# Validação do protótipo · aula 2

Verificação realizada em 16/10/2026 com Node.js 24 e Microsoft Edge em modo automatizado.

| Verificação | Resultado |
| --- | --- |
| `npm test` | 10 testes da lógica aprovados |
| `npm run lint` | Sem erros |
| `npm run build` | TypeScript e build de produção aprovados |
| Avanço manual e automático | Contadores, ordem, histórico e palete atualizados; pausa mantém os valores |
| Fila cheia e liberação | Cancelamento preserva estado; confirmação registra 50 peças e transfere 25 para o próximo palete |
| Ordens | Filtro, busca, estado sem resultados e limpeza conferidos |
| Cenários | Parada bloqueia ações; início sem amostra e primeira peça conferidos; reinício restaura dados |
| CSV | Download e conteúdo com indicadores, origem simulada e saída de palete conferidos |
| PDF | Arquivo gerado pela impressão, com duas páginas no cenário padrão |
| Responsividade | Sem overflow da página em 1440, 1024, 768, 390 e 320 px; tabela pode rolar horizontalmente |
| Modal e teclado | Ajuda, fechamento com Escape e retorno de foco ao botão conferidos |
| Console | Nenhum erro de execução durante o fluxo principal |

Os testes de domínio estão em `tests/expedition.test.ts`. A verificação automatizada de navegador foi executada como ferramenta temporária externa ao projeto, sem adicionar dependências à aplicação. Este registro não comprova integração com servidor, planta ou Shell, que estão fora do escopo desta etapa.
