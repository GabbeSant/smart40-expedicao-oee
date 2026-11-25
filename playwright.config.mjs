import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './integration/browser',
  testMatch: '*.spec.mjs',
  fullyParallel: false,
  workers: 1,
  globalTimeout: 120_000,
  timeout: 30_000,
  reporter: [['list'], ['json', { outputFile: 'test-results/browser-results.json' }]],
  use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node integration/serve-release.mjs', url: 'http://127.0.0.1:4173/sprint3.html', reuseExistingServer: false },
    { command: 'node integration/browser/serve-host.mjs', url: 'http://127.0.0.1:4174', reuseExistingServer: false },
    { command: 'node FrontEnd/node_modules/vite/bin/vite.js FrontEnd --host 127.0.0.1 --port 4184 --strictPort', url: 'http://127.0.0.1:4184/sprint3.html', reuseExistingServer: false },
  ],
});
