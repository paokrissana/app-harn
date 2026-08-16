import { describe, expect, it } from 'vitest'

import {
  displayName,
  emptyMeal,
  newDish,
  toggleEater,
  withPerson,
  withoutPerson,
} from './meal-form'
import type { GroupMealFormInput } from './schema'

function table(): GroupMealFormInput {
  return {
    people: [
      { id: 'alex', name: 'Alex' },
      { id: 'bianca', name: 'Bianca' },
    ],
    dishes: [
      { id: '1', title: 'Tom yum', price: '300', sharedBy: ['alex', 'bianca'] },
      { id: '2', title: 'Steak', price: '540', sharedBy: ['bianca'] },
    ],
    totalBill: '0',
    serviceChargeEnabled: true,
    serviceChargePct: '10',
    vatEnabled: true,
    vatPct: '7',
    payerId: 'alex',
  }
}

describe('emptyMeal', () => {
  it('starts with two people, since one splits nothing', () => {
    expect(emptyMeal().people).toHaveLength(2)
  })

  it('assumes the first person paid, and the usual Thai charges', () => {
    const meal = emptyMeal()
    expect(meal.payerId).toBe(meal.people[0].id)
    expect(meal.serviceChargePct).toBe('10')
    expect(meal.vatPct).toBe('7')
  })
})

describe('newDish', () => {
  it('is shared by the whole table to begin with', () => {
    expect(newDish(['alex', 'bianca']).sharedBy).toEqual(['alex', 'bianca'])
  })

  it('does not alias the list it was handed', () => {
    const everyone = ['alex']
    const dish = newDish(everyone)
    everyone.push('bianca')
    expect(dish.sharedBy).toEqual(['alex'])
  })
})

describe('toggleEater', () => {
  it('takes somebody off a dish, and puts them back', () => {
    expect(toggleEater(['alex', 'bianca'], 'alex')).toEqual(['bianca'])
    expect(toggleEater(['bianca'], 'alex')).toEqual(['bianca', 'alex'])
  })
})

describe('withPerson', () => {
  it('adds anyone new to the dishes the whole table was sharing', () => {
    const [tomYum] = withPerson(table()).dishes
    expect(tomYum.sharedBy).toHaveLength(3)
  })

  it('leaves a dish alone when it was already down to some people', () => {
    const [, steak] = withPerson(table()).dishes
    expect(steak.sharedBy).toEqual(['bianca'])
  })
})

describe('withoutPerson', () => {
  it('takes them off every dish they were sharing', () => {
    const [tomYum] = withoutPerson(table(), 'alex').dishes
    expect(tomYum.sharedBy).toEqual(['bianca'])
  })

  it('drops a dish nobody is left to pay for', () => {
    // The steak was Bianca's alone, so it goes when she does.
    const titles = withoutPerson(table(), 'bianca').dishes.map(
      (dish) => dish.title,
    )
    expect(titles).toEqual(['Tom yum'])
  })

  it('moves the bill to whoever is left when the payer goes', () => {
    expect(withoutPerson(table(), 'alex').payerId).toBe('bianca')
  })

  it('leaves the payer alone when somebody else goes', () => {
    expect(withoutPerson(table(), 'bianca').payerId).toBe('alex')
  })
})

describe('displayName', () => {
  it('falls back to a numbered placeholder while unnamed', () => {
    expect(displayName('  ', 2, 'Name')).toBe('Name 3')
    expect(displayName(' Alex ', 0, 'Name')).toBe('Alex')
  })
})
