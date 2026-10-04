import { describe, expect, it } from 'vitest'

import { changeCount, startSession, type SushiRestaurant } from './session'
import {
  clearSession,
  forgetRestaurant,
  loadRestaurants,
  loadSession,
  saveRestaurant,
  saveSession,
} from './storage'

const myPlace = (price = 35): SushiRestaurant => ({
  id: 'mine',
  name: 'My Local Sushi',
  pricing: [
    { id: 'red', label: 'Red', price, color: 'red' },
    { id: 'gold', label: 'Gold', price: 90, color: 'gold' },
  ],
})

describe('saved restaurants', () => {
  it('is empty until something is saved', () => {
    expect(loadRestaurants()).toEqual([])
  })

  it('keeps a restaurant for next time', () => {
    saveRestaurant([], myPlace())
    expect(loadRestaurants()).toEqual([myPlace()])
  })

  it('updates rather than duplicates when saved again', () => {
    const once = saveRestaurant([], myPlace(35))
    saveRestaurant(once, myPlace(40))

    const kept = loadRestaurants()
    expect(kept).toHaveLength(1)
    expect(kept[0].pricing[0].price).toBe(40)
  })

  it('forgets one on request', () => {
    const list = saveRestaurant([], myPlace())
    forgetRestaurant(list, 'mine')
    expect(loadRestaurants()).toEqual([])
  })

  it('treats corrupt or foreign storage as nothing saved', () => {
    localStorage.setItem('sushi-restaurants', '{not json')
    expect(loadRestaurants()).toEqual([])

    localStorage.setItem(
      'sushi-restaurants',
      JSON.stringify({ version: 99, data: [myPlace()] }),
    )
    expect(loadRestaurants()).toEqual([])

    localStorage.setItem(
      'sushi-restaurants',
      JSON.stringify({ version: 1, data: [{ id: 'x', pricing: 'nope' }] }),
    )
    expect(loadRestaurants()).toEqual([])
  })
})

describe('the session in progress', () => {
  it('comes back after a refresh exactly as it was', () => {
    let session = startSession(myPlace())
    session = changeCount(session, session.diners[0].id, 'red', 3)
    saveSession(session)

    expect(loadSession()).toEqual(session)
  })

  it('keeps its own prices when the saved restaurant changes afterwards', () => {
    // A session starts at ฿35 a red plate…
    const session = startSession(myPlace(35))
    saveSession(session)

    // …the restaurant is then saved again at ฿45…
    saveRestaurant(loadRestaurants(), myPlace(45))

    // …and the meal still in progress adds up at the price it started with.
    const restored = loadSession()!
    expect(restored.plates.find((p) => p.id === 'red')!.price).toBe('35')
  })

  it('survives its restaurant being forgotten', () => {
    const list = saveRestaurant([], myPlace())
    const session = startSession(myPlace())
    saveSession(session)

    forgetRestaurant(list, 'mine')

    expect(loadSession()?.plates).toEqual(session.plates)
  })

  it('is gone once cleared', () => {
    saveSession(startSession(null))
    clearSession()
    expect(loadSession()).toBeNull()
  })

  it('treats a damaged session as no session', () => {
    localStorage.setItem(
      'sushi-session',
      JSON.stringify({ version: 1, data: { restaurantId: 1 } }),
    )
    expect(loadSession()).toBeNull()
  })
})
