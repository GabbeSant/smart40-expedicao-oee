# Demonstração · Grupo 5 · 4–5 minutos

## Antes da aula

Execute `npm ci` e `npm run dev`; abra `http://localhost:8084`. Confira `npm test`, `npm run lint` e `npm run build`. Deixe a página no cenário Operação normal, pausada. Não precisa de Shell, servidor mock ou internet para usar a aplicação depois de instalar as dependências.

## 1. Apresentar o propósito

“Somos o Grupo 5. Nosso módulo mostra o posto final de Expedição: produtividade, eficiência, ordens, ocupação de paletes e fluxo de saída. Nesta etapa todos os dados e comandos são simulados.”

Mostre o selo de simulação e a identificação do grupo.

## 2. Mostrar os indicadores

Explique: total = aprovadas + rejeitadas; qualidade = aprovadas / total; refugo = rejeitadas / total. OEE combina disponibilidade, performance e qualidade. Disponibilidade/performance ainda são parâmetros do mock. MTBF é marcado como indisponível porque faltam registros de tempos e falhas.

Inicie a simulação, aguarde uma atualização e pause. Use `+ 1 peça` para mostrar atualização dos contadores, da ordem, do gráfico e do palete.

## 3. Demonstrar os problemas

Selecione OEE baixo e mostre o alerta e os componentes. Troque para Refugo elevado; avance quatro peças e observe a rejeição. Trocar cenário reinicia o estado, tornando a demonstração repetível.

## 4. Demonstrar a expedição

Selecione Fila cheia. Mostre o palete de 50 peças e fila de 25. Clique em Simular liberação, confira destino e confirme. O palete enviado aparece no histórico; o próximo recebe as 25 peças da fila.

## 5. Mostrar as ordens e o relatório

Filtre Em produção e pesquise por produto. Limpe os filtros. Exporte CSV e mostre indicadores, ordens e saídas. Clique em Salvar PDF e use a impressão do navegador. Os relatórios permanecem identificados como demonstração.

## 6. Mostrar os limites e próximos passos

Selecione Produção parada: produção e saída ficam bloqueadas. Selecione Início de turno: OEE sem amostra; `+ 1 peça` inicia os contadores sem divisão por zero.

“O protótipo já permite validar as telas e regras de expedição. Depois vamos confirmar as fontes, adaptar o contrato e integrar com o módulo compartilhado. Ainda não há conexão real com a planta.”
