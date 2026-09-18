import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { LanguageProvider } from '@/i18n/context'
import { PercentageCalculator } from './percentage-calculator'

type User = ReturnType<typeof userEvent.setup>

function renderCalculator() {
  return render(
    <LanguageProvider>
      <PercentageCalculator />
    </LanguageProvider>,
  )
}

const pickMode = (user: User, name: RegExp) =>
  user.click(screen.getByRole('tab', { name }))

/** Type into the two boxes, clearing whatever was there. */
async function enter(user: User, percentage: string, amount: string) {
  const [first, second] = screen.getAllByRole('spinbutton')
  await user.clear(first)
  await user.type(first, percentage)
  await user.clear(second)
  await user.type(second, amount)
}

describe('Percentage Calculator', () => {
  it('shows no answer until both boxes are filled', async () => {
    const user = userEvent.setup()
    renderCalculator()

    expect(screen.queryByText(/answer/i)).toBeNull()

    const [first] = screen.getAllByRole('spinbutton')
    await user.type(first, '80')
    expect(screen.queryByText(/answer/i)).toBeNull()
  })

  it('answers 80% of 1,500 without being asked to calculate', async () => {
    const user = userEvent.setup()
    renderCalculator()

    await enter(user, '80', '1500')

    expect(screen.getByText('80% of 1,500')).toBeInTheDocument()
    expect(screen.getByText('1,200')).toBeInTheDocument()
  })

  it('shows both the saving and what you pay on a discount', async () => {
    const user = userEvent.setup()
    renderCalculator()

    await pickMode(user, /take a percentage off/i)
    await enter(user, '60', '5000')

    expect(screen.getByText('60% off 5,000')).toBeInTheDocument()
    expect(screen.getByText('You save 3,000')).toBeInTheDocument()
    expect(screen.getByText(/you pay/i)).toBeInTheDocument()
    expect(screen.getByText('2,000')).toBeInTheDocument()
  })

  it('shows what was added and the new amount on an increase', async () => {
    const user = userEvent.setup()
    renderCalculator()

    await pickMode(user, /add a percentage on/i)
    await enter(user, '10', '1000')

    expect(screen.getByText('Adds 100')).toBeInTheDocument()
    expect(screen.getByText('1,100')).toBeInTheDocument()
  })

  it('answers 800 out of 1,000 as a percentage', async () => {
    const user = userEvent.setup()
    renderCalculator()

    await pickMode(user, /one amount as a percentage of another/i)
    await enter(user, '800', '1000')

    expect(screen.getByText('800 out of 1,000')).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
  })

  it('refuses a discount over 100% and withholds the answer', async () => {
    const user = userEvent.setup()
    renderCalculator()

    await pickMode(user, /take a percentage off/i)
    await enter(user, '150', '5000')

    expect(screen.getByText('At most 100%')).toBeInTheDocument()
    expect(screen.queryByText(/you pay/i)).toBeNull()
  })

  it('refuses a whole of zero', async () => {
    const user = userEvent.setup()
    renderCalculator()

    await pickMode(user, /one amount as a percentage of another/i)
    await enter(user, '800', '0')

    expect(screen.getByText('Cannot be zero')).toBeInTheDocument()
  })

  it('keeps the numbers when the question changes', async () => {
    const user = userEvent.setup()
    renderCalculator()

    await enter(user, '10', '1000')
    expect(screen.getByText('10% of 1,000')).toBeInTheDocument()

    await pickMode(user, /add a percentage on/i)
    expect(screen.getByText('10% more than 1,000')).toBeInTheDocument()
  })

  it('handles decimals in both boxes', async () => {
    const user = userEvent.setup()
    renderCalculator()

    await enter(user, '12.5', '200')
    expect(screen.getByText('25')).toBeInTheDocument()
  })

  it('names the mode it is on, for anyone not looking at the tabs', async () => {
    const user = userEvent.setup()
    renderCalculator()

    expect(
      screen.getByRole('tab', { name: /percentage of an amount/i }),
    ).toHaveAttribute('aria-selected', 'true')

    await pickMode(user, /take a percentage off/i)
    expect(
      screen.getByRole('tab', { name: /take a percentage off/i }),
    ).toHaveAttribute('aria-selected', 'true')
  })
})
