import '@testing-library/jest-dom/vitest'
import { beforeEach, vi } from 'vitest'

// Saved bills, theme and language all live in localStorage — start each test
// with an empty one so nothing leaks between them.
beforeEach(() => {
  localStorage.clear()
  /*
   * The app defaults to Thai, for the reason in i18n/context.tsx. Tests assert
   * against English wording because that is what they were written in and it
   * keeps them readable to anyone. Pinning it here is a test convenience, not
   * a claim about the default — that is covered in i18n/context.test.tsx.
   */
  localStorage.setItem('lang', 'en')
})

// jsdom has no layout, so scrolling back to the form is a no-op here.
window.scrollTo = vi.fn()

// jsdom does not implement matchMedia; the theme toggle reads it on mount.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
})
