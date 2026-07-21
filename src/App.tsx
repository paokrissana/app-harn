import { SplitMealCalculator } from '@/components/split-meal-calculator'
import { ThemeToggle } from '@/components/theme-toggle'

function App() {
  return (
    <div className="bg-background text-foreground min-h-svh w-full">
      <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col gap-6 px-4 py-10">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">
              Split Meal Calculator
            </h1>
            <p className="text-muted-foreground text-sm">
              Work out what you owe whoever paid — your plates plus Service
              Charge and VAT.
            </p>
          </div>
          <ThemeToggle />
        </header>

        <main>
          <SplitMealCalculator />
        </main>
      </div>
    </div>
  )
}

export default App
