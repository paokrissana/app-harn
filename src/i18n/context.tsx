import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  translations,
  type Lang,
  type TranslationKey,
} from '@/i18n/translations'

type Translate = (
  key: TranslationKey,
  params?: Record<string, string | number>,
) => string

interface I18nValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: Translate
}

const I18nContext = createContext<I18nValue | null>(null)

function getInitialLang(): Lang {
  const stored = localStorage.getItem('lang')
  return stored === 'en' || stored === 'th' ? stored : 'en'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(getInitialLang)

  useEffect(() => {
    localStorage.setItem('lang', lang)
    document.documentElement.lang = lang
  }, [lang])

  const t = useCallback<Translate>(
    (key, params) => {
      let text = translations[lang][key] ?? translations.en[key] ?? key
      if (params) {
        for (const [name, value] of Object.entries(params)) {
          text = text.replace(`{${name}}`, String(value))
        }
      }
      return text
    },
    [lang],
  )

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error('useI18n must be used within a LanguageProvider')
  }
  return ctx
}
