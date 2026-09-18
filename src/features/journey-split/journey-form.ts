import { newId } from '@/shared/lib/id'
import type { JourneyFormInput } from './schema'

type Passenger = JourneyFormInput['passengers'][number]
type Drop = JourneyFormInput['drops'][number]
type Fee = JourneyFormInput['fees'][number]

export function newPassenger(): Passenger {
  return { id: newId(), name: '' }
}

/** A blank drop — nobody picked yet, so the form asks who. */
export function newDrop(): Drop {
  return { id: newId(), passengerId: '', meter: '' }
}

/** A toll, parking, or anything else on top of the meter. */
export function newFee(): Fee {
  return { id: newId(), label: '', amount: '', split: 'everyone' }
}

/** A fresh ride: two passengers, since one person splits nothing. */
export function emptyJourney(): JourneyFormInput {
  const [first, second] = [newPassenger(), newPassenger()]

  return {
    passengers: [first, second],
    startMeter: '35',
    drops: [],
    endMeter: '',
    fees: [],
    payerId: first.id,
  }
}

/**
 * Remove somebody from the ride, and everything pointing at them: their drop
 * goes, and if they settled the fare that moves to whoever is left. A dangling
 * id would fail validation against a person no longer on screen.
 */
export function withoutPassenger(
  values: JourneyFormInput,
  passengerId: string,
): JourneyFormInput {
  const passengers = values.passengers.filter(
    (passenger) => passenger.id !== passengerId,
  )

  return {
    ...values,
    passengers,
    drops: values.drops.filter((drop) => drop.passengerId !== passengerId),
    payerId:
      values.payerId === passengerId
        ? (passengers[0]?.id ?? '')
        : values.payerId,
  }
}

/** What to call somebody who has not been named yet. */
export function displayName(name: string, index: number, fallback: string) {
  return name.trim() === '' ? `${fallback} ${index + 1}` : name.trim()
}
