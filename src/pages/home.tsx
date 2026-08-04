import { Link } from 'react-router-dom'
import { ChevronRightIcon } from 'lucide-react'

import { TOOLS, type Tool } from '@/lib/tools'
import { useI18n } from '@/i18n/context'
import { cn } from '@/lib/utils'

const CARD =
  'bg-card flex w-full items-center gap-3 rounded-xl border p-4 shadow-sm min-h-[4.5rem]'

/**
 * A small label on a tool card. Amber for beta rather than the theme's primary,
 * which changes with the colour switcher and would read as a highlight instead
 * of a caution. Letter spacing is English-only — it breaks up Thai clusters.
 */
function Badge({ tone, children }: { tone: 'soon' | 'beta'; children: string }) {
  const { lang } = useI18n()

  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[0.625rem] font-semibold whitespace-nowrap uppercase',
        lang === 'en' && 'tracking-wide',
        tone === 'beta'
          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
          : 'bg-muted text-muted-foreground',
      )}
    >
      {children}
    </span>
  )
}

/** A tool tile — a link once the tool exists, otherwise a dimmed "Soon" card. */
function ToolCard({ tool }: { tool: Tool }) {
  const { t } = useI18n()
  const Icon = tool.icon

  const body = (
    <>
      <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-5" />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className="leading-tight font-semibold">{t(tool.nameKey)}</span>
          {!tool.path && <Badge tone="soon">{t('soon')}</Badge>}
          {tool.path && tool.beta && <Badge tone="beta">{t('beta')}</Badge>}
        </span>
        <span className="text-muted-foreground text-sm text-balance">
          {t(tool.descKey)}
        </span>
      </span>

      {tool.path && (
        <ChevronRightIcon className="text-muted-foreground size-4 shrink-0" />
      )}
    </>
  )

  // Not built yet: shown so the direction is visible, but nothing to tap.
  if (!tool.path) {
    return (
      <div aria-disabled className={cn(CARD, 'opacity-55')}>
        {body}
      </div>
    )
  }

  return (
    <Link
      to={tool.path}
      className={cn(
        CARD,
        'hover:border-primary/40 focus-visible:ring-ring/50 outline-none transition hover:shadow-md focus-visible:ring-[3px]',
      )}
    >
      {body}
    </Link>
  )
}

export function HomePage() {
  const { t } = useI18n()

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold tracking-tight text-balance">
        {t('tagline')}
      </h1>

      {/* One column at every width: the shell is a narrow phone-shaped
          column, and two columns inside it wrap the descriptions to bits. */}
      <ul className="flex flex-col gap-3">
        {TOOLS.map((tool) => (
          <li key={tool.id} className="flex">
            <ToolCard tool={tool} />
          </li>
        ))}
      </ul>
    </div>
  )
}
