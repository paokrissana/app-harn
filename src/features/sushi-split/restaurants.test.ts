import { describe, expect, it } from 'vitest'

import { PRESET_RESTAURANTS } from './restaurants'
import { isUnpriced, startSession } from './session'

describe('the built-in restaurants', () => {
  it('lists some, so nobody has to type a name they already know', () => {
    expect(PRESET_RESTAURANTS.length).toBeGreaterThan(0)
  })

  it('invents no prices for any of them', () => {
    // A real restaurant's name next to a made-up price is something people
    // trust. Every entry is a name until its prices come from that restaurant.
    for (const restaurant of PRESET_RESTAURANTS) {
      expect(isUnpriced(restaurant)).toBe(true)
    }
  })

  it('has a name and a distinct id for each', () => {
    const ids = PRESET_RESTAURANTS.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const r of PRESET_RESTAURANTS) expect(r.name.trim()).not.toBe('')
  })

  it('is in alphabetical order, so the list is easy to scan', () => {
    const names = PRESET_RESTAURANTS.map((r) => r.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  })
})

describe('a session at a restaurant with no prices yet', () => {
  it('keeps the name and starts the usual plates with blank prices', () => {
    const [first] = PRESET_RESTAURANTS
    const session = startSession(first)

    expect(session.restaurantId).toBe(first.id)
    expect(session.restaurantName).toBe(first.name)
    expect(session.plates.map((p) => p.id)).toEqual([
      'red',
      'blue',
      'green',
      'yellow',
    ])
    expect(session.plates.every((p) => p.price === '')).toBe(true)
  })
})
