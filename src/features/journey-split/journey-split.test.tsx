import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { LanguageProvider } from '@/i18n/context'
import { JourneySplit } from './journey-split'

type User = ReturnType<typeof userEvent.setup>

function renderJourney() {
  return render(
    <LanguageProvider>
      <JourneySplit />
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
      await user.click(screen.getByRole('button', { name: /add passenger/i }))
    }
    await user.type(screen.getByLabelText(`Name ${index + 1}`), name)
  }
}

async function setMeter(user: User, label: RegExp, value: string) {
  const box = screen.getByLabelText(label)
  await user.clear(box)
  await user.type(box, value)
}

/** Record somebody getting out. `index` is the drop's position in the list. */
async function dropAt(
  user: User,
  index: number,
  person: string,
  meter: string,
) {
  await user.click(screen.getByRole('button', { name: /add a drop-off/i }))
  await user.click(
    screen.getByRole('button', { name: `Drop-off ${index}: ${person}` }),
  )
  await user.type(screen.getByLabelText(`Meter ${index}`), meter)
}

const calculate = () => screen.getByRole('button', { name: /^calculate$/i })

/**
 * The ride from the spec: A, B and C from ฿35, B out at ฿145, A at ฿245, C on
 * to ฿335. C settled with the driver.
 */
async function enterTheRide(user: User) {
  await nameThem(user, ['A', 'B', 'C'])
  await setMeter(user, /meter at the start/i, '35')
  await dropAt(user, 1, 'B', '145')
  await dropAt(user, 2, 'A', '245')
  await setMeter(user, /meter at the end/i, '335')
  await user.click(screen.getByRole('button', { name: 'C' }))
}

describe('Split Taxi', () => {
  it('starts with two passengers and the flagfall filled in', () => {
    renderJourney()

    expect(screen.getByLabelText('Name 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Name 2')).toBeInTheDocument()
    expect(screen.getByLabelText(/meter at the start/i)).toHaveValue(35)
  })

  it('charges each passenger for the stretch they rode', async () => {
    const user = userEvent.setup()
    renderJourney()

    await enterTheRide(user)
    await user.click(calculate())

    expect(
      await screen.findByText(/fare total: 300\.00 THB/i),
    ).toBeInTheDocument()
    // B rode one stretch, A two, C all three.
    expect(owed().getByText('37.00 THB')).toBeInTheDocument()
    expect(owed().getByText('87.00 THB')).toBeInTheDocument()
    expect(owed().getByText('176.00 THB')).toBeInTheDocument()
  })

  it('shows how each stretch of the meter was shared', async () => {
    const user = userEvent.setup()
    renderJourney()

    await enterTheRide(user)
    await user.click(calculate())

    const breakdown = (
      await screen.findByText(/how the meter was shared/i)
    ).closest('section')!

    expect(breakdown).toHaveTextContent('35.00 → 145.00')
    expect(breakdown).toHaveTextContent('110.00 ÷ 3')
    expect(breakdown).toHaveTextContent('100.00 ÷ 2')
    expect(breakdown).toHaveTextContent('90.00 ÷ 1')
  })

  it('says the shares add up to what was paid', async () => {
    const user = userEvent.setup()
    renderJourney()

    await enterTheRide(user)
    await user.click(calculate())

    expect(
      await screen.findByText(/adds up to 300\.00 THB — what you paid/i),
    ).toBeInTheDocument()
  })

  it('divides a toll among everyone who rode', async () => {
    const user = userEvent.setup()
    renderJourney()

    await enterTheRide(user)
    await user.click(screen.getByRole('button', { name: /add a toll/i }))
    await user.type(screen.getByLabelText(/what for 1/i), 'Toll')
    await user.type(screen.getByLabelText(/amount 1/i), '60')
    await user.click(calculate())

    expect(
      await screen.findByText(/fare total: 360\.00 THB/i),
    ).toBeInTheDocument()
    // 20 each on top of the meter: B's 36.67 becomes 56.67, rounded to 57.
    expect(owed().getByText('57.00 THB')).toBeInTheDocument()
  })

  it('leaves parking to whoever was still in the car', async () => {
    const user = userEvent.setup()
    renderJourney()

    await enterTheRide(user)
    await user.click(screen.getByRole('button', { name: /add a toll/i }))
    await user.type(screen.getByLabelText(/what for 1/i), 'Parking')
    await user.type(screen.getByLabelText(/amount 1/i), '60')

    const group = screen.getByRole('group', { name: /Parking: who pays this/i })
    await user.click(
      within(group).getByRole('button', { name: /still in the car/i }),
    )
    await user.click(calculate())

    // B and A are untouched; C carries the whole 60.
    expect(await owed().findByText('37.00 THB')).toBeInTheDocument()
    expect(owed().getByText('87.00 THB')).toBeInTheDocument()
    expect(owed().getByText('236.00 THB')).toBeInTheDocument()
  })

  it('refuses a meter that goes backwards', async () => {
    const user = userEvent.setup()
    renderJourney()

    await nameThem(user, ['A', 'B'])
    await setMeter(user, /meter at the start/i, '100')
    await dropAt(user, 1, 'A', '50')
    await setMeter(user, /meter at the end/i, '200')
    await user.click(calculate())

    expect(
      await screen.findByText(/a meter cannot go down/i),
    ).toBeInTheDocument()
  })

  it('refuses an end reading before the last drop-off', async () => {
    const user = userEvent.setup()
    renderJourney()

    await nameThem(user, ['A', 'B'])
    await dropAt(user, 1, 'A', '200')
    await setMeter(user, /meter at the end/i, '150')
    await user.click(calculate())

    expect(
      await screen.findByText(/cannot be less than the last drop-off/i),
    ).toBeInTheDocument()
  })

  it('refuses the same passenger getting out twice', async () => {
    const user = userEvent.setup()
    renderJourney()

    await nameThem(user, ['A', 'B', 'C'])
    await dropAt(user, 1, 'A', '100')
    await dropAt(user, 2, 'A', '200')
    await setMeter(user, /meter at the end/i, '300')
    await user.click(calculate())

    expect(
      await screen.findByText(/they have already got out/i),
    ).toBeInTheDocument()
  })

  it('refuses a journey nobody finishes', async () => {
    const user = userEvent.setup()
    renderJourney()

    await nameThem(user, ['A', 'B'])
    await dropAt(user, 1, 'A', '100')
    await dropAt(user, 2, 'B', '200')
    await setMeter(user, /meter at the end/i, '300')
    await user.click(calculate())

    expect(
      await screen.findByText(/somebody has to reach the destination/i),
    ).toBeInTheDocument()
  })

  it('asks who got out when a drop names nobody', async () => {
    const user = userEvent.setup()
    renderJourney()

    await nameThem(user, ['A', 'B'])
    await user.click(screen.getByRole('button', { name: /add a drop-off/i }))
    await user.type(screen.getByLabelText('Meter 1'), '100')
    await setMeter(user, /meter at the end/i, '200')
    await user.click(calculate())

    expect(await screen.findByText(/pick who left/i)).toBeInTheDocument()
  })

  it('takes a leaving passenger off their drop-off', async () => {
    const user = userEvent.setup()
    renderJourney()

    await nameThem(user, ['A', 'B', 'C'])
    await dropAt(user, 1, 'B', '145')

    await user.click(screen.getByRole('button', { name: /remove b/i }))

    expect(screen.queryByLabelText('Meter 1')).not.toBeInTheDocument()
  })
})
