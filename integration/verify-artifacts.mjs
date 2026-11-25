import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'release');
const manifest = JSON.parse(fs.readFileSync(path.join(output, 'manifest.json'), 'utf8'));
const files = fs.readdirSync(output, { recursive: true }).filter(file => fs.statSync(path.join(output, file)).isFile()).map(file => file.replaceAll(path.sep, '/'));
for (const file of ['index.html', 'sprint3.html', manifest.entry.slice(1), manifest.types.slice(1),
  manifest.sprint3.entry.slice(1), 'flows.local.json', 'flows.cloud.json', 'package.json']) assert.ok(files.includes(file), file);
for (const file of files) {
  assert.ok(!/(?:^|[/\\])\.|\.map$|\.env|(?:^|[/\\])(?:data|node_modules|plant|api-mes)(?:[/\\]|$)/i.test(file), `Arquivo local indevido: ${file}`);
  assert.ok(!/^assets\/dashboard-/.test(file), `Demonstração simulada indevida: ${file}`);
  if (!/\.(?:js|html|css)$/.test(file)) continue;
  const contents = fs.readFileSync(path.join(output, file), 'utf8');
  assert.ok(!/Simular no desenvolvimento|Ler bancada N2|S3_STOCK_PASSWORD/.test(contents), `Configuração de desenvolvimento publicada: ${file}`);
  if (file.startsWith('assets/') || file.endsWith('.html'))
    assert.ok(!/192\.168\.|localhost:1880/.test(contents), `Endereço local no frontend: ${file}`);
  // ESM, folhas de estilo e referências do HTML têm que fechar dentro da distribuição.
  const references = [...contents.matchAll(/(?:\bfrom\s*|\bimport\s*|\bimport\s*\(\s*|(?:src|href)=)["']([^"']+)["']/g)];
  for (const [, reference] of references) {
    if (!reference.startsWith('.') && !reference.startsWith('/')) continue;
    const resolved = reference.startsWith('/') ? path.join(output, reference.slice(1)) : path.resolve(output, path.dirname(file), reference);
    assert.ok(resolved.startsWith(`${output}${path.sep}`) && fs.existsSync(resolved), `${file}: import/asset ausente ${reference}`);
  }
}
const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
assert.equal(config.outputDirectory, 'release');
assert.equal(config.buildCommand, 'npm run build:release');
assert.ok(config.headers.some(rule => rule.headers.some(header => header.key === 'Access-Control-Allow-Origin' && header.value === '*')));
assert.deepEqual(manifest.sprint3.lifecycles, ['bootstrap', 'mount', 'unmount']);
console.log(`Distribuição validada: ${files.length} arquivos; imports/assets, Sprint 2, Sprint 3, CORS e exclusão de arquivos locais.`);
