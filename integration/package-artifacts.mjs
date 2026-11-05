import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFlows } from './node-red/flow.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'release');
fs.mkdirSync(output, { recursive: true });
fs.cpSync(path.join(root, 'FrontEnd/dist-processing'), output, { recursive: true });
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
  contractStatus: 'proposed-awaiting-group1-and-automation-validation',
}, null, 2));
console.log('Biblioteca ESM, declarações TypeScript, manifest e fluxos exportados em release/.');
