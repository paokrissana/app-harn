import { describe, expect, it } from 'vitest'

import { leaveDevMode, resolveDevMode } from '@/lib/dev-mode'

describe('resolveDevMode', () => {
  it('is off for an ordinary visit', () => {
    expect(resolveDevMode('')).toBe(false)
    expect(resolveDevMode('?lang=th')).toBe(false)
  })

  it('turns on from the parameter', () => {
    expect(resolveDevMode('?devMode=on')).toBe(true)
  })

  it('stays on afterwards, without the parameter', () => {
    resolveDevMode('?devMode=on')
    expect(resolveDevMode('')).toBe(true)
  })

  it('turns off from the parameter, and stays off', () => {
    resolveDevMode('?devMode=on')
    expect(resolveDevMode('?devMode=off')).toBe(false)
    expect(resolveDevMode('')).toBe(false)
  })

  it('fails closed on a value it does not recognise', () => {
    // A typo should not strand somebody in a mode they cannot name.
    resolveDevMode('?devMode=on')
    expect(resolveDevMode('?devMode=yes')).toBe(false)
  })

  it('leaves the mode when asked from inside the app', () => {
    resolveDevMode('?devMode=on')
    leaveDevMode()
    expect(resolveDevMode('')).toBe(false)
  })

  it('survives storage being unavailable', () => {
    const real = Object.getOwnPropertyDescriptor(window, 'localStorage')!
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked')
      },
    })

    try {
      // Off rather than a crash, and the parameter still reads for this visit.
      expect(resolveDevMode('')).toBe(false)
      expect(resolveDevMode('?devMode=on')).toBe(true)
      expect(() => leaveDevMode()).not.toThrow()
    } finally {
      Object.defineProperty(window, 'localStorage', real)
    }
  })
})
