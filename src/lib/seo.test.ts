import { describe, expect, it } from 'vitest'

import type { Lang } from '@/i18n/translations'
import { TOOLS } from '@/lib/tools'
import {
  canonicalFor,
  INDEXED_ROUTES,
  metaFor,
  SITE_URL,
  type SeoLang,
} from '@/lib/seo'

/*
 * seo.ts declares its own language union so it can stay import-free for the
 * build config. This fails to compile if the two ever drift apart.
 */
type Identical<A, B> = A extends B ? (B extends A ? true : never) : never
const LANGS_MATCH: Identical<SeoLang, Lang> = true

describe('seo metadata', () => {
  it('keeps its language union in step with the app', () => {
    expect(LANGS_MATCH).toBe(true)
  })

  it('describes every tool that has a page', () => {
    const built = TOOLS.filter((tool) => tool.path !== null).map(
      (tool) => tool.path,
    )

    for (const path of built) {
      expect(INDEXED_ROUTES).toContain(path)
    }
  })

  it('gives every route a distinct title in both languages', () => {
    for (const lang of ['th', 'en'] as const) {
      const titles = INDEXED_ROUTES.map((route) => metaFor(route, lang).title)
      expect(new Set(titles).size).toBe(titles.length)
    }
  })

  it('carries the searches each page is meant to answer', () => {
    // The whole point of the Thai copy — these are the queries from CLAUDE.md.
    expect(metaFor('/percentage', 'th').title).toContain('80% ของ 1500')
    expect(metaFor('/split-meal', 'th').title).toContain('หารค่าอาหาร')
    expect(metaFor('/split-group-order', 'th').title).toContain('GrabFood')
    expect(metaFor('/split-group-meal', 'th').title).toContain(
      'หารค่าอาหารหลายคน',
    )
  })

  it('keeps titles and descriptions to a length a result can show', () => {
    for (const route of INDEXED_ROUTES) {
      for (const lang of ['th', 'en'] as const) {
        const { title, description } = metaFor(route, lang)
        expect(title.length).toBeLessThanOrEqual(70)
        expect(description.length).toBeGreaterThan(50)
        expect(description.length).toBeLessThanOrEqual(165)
      }
    }
  })

  it('falls back to the home page for a route it does not know', () => {
    expect(metaFor('/not-a-page', 'th')).toEqual(metaFor('/', 'th'))
  })

  it('builds absolute canonical urls, with one slash for home', () => {
    expect(canonicalFor('/')).toBe(`${SITE_URL}/`)
    expect(canonicalFor('/percentage')).toBe(`${SITE_URL}/percentage`)
  })
})
