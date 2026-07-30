import { render, screen, within } from '@testing-library/react'
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

/** The saved-bills list, so amounts there are not confused with the result. */
function history() {
  return within(screen.getByRole('list', { name: /saved bills/i }))
}

/** Fill in a one-item bill and calculate it. */
async function calculateBill(
  user: ReturnType<typeof userEvent.setup>,
  { dish = 'Pad Thai', price = '220' } = {},
) {
  await user.type(screen.getByLabelText(/total bill/i), '1177')
  await user.type(screen.getByLabelText(/item 1 name/i), dish)
  await user.type(screen.getByLabelText(/item 1 price/i), price)
  await user.click(screen.getByRole('button', { name: /^calculate$/i }))
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

  it('saves every calculation to the history list', async () => {
    const user = userEvent.setup()
    renderCalc()

    expect(screen.queryByText(/saved bills/i)).not.toBeInTheDocument()

    await calculateBill(user)

    expect(await screen.findByText(/saved bills/i)).toBeInTheDocument()
    // named after the dish, since the note was left blank
    expect(history().getByText('Pad Thai')).toBeInTheDocument()
    expect(history().getByText('258.94 THB')).toBeInTheDocument()
  })

  it('keeps the note typed for the bill', async () => {
    const user = userEvent.setup()
    renderCalc()

    await user.type(screen.getByLabelText(/place \/ note/i), 'Somtam Der')
    await calculateBill(user)

    expect(await screen.findByText('Somtam Der')).toBeInTheDocument()
  })

  it('survives a reload, reading the bills back from storage', async () => {
    const user = userEvent.setup()
    const { unmount } = renderCalc()
    await calculateBill(user)
    await screen.findByText('Pad Thai')
    unmount()

    renderCalc()

    expect(screen.getByText('Pad Thai')).toBeInTheDocument()
    expect(screen.getByText('258.94 THB')).toBeInTheDocument()
  })

  it('reopens a saved bill in the form and overwrites it on recalculation', async () => {
    const user = userEvent.setup()
    renderCalc()
    await calculateBill(user)
    await screen.findByText('Pad Thai')

    await user.click(screen.getByRole('button', { name: /edit: pad thai/i }))

    // the whole bill comes back into the form
    expect(screen.getByLabelText(/item 1 name/i)).toHaveValue('Pad Thai')
    expect(screen.getByLabelText(/item 1 price/i)).toHaveValue(220)
    expect(screen.getByText(/calculating again overwrites it/i)).toBeInTheDocument()

    const price = screen.getByLabelText(/item 1 price/i)
    await user.clear(price)
    await user.type(price, '440')
    await user.click(screen.getByRole('button', { name: /^calculate$/i }))

    // updated in place, not added a second time
    expect(await history().findByText('517.88 THB')).toBeInTheDocument()
    expect(history().getAllByRole('listitem')).toHaveLength(1)
    expect(history().getByText(/edited/i)).toBeInTheDocument()
  })

  it('starts a fresh bill instead of overwriting after New bill', async () => {
    const user = userEvent.setup()
    renderCalc()
    await calculateBill(user)
    await screen.findByText('Pad Thai')

    await user.click(screen.getByRole('button', { name: /edit: pad thai/i }))
    await user.click(screen.getByRole('button', { name: /new bill/i }))

    expect(screen.getByLabelText(/item 1 name/i)).toHaveValue('')
    await calculateBill(user, { dish: 'Khao Man Gai', price: '80' })

    expect(await history().findByText('Khao Man Gai')).toBeInTheDocument()
    expect(history().getAllByRole('listitem')).toHaveLength(2)
  })

  it('deletes a single bill', async () => {
    const user = userEvent.setup()
    renderCalc()
    await calculateBill(user)
    await screen.findByText('Pad Thai')

    await user.click(screen.getByRole('button', { name: /delete: pad thai/i }))

    expect(screen.queryByText('Pad Thai')).not.toBeInTheDocument()
    expect(screen.queryByText(/saved bills/i)).not.toBeInTheDocument()
  })

  it('clears the whole history, but only on the second tap', async () => {
    const user = userEvent.setup()
    renderCalc()
    await calculateBill(user)
    await screen.findByText('Pad Thai')

    await user.click(screen.getByRole('button', { name: /clear all/i }))
    expect(screen.getByText('Pad Thai')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /tap again to clear/i }))
    expect(screen.queryByText(/saved bills/i)).not.toBeInTheDocument()
  })

  it('shows validation errors when required fields are empty', async () => {
    const user = userEvent.setup()
    renderCalc()

    await user.click(screen.getByRole('button', { name: /^calculate$/i }))

    expect((await screen.findAllByText('Required')).length).toBeGreaterThan(0)
    expect(screen.queryByText(/you should pay/i)).not.toBeInTheDocument()
  })
})
