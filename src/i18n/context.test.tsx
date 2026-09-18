import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { LanguageProvider, useI18n } from './context'

function Probe() {
  const { lang, t } = useI18n()
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="tagline">{t('tagline')}</span>
    </div>
  )
}

const renderProbe = () =>
  render(
    <LanguageProvider>
      <Probe />
    </LanguageProvider>,
  )

describe('language default', () => {
  /*
   * The suite pins English in test/setup.ts so assertions stay readable, so
   * these clear it first — this is the one place the real default is checked.
   */
  it('is Thai when nothing has been chosen', () => {
    localStorage.clear()
    renderProbe()

    expect(screen.getByTestId('lang')).toHaveTextContent('th')
    expect(screen.getByTestId('tagline')).toHaveTextContent('แบ่งจ่ายให้ง่ายที่สุด')
  })

  it('keeps a language the visitor picked before', () => {
    localStorage.clear()
    localStorage.setItem('lang', 'en')
    renderProbe()

    expect(screen.getByTestId('lang')).toHaveTextContent('en')
  })

  it('falls back to Thai when storage holds nonsense', () => {
    localStorage.clear()
    localStorage.setItem('lang', 'fr')
    renderProbe()

    expect(screen.getByTestId('lang')).toHaveTextContent('th')
  })

  it('remembers a switch away from the default', async () => {
    const user = userEvent.setup()
    localStorage.clear()

    function Toggle() {
      const { lang, setLang } = useI18n()
      return (
        <button type="button" onClick={() => setLang('en')}>
          {lang}
        </button>
      )
    }

    render(
      <LanguageProvider>
        <Toggle />
      </LanguageProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'th' }))
    expect(screen.getByRole('button', { name: 'en' })).toBeInTheDocument()
    expect(localStorage.getItem('lang')).toBe('en')
  })
})
