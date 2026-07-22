import { SplitMealCalculator } from '@/components/split-meal-calculator'
import { ThemeToggle } from '@/components/theme-toggle'
import { LanguageToggle } from '@/components/language-toggle'
import { useI18n } from '@/i18n/context'

function App() {
  const { t } = useI18n()

  return (
    <div className="bg-background text-foreground min-h-svh w-full">
      <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col gap-6 px-4 py-10">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">
              {t('appName')}
            </h1>
            <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
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
