import { describe, expect, it } from 'vitest'

import type { GroupOrderFormInput } from './schema'
import {
  displayName,
  emptyOrder,
  newItem,
  toggleSharer,
  withoutPerson,
} from './order-form'

const order: GroupOrderFormInput = {
  people: [
    { id: 'alex', name: 'Alex' },
    { id: 'bianca', name: 'Bianca' },
    { id: 'carlos', name: 'Carlos' },
  ],
  headcount: '3',
  items: [
    {
      id: '1',
      title: 'Gyoza',
      price: '120',
      addedBy: 'alex',
      sharedBy: ['alex', 'bianca'],
    },
    {
      id: '2',
      title: 'Soup',
      price: '60',
      addedBy: 'carlos',
      sharedBy: ['bianca', 'carlos'],
    },
  ],
  deliveryFee: '45',
  deliveryPromos: [],
  discounts: [],
  payerId: 'alex',
}

describe('emptyOrder', () => {
  it('starts with two people, since one cannot split anything', () => {
    const fresh = emptyOrder()
    expect(fresh.people).toHaveLength(2)
    expect(fresh.payerId).toBe(fresh.people[0].id)
  })
})

describe('newItem', () => {
  it('is shared by whoever it was added under, to begin with', () => {
    const item = newItem('carlos')
    expect(item.addedBy).toBe('carlos')
    expect(item.sharedBy).toEqual(['carlos'])
  })
})

describe('toggleSharer', () => {
  it('adds somebody who was not sharing', () => {
    expect(toggleSharer(['alex'], 'bianca')).toEqual(['alex', 'bianca'])
  })

  it('drops somebody who was', () => {
    expect(toggleSharer(['alex', 'bianca'], 'alex')).toEqual(['bianca'])
  })
})

describe('withoutPerson', () => {
  it('takes their own lines with them', () => {
    const left = withoutPerson(order, 'carlos')
    expect(left.items.map((item) => item.title)).toEqual(['Gyoza'])
  })

  it('takes them off anything they were sharing', () => {
    const left = withoutPerson(order, 'bianca')
    expect(left.items[0].sharedBy).toEqual(['alex'])
    expect(left.items[1].sharedBy).toEqual(['carlos'])
  })

  it('hands the payer over when the payer leaves', () => {
    const left = withoutPerson(order, 'alex')
    expect(left.payerId).toBe('bianca')
  })

  it('leaves the payer alone when somebody else leaves', () => {
    expect(withoutPerson(order, 'carlos').payerId).toBe('alex')
  })

  it('leaves no reference behind that validation would trip over', () => {
    const left = withoutPerson(order, 'bianca')
    const ids = new Set(left.people.map((person) => person.id))

    for (const item of left.items) {
      for (const id of item.sharedBy) expect(ids.has(id)).toBe(true)
    }
    expect(ids.has(left.payerId)).toBe(true)
  })
})

describe('displayName', () => {
  it('uses the name when there is one', () => {
    expect(displayName('Alex', 0, 'Person')).toBe('Alex')
  })

  it('falls back to a numbered placeholder', () => {
    expect(displayName('', 2, 'Person')).toBe('Person 3')
    expect(displayName('   ', 0, 'Person')).toBe('Person 1')
  })
})
