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
- Camada isolada para GET de ordens da Planta N2: DTOs, validação, adapter parcial e fallback mock identificado, sem ativação na UI. Análise e pendências em [integração de ordens](integracao-production-orders.md).

## Decisões

Manter React + TypeScript + Vite, sem backend, roteador, biblioteca de gráficos ou dependência do Shell. A lógica fica em `src/domain`, a nova interface em `src/components`, e os materiais ignorados de `docs/SMART40FFE` não são necessários para executar o projeto.

As 12 posições da referência de outros alunos e os lotes de até 50 peças são premissas de simulação configuradas para a apresentação. Não comprovam a configuração física da bancada desta turma. Veja as regras e fórmulas em `blueprint-dados.md`.

## Próximos passos após esta versão

1. Apresentar o fluxo completo ao professor e validar a unidade armazenada: peça, pedido montado ou lote; confirmar capacidade e sequência da bancada.
2. Ajustar nomenclatura e parâmetros conforme essa validação, mantendo a origem dos dados explícita.
3. Validar os campos pendentes da API (status, quantidades e destino) e os contratos do Shell antes de alimentar o domínio/UI com ordens reais. A leitura isolada por GET já está preparada.
4. Só então configurar montagem/desmontagem do módulo, conexão compartilhada e estados de telemetria indisponível.
5. Preparar publicação e automação conforme a forma de entrega definida pela disciplina.

Conexão direta a PLC/S7, envio de comandos reais e integração ativa com o Shell continuam fora desta etapa. A camada de API é exclusivamente de leitura e não modifica a simulação.
