import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { LanguageProvider } from '@/i18n/context'
import { SplitGroupOrder } from './split-group-order'

type User = ReturnType<typeof userEvent.setup>

function renderOrder() {
  return render(
    <LanguageProvider>
      <SplitGroupOrder />
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

/**
 * Add a line under someone. `index` is the line's position across the whole
 * order, which is how the inputs are labelled.
 */
async function addItem(
  user: User,
  person: string,
  index: number,
  title: string,
  price: string,
) {
  await user.click(
    screen.getByRole('button', { name: `Add item for ${person}` }),
  )
  await user.type(screen.getByLabelText(`Item ${index}`), title)
  await user.type(screen.getByLabelText(`Item ${index} Price`), price)
}

/** Tick somebody onto a line, by the line's title. */
async function share(user: User, title: string, person: string) {
  await user.click(screen.getByRole('button', { name: `${title}: ${person}` }))
}

async function addDiscount(
  user: User,
  index: number,
  kind: 'percent' | 'amount',
  value: string,
) {
  await user.click(screen.getByRole('button', { name: /add discount/i }))
  if (kind === 'amount') {
    const group = screen.getByRole('group', {
      name: new RegExp(`^Discounts ${index}:`),
    })
    await user.click(within(group).getByRole('button', { name: 'Baht' }))
  }
  await user.type(screen.getByLabelText(`Discounts ${index}`), value)
}

/** Alex, Bianca and Carlos, exactly as the order arrived from Grab. */
async function enterTheRealOrder(user: User) {
  await nameThem(user, ['Alex', 'Bianca', 'Carlos'])

  await addItem(user, 'Alex', 1, 'Fried rice', '80')
  await addItem(user, 'Alex', 2, 'Gyoza', '120')
  await share(user, 'Gyoza', 'Bianca') // Alex added it, Bianca halves it

  await addItem(user, 'Bianca', 3, 'Chicken rice', '90')

  await addItem(user, 'Carlos', 4, 'Noodles', '100')
  await addItem(user, 'Carlos', 5, 'Soup', '60')
  await share(user, 'Soup', 'Bianca') // Carlos added it, Bianca halves it

  await user.type(screen.getByLabelText(/delivery fee/i), '45')
}

describe('Split Group Order', () => {
  it('starts with two people and nobody ordering yet', () => {
    renderOrder()

    expect(screen.getByLabelText('Name 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Name 2')).toBeInTheDocument()
    expect(screen.queryByLabelText('Name 3')).not.toBeInTheDocument()
    // the first person is assumed to have paid until told otherwise
    expect(screen.getByRole('button', { name: 'Name 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('splits the real Grab order the way the receipt implies', async () => {
    const user = userEvent.setup()
    renderOrder()

    await enterTheRealOrder(user)
    await addDiscount(user, 1, 'percent', '10')
    await addDiscount(user, 2, 'amount', '30')

    await user.click(screen.getByRole('button', { name: /^calculate$/i }))

    // food 450, delivery 45, discounts 75 → 420 paid by Alex
    expect(
      await screen.findByText(/order total: 420\.00 THB/i),
    ).toBeInTheDocument()
    expect(owed().getByText('165.00 THB')).toBeInTheDocument() // Bianca
    expect(owed().getByText('123.00 THB')).toBeInTheDocument() // Carlos
    expect(owed().getByText('132.00 THB')).toBeInTheDocument() // Alex, who paid
  })

  it('marks who paid, and only asks the others for money', async () => {
    const user = userEvent.setup()
    renderOrder()

    await enterTheRealOrder(user)
    await user.click(screen.getByRole('button', { name: /^calculate$/i }))

    const alex = owed().getByText(/Alex/)
    expect(alex).toHaveTextContent(/paid/i)
    expect(owed().getByText(/^Bianca$/)).not.toHaveTextContent(/paid/i)
  })

  it('follows who shares a line, not who added it', async () => {
    const user = userEvent.setup()
    renderOrder()

    await nameThem(user, ['Alex', 'Bianca'])
    // one 100 dish under Alex, halved with Bianca, no fees
    await addItem(user, 'Alex', 1, 'Gyoza', '100')
    await share(user, 'Gyoza', 'Bianca')
    await user.type(screen.getByLabelText(/delivery fee/i), '0')

    await user.click(screen.getByRole('button', { name: /^calculate$/i }))

    expect(
      await screen.findByText(/order total: 100\.00 THB/i),
    ).toBeInTheDocument()
    const lines = owed().getAllByRole('listitem')
    expect(lines).toHaveLength(2)
    for (const line of lines) expect(line).toHaveTextContent('50.00 THB')
  })

  it('splits the delivery fee evenly, whatever people ordered', async () => {
    const user = userEvent.setup()
    renderOrder()

    await nameThem(user, ['Alex', 'Bianca'])
    await addItem(user, 'Alex', 1, 'Rice', '100')
    await addItem(user, 'Bianca', 2, 'Noodles', '300')
    await user.type(screen.getByLabelText(/delivery fee/i), '40')

    await user.click(screen.getByRole('button', { name: /^calculate$/i }))

    // 20 each on top of their own food
    expect(await owed().findByText('120.00 THB')).toBeInTheDocument()
    expect(owed().getByText('320.00 THB')).toBeInTheDocument()
  })

  it('lets a delivery promo cancel the fee without touching the food', async () => {
    const user = userEvent.setup()
    renderOrder()

    await nameThem(user, ['Alex', 'Bianca'])
    await addItem(user, 'Alex', 1, 'Rice', '100')
    await addItem(user, 'Bianca', 2, 'Noodles', '100')
    await user.type(screen.getByLabelText(/delivery fee/i), '40')

    await user.click(screen.getByRole('button', { name: /add delivery promo/i }))
    await user.type(screen.getByLabelText('Delivery promo 1'), '100') // 100% off

    await user.click(screen.getByRole('button', { name: /^calculate$/i }))

    // 200 of food, no delivery, nothing off the items
    expect(
      await screen.findByText(/order total: 200\.00 THB/i),
    ).toBeInTheDocument()
    const lines = owed().getAllByRole('listitem')
    for (const line of lines) expect(line).toHaveTextContent('100.00 THB')
  })

  it('shows the working behind each person’s figure', async () => {
    const user = userEvent.setup()
    renderOrder()

    await enterTheRealOrder(user)
    await addDiscount(user, 1, 'percent', '10')
    await addDiscount(user, 2, 'amount', '30')
    await user.click(screen.getByRole('button', { name: /^calculate$/i }))

    // Bianca: 180 of food, 15 of delivery, 30 off
    const bianca = (await owed().findByText(/^Bianca$/)).closest('li')!
    expect(bianca).toHaveTextContent('food 180.00')
    expect(bianca).toHaveTextContent('delivery 15.00')
    expect(bianca).toHaveTextContent('discount −30.00')
    expect(bianca).toHaveTextContent('165.00 THB')
  })

  it('leaves the discount out of the working when there is none', async () => {
    const user = userEvent.setup()
    renderOrder()

    await enterTheRealOrder(user)
    await user.click(screen.getByRole('button', { name: /^calculate$/i }))

    const lines = owed().getAllByRole('listitem')
    for (const line of lines) expect(line).not.toHaveTextContent('discount')
  })

  it('says the shares add up to what was paid', async () => {
    const user = userEvent.setup()
    renderOrder()

    await enterTheRealOrder(user)
    await addDiscount(user, 1, 'percent', '10')
    await addDiscount(user, 2, 'amount', '30')
    await user.click(screen.getByRole('button', { name: /^calculate$/i }))

    expect(
      await screen.findByText(/adds up to 420\.00 THB — what you paid/i),
    ).toBeInTheDocument()
  })

  it('does not claim to add up when only part of the group is listed', async () => {
    const user = userEvent.setup()
    renderOrder()

    await enterTheRealOrder(user)
    const headcount = screen.getByLabelText(/people in the group/i)
    await user.clear(headcount)
    await user.type(headcount, '7')
    await user.click(screen.getByRole('button', { name: /^calculate$/i }))

    expect(await screen.findByText(/of 7 who ordered/i)).toBeInTheDocument()
    expect(screen.queryByText(/what you paid/i)).not.toBeInTheDocument()
  })

  it('warns that a capped promo goes in as an amount', () => {
    renderOrder()

    expect(
      screen.getByText(/goes in as ฿50, not 10%/i),
    ).toBeInTheDocument()
  })

  it('counts the group as the people listed, until told otherwise', async () => {
    const user = userEvent.setup()
    renderOrder()

    expect(screen.getByLabelText(/people in the group/i)).toHaveValue(2)
    await user.click(screen.getByRole('button', { name: /add person/i }))
    // adding somebody grows the group with it
    expect(screen.getByLabelText(/people in the group/i)).toHaveValue(3)
  })

  it('divides delivery across the whole group, not just those listed', async () => {
    const user = userEvent.setup()
    renderOrder()

    await enterTheRealOrder(user)
    await addDiscount(user, 1, 'percent', '10')
    await addDiscount(user, 2, 'amount', '30')

    // seven colleagues ordered; only these three shared anything
    const headcount = screen.getByLabelText(/people in the group/i)
    await user.clear(headcount)
    await user.type(headcount, '7')

    await user.click(screen.getByRole('button', { name: /^calculate$/i }))

    /*
     * Delivery is 45 ÷ 7 = 6.43 each rather than 15, and the flat 30 is only
     * three sevenths theirs, while the 10% is already their own share.
     */
    expect(await owed().findByText('163.00 THB')).toBeInTheDocument() // Bianca
    expect(owed().getByText('120.00 THB')).toBeInTheDocument() // Carlos
  })

  it('says out loud that it only covers part of the order', async () => {
    const user = userEvent.setup()
    renderOrder()

    await enterTheRealOrder(user)
    const headcount = screen.getByLabelText(/people in the group/i)
    await user.clear(headcount)
    await user.type(headcount, '7')
    await user.click(screen.getByRole('button', { name: /^calculate$/i }))

    expect(
      await screen.findByText(/covers the 3 people listed, of 7 who ordered/i),
    ).toBeInTheDocument()
  })

  it('will not let the group be smaller than the people in it', async () => {
    const user = userEvent.setup()
    renderOrder()

    await enterTheRealOrder(user)
    const headcount = screen.getByLabelText(/people in the group/i)
    await user.clear(headcount)
    await user.type(headcount, '2')

    await user.click(screen.getByRole('button', { name: /^calculate$/i }))

    expect(
      await screen.findByText(/cannot be fewer than the 3 people listed/i),
    ).toBeInTheDocument()
  })

  it('keeps the bigger group when somebody listed leaves', async () => {
    const user = userEvent.setup()
    renderOrder()

    await nameThem(user, ['Alex', 'Bianca', 'Carlos'])
    const headcount = screen.getByLabelText(/people in the group/i)
    await user.clear(headcount)
    await user.type(headcount, '7')

    await user.click(screen.getByRole('button', { name: /remove carlos/i }))

    // still seven people ordered, we are just tracking two of them now
    expect(screen.getByLabelText(/people in the group/i)).toHaveValue(7)
  })

  it('refuses discounts bigger than the order', async () => {
    const user = userEvent.setup()
    renderOrder()

    await nameThem(user, ['Alex', 'Bianca'])
    await addItem(user, 'Alex', 1, 'Rice', '100')
    await user.type(screen.getByLabelText(/delivery fee/i), '0')
    await addDiscount(user, 1, 'amount', '500')

    await user.click(screen.getByRole('button', { name: /^calculate$/i }))

    expect(
      await screen.findByText(/discounts come to more than the order/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('list', { name: /who owes you/i }),
    ).not.toBeInTheDocument()
  })

  it('asks who paid when the group changes under it', async () => {
    const user = userEvent.setup()
    renderOrder()

    await nameThem(user, ['Alex', 'Bianca', 'Carlos'])
    await addItem(user, 'Alex', 1, 'Rice', '100')
    await addItem(user, 'Carlos', 2, 'Noodles', '100')
    await user.type(screen.getByLabelText(/delivery fee/i), '0')

    // Alex paid by default; hand it to Carlos
    await user.click(screen.getByRole('button', { name: 'Carlos' }))
    await user.click(screen.getByRole('button', { name: /^calculate$/i }))

    expect(await owed().findByText(/Carlos/)).toHaveTextContent(/paid/i)
  })

  it('takes a leaving person’s items and shares with them', async () => {
    const user = userEvent.setup()
    renderOrder()

    await nameThem(user, ['Alex', 'Bianca', 'Carlos'])
    await addItem(user, 'Alex', 1, 'Rice', '100')
    await addItem(user, 'Carlos', 2, 'Noodles', '200')
    await share(user, 'Noodles', 'Bianca')

    await user.click(screen.getByRole('button', { name: /remove carlos/i }))

    // Carlos and his noodles are gone, and Bianca is no longer sharing them
    expect(screen.queryByDisplayValue('Carlos')).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue('Noodles')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('Rice')).toBeInTheDocument()
  })

  it('will not calculate an order with nothing in it', async () => {
    const user = userEvent.setup()
    renderOrder()

    await nameThem(user, ['Alex', 'Bianca'])
    await user.click(screen.getByRole('button', { name: /^calculate$/i }))

    expect(
      await screen.findByText(/add at least one item/i),
    ).toBeInTheDocument()
  })

  it('needs everyone named', async () => {
    const user = userEvent.setup()
    renderOrder()

    await user.click(screen.getByRole('button', { name: /add item for name 1/i }))
    await user.type(screen.getByLabelText('Item 1'), 'Rice')
    await user.type(screen.getByLabelText('Item 1 Price'), '100')
    await user.type(screen.getByLabelText(/delivery fee/i), '0')

    await user.click(screen.getByRole('button', { name: /^calculate$/i }))

    expect((await screen.findAllByText('Required')).length).toBeGreaterThan(0)
  })
})
