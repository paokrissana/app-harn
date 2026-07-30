import '@testing-library/jest-dom/vitest'
import { beforeEach, vi } from 'vitest'

// Saved bills, theme and language all live in localStorage — start each test
// with an empty one so nothing leaks between them.
beforeEach(() => {
  localStorage.clear()
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
