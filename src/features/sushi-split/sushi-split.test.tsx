import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { LanguageProvider } from '@/i18n/context'
import { SushiSplit } from './sushi-split'

type User = ReturnType<typeof userEvent.setup>

const renderSushi = () =>
  render(
    <LanguageProvider>
      <SushiSplit />
    </LanguageProvider>,
  )

async function fill(user: User, label: string, value: string) {
  const box = screen.getByLabelText(label)
  await user.clear(box)
  await user.type(box, value)
}

/** Tap the + for a plate `times` times. */
async function tap(user: User, plate: string, name: string, times: number) {
  const plus = screen.getByRole('button', {
    name: `One more ${plate} plate for ${name}`,
  })
  for (let i = 0; i < times; i++) await user.click(plus)
}

/** The spec's worked example, typed in from scratch. */
async function enterTheMeal(user: User) {
  await fill(user, 'Restaurant name', 'Test Sushi')
  await fill(user, 'Price of Red', '40')
  await fill(user, 'Price of Blue', '50')
  await fill(user, 'Price of Green', '60')
  await fill(user, 'Price of Yellow', '70')

  await fill(user, 'Name 1', 'Pao')
  await fill(user, 'Name 2', 'A')

  await tap(user, 'Red', 'Pao', 3)
  await tap(user, 'Blue', 'Pao', 2)
  await tap(user, 'Green', 'Pao', 1)
  await tap(user, 'Red', 'A', 2)
  await tap(user, 'Yellow', 'A', 2)
}

const calculate = (user: User) =>
  user.click(screen.getByRole('button', { name: /^calculate$/i }))

describe('Split Sushi', () => {
  it('starts somewhere new, with the usual plates and no prices', () => {
    renderSushi()

    expect(screen.getByLabelText('Restaurant')).toHaveValue('other')
    for (const plate of ['Red', 'Blue', 'Green', 'Yellow']) {
      expect(screen.getByLabelText(`Price of ${plate}`)).toHaveValue(null)
    }
  })

  it('counts plates up and down, never below none', async () => {
    const user = userEvent.setup()
    renderSushi()
    await fill(user, 'Name 1', 'Pao')

    const less = screen.getByRole('button', { name: 'One less Red plate for Pao' })
    expect(less).toBeDisabled()

    await tap(user, 'Red', 'Pao', 3)
    await user.click(less)

    expect(screen.getByLabelText('Red plates for Pao')).toHaveTextContent('2')
  })

  it('keeps each person’s food total up to date as plates go on', async () => {
    const user = userEvent.setup()
    renderSushi()

    await enterTheMeal(user)

    expect(screen.getByLabelText('Food so far for Pao')).toHaveTextContent(
      '280.00 THB',
    )
    expect(screen.getByLabelText('Food so far for A')).toHaveTextContent(
      '220.00 THB',
    )
  })

  it('splits the meal, with service charge shared by what each ate', async () => {
    const user = userEvent.setup()
    renderSushi()

    await enterTheMeal(user)
    await user.click(screen.getByLabelText('Include VAT'))
    await calculate(user)

    const result = within(screen.getByRole('list', { name: /who owes what/i }))
    expect(result.getByText('308.00 THB')).toBeInTheDocument() // Pao, paid
    expect(result.getByText('242.00 THB')).toBeInTheDocument() // A
    expect(screen.getByText('A owes Pao 242.00 THB')).toBeInTheDocument()
    expect(
      screen.getByText(/adds up to 550\.00 THB — what you paid/i),
    ).toBeInTheDocument()
  })

  it('takes the discount off before service charge and VAT', async () => {
    const user = userEvent.setup()
    renderSushi()

    await enterTheMeal(user)
    await fill(user, 'Discount', '100')
    await calculate(user)

    // 500 − 100 = 400, + 40 service, + 7% of 440 = 470.80.
    expect(
      screen.getByText(/adds up to 470\.80 THB/i),
    ).toBeInTheDocument()
  })

  it('shows which plates make up each person’s food', async () => {
    const user = userEvent.setup()
    renderSushi()

    await enterTheMeal(user)
    await calculate(user)

    const pao = screen
      .getAllByText('Show plates')[0]
      .closest('details')!
    expect(pao).toHaveTextContent('Red × 3')
    expect(pao).toHaveTextContent('Blue × 2')
  })

  it('updates the answer when something is changed afterwards', async () => {
    const user = userEvent.setup()
    renderSushi()

    await enterTheMeal(user)
    await user.click(screen.getByLabelText('Include VAT'))
    await calculate(user)
    expect(screen.getByText(/adds up to 550\.00 THB/i)).toBeInTheDocument()

    await tap(user, 'Red', 'A', 1) // one more ฿40 plate, + 10% service
    expect(screen.getByText(/adds up to 594\.00 THB/i)).toBeInTheDocument()
  })

  it('asks for a price that was left blank', async () => {
    const user = userEvent.setup()
    renderSushi()

    await fill(user, 'Restaurant name', 'Test Sushi')
    await fill(user, 'Name 1', 'Pao')
    await fill(user, 'Name 2', 'A')
    await tap(user, 'Red', 'Pao', 1)
    await calculate(user)

    expect(screen.getAllByText('Required').length).toBeGreaterThan(0)
    expect(screen.queryByRole('list', { name: /who owes what/i })).toBeNull()
  })

  it('saves a restaurant for next time', async () => {
    const user = userEvent.setup()
    renderSushi()

    const save = screen.getByRole('button', { name: /save for next time/i })
    expect(save).toBeDisabled() // no name, no prices yet

    await enterTheMeal(user)
    await user.click(save)

    expect(screen.getByRole('button', { name: /saved/i })).toBeInTheDocument()
    expect(
      within(screen.getByLabelText('Restaurant')).getByRole('option', {
        name: 'Test Sushi',
      }),
    ).toBeInTheDocument()
  })

  it('remembers the plates after the page is reloaded', async () => {
    const user = userEvent.setup()
    const first = renderSushi()

    await fill(user, 'Name 1', 'Pao')
    await tap(user, 'Red', 'Pao', 4)
    first.unmount()

    renderSushi()
    expect(screen.getByLabelText('Red plates for Pao')).toHaveTextContent('4')
  })

  it('starts over with nobody’s plates counted', async () => {
    const user = userEvent.setup()
    renderSushi()

    await fill(user, 'Name 1', 'Pao')
    await tap(user, 'Red', 'Pao', 2)
    await user.click(screen.getByRole('button', { name: /start over/i }))

    expect(screen.getByLabelText('Name 1')).toHaveValue('')
    expect(screen.getAllByLabelText(/Red plates for/)[0]).toHaveTextContent('0')
  })
})
