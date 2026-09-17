import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

import { useI18n } from '@/i18n/context'
import { canonicalFor, metaFor, SITE_URL } from '@/lib/seo'

/**
 * The head of whatever page is showing.
 *
 * React 19 hoists `<title>` and `<meta>` rendered anywhere in the tree into
 * `<head>`, so this needs no helmet library and no manual DOM writing. It sits
 * in the app shell and follows the router, which means one component covers
 * every route instead of each page remembering to describe itself.
 *
 * `<html lang>` is the exception — it is an attribute on a node React does not
 * own, so that one is still set by hand.
 */
export function PageMeta() {
  const { lang } = useI18n()
  const { pathname } = useLocation()

  const path = pathname === '' ? '/' : pathname
  const { title, description } = metaFor(path, lang)
  const canonical = canonicalFor(path)

  // Tells a crawler, and a screen reader, which language it is reading.
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      {/* What LINE, Messenger and the rest show when the link is shared. */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="AppHarn" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:locale" content={lang === 'th' ? 'th_TH' : 'en_GB'} />
      <meta property="og:image" content={`${SITE_URL}/favicon.svg`} />
      <meta name="twitter:card" content="summary" />
    </>
  )
}
