# Plano · Grupo 5 · Expedição & OEE

## Implementado

- Painel responsivo com produção, qualidade, refugo, OEE, histórico didático e estados sem amostra.
- Sete cenários, incluindo **Novo planejamento** para cadastrar as próprias ordens e começar do zero.
- Cadastro de OP com código único, produto, quantidade e destino; validação, fila, busca, filtros e conclusão automática.
- Mapa 2D da expedição: recebimento → identificação RFID simulada → armazenamento → expedição.
- Prateleira de 12 posições configurável; seleção mostra os dados do lote.
- Separação de lotes por OP/destino, fila preservada, bloqueio de armazenamento cheio e proteção contra saída duplicada.
- Confirmação de armazenamento/expedição, registro de movimentações e histórico de saídas.
- Premissas editáveis de tempo planejado, paradas e ciclo ideal; cálculo didático de D/P/Q/OEE.
- Salvamento local versionado, restauração pausada, tratamento de dados inválidos e reinício com confirmação.
- CSV ampliado, impressão em PDF, testes de domínio e verificação no navegador.

## Decisões

Manter React + TypeScript + Vite, sem backend, roteador, biblioteca de gráficos ou dependência do Shell. A lógica fica em `src/domain`, a nova interface em `src/components`, e os materiais ignorados de `docs/SMART40FFE` não são necessários para executar o projeto.

As 12 posições da referência de outros alunos e os lotes de até 50 peças são premissas de simulação configuradas para a apresentação. Não comprovam a configuração física da bancada desta turma. Veja as regras e fórmulas em `blueprint-dados.md`.

## Próximos passos após esta versão

1. Apresentar o fluxo completo ao professor e validar a unidade armazenada: peça, pedido montado ou lote; confirmar capacidade e sequência da bancada.
2. Ajustar nomenclatura e parâmetros conforme essa validação, mantendo a origem dos dados explícita.
3. Definir fontes e adaptar o contrato quando chegar a etapa de integração com a turma.
4. Só então configurar montagem/desmontagem do módulo, conexão compartilhada e estados de telemetria indisponível.
5. Preparar publicação e automação conforme a forma de entrega definida pela disciplina.

Conexão industrial, envio de comandos reais e integração com o Shell continuam fora desta etapa.
