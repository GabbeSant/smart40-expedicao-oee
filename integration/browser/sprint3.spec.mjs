import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { contractReplay } from './replay.mjs';

const moduleUrl = 'http://127.0.0.1:4173/assets/sprint3-module.js';
const evidence = 'docs/estabilizacao-sprint3/evidencias';
const send = (page, payload) => page.evaluate(value => window.dispatchEvent(new CustomEvent('smart40:telemetria', { detail: value })), payload);
const kpi = (page, label) => page.locator('.s3-kpi').filter({ has: page.getByRole('heading', { name: label, exact: true }) }).locator('strong');
const total = page => page.locator('.s3-dl > div').filter({ has: page.getByText('Peças processadas', { exact: true }) }).locator('dd');

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.__errors = errors;
});
test.afterEach(async ({ page }) => { expect(page.__errors).toEqual([]); });

async function host(page) {
  await page.addInitScript(() => {
    const add = window.addEventListener.bind(window), remove = window.removeEventListener.bind(window);
    const start = window.setInterval.bind(window), stop = window.clearInterval.bind(window);
    const listeners = new Map(), intervals = new Set();
    window.addEventListener = (type, callback, options) => {
      if (type.startsWith('smart40:')) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(callback); }
      add(type, callback, options);
    };
    window.removeEventListener = (type, callback, options) => { listeners.get(type)?.delete(callback); remove(type, callback, options); };
    window.setInterval = (...args) => { const id = start(...args); intervals.add(id); return id; };
    window.clearInterval = id => { intervals.delete(id); stop(id); };
    window.__resources = () => ({ listeners: [...listeners.values()].reduce((n, set) => n + set.size, 0), intervals: intervals.size });
    window.__sockets = 0;
    window.WebSocket = class { constructor() { window.__sockets++; throw new Error('O módulo não pode abrir WebSocket.'); } };
  });
  await page.goto('http://127.0.0.1:4174');
  await page.evaluate(async url => {
    window.__module = await import(url);
    await window.__module.bootstrap();
    window.__resets = [];
    await window.__module.mount({ domElement: document.getElementById('module'), onReset: entry => window.__resets.push(entry) });
  }, moduleUrl);
  await expect(page.getByRole('heading', { name: 'Expedição e OEE', exact: true })).toBeVisible();
}

