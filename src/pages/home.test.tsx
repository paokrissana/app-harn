import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { AppRoutes } from '@/App'
import { LanguageProvider } from '@/i18n/context'
import { TOOLS } from '@/lib/tools'

function renderAt(path: string) {
  return render(
    <LanguageProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </LanguageProvider>,
  )
}

describe('home page', () => {
  it('lists the tools that exist, and no roadmap', () => {
    renderAt('/')

    const built = TOOLS.filter((tool) => tool.path !== null)
    expect(screen.getAllByRole('listitem')).toHaveLength(built.length)
    expect(screen.getByText('Split Meal')).toBeInTheDocument()
    // Split Utilities has no page, so it is roadmap rather than product.
    expect(screen.queryByText('Split Utilities')).not.toBeInTheDocument()
  })

  it('brings the unbuilt tools back in dev mode', () => {
    renderAt('/?devMode=on')

    expect(screen.getAllByRole('listitem')).toHaveLength(TOOLS.length)
    expect(screen.getByText('Split Utilities')).toBeInTheDocument()
  })

  it('says why there is extra on screen, and offers the way out', async () => {
    const user = userEvent.setup()
    renderAt('/?devMode=on')

    expect(screen.getByText(/dev mode/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /turn off/i }))

    expect(screen.queryByText('Split Utilities')).not.toBeInTheDocument()
    expect(screen.queryByText(/dev mode/i)).not.toBeInTheDocument()
  })

  it('remembers dev mode without the parameter, until turned off', () => {
    renderAt('/?devMode=on')
    expect(screen.getByText('Split Utilities')).toBeInTheDocument()

    // A fresh visit with no parameter at all.
    renderAt('/')
    expect(screen.getAllByText('Split Utilities').length).toBeGreaterThan(0)
  })

  it('leads with the mission', () => {
    renderAt('/')
    expect(
      screen.getByRole('heading', { name: /make splitting expenses simple/i }),
    ).toBeInTheDocument()
  })

  it('only makes the built tool tappable', () => {
    renderAt('/')

    expect(screen.getByRole('link', { name: /split meal/i })).toHaveAttribute(
      'href',
      '/split-meal',
    )
    expect(
      screen.queryByRole('link', { name: /split taxi/i }),
    ).not.toBeInTheDocument()
  })

  it('flags Split Group Order as still being worked on', () => {
    renderAt('/')

    const card = screen.getByRole('link', { name: /split group order/i })
    expect(within(card).getByText(/^beta$/i)).toBeInTheDocument()
    // the finished tool carries no such label
    const meal = screen.getByRole('link', { name: /split meal/i })
    expect(within(meal).queryByText(/^beta$/i)).not.toBeInTheDocument()
  })

  it('warns on the group order page itself, before anything is entered', async () => {
    renderAt('/split-group-order')

    expect(
      screen.getByText(/check the numbers before you send them/i),
    ).toBeInTheDocument()
  })

  it('does not warn on the finished tool', () => {
    renderAt('/split-meal')
    expect(
      screen.queryByText(/check the numbers before you send them/i),
    ).not.toBeInTheDocument()
  })

  it('marks the unbuilt tools as coming soon', () => {
    renderAt('/?devMode=on')

    const soon = screen.getAllByText(/^coming soon$/i)
    expect(soon).toHaveLength(TOOLS.filter((tool) => !tool.path).length)
  })

  it('opens the calculator when a tool is tapped', async () => {
    const user = userEvent.setup()
    renderAt('/')

    await user.click(screen.getByRole('link', { name: /split meal/i }))

    expect(screen.getByLabelText(/total bill/i)).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Split Meal' }),
    ).toBeInTheDocument()
  })
})

describe('routing', () => {
  it('opens the calculator on its own URL', () => {
    renderAt('/split-meal')
    expect(screen.getByLabelText(/total bill/i)).toBeInTheDocument()
  })

  it('goes back to the tools from a tool page', async () => {
    const user = userEvent.setup()
    renderAt('/split-meal')

    await user.click(screen.getByRole('link', { name: /all tools/i }))

    expect(screen.getByText('Split Meal')).toBeInTheDocument()
    expect(screen.queryByLabelText(/total bill/i)).not.toBeInTheDocument()
  })

  it('sends an unknown path home', () => {
    renderAt('/split-something-else')
    expect(screen.getByText('Split Meal')).toBeInTheDocument()
    expect(screen.queryByLabelText(/total bill/i)).not.toBeInTheDocument()
  })

  it('leads with the finished tools, before the ones still in beta', () => {
    renderAt('/')

    const names = screen
      .getAllByRole('link')
      .map((link) => link.textContent ?? '')
      .filter((text) => text.includes('Split') || text.includes('Percentage'))

    expect(names[0]).toContain('Split Meal')
    expect(names[1]).toContain('Percentage Calculator')
  })

  it('does not call the Percentage Calculator a beta', () => {
    renderAt('/')

    const card = screen
      .getAllByRole('link')
      .find((link) => link.textContent?.includes('Percentage Calculator'))!

    expect(card).not.toHaveTextContent(/beta/i)
    expect(card).not.toHaveTextContent(/coming soon/i)
  })

  it('keeps the brand as a way home on every page', () => {
    renderAt('/split-meal')
    const header = screen.getByRole('banner')
    expect(
      within(header).getByRole('link', { name: /app harn/i }),
    ).toHaveAttribute('href', '/')
  })
})
