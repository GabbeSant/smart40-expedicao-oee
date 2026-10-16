# SMART 4.0 — Expedição & OEE

Microfrontend do Grupo 5 para monitorar o posto final de expedição. A tela reúne OEE, disponibilidade/performance/qualidade, produção aprovada e rejeitada, ritmo, refugo, fila de saída, histórico por hora, ordens e palete.

## Desenvolvimento

```bash
npm install
npm run dev
```

O Vite atende em `http://localhost:8084`. A aplicação funciona sozinha com dados locais e oferece cenários de demonstração no seletor do cabeçalho.

## Integração com o App Shell

O Grupo 5 escuta `smart40:telemetria` e não abre conexão WebSocket própria. O Shell pode publicar o payload tipado desta forma:

```ts
window.dispatchEvent(new CustomEvent('smart40:telemetria', { detail: dados }))
```

Consulte [`docs/blueprint-dados.md`](docs/blueprint-dados.md) para o contrato e os indicadores.

## Exportação

- **CSV:** baixa as ordens de produção em formato compatível com planilhas.
- **PDF:** abre a impressão do navegador, onde é possível salvar como PDF.
