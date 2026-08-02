import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'path'

// Konfiguracja wylacznie do testu RAG (test/rag-harness.ts) - nie wchodzi do buildu produkcyjnego.
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out-test/main',
      rollupOptions: { input: { index: resolve(__dirname, 'test/rag-harness.ts') } }
    }
  }
})
