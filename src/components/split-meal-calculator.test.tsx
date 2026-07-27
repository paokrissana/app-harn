import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { LanguageProvider } from '@/i18n/context'
import { SplitMealCalculator } from './split-meal-calculator'

function renderCalc() {
  return render(
    <LanguageProvider>
      <SplitMealCalculator />
    </LanguageProvider>,
  )
}

describe('SplitMealCalculator (UI)', () => {
  it('computes payback from own plates with service charge and VAT', async () => {
    const user = userEvent.setup()
    renderCalc()

    await user.type(screen.getByLabelText(/total bill/i), '1177')
    await user.type(screen.getByLabelText(/item 1 price/i), '180')
    await user.click(screen.getByRole('button', { name: /add item/i }))
    await user.type(screen.getByLabelText(/item 2 price/i), '40')

    await user.click(screen.getByRole('button', { name: /^calculate$/i }))

    // 220 food + 10% SC + 7% VAT = 258.94
    expect(
      await screen.findByText('You should pay 258.94 THB to A'),
    ).toBeInTheDocument()
  })

  it('adds a shared dish and includes the user’s slice', async () => {
    const user = userEvent.setup()
    renderCalc()

    await user.type(screen.getByLabelText(/total bill/i), '1177')
    await user.type(screen.getByLabelText(/item 1 price/i), '220')

    await user.click(screen.getByRole('button', { name: /add shared/i }))
    await user.type(screen.getByLabelText(/shared item 1 price/i), '300')
    const shares = screen.getByLabelText(/shared item 1 people sharing/i)
    await user.clear(shares)
    await user.type(shares, '4') // 300 / 4 = 75

    await user.click(screen.getByRole('button', { name: /^calculate$/i }))

    // (220 + 75) * 1.10 * 1.07 = 347.215 -> 347.22 THB
    expect(
      await screen.findByText('You should pay 347.22 THB to A'),
    ).toBeInTheDocument()
  })

  it('removes a shared dish', async () => {
    const user = userEvent.setup()
    renderCalc()

    await user.click(screen.getByRole('button', { name: /add shared/i }))
    expect(screen.getByLabelText(/shared item 1 price/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /remove shared item 1/i }))
    expect(
      screen.queryByLabelText(/shared item 1 price/i),
    ).not.toBeInTheDocument()
  })

  it('has service charge and VAT switched on by default', () => {
    renderCalc()

    expect(
      screen.getByRole('switch', { name: /include service charge/i }),
    ).toBeChecked()
    expect(screen.getByRole('switch', { name: /include vat/i })).toBeChecked()
    expect(screen.getByLabelText(/service charge %/i)).toBeEnabled()
    expect(screen.getByLabelText(/vat %/i)).toBeEnabled()
  })

  it('drops both charges when their toggles are switched off', async () => {
    const user = userEvent.setup()
    renderCalc()

    await user.type(screen.getByLabelText(/total bill/i), '1177')
    await user.type(screen.getByLabelText(/item 1 price/i), '220')

    await user.click(
      screen.getByRole('switch', { name: /include service charge/i }),
    )
    await user.click(screen.getByRole('switch', { name: /include vat/i }))

    // percentage boxes go dead once their charge is off
    expect(screen.getByLabelText(/service charge %/i)).toBeDisabled()
    expect(screen.getByLabelText(/vat %/i)).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /^calculate$/i }))

    expect(
      await screen.findByText('You should pay 220.00 THB to A'),
    ).toBeInTheDocument()
    // and the charge rows disappear from the summary
    expect(screen.queryByText('Service charge')).not.toBeInTheDocument()
    expect(screen.queryByText('VAT')).not.toBeInTheDocument()
  })

  it('keeps VAT when only service charge is switched off', async () => {
    const user = userEvent.setup()
    renderCalc()

    await user.type(screen.getByLabelText(/total bill/i), '1177')
    await user.type(screen.getByLabelText(/item 1 price/i), '220')
    await user.click(
      screen.getByRole('switch', { name: /include service charge/i }),
    )

    await user.click(screen.getByRole('button', { name: /^calculate$/i }))

    // 220 + 7% VAT = 235.40
    expect(
      await screen.findByText('You should pay 235.40 THB to A'),
    ).toBeInTheDocument()
    expect(screen.getByText('VAT')).toBeInTheDocument()
    expect(screen.queryByText('Service charge')).not.toBeInTheDocument()
  })

  it('does not demand a percentage for a charge that is switched off', async () => {
    const user = userEvent.setup()
    renderCalc()

    await user.type(screen.getByLabelText(/total bill/i), '1177')
    await user.type(screen.getByLabelText(/item 1 price/i), '220')

    // empty the VAT box, then switch VAT off — no error, no VAT charged
    await user.clear(screen.getByLabelText(/vat %/i))
    await user.click(screen.getByRole('switch', { name: /include vat/i }))

    await user.click(screen.getByRole('button', { name: /^calculate$/i }))

    // 220 + 10% SC = 242.00
    expect(
      await screen.findByText('You should pay 242.00 THB to A'),
    ).toBeInTheDocument()
  })

  it('still requires a percentage while the charge is switched on', async () => {
    const user = userEvent.setup()
    renderCalc()

    await user.type(screen.getByLabelText(/total bill/i), '1177')
    await user.type(screen.getByLabelText(/item 1 price/i), '220')
    await user.clear(screen.getByLabelText(/vat %/i))

    await user.click(screen.getByRole('button', { name: /^calculate$/i }))

    expect((await screen.findAllByText('Required')).length).toBeGreaterThan(0)
    expect(screen.queryByText(/you should pay/i)).not.toBeInTheDocument()
  })

  it('shows validation errors when required fields are empty', async () => {
    const user = userEvent.setup()
    renderCalc()

    await user.click(screen.getByRole('button', { name: /^calculate$/i }))

    expect((await screen.findAllByText('Required')).length).toBeGreaterThan(0)
    expect(screen.queryByText(/you should pay/i)).not.toBeInTheDocument()
  })
})
