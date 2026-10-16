# Plano de implementação · Grupo 5

## Escopo confirmado

Grupo 5: Expedição, Logística e OEE. O nome antigo da pasta não define o grupo. Entrega atual para aula 2: protótipo independente com dados locais; integração com o Shell fica fora desta etapa.

As referências consultadas incluem o guia Markdown, tema, mock e os trechos de Expedição/OEE dos PDFs `Aula_10_FFE_SPRINT1`, `especificacao_tecnica_frontend_smart40`, `Guia Completo` e `Guia Checklist`. O runbook de Sprint 1 determina trabalhar com simulação e identificar a origem dos indicadores; a especificação geral descreve a evolução futura. Requisitos industriais e de integração não são apresentados como atendidos por este protótipo.

## Implementado para a aula 2

- Painel responsivo de Expedição/OEE com identidade industrial e identificação de origem simulada.
- Cenários de operação normal, OEE baixo, refugo elevado, fila cheia, produção parada e início de turno.
- Simulação automática pausável e avanço manual de uma peça.
- Contadores, qualidade, refugo, OEE e histórico coerentes entre si.
- Gráfico com escala dinâmica e tabela dos valores.
- Ordens com busca/filtro, avanço de progresso e conclusão automática.
- Palete com posições, fila, confirmação de liberação e histórico local de saídas.
- Alertas didáticos e estados vazios, sem preencher métricas ausentes com falsas medições.
- Exportação CSV e impressão em PDF.
- Testes da lógica, lint e build; documentação e roteiro de apresentação.

## Decisões para manter simples

Manter React + TypeScript + Vite. Sem roteador, banco de dados, API, biblioteca de gráficos ou gerenciamento global adicional. Estado local com reducer permite atualizar produção, ordens, palete e fila juntos; funções isoladas permitem testar os cálculos.

O tema usado fica em `src/styles/theme.css`, com tokens da referência do professor. A aplicação não depende de materiais ignorados em `docs/SMART40FFE`.

## Evolução após validar o protótipo com o professor

1. Validar nomenclatura, critérios de avaliação e fórmulas. Para OEE medido, obter tempo planejado, tempo operacional e ciclo ideal. Para MTBF, obter tempos e falhas.
2. Confirmar uma fonte para ordens, paletes e histórico. Só depois definir leitura/persistência necessárias.
3. Mapear `expedition.metrics` e os demais envelopes aprovados para o modelo de tela. Não assumir que o mock do professor e o contrato preliminar têm o mesmo formato.
4. Na fase de integração, acordar formato do módulo e fonte compartilhada, implementar montagem/desmontagem e estados de desconexão/telemetria desatualizada.
5. Configurar publicação e automação quando a forma de entrega estiver definida.

Nenhuma dessas etapas futuras é necessária para apresentar o módulo na aula 2.
