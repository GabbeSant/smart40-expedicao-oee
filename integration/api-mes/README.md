# API MES — referência opcional do Grupo 5

Implementa os cinco eventos do Caminho A, sem tela ou comandos de máquina. A definição de responsabilidade final entre Grupo 5 e Grupo 1 permanece com a turma. Este serviço é separado da biblioteca TypeScript e não é necessário para importá-la no Shell.

## Preparar

1. Instalar as dependências da raiz: `npm ci`.
2. Copiar `.env.example` desta pasta para `.env` e configurar um banco próprio em `DATABASE_URL`.
3. Substituir os tokens de exemplo por segredos únicos. Cada credencial declara `unitId` e papel `read` ou `write`.
4. Na raiz, executar `npm run mes:migrate`, depois `npm run mes:start`.

`mes:migrate` cria somente o schema `smart40_mes` e suas tabelas/índices, sem modificar tabelas de outros sistemas. O usuário do banco precisa ter permissão para criar esse schema. O serviço não inicializa um PostgreSQL externo automaticamente.

No banco local, `PG_SSL_MODE=disable` pode ser usado explicitamente. Na nuvem, usar `verify-full`, padrão do driver, e `PG_CA_FILE` se necessário. Não colocar opções SSL na query de `DATABASE_URL`; isso evita sobrescrever a validação de certificado configurada pelo serviço.

## Rotas

Todas as rotas `/api/Events` exigem `Authorization: Bearer <token>`. A unidade vem da credencial, não do corpo da requisição. A conexão externa deve usar HTTPS. `/health` é público e verifica o banco.

| Método e caminho | Papel | Dados/resultado |
| --- | --- | --- |
| POST `/api/Events/order/movedin` | write | Entrada na estação |
| POST `/api/Events/process/started` | write | Início de processo; exige `processCode` textual |
| POST `/api/Events/process/finished` | write | Fim de processo; exige `processCode` textual |
| POST `/api/Events/order/movedout` | write | Saída da estação |
| POST `/api/Events/order/completed` | write | Conclusão, somente `componentId: 4` |
| GET `/api/Events/order/current` | read/write | Ordem observada em produção mais recentemente, ou null |
| GET `/api/Events/order/:trackingCode` | read/write | Ordem e seu histórico |
| GET `/api/Events/metrics` | read/write | `criadas`, `emProducao`, `concluidas`, `scope: "orders"` |

Corpo comum dos POSTs:

```json
{
  "eventId": "identidade-estavel-da-ocorrencia",
  "componentId": 4,
  "trackingCode": "OP1",
  "timeStamp": "2026-11-04T15:30:00Z"
}
```

`eventId` é recomendado para retransmissões. Sem ele, usa-se uma chave formada pelos campos do evento, com timestamp normalizado. Primeira gravação retorna 201; repetição retorna 200 com `duplicate: true`; ID reutilizado com outro conteúdo retorna 409. `processCode` é necessário nos eventos de processo.

As métricas contam somente ordens conhecidas pelo MES. Não equivalem ao catálogo inteiro de pedidos, não indicam quantidade de peças aprovadas/rejeitadas e não calculam OEE. Uma saída de peça do processador também não conclui automaticamente uma OP inteira.

## Publicação opcional

O [render.yaml](render.yaml) descreve o serviço para Render, usando a raiz do repositório. Na configuração da Blueprint, selecione o caminho `integration/api-mes/render.yaml`. Configure `DATABASE_URL`, `MES_TOKENS_JSON`, `MES_ALLOWED_ORIGINS` e TLS do banco no destino real. A Blueprint não cria banco ou credenciais e não foi aplicada a um projeto remoto. Não configure um token write no navegador; o agente/gateway é o cliente de escrita. A hospedagem estática `vercel.json` da raiz continua destinada à biblioteca, não à API MES.

## Verificar localmente

`npm run test:e2e` inclui HTTP real e SQL executado em PGlite, um PostgreSQL embarcado para testes. Verifica o primeiro evento sem violar FK, rollback, rotas reservadas, deduplicação, autorização por papel e isolamento de unidade. A conexão TLS com um PostgreSQL hospedado precisa ser validada quando houver banco disponível.
