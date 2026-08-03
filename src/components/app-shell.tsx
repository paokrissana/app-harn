import { Link, Outlet } from 'react-router-dom'

import { useI18n } from '@/i18n/context'
import { AccentSwitcher } from '@/components/accent-switcher'
import { LanguageToggle } from '@/components/language-toggle'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'

/**
 * Chrome shared by every page: the brand (which is also the way home), the
 * language, theme and colour controls, and the page itself. Each page brings
 * its own heading.
 */
export function AppShell() {
  const { t } = useI18n()

  return (
    <div className="relative min-h-svh w-full overflow-hidden">
      <div className="from-primary/15 pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b to-transparent" />

      <div className="relative mx-auto flex min-h-svh w-full max-w-lg flex-col gap-6 px-4 py-8 sm:py-12">
        <header className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <Link
              to="/"
              className="focus-visible:ring-ring/50 flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-[3px]"
            >
              <Logo className="size-9" />
              <span className="text-2xl font-extrabold tracking-tight">
                {t('appName')}
              </span>
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <span className="text-muted-foreground text-xs">
              {t('switchColour')}
            </span>
            <AccentSwitcher />
          </div>
        </header>

        <main>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
