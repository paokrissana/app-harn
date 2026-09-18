/**
 * The languages a page can be described in.
 *
 * Declared here rather than imported so this module has no imports at all —
 * `vite.config.ts` pulls it in to pre-render each route's head, and an aliased
 * import would drag the app's path mapping into the build config's resolution.
 * `seo.test.ts` asserts at compile time that this stays identical to the app's
 * `Lang`, so the two cannot drift.
 */
export type SeoLang = 'en' | 'th'

/**
 * Where the site actually lives. Canonical URLs and the sitemap need an
 * absolute address, and a relative one would point at whatever host served the
 * page — including a preview build.
 */
export const SITE_URL = 'https://paokrissana.github.io/app-harn'

/** What a page tells a search engine about itself. */
export interface PageMeta {
  title: string
  description: string
}

/**
 * Per-route metadata, both languages.
 *
 * Written for the searches in CLAUDE.md §9, which is why the Thai leads with
 * the phrase somebody would actually type rather than the tool's name. A title
 * is the strongest on-page signal there is and the line people decide to click,
 * so it carries the query; the description does not rank at all and exists to
 * earn the click.
 */
const PAGES: Record<string, Record<SeoLang, PageMeta>> = {
  '/': {
    th: {
      title: 'AppHarn — หารค่าอาหาร คิดเปอร์เซ็นต์ แบ่งบิลกับเพื่อน',
      description:
        'เครื่องมือหารเงินง่าย ๆ หารค่าอาหาร แบ่งบิลทั้งโต๊ะ หารค่า GrabFood และคิดเปอร์เซ็นต์ ใช้ฟรี ไม่ต้องสมัคร',
    },
    en: {
      title: 'AppHarn — split bills and work out percentages',
      description:
        'Simple tools for splitting money: meals, group delivery orders, one restaurant bill, and a percentage calculator. Free, no sign-up.',
    },
  },
  '/split-meal': {
    th: {
      title: 'หารค่าอาหาร — จ่ายคืนเพื่อนเท่าไหร่ | AppHarn',
      description:
        'คิดยอดที่ต้องจ่ายคืนคนที่ออกเงินให้ รวมค่าบริการ VAT และทิป ใส่เฉพาะรายการของคุณ',
    },
    en: {
      title: 'Split Meal — what you owe when a friend paid | AppHarn',
      description:
        'Work out what to pay back the person who covered the bill, including service charge, VAT and a tip.',
    },
  },
  '/percentage': {
    th: {
      title: 'คิดเปอร์เซ็นต์ — 80% ของ 1500, ลด 60% เหลือเท่าไหร่ | AppHarn',
      description:
        'คิดเปอร์เซ็นต์ของยอดเงิน คิดส่วนลด คิดราคาที่เพิ่มขึ้น และหาว่ายอดหนึ่งเป็นกี่เปอร์เซ็นต์ของอีกยอด',
    },
    en: {
      title: 'Percentage Calculator — discounts, increases and shares | AppHarn',
      description:
        'What is 80% of 1,500? Take 60% off 5,000? Four everyday percentage questions, answered as you type.',
    },
  },
  '/split-group-order': {
    th: {
      title: 'หารค่า GrabFood — สั่งรวมแล้วใครจ่ายเท่าไหร่ | AppHarn',
      description:
        'สั่งเดลิเวอรีให้ทั้งกลุ่มแล้วคิดว่าใครต้องคืนเท่าไหร่ หารค่าส่ง แยกส่วนลด และจานที่แชร์กัน',
    },
    en: {
      title: 'Split Group Order — who owes you after a delivery | AppHarn',
      description:
        'You ordered delivery for everyone. Work out what each person owes, with the delivery fee, promos and shared plates.',
    },
  },
  '/split-group-meal': {
    th: {
      title: 'หารค่าอาหารหลายคน — แบ่งบิลทั้งโต๊ะ | AppHarn',
      description:
        'บิลเดียวทั้งโต๊ะ แบ่งให้แต่ละคนตามที่กินจริง พร้อมค่าบริการ 10% และ VAT 7%',
    },
    en: {
      title: 'Split Group Meal — one restaurant bill, everyone’s share | AppHarn',
      description:
        'Split one restaurant bill by what each person actually ate, with service charge and VAT.',
    },
  },
}

/**
 * Every route worth indexing — the keys above, in order.
 *
 * Deliberately not derived from the tool registry: this module is imported by
 * `vite.config.ts` at build time, and reaching into the registry would drag the
 * icon library into the config's module graph. A tool without an entry here is
 * simply not pre-rendered, which a test catches.
 */
export const INDEXED_ROUTES: string[] = Object.keys(PAGES)

/**
 * The metadata for a route. Falls back to the home page for anything unlisted,
 * so a new tool without an entry is merely generic rather than blank.
 */
export function metaFor(path: string, lang: SeoLang): PageMeta {
  const page = PAGES[path] ?? PAGES['/']
  return page[lang]
}

/** The absolute address of a route, for canonical tags and the sitemap. */
export function canonicalFor(path: string): string {
  return path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`
}
