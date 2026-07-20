import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { SplitMealCalculator } from './split-meal-calculator'

describe('SplitMealCalculator (UI)', () => {
  it('calculates and shows the settlement sentence', async () => {
    const user = userEvent.setup()
    render(<SplitMealCalculator />)

    await user.type(screen.getByLabelText(/person a food amount/i), '300')
    await user.type(screen.getByLabelText(/person b food amount/i), '200')
    await user.click(screen.getByRole('button', { name: /calculate/i }))

    // Payer defaults to A, so B transfers B's share: 0.4 * 588.5 = 235.40.
    expect(
      await screen.findByText('B should transfer 235.40 THB to A'),
    ).toBeInTheDocument()
    expect(screen.getByText('Grand total').nextSibling).toHaveTextContent(
      '588.50 THB',
    )
  })

  it('shows validation errors when required amounts are missing', async () => {
    const user = userEvent.setup()
    render(<SplitMealCalculator />)

    await user.click(screen.getByRole('button', { name: /calculate/i }))

    expect((await screen.findAllByText('Required')).length).toBeGreaterThan(0)
    expect(screen.queryByText(/should transfer/i)).not.toBeInTheDocument()
  })
})
