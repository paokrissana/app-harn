import { useEffect, useState } from 'react'

import { useI18n } from '@/i18n/context'
import { cn } from '@/lib/utils'

const ACCENTS = [
  { key: 'emerald', color: 'oklch(0.596 0.145 163.225)' },
  { key: 'indigo', color: 'oklch(0.511 0.262 276.966)' },
  { key: 'violet', color: 'oklch(0.541 0.281 293.009)' },
  { key: 'rose', color: 'oklch(0.586 0.253 17.585)' },
] as const

type Accent = (typeof ACCENTS)[number]['key']

function getInitialAccent(): Accent {
  const stored = localStorage.getItem('accent')
  return ACCENTS.some((a) => a.key === stored) ? (stored as Accent) : 'emerald'
}

export function AccentSwitcher() {
  const { t } = useI18n()
  const [accent, setAccent] = useState<Accent>(getInitialAccent)

  useEffect(() => {
    document.documentElement.dataset.accent = accent
    localStorage.setItem('accent', accent)
  }, [accent])

  return (
    <div
      role="group"
      aria-label={t('switchColour')}
      className="flex items-center gap-1.5"
    >
      {ACCENTS.map((a) => (
        <button
          key={a.key}
          type="button"
          aria-label={a.key}
          aria-pressed={accent === a.key}
          onClick={() => setAccent(a.key)}
          style={{ backgroundColor: a.color }}
          className={cn(
            'ring-offset-background size-5 rounded-full ring-offset-2 transition',
            accent === a.key
              ? 'ring-foreground/60 ring-2'
              : 'ring-0 hover:scale-110',
          )}
        />
      ))}
    </div>
  )
}
