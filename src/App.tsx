import { SplitMealCalculator } from '@/components/split-meal-calculator'
import { ThemeToggle } from '@/components/theme-toggle'
import { LanguageToggle } from '@/components/language-toggle'
import { AccentSwitcher } from '@/components/accent-switcher'
import { Logo } from '@/components/logo'
import { useI18n } from '@/i18n/context'

function App() {
  const { t } = useI18n()

  return (
    <div className="relative min-h-svh w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/15 to-transparent" />

      <div className="relative mx-auto flex min-h-svh w-full max-w-lg flex-col gap-6 px-4 py-8 sm:py-12">
        <header className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Logo className="size-9" />
              <h1 className="text-2xl font-extrabold tracking-tight">
                {t('appName')}
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
          <p className="text-muted-foreground text-sm text-balance">
            {t('subtitle')}
          </p>
          <div className="flex items-center gap-3 pt-1">
            <span className="text-muted-foreground text-xs">{t('switchColour')}</span>
            <AccentSwitcher />
          </div>
        </header>

        <main>
          <SplitMealCalculator />
        </main>
      </div>
    </div>
  )
}

export default App
