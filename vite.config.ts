/// <reference types="vitest/config" />
import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * GitHub Pages has no server to rewrite unknown paths onto index.html, so a
 * deep link like /app-harn/split-meal would 404 on refresh. Pages does serve
 * 404.html for anything it cannot find, so shipping the app as 404.html makes
 * every route resolve. Done here rather than in the workflow so `npm run
 * preview` behaves like production.
 */
function pagesDeepLinkFallback(): Plugin {
  return {
    name: 'pages-deep-link-fallback',
    apply: 'build',
    closeBundle() {
      const dist = path.resolve(import.meta.dirname, 'dist')
      const index = path.join(dist, 'index.html')
      if (fs.existsSync(index)) {
        fs.copyFileSync(index, path.join(dist, '404.html'))
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Served from https://paokrissana.github.io/app-harn/ in production.
  base: command === 'build' ? '/app-harn/' : '/',
  plugins: [react(), tailwindcss(), pagesDeepLinkFallback()],
  server: {
    port: 6900,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
}))
