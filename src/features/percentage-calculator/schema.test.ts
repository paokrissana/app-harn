import { describe, expect, it } from 'vitest'

import { translations } from '@/i18n/translations'
import { isAnswerable, parseNumber, validate } from './schema'

const t = (key: keyof typeof translations.en) => translations.en[key]

describe('parseNumber', () => {
  it('reads a number, decimals included', () => {
    expect(parseNumber('80')).toBe(80)
    expect(parseNumber(' 12.5 ')).toBe(12.5)
  })

  it('treats blank as "not filled in", not as zero', () => {
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('   ')).toBeNull()
  })

  it('rejects anything that is not a finite number', () => {
    expect(parseNumber('abc')).toBeNull()
    expect(parseNumber('Infinity')).toBeNull()
  })
})

describe('validate', () => {
  it('says nothing about a box nobody has filled in yet', () => {
    expect(validate('of', '', '', t)).toEqual({
      percentage: undefined,
      amount: undefined,
    })
  })

  it('catches text where a number belongs', () => {
    expect(validate('of', 'abc', '100', t).percentage).toBe('Numbers only')
  })

  it('catches negatives in either box', () => {
    expect(validate('of', '-5', '100', t).percentage).toBe('Cannot be negative')
    expect(validate('of', '5', '-100', t).amount).toBe('Cannot be negative')
  })

  it('caps a discount at 100%, since you cannot pay less than nothing', () => {
    expect(validate('discount', '150', '100', t).percentage).toBe('At most 100%')
    expect(validate('discount', '100', '100', t).percentage).toBeUndefined()
  })

  it('lets the other modes go past 100%', () => {
    // "300% of 50" and "up 300%" are ordinary questions.
    expect(validate('of', '300', '50', t).percentage).toBeUndefined()
    expect(validate('increase', '300', '50', t).percentage).toBeUndefined()
  })

  it('refuses a whole of zero, which has no answer', () => {
    expect(validate('relation', '800', '0', t).amount).toBe('Cannot be zero')
  })

  it('allows zero as an ordinary amount elsewhere', () => {
    expect(validate('of', '80', '0', t).amount).toBeUndefined()
  })
})

describe('isAnswerable', () => {
  const clean = { percentage: undefined, amount: undefined }

  it('needs both boxes filled', () => {
    expect(isAnswerable('80', '', clean)).toBe(false)
    expect(isAnswerable('', '1500', clean)).toBe(false)
    expect(isAnswerable('80', '1500', clean)).toBe(true)
  })

  it('refuses while anything is complaining', () => {
    expect(isAnswerable('80', '1500', { percentage: 'Numbers only' })).toBe(
      false,
    )
  })

  it('counts zero as filled in', () => {
    expect(isAnswerable('0', '0', clean)).toBe(true)
  })
})
