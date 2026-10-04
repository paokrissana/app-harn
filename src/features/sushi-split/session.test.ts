import { describe, expect, it } from 'vitest'

import {
  changeCount,
  foodSoFar,
  linesFor,
  OTHER,
  plateCount,
  removeDiner,
  removePlate,
  startSession,
  switchRestaurant,
  templatePlates,
  toRestaurant,
  type SushiRestaurant,
} from './session'

/** Two restaurants that disagree about what a red plate costs. */
const placeA = (): SushiRestaurant => ({
  id: 'place-a',
  name: 'Place A',
  pricing: [
    { id: 'red', label: 'Red', price: 40, color: 'red' },
    { id: 'blue', label: 'Blue', price: 50, color: 'blue' },
    { id: 'gold', label: 'Gold', price: 120, color: 'gold' },
  ],
})

const placeB = (): SushiRestaurant => ({
  id: 'place-b',
  name: 'Place B',
  pricing: [
    { id: 'red', label: 'Red', price: 50, color: 'red' },
    { id: 'blue', label: 'Blue', price: 60, color: 'blue' },
  ],
})

describe('starting a session', () => {
  it('starts somewhere new with four colours and no prices', () => {
    const session = startSession(null)

    expect(session.restaurantId).toBe(OTHER)
    expect(session.plates.map((p) => p.id)).toEqual([
      'red',
      'blue',
      'green',
      'yellow',
    ])
    // Prices would be a guess, so the boxes start empty and must be filled.
    expect(session.plates.every((p) => p.price === '')).toBe(true)
  })

  it('names the template plates in whatever language it is given', () => {
    const thai = { red: 'แดง', blue: 'น้ำเงิน', green: 'เขียว', yellow: 'เหลือง' }
    const plates = templatePlates((c) => thai[c as keyof typeof thai])
    expect(plates.map((p) => p.label)).toEqual(Object.values(thai))
  })

  it('starts with two people and the first one paying', () => {
    const session = startSession(null)
    expect(session.diners).toHaveLength(2)
    expect(session.payerId).toBe(session.diners[0].id)
  })

  it('copies a restaurant’s own prices', () => {
    const session = startSession(placeA())
    expect(session.restaurantName).toBe('Place A')
    expect(session.plates.map((p) => [p.id, p.price])).toEqual([
      ['red', '40'],
      ['blue', '50'],
      ['gold', '120'],
    ])
  })
})

describe('the price snapshot', () => {
  it('is untouched when the restaurant’s prices change afterwards', () => {
    const restaurant = placeA()
    const session = startSession(restaurant)

    // The restaurant is edited after the meal started…
    restaurant.pricing[0].price = 45
    restaurant.pricing.push({ id: 'new', label: 'New', price: 99, color: null })
    restaurant.name = 'Renamed'

    // …and the session still adds up the way it did.
    expect(session.plates.map((p) => p.price)).toEqual(['40', '50', '120'])
    expect(session.plates).toHaveLength(3)
    expect(session.restaurantName).toBe('Place A')
  })

  it('shares no objects with the restaurant it came from', () => {
    const restaurant = placeA()
    const session = startSession(restaurant)
    expect(session.plates[0]).not.toBe(restaurant.pricing[0])
  })
})

describe('switching restaurant', () => {
  it('takes the new restaurant’s prices, not the old one’s', () => {
    const session = switchRestaurant(startSession(placeA()), placeB())
    const red = session.plates.find((p) => p.id === 'red')!

    // Same colour, different restaurant: 50, never A's 40.
    expect(red.price).toBe('50')
    expect(session.restaurantName).toBe('Place B')
  })

  it('keeps the counts for plates both restaurants have', () => {
    let session = startSession(placeA())
    const pao = session.diners[0].id
    session = changeCount(session, pao, 'red', 3)
    session = changeCount(session, pao, 'gold', 1)

    session = switchRestaurant(session, placeB())

    // Three red plates are still three red plates; B has no gold.
    expect(session.diners[0].counts).toEqual({ red: 3 })
  })

  it('keeps the people and who paid', () => {
    const before = startSession(placeA())
    const after = switchRestaurant(before, placeB())
    expect(after.diners.map((d) => d.id)).toEqual(before.diners.map((d) => d.id))
    expect(after.payerId).toBe(before.payerId)
  })
})

describe('counting plates', () => {
  it('adds and takes away one at a time', () => {
    let session = startSession(placeA())
    const id = session.diners[0].id
    session = changeCount(session, id, 'red', 1)
    session = changeCount(session, id, 'red', 1)
    session = changeCount(session, id, 'red', -1)
    expect(session.diners[0].counts.red).toBe(1)
  })

  it('never goes below none', () => {
    const session = changeCount(startSession(placeA()), 'nobody', 'red', -1)
    const id = session.diners[0].id
    const after = changeCount(session, id, 'red', -1)
    expect(after.diners[0].counts.red).toBe(0)
  })

  it('only touches the person whose plate it is', () => {
    const session = startSession(placeA())
    const after = changeCount(session, session.diners[0].id, 'red', 2)
    expect(after.diners[1].counts).toEqual({})
  })
})

describe('a person’s plates', () => {
  const counted = () => {
    let session = startSession(placeA())
    const id = session.diners[0].id
    session = changeCount(session, id, 'red', 3)
    session = changeCount(session, id, 'blue', 2)
    return session
  }

  it('lists only the plates they had, with what each line comes to', () => {
    const session = counted()
    const lines = linesFor(session.diners[0], session.plates)
    expect(lines.map((l) => [l.plate.id, l.quantity, l.subtotal])).toEqual([
      ['red', 3, 120],
      ['blue', 2, 100],
    ])
  })

  it('totals their food as they go', () => {
    const session = counted()
    expect(foodSoFar(session.diners[0], session.plates)).toBe(220)
    expect(plateCount(session.diners[0])).toBe(5)
  })

  it('counts a plate with no price yet as nothing, rather than breaking', () => {
    let session = startSession(null)
    session = changeCount(session, session.diners[0].id, 'red', 4)
    expect(foodSoFar(session.diners[0], session.plates)).toBe(0)
  })
})

describe('changing the plates and people', () => {
  it('takes a removed plate type out of everyone’s counts', () => {
    let session = startSession(placeA())
    session = changeCount(session, session.diners[0].id, 'gold', 2)
    session = removePlate(session, 'gold')
    expect(session.diners[0].counts).toEqual({})
  })

  it('passes the bill on when the payer leaves', () => {
    const session = startSession(placeA())
    const [first, second] = session.diners
    const after = removeDiner(session, first.id)
    expect(after.payerId).toBe(second.id)
  })
})

describe('toRestaurant', () => {
  it('turns a session’s plates back into prices worth saving', () => {
    const session = startSession(placeA())
    const restaurant = toRestaurant(session, 'kept')
    expect(restaurant).toEqual({ ...placeA(), id: 'kept' })
  })
})