test('standalone de desenvolvimento: modo separado, reset e responsividade', async ({ page }) => {
  await page.goto('http://127.0.0.1:4184/sprint3.html');
  await expect(kpi(page, 'OEE completo')).toHaveText('N/D');
  await page.getByRole('button', { name: 'Simular no desenvolvimento' }).click();
  await expect(kpi(page, 'OEE completo')).toHaveText('70%');
  await expect(page.locator('.s3-slot')).toHaveCount(12);
  await page.setViewportSize({ width: 360, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Revisar reset' }).click();
  await page.getByLabel('Quem solicitou').fill('Operador de teste');
  await page.getByRole('button', { name: 'Confirmar reset' }).click();
  await expect(total(page)).toHaveText('0');
  await page.getByRole('button', { name: 'Voltar ao modo real' }).click();
  await expect(total(page)).toHaveText('N/D');
});

test('produção: rotas, N/D, sem controles de simulação e sem API local', async ({ page, request }) => {
  for (const route of ['/', '/sprint3.html']) {
    await page.goto(`http://127.0.0.1:4173${route}`);
    await expect(kpi(page, 'OEE completo')).toHaveText('N/D');
    await expect(page.getByRole('button', { name: /simul|bancada/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Revisar reset' })).toBeDisabled();
  }
  expect((await request.get('http://127.0.0.1:4173/__sprint3/observacao')).status()).toBe(404);
  const response = await request.get(moduleUrl);
  expect(response.headers()['access-control-allow-origin']).toBe('*');
  expect(response.headers()['content-type']).toBe('text/javascript');
  fs.mkdirSync(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/producao-sem-telemetria.png`, fullPage: true });
});

test('módulo ESM entre origens: isolamento, replay, divergência, deduplicação e auditoria', async ({ page }) => {
  await host(page);
  expect(await page.locator('#shell-button').evaluate(element => getComputedStyle(element).color)).toBe('rgb(160, 0, 0)');
  expect(await page.getByRole('heading', { name: 'Expedição e OEE', exact: true }).evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThan(20);
  const frame = contractReplay();
  await send(page, frame); // mount resolve com os listeners prontos
  await expect(kpi(page, 'OEE completo')).toHaveText('70%');
  await expect(kpi(page, 'Disponibilidade')).toHaveText('80%');
  await expect(kpi(page, 'Qualidade')).toHaveText('87,5%');
  await expect(page.getByText('Divergência', { exact: true })).toHaveCount(1);
  await send(page, frame);
  await expect(total(page)).toHaveText('8');
  await page.screenshot({ path: `${evidence}/host-replay-sintetico.png`, fullPage: true });
  await page.setViewportSize({ width: 360, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${evidence}/host-mobile-sintetico.png`, fullPage: true });
  await page.getByRole('button', { name: 'Revisar reset' }).click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(total(page)).toHaveText('8');
  await page.getByRole('button', { name: 'Revisar reset' }).click();
  await page.getByLabel('Quem solicitou').fill('Ana · fixture');
  await page.getByRole('button', { name: 'Confirmar reset' }).click();
  await expect(total(page)).toHaveText('0');
  await expect(page.locator('.s3-occupied')).toHaveCount(3);
  const entries = await page.evaluate(() => JSON.parse(localStorage.getItem('smart40-sprint3-reset-medido')));
  expect(entries[0].totalBefore).toBe(8);
  expect(entries[0].before.indicators.oee).toBe(70);
  expect(entries[0].before.counts).toEqual({ totalProduced: 8, approved: 7, rejected: 1 });
  expect(await page.evaluate(() => window.__resets.length)).toBe(1);
  await send(page, frame);
  await expect(total(page)).toHaveText('0');
  await page.screenshot({ path: `${evidence}/reset-auditado-sintetico.png`, fullPage: true });
  expect(await page.evaluate(() => window.__sockets)).toBe(0);
});

test('montar e desmontar quinze vezes preserva o host e libera listeners e timers', async ({ page }) => {
  await host(page);
  const frame = contractReplay();
  await send(page, frame);
  await expect(total(page)).toHaveText('8');
  const result = await page.evaluate(async () => {
    let rejected = false;
    try { await window.__module.mount({ domElement: document.getElementById('module') }); } catch { rejected = true; }
    return { rejected, resources: window.__resources() };
  });
  expect(result).toEqual({ rejected: true, resources: { listeners: 4, intervals: 1 } });
  for (let i = 0; i < 15; i++) {
    await page.evaluate(() => window.__module.unmount());
    expect(await page.evaluate(() => window.__resources())).toEqual({ listeners: 0, intervals: 0 });
    await expect(page.locator('#sentinel')).toHaveCount(1);
    await page.evaluate(() => window.__module.mount({ domElement: document.getElementById('module') }));
    await expect(total(page)).toHaveText('8');
  }
  await page.evaluate(() => window.__module.unmount());
  expect(await page.evaluate(() => window.__resources())).toEqual({ listeners: 0, intervals: 0 });
  expect(await page.evaluate(() => window.__sockets)).toBe(0);
  await expect(page.locator('[data-smart40-module]')).toHaveCount(0);
});

test('desconexão e reconexão preservam valores, rejeitam simulação e sinalizam fonte vencida', async ({ page }) => {
  await page.clock.install();
  await host(page);
  await send(page, contractReplay(Date.now(), 'simulado'));
  await expect(total(page)).toHaveText('N/D');
  const frame = contractReplay();
  await send(page, frame);
  await expect(total(page)).toHaveText('8');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('smart40:connection.state', { detail: { data: { status: 'DISCONNECTED' } } })));
  await expect(page.getByText(/App Shell desconectado/)).toBeVisible();
  await expect(total(page)).toHaveText('8');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('smart40:expedition:connection', { detail: 'CONNECTED' })));
  await send(page, frame);
  await expect(page.getByText(/App Shell desconectado/)).toHaveCount(0);
  await expect(total(page)).toHaveText('8');
  await page.clock.runFor(17_000);
  await expect(page.getByText(/Telemetria vencida/)).toBeVisible();
  await expect(page.getByText(/Última ocupação recebida/)).toBeVisible();
});

test('falha de armazenamento da auditoria impede reset e preserva contagem', async ({ page }) => {
  await host(page);
  await send(page, contractReplay());
  await expect(total(page)).toHaveText('8');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('Auditoria indisponível na fixture'); }; });
  await page.getByRole('button', { name: 'Revisar reset' }).click();
  await page.getByLabel('Quem solicitou').fill('Operador fixture');
  await page.getByRole('button', { name: 'Confirmar reset' }).click();
  await expect(page.getByText('Auditoria indisponível na fixture', { exact: true })).toBeVisible();
  await expect(total(page)).toHaveText('8');
  expect(await page.evaluate(() => window.__resets.length)).toBe(0);
});

