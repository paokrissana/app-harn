import { newId } from '@/shared/lib/id'
import type { GroupMealFormInput } from './schema'

type Person = GroupMealFormInput['people'][number]
type Dish = GroupMealFormInput['dishes'][number]

export function newPerson(): Person {
  return { id: newId(), name: '' }
}

/**
 * A blank dish, shared by everybody at the table.
 *
 * This is the opposite default to Split Group Order, and deliberately: there a
 * line belongs to whoever tapped it and sharing is the exception, here the food
 * goes round the table and eating something alone is the exception. Starting
 * from everyone means the common case costs no taps at all.
 */
export function newDish(everyone: string[]): Dish {
  return { id: newId(), title: '', price: '', sharedBy: [...everyone] }
}

/** A fresh table: two people, since one person splits nothing. */
export function emptyMeal(): GroupMealFormInput {
  const [first, second] = [newPerson(), newPerson()]

  return {
    people: [first, second],
    dishes: [],
    // Starts at zero, which means "I have not got the bill" and skips the
    // cross-check. Blank would just fail validation before anyone typed a dish.
    totalBill: '0',
    serviceChargeEnabled: true,
    serviceChargePct: '10',
    vatEnabled: true,
    vatPct: '7',
    payerId: first.id,
  }
}

/** Add or drop one person from the people sharing a dish. */
export function toggleEater(sharedBy: string[], personId: string): string[] {
  return sharedBy.includes(personId)
    ? sharedBy.filter((id) => id !== personId)
    : [...sharedBy, personId]
}

/**
 * Add somebody to the table. Anything currently shared by everyone stays shared
 * by everyone — a dish for the table does not stop being for the table when one
 * more person sits down. Dishes that were already narrowed to some people are
 * left exactly as they are.
 */
export function withPerson(values: GroupMealFormInput): GroupMealFormInput {
  const person = newPerson()
  const everyone = values.people.length

  return {
    ...values,
    people: [...values.people, person],
    dishes: values.dishes.map((dish) =>
      dish.sharedBy.length === everyone
        ? { ...dish, sharedBy: [...dish.sharedBy, person.id] }
        : dish,
    ),
  }
}

/**
 * Remove somebody from the table, and everything that pointed at them: they
 * come off every dish, and if they were the payer that moves to whoever is
 * left. A dangling id would fail validation against a person no longer on
 * screen.
 *
 * A dish only they were eating goes with them — keeping it would leave a price
 * on the bill that nobody is paying for.
 */
export function withoutPerson(
  values: GroupMealFormInput,
  personId: string,
): GroupMealFormInput {
  const people = values.people.filter((person) => person.id !== personId)

  const dishes = values.dishes
    .map((dish) => ({
      ...dish,
      sharedBy: dish.sharedBy.filter((id) => id !== personId),
    }))
    .filter((dish) => dish.sharedBy.length > 0)

  return {
    ...values,
    people,
    dishes,
    payerId:
      values.payerId === personId ? (people[0]?.id ?? '') : values.payerId,
  }
}

/** What to call somebody who has not been named yet. */
export function displayName(name: string, index: number, fallback: string) {
  return name.trim() === '' ? `${fallback} ${index + 1}` : name.trim()
}
