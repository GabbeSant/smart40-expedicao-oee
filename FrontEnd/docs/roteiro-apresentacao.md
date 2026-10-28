# Demonstração · Grupo 5 · 5 minutos

## Preparação

Use Node 24. Execute `npm ci`, `npm test`, `npm run lint`, `npm run build` e `npm run dev`; abra `http://localhost:8084`. No PowerShell com bloqueio de scripts, use `npm.cmd`.

O sistema restaura o último trabalho deste navegador, pausado. Para uma apresentação repetível, selecione **Novo planejamento**. Atenção: isso substitui os dados salvos.

## 1. Propósito e premissas

“Somos o Grupo 5. Este módulo acompanha produção, OEE e fluxo de expedição. Todos os dados e ações são simulados. As posições e capacidade por lote são premissas didáticas, sem conexão com a máquina.”

## 2. Planejar

No Mapa da expedição, clique **Nova OP**. Cadastre `OP-DEMO`, produto `Carcaça A`, quantidade `2`, destino `Campinas`. Cadastre `OP-DEMO-B`, produto `Carcaça B`, quantidade `3`, destino `Santos`.

Mostre as duas ordens: uma ativa e outra aguardando. Tente repetir um código para demonstrar a validação.

## 3. Produzir e separar

Avance **+ 1 peça** três vezes. A primeira OP conclui com duas peças; a segunda inicia. Mostre que o lote mantém as duas peças da primeira OP, enquanto a peça da segunda fica na fila com seu destino preservado.

Os contadores e o gráfico acompanham a produção. Rejeitadas não entram nas OPs ou lotes.

## 4. Identificar, armazenar e expedir

Clique **Identificar lote**, depois **Armazenar lote** e confirme. A posição 01 recebe o lote da primeira OP; o novo lote recebe a peça da segunda OP que aguardava.

Avance mais duas peças, identifique e armazene o segundo lote. Clique na posição 01: mostre OP, produto, quantidade, destino e horário. Clique **Simular expedição**, confira e confirme. A posição fica livre e o histórico registra a saída. O segundo lote permanece armazenado.

## 5. Explicar OEE e salvar

Abra **Premissas do OEE** e mostre tempo planejado, paradas e ciclo ideal. Explique D = operação / planejado, P = total × ciclo / operação e Q = aprovadas / total. OEE = D × P × Q. Tempos e ciclo são simulados; MTBF permanece indisponível.

Recarregue a página: OPs, posições, fila e históricos retornam, com a execução pausada. Exporte CSV e mostre os vínculos por OP/destino; Salvar PDF abre a impressão.

## 6. Encerrar

“Temos um fluxo local completo de planejamento, produção e expedição. O próximo passo é validar a representação da bancada com o professor e depois adaptar a integração com a turma.”
