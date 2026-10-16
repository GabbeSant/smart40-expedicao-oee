# SMART 4.0 · Expedição & OEE

Protótipo independente do **Grupo 5**, preparado para a aula 2. React, TypeScript e Vite, sem backend ou dependência do App Shell. A pasta mantém o nome antigo por compatibilidade com o checkout.

Todos os indicadores, ordens, paletes e saídas são simulados. Nenhum comando é enviado à planta. Os dados ficam em memória e reiniciam ao recarregar, reiniciar ou trocar de cenário.

## Rodar

Use **Node.js 24 LTS** e npm. O projeto utiliza o suporte nativo do Node a TypeScript nos testes; o requisito antigo de Node 18 nos guias não corresponde à base Vite atual.

```bash
npm ci
npm run dev
```

Abra **http://localhost:8084**. No PowerShell com execução de scripts bloqueada, use `npm.cmd` no lugar de `npm`.

## Demonstrar

- Seis cenários: operação normal, OEE baixo, refugo elevado, fila cheia, produção parada e início de turno.
- Simulação automática: uma peça a cada 5 segundos, ou avanço manual com `+ 1 peça` quando pausada.
- OEE consistente com seus componentes; qualidade e refugo calculados pelos contadores.
- Gráfico com escala dinâmica, valores e alternativa em tabela.
- Palete com 50 posições, fila e confirmação de saída simulada. A fila abastece o próximo palete.
- Ordens com busca, filtro, progresso e avanço automático da próxima ordem ao concluir a ativa.
- Alertas de eficiência, refugo, fila e ausência de amostra.
- CSV dos indicadores, ordens filtradas e saídas; PDF via impressão do navegador.
- Layout responsivo, navegação por teclado, modal com foco contido e estados vazios.

Para salvar PDF, clique em **Salvar PDF** e selecione **Salvar como PDF** no diálogo de impressão. CSV e PDF identificam a origem simulada dos dados.

## Verificar

```bash
npm test
npm run lint
npm run build
```

Os testes verificam conservação dos contadores, coerência do histórico/OEE, paletização, rejeição, conclusão de ordens, reinício e geração de CSV.

## Organização

| Arquivo | Responsabilidade |
| --- | --- |
| `src/App.tsx` | Interface e interações da demonstração |
| `src/App.css` | Layout responsivo e impressão |
| `src/styles/theme.css` | Tokens adaptados do tema do professor |
| `src/mocks/telemetryMock.ts` | Cenários determinísticos |
| `src/domain/expedition.ts` | Transições, alertas e CSV |
| `src/types/smart40.ts` | Tipos do protótipo local |
| `tests/expedition.test.ts` | Verificação da lógica |

Veja [o blueprint dos dados](docs/blueprint-dados.md), [o plano de evolução](docs/plano-implementacao.md) e [o roteiro de apresentação](docs/roteiro-apresentacao.md).

Os materiais originais do professor em `docs/SMART40FFE/` são ignorados pelo Git. Nenhum arquivo dessa pasta é necessário para rodar o protótipo.