test('telemetria a 10 Hz atualiza os indicadores no máximo uma vez por segundo', async ({ page }) => {
  await page.clock.install();
  await host(page);
  const frame = contractReplay();
  await send(page, frame);
  await page.clock.runFor(1000);
  await expect(total(page)).toHaveText('8');
  await page.evaluate(value => {
    window.__kpiUpdates = 0;
    const panel = document.querySelector('[data-smart40-module]').shadowRoot.querySelector('.s3-kpis');
    new MutationObserver(() => window.__kpiUpdates++).observe(panel, { childList: true, characterData: true, subtree: true, attributes: true });
    for (let i = 0; i < 20; i++) setTimeout(() => {
      const station = value.estacoes.expedicao;
      const base = station.eventos[0];
      const timestamp = new Date().toISOString();
      const event = { ...base, seq: 10 + i * 2, eventId: `burst-${i}`, pieceId: `burst-piece-${i}`, inspection: 'APPROVED', timestamp };
      const analysis = { ...station.eventos.at(-1), seq: 11 + i * 2, eventId: `burst-window-${i}`, timestamp,
        plannedSeconds: 91 + i / 10, operatingSeconds: 73 + i / 10 };
      window.dispatchEvent(new CustomEvent('smart40:telemetria', { detail: { ...value, timestamp,
        estacoes: { expedicao: { ...station, eventos: [event, analysis] } } } }));
    }, i * 100);
  }, frame);
  await page.clock.runFor(3000);
  await expect(total(page)).toHaveText('28');
  const updates = await page.evaluate(() => window.__kpiUpdates);
  expect(updates).toBeGreaterThan(0);
  expect(updates).toBeLessThanOrEqual(3);
  fs.writeFileSync(`${evidence}/frequencia-renderizacao.json`, JSON.stringify({ synthetic: true, inputHz: 10,
    events: 40, durationMs: 3000, kpiDomUpdates: updates, maximumExpected: 3 }, null, 2));
});

test('amostras acumuladas: faixas de cor, nova época e reset com próxima referência', async ({ page }) => {
  const at = Date.now();
  await page.clock.install({ time: at });
  await host(page);
  const frame = contractReplay(at);
  const cumulative = (seq, secondsBefore, approved, rejected, seconds, epoch = 'fixture-A') => ({
    ...frame, timestamp: new Date(at - secondsBefore * 1000).toISOString(), estacoes: { expedicao: {
      ...frame.estacoes.expedicao, eventos: [], amostraAcumulada: {
        epoch, seq, timestamp: new Date(at - secondsBefore * 1000).toISOString(), quality: 'GOOD',
        totalProduced: approved + rejected, approved, rejected, plannedSeconds: seconds, operatingSeconds: seconds,
      },
    } },
  });
  await send(page, cumulative(1, 300, 0, 0, 0));
  await expect(kpi(page, 'OEE completo')).toHaveText('N/D');
  for (const [seq, ago, good, bad, seconds, value, band] of [
    [2, 180, 85, 15, 120, '85%', '.s3-high'],
    [3, 90, 140, 60, 210, '70%', '.s3-mid'],
    [4, 0, 699, 301, 300, '69,9%', '.s3-low'],
  ]) {
    await send(page, cumulative(seq, ago, good, bad, seconds));
    await expect(kpi(page, 'OEE completo')).toHaveText(value);
    await expect(page.locator(band)).toBeVisible();
  }
  await send(page, cumulative(1, -1, 0, 0, 0, 'fixture-B'));
  await expect(page.getByText(/A fonte reiniciou os contadores/)).toBeVisible();
  await expect(kpi(page, 'OEE completo')).toHaveText('N/D');
  // A confirmação não pode ocorrer antes da referência recebida da fonte.
  await page.clock.runFor(2000);
  await page.getByRole('button', { name: 'Revisar reset' }).click();
  await page.getByLabel('Quem solicitou').fill('Operador acumulado · fixture');
  await page.getByRole('button', { name: 'Confirmar reset' }).click();
  await expect(page.getByText(/Nova referência salva/)).toBeVisible();
  const next = cumulative(2, -3, 10, 0, 10, 'fixture-B');
  next.estacoes.expedicao.amostraAcumulada.operatingSeconds = 8;
  await send(page, next);
  await expect(kpi(page, 'OEE completo')).toHaveText('80%');
  const entries = await page.evaluate(() => JSON.parse(localStorage.getItem('smart40-sprint3-reset-medido')));
  expect(entries[0].before.counts).toEqual({ totalProduced: 1000, approved: 699, rejected: 301 });
});
