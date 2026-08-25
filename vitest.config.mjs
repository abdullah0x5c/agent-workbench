import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.js'],
    include: ['tests/**/*.test.{js,jsx}'],
    testTimeout: 30000,
    hookTimeout: 120000,
    restoreMocks: true,
    env: {
      MONGOMS_SYSTEM_BINARY: '/usr/bin/mongod',
      MONGOMS_DISABLE_POSTINSTALL: '1',
      DEFAULT_PROVIDER: 'mock',
      ALLOW_REAL_PROVIDER: 'false',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/agent_workbench_test',
    },
  },
})
