import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { sprint3Bench } from './sprint3-bench.ts'

export default defineConfig(({ mode }) => ({
  plugins: [react(), mode === 'bancada' && sprint3Bench(loadEnv(mode, process.cwd(), 'S3_'))],
  build: {
    rolldownOptions: {
      preserveEntrySignatures: 'strict',
      input: {
        dashboard: fileURLToPath(new URL('./index.html', import.meta.url)),
        sprint3: fileURLToPath(new URL('./sprint3.html', import.meta.url)),
        sprint3Module: fileURLToPath(new URL('./src/sprint3/mfe.tsx', import.meta.url)),
      },
      output: { entryFileNames: chunk => chunk.name === 'sprint3Module' ? 'assets/sprint3-module.js' : 'assets/[name]-[hash].js' },
    },
  },
  server: {
    port: 8084
  }
}))
