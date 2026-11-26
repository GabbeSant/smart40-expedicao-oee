import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFlows } from './node-red/flow.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'release');
const frontend = path.join(root, 'FrontEnd/dist');
// A lista do Vite permite publicar somente a Sprint 3 e seus chunks compartilhados.
const viteManifest = JSON.parse(fs.readFileSync(path.join(frontend, '.vite/manifest.json'), 'utf8'));
const pages = ['index.html', 'sprint3.html'];
const assets = new Set([...pages, 'favicon.svg']);
const chunksByFile = new Map(Object.entries(viteManifest).map(([key, chunk]) => [chunk.file, key]));
function include(key) {
  const chunk = viteManifest[key];
  if (!chunk) throw new Error(`Entrada do Vite ausente: ${key}`);
  if (assets.has(chunk.file)) return;
  assets.add(chunk.file);
  for (const file of [...(chunk.css ?? []), ...(chunk.assets ?? [])]) assets.add(file);
  for (const dependency of [...(chunk.imports ?? []), ...(chunk.dynamicImports ?? [])]) include(dependency);
}
for (const page of pages) {
  const html = fs.readFileSync(path.join(frontend, page), 'utf8');
  for (const [, file] of html.matchAll(/(?:src|href)="\/(assets\/[\w.-]+)"/g)) {
    const key = chunksByFile.get(file);
    if (key) include(key);
    else assets.add(file);
  }
}
include('src/sprint3/mfe.tsx');
for (const file of assets) {
  if (!/^(?:assets\/[\w.-]+|index\.html|sprint3\.html|favicon\.svg)$/.test(file) || !fs.statSync(path.join(frontend, file)).isFile())
    throw new Error(`Artefato não permitido ou ausente: ${file}`);
}
if (!fs.existsSync(path.join(root, 'FrontEnd/dist-processing/processing/index.js'))) throw new Error('Compile a biblioteca antes de empacotar.');
// Destino fixo, resolvido dentro da raiz: remove apenas a distribuição gerada.
if (output !== path.join(root, 'release') || path.dirname(output) !== root) throw new Error('Destino de release inválido.');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
fs.cpSync(path.join(root, 'FrontEnd/dist-processing'), output, { recursive: true });
for (const file of assets) {
  fs.mkdirSync(path.dirname(path.join(output, file)), { recursive: true });
  fs.copyFileSync(path.join(frontend, file), path.join(output, file));
}
fs.writeFileSync(path.join(output, 'package.json'), JSON.stringify({
  name: '@smart40/expedition-processing', version: '1.0.0', type: 'module',
  exports: { '.': { types: './processing/index.d.ts', import: './processing/index.js' } },
}, null, 2));
for (const [name, cloud] of [['flows.local.json', false], ['flows.cloud.json', true]]) {
  fs.writeFileSync(path.join(output, name), JSON.stringify(createFlows({ cloud }), null, 2));
}
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify({
  module: 'smart40-expedition-processing', version: '1.0.0', interface: 'headless',
  entry: '/processing/index.js', types: '/processing/index.d.ts',
  inputEvent: 'smart40:telemetria', inputAliases: ['smart40:expedition:telemetry'],
  outputEvent: 'smart40:expedition:metrics',
  sprint3: {
    module: '@smart40/expedicao-oee', format: 'esm', entry: '/assets/sprint3-module.js',
    standalone: '/sprint3.html', lifecycles: ['bootstrap', 'mount', 'unmount'],
    connectionEvents: ['smart40:connection.state', 'smart40:expedition:connection'],
    websocketOwner: 'app-shell', simulationInProduction: false,
  },
  contractStatus: 'proposed-awaiting-group1-and-automation-validation',
}, null, 2));
console.log('Sprint 2 (biblioteca e fluxos) + Sprint 3 (standalone e módulo ESM) em release/.');
