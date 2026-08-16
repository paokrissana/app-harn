import { newId } from '@/shared/lib/id'
import type { GroupOrderFormInput } from './schema'

type Person = GroupOrderFormInput['people'][number]
type Item = GroupOrderFormInput['items'][number]
type Promo = GroupOrderFormInput['discounts'][number]

export function newPerson(): Person {
  return { id: newId(), name: '' }
}

/** A blank line under someone, shared by them alone until others are ticked. */
export function newItem(addedBy: string): Item {
  return { id: newId(), title: '', price: '', addedBy, sharedBy: [addedBy] }
}

export function newPromo(): Promo {
  return { id: newId(), kind: 'percent', value: '' }
}

/** A fresh order: two people, since one cannot split anything. */
export function emptyOrder(): GroupOrderFormInput {
  const [first, second] = [newPerson(), newPerson()]

  return {
    people: [first, second],
    headcount: '2',
    items: [],
    deliveryFee: '',
    deliveryPromos: [],
    discounts: [],
    payerId: first.id,
  }
}

/** Add or drop one person from the people sharing a line. */
export function toggleSharer(sharedBy: string[], personId: string): string[] {
  return sharedBy.includes(personId)
    ? sharedBy.filter((id) => id !== personId)
    : [...sharedBy, personId]
}

/**
 * Remove somebody from the group, and everything that pointed at them: their
 * own lines go, they come off anything they were sharing, and if they were the
 * payer that moves to whoever is left. Leaving a dangling id behind would fail
 * validation with an error pointing at a person who is no longer on screen.
 */
export function withoutPerson(
  values: GroupOrderFormInput,
  personId: string,
): GroupOrderFormInput {
  const people = values.people.filter((person) => person.id !== personId)

  const items = values.items
    .filter((item) => item.addedBy !== personId)
    .map((item) => ({
      ...item,
      sharedBy: item.sharedBy.filter((id) => id !== personId),
    }))

  return {
    ...values,
    people,
    items,
    // A group of seven stays a group of seven when one of the three leaves.
    headcount: String(Math.max(Number(values.headcount) || 0, people.length)),
    payerId:
      values.payerId === personId ? (people[0]?.id ?? '') : values.payerId,
  }
}

/** What to call somebody who has not been named yet. */
export function displayName(name: string, index: number, fallback: string) {
  return name.trim() === '' ? `${fallback} ${index + 1}` : name.trim()
}
