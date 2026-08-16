import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { LanguageProvider } from '@/i18n/context'
import { SplitGroupMeal } from './split-group-meal'

type User = ReturnType<typeof userEvent.setup>

function renderMeal() {
  return render(
    <LanguageProvider>
      <SplitGroupMeal />
    </LanguageProvider>,
  )
}

/** The result list, so its amounts are not confused with the form's. */
function owed() {
  return within(screen.getByRole('list', { name: /who owes you/i }))
}

async function nameThem(user: User, names: string[]) {
  for (const [index, name] of names.entries()) {
    if (index > 1) {
      await user.click(screen.getByRole('button', { name: /add person/i }))
    }
    await user.type(screen.getByLabelText(`Name ${index + 1}`), name)
  }
}

/** Add a dish. `index` is its position down the list, which labels the inputs. */
async function addDish(
  user: User,
  index: number,
  title: string,
  price: string,
) {
  await user.click(screen.getByRole('button', { name: /add dish/i }))
  await user.type(screen.getByLabelText(`Dish ${index}`), title)
  await user.type(screen.getByLabelText(`Dish ${index} Price`), price)
}

/** Take somebody off a dish, by the dish's title. */
async function unshare(user: User, title: string, person: string) {
  await user.click(screen.getByRole('button', { name: `${title}: ${person}` }))
}

const calculate = () => screen.getByRole('button', { name: /^calculate$/i })

/**
 * Three out for dinner: the tom yum and rice went round the table, the steak
 * was Bianca's alone. Alex paid. Food 900, and with 10% service and 7% VAT the
 * bill comes to 1,059.30.
 */
async function enterTheDinner(user: User) {
  await nameThem(user, ['Alex', 'Bianca', 'Carlos'])

  await addDish(user, 1, 'Tom yum', '300')
  await addDish(user, 2, 'Rice', '60')
  await addDish(user, 3, 'Steak', '540')
  await unshare(user, 'Steak', 'Alex')
  await unshare(user, 'Steak', 'Carlos')
}

