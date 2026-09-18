/// <reference types="vitest/config" />
import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import {
  canonicalFor,
  INDEXED_ROUTES,
  metaFor,
  SITE_URL,
} from './src/lib/seo.js'

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

/** Escape for an HTML attribute — titles and descriptions contain quotes. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Bake each route's head into a real HTML file.
 *
 * The 404.html fallback above makes deep links *render*, but the file it serves
 * is the generic shell and the HTTP status is still 404 — so a crawler is told
 * the page does not exist, and what little it does read says "App Harn" for
 * every route. Writing dist/percentage/index.html fixes both: the file exists,
 * so Pages answers 200, and the title and description are in the markup before
 * any JavaScript runs.
 *
 * Only the head is generated. The body is identical on every route and React
 * fills it in on load, so rendering it here would be machinery for no gain —
 * these pages have no server data to wait for. The head is the whole point.
 *
 * Metadata is the Thai copy, matching the app's default: the served HTML can
 * only carry one language, and Thai is the one the target searches are in.
 */
function prerenderRouteHeads(): Plugin {
  return {
    name: 'prerender-route-heads',
    apply: 'build',
    closeBundle() {
      const dist = path.resolve(import.meta.dirname, 'dist')
      const shell = path.join(dist, 'index.html')
      if (!fs.existsSync(shell)) return

      const template = fs.readFileSync(shell, 'utf8')

      const headFor = (route: string) => {
        const { title, description } = metaFor(route, 'th')
        const canonical = canonicalFor(route)

        return [
          `<title>${escapeHtml(title)}</title>`,
          `<meta name="description" content="${escapeHtml(description)}" />`,
          `<link rel="canonical" href="${canonical}" />`,
          `<meta property="og:type" content="website" />`,
          `<meta property="og:site_name" content="AppHarn" />`,
          `<meta property="og:title" content="${escapeHtml(title)}" />`,
          `<meta property="og:description" content="${escapeHtml(description)}" />`,
          `<meta property="og:url" content="${canonical}" />`,
          `<meta property="og:locale" content="th_TH" />`,
          `<meta name="twitter:card" content="summary" />`,
        ].join('\n    ')
      }

      for (const route of INDEXED_ROUTES) {
        const html = template.replace(/<title>.*?<\/title>/, headFor(route))

        if (route === '/') {
          fs.writeFileSync(shell, html)
          // The fallback inherits the home page's head, which is the right
          // generic answer for a URL we do not know about.
          fs.writeFileSync(path.join(dist, '404.html'), html)
          continue
        }

        const dir = path.join(dist, route.replace(/^\//, ''))
        fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(path.join(dir, 'index.html'), html)
      }

      // Nothing here is private, and the sitemap is the fastest way for a
      // crawler to learn the deep links exist at all.
      fs.writeFileSync(
        path.join(dist, 'robots.txt'),
        `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`,
      )

      const urls = INDEXED_ROUTES.map(
        (route: string) => `  <url><loc>${canonicalFor(route)}</loc></url>`,
      ).join('\n')
      fs.writeFileSync(
        path.join(dist, 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Served from https://paokrissana.github.io/app-harn/ in production.
  base: command === 'build' ? '/app-harn/' : '/',
  plugins: [
    react(),
    tailwindcss(),
    pagesDeepLinkFallback(),
    prerenderRouteHeads(),
  ],
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
