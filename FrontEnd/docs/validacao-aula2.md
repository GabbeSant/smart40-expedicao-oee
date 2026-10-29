# Validação · evolução do protótipo

Verificação local com Node.js 24 e Microsoft Edge automatizado.

| Verificação | Evidência |
| --- | --- |
| Domínio | 19 testes: indicadores, OPs, fila, separação por destino, RFID, armazenamento, expedição, capacidade, OEE, CSV e persistência |
| Qualidade | TypeScript, build Vite e ESLint |
| Fluxo no navegador | Duas OPs de produtos/destinos distintos, produção de cinco peças, dois lotes armazenados e uma expedição |
| Validação de formulário | Código duplicado e paradas maiores que o tempo planejado rejeitados |
| Cancelamento | Cancelar expedição preserva o lote e a ocupação |
| Recarga | Restaura OPs, rack, saídas e premissas com simulação pausada |
| Falhas de armazenamento | Sessão corrompida inicia nova demonstração com aviso; salvamento bloqueado informa a falha e mantém a interface funcionando |
| Teclado | Após expedir, o foco retorna à posição selecionada quando o botão de expedição deixa de existir |
| Exportação | CSV com OP/destino, posições, premissas e eventos; PDF gerado pela impressão |
| Responsividade | Sem overflow da página em 1440, 1024, 768, 390 e 320 px; tabela pode rolar |
| Simulação automática | Atualização após cinco segundos e restauração pausada ao recarregar |
| Reinício | Restaura cenário, limpa rack/históricos e substitui o estado salvo |
| Runtime | Nenhum erro de execução durante o fluxo principal |

Os testes reproduzíveis estão em `tests/expedition.test.ts` e `tests/warehouse.test.ts`; execute `npm test`. A automação de navegador foi executada com ferramentas temporárias externas ao projeto, sem adicionar dependências à aplicação.

Não foram verificados integração com Shell, backend, sensores, RFID físico ou comandos à planta, pois não fazem parte deste protótipo.
