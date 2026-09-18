import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { LanguageProvider } from '@/i18n/context'
import { ServiceChargeCalculator } from './service-charge-calculator'
import { TipCalculator } from './tip-calculator'
import { VatCalculator } from './vat-calculator'

type User = ReturnType<typeof userEvent.setup>

const renderIn = (ui: React.ReactElement) =>
  render(<LanguageProvider>{ui}</LanguageProvider>)

async function fill(user: User, label: RegExp, value: string) {
  const box = screen.getByLabelText(label)
  await user.clear(box)
  await user.type(box, value)
}

describe('VAT Calculator', () => {
  it('waits for an amount before answering', () => {
    renderIn(<VatCalculator />)
    expect(screen.queryByText(/total with vat/i)).toBeNull()
  })

  it('adds 7% to a price without it', async () => {
    const user = userEvent.setup()
    renderIn(<VatCalculator />)

    await fill(user, /before vat/i, '100')

    expect(screen.getByText('107')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('takes VAT back out by dividing, not subtracting', async () => {
    const user = userEvent.setup()
    renderIn(<VatCalculator />)

    await user.click(screen.getByRole('tab', { name: /remove vat/i }))
    await fill(user, /total with vat/i, '107')

    // 100, not the 99.51 that subtracting 7% would give.
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.queryByText('99.51')).toBeNull()
  })

  it('takes a rate other than 7', async () => {
    const user = userEvent.setup()
    renderIn(<VatCalculator />)

    await fill(user, /before vat/i, '200')
    await fill(user, /vat rate/i, '10')

    expect(screen.getByText('220')).toBeInTheDocument()
  })
})

describe('Service Charge Calculator', () => {
  it('puts VAT on the service charge, not just the food', async () => {
    const user = userEvent.setup()
    renderIn(<ServiceChargeCalculator />)

    await fill(user, /food and drink/i, '1000')

    // 1,000 + 10% = 1,100, then 7% of that. 1,177, not the 1,170 a flat 17%
    // would give.
    expect(screen.getByText('1,177')).toBeInTheDocument()
    expect(screen.queryByText('1,170')).toBeNull()
  })

  it('shows each step of the bill', async () => {
    const user = userEvent.setup()
    renderIn(<ServiceChargeCalculator />)

    await fill(user, /food and drink/i, '1000')

    expect(screen.getByText('+ 100')).toBeInTheDocument() // service charge
    expect(screen.getByText('+ 77')).toBeInTheDocument() // VAT on 1,100
  })

  it('handles a place that charges VAT only', async () => {
    const user = userEvent.setup()
    renderIn(<ServiceChargeCalculator />)

    await fill(user, /food and drink/i, '1000')
    await fill(user, /service charge/i, '0')

    expect(screen.getByText('1,070')).toBeInTheDocument()
  })
})

describe('Tip Calculator', () => {
  it('adds a tip to the bill', async () => {
    const user = userEvent.setup()
    renderIn(<TipCalculator />)

    await fill(user, /the bill/i, '1000')

    expect(screen.getByText(/total with tip/i)).toBeInTheDocument()
    expect(screen.getByText('1,100')).toBeInTheDocument()
  })

  it('switches to a per-person answer once it is being split', async () => {
    const user = userEvent.setup()
    renderIn(<TipCalculator />)

    await fill(user, /the bill/i, '1000')
    await fill(user, /split between how many/i, '4')

    expect(screen.getByText(/each person pays/i)).toBeInTheDocument()
    expect(screen.getByText('275')).toBeInTheDocument()
  })

  it('does not ask about splitting when it is just you', async () => {
    const user = userEvent.setup()
    renderIn(<TipCalculator />)

    await fill(user, /the bill/i, '1000')

    expect(screen.queryByText(/each person pays/i)).toBeNull()
  })

  it('still answers with no tip at all', async () => {
    const user = userEvent.setup()
    renderIn(<TipCalculator />)

    await fill(user, /the bill/i, '1000')
    await fill(user, /^tip$/i, '0')

    expect(screen.getByText('+ 0')).toBeInTheDocument()
    // The bill and the total are the same figure, so it appears twice: once as
    // the working, once as the answer.
    expect(screen.getAllByText('1,000')).toHaveLength(2)
  })
})
