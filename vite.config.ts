import { existsSync } from 'node:fs'
import { defineConfig } from 'vite-plus'
import react from '@vitejs/plugin-react'

if (existsSync('.env.local')) process.loadEnvFile('.env.local')

const bindHost = process.env.PHYSIS_BIND_HOST ?? '127.0.0.1'
const proxyHost = bindHost.includes(':') ? `[${bindHost}]` : bindHost
const proxyPort = process.env.PHYSIS_PORT ?? '4317'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: `http://${proxyHost}:${proxyPort}`,
        changeOrigin: true,
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'server/**/*.test.ts'],
    environment: 'node',
  },
  lint: {
    ignorePatterns: ['dist/**', 'node_modules/**'],
  },
  fmt: {
    semi: false,
    singleQuote: true,
  },
})