describe('Split Group Meal', () => {
  it('starts with two people and nothing ordered', () => {
    renderMeal()

    expect(screen.getByLabelText('Name 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Name 2')).toBeInTheDocument()
    expect(screen.queryByLabelText('Name 3')).not.toBeInTheDocument()
    // the first person is assumed to have paid until told otherwise
    expect(screen.getByRole('button', { name: 'Name 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('shares a new dish with the whole table by default', async () => {
    const user = userEvent.setup()
    renderMeal()

    await nameThem(user, ['Alex', 'Bianca'])
    await addDish(user, 1, 'Tom yum', '300')

    for (const person of ['Alex', 'Bianca']) {
      expect(
        screen.getByRole('button', { name: `Tom yum: ${person}` }),
      ).toHaveAttribute('aria-pressed', 'true')
    }
  })

  it('shares a dish added later with everyone already at the table', async () => {
    const user = userEvent.setup()
    renderMeal()

    await nameThem(user, ['Alex', 'Bianca', 'Carlos'])
    await addDish(user, 1, 'Tom yum', '300')

    expect(
      screen.getByRole('button', { name: 'Tom yum: Carlos' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('splits the dinner by what each person actually ate', async () => {
    const user = userEvent.setup()
    renderMeal()

    await enterTheDinner(user)
    await user.click(calculate())

    expect(await screen.findByText(/bill total: 1,059\.30 THB/i)).toBeInTheDocument()

    /*
     * Bianca ate 660 of the 900 — her steak plus a third of the sharing. The
     * 159.30 of service and VAT follows the same proportions, giving her
     * 116.82 of it and the other two 21.24 each.
     */
    expect(owed().getByText('777.00 THB')).toBeInTheDocument() // 660 + 116.82
    expect(owed().getByText('141.00 THB')).toBeInTheDocument() // 120 + 21.24
  })

  it('shows the working behind each figure', async () => {
    const user = userEvent.setup()
    renderMeal()

    await enterTheDinner(user)
    await user.click(calculate())

    const bianca = (await owed().findByText(/^Bianca$/)).closest('li')!
    expect(bianca).toHaveTextContent('food 660.00')
    expect(bianca).toHaveTextContent('service + VAT 116.82')
  })

  it('says the shares add up to what was paid', async () => {
    const user = userEvent.setup()
    renderMeal()

    await enterTheDinner(user)
    await user.click(calculate())

    expect(
      await screen.findByText(/adds up to 1,059\.30 THB — what you paid/i),
    ).toBeInTheDocument()
  })

  it('drops the charges when both switches are off', async () => {
    const user = userEvent.setup()
    renderMeal()

    await enterTheDinner(user)
    await user.click(screen.getByLabelText(/include service charge/i))
    await user.click(screen.getByLabelText(/include vat/i))
    await user.click(calculate())

    expect(await screen.findByText(/bill total: 900\.00 THB/i)).toBeInTheDocument()
  })

  it('refuses dishes that come to more than the bill', async () => {
    const user = userEvent.setup()
    renderMeal()

    await enterTheDinner(user)
    await user.clear(screen.getByLabelText(/total on the bill/i))
    await user.type(screen.getByLabelText(/total on the bill/i), '500')
    await user.click(calculate())

    expect(
      await screen.findByText(/come to 1,059\.30 THB, more than the bill/i),
    ).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: /who owes you/i })).toBeNull()
  })

  it('accepts a bill that matches, within a baht of rounding', async () => {
    const user = userEvent.setup()
    renderMeal()

    await enterTheDinner(user)
    await user.clear(screen.getByLabelText(/total on the bill/i))
    await user.type(screen.getByLabelText(/total on the bill/i), '1058.50')
    await user.click(calculate())

    expect(await screen.findByText(/bill total/i)).toBeInTheDocument()
  })

  it('will not calculate a table with no dishes', async () => {
    const user = userEvent.setup()
    renderMeal()

    await nameThem(user, ['Alex', 'Bianca'])
    await user.click(calculate())

    expect(await screen.findByText(/add at least one dish/i)).toBeInTheDocument()
  })

  it('needs everyone named', async () => {
    const user = userEvent.setup()
    renderMeal()

    await user.type(screen.getByLabelText('Name 1'), 'Alex')
    await addDish(user, 1, 'Tom yum', '300')
    await user.click(calculate())

    expect(await screen.findByText(/required/i)).toBeInTheDocument()
  })

  it('refuses a dish nobody is left eating', async () => {
    const user = userEvent.setup()
    renderMeal()

    await nameThem(user, ['Alex', 'Bianca'])
    await addDish(user, 1, 'Tom yum', '300')
    await unshare(user, 'Tom yum', 'Alex')
    await unshare(user, 'Tom yum', 'Bianca')
    await user.click(calculate())

    expect(
      await screen.findByText(/somebody has to have eaten it/i),
    ).toBeInTheDocument()
  })

  it('puts a narrowed dish back to the whole table', async () => {
    const user = userEvent.setup()
    renderMeal()

    await nameThem(user, ['Alex', 'Bianca'])
    await addDish(user, 1, 'Tom yum', '300')
    await unshare(user, 'Tom yum', 'Alex')

    await user.click(screen.getByRole('button', { name: /^everyone$/i }))

    expect(
      screen.getByRole('button', { name: 'Tom yum: Alex' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('takes a leaving person off the dishes they were sharing', async () => {
    const user = userEvent.setup()
    renderMeal()

    await nameThem(user, ['Alex', 'Bianca', 'Carlos'])
    await addDish(user, 1, 'Tom yum', '300')

    await user.click(screen.getByRole('button', { name: /remove carlos/i }))

    expect(
      screen.queryByRole('button', { name: 'Tom yum: Carlos' }),
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Tom yum: Alex' }),
    ).toBeInTheDocument()
  })
})
