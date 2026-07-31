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
  it('lists every tool from the vision', () => {
    renderAt('/')

    const cards = screen.getAllByRole('listitem')
    expect(cards).toHaveLength(TOOLS.length)
    expect(screen.getByText('Split Meal')).toBeInTheDocument()
    expect(screen.getByText('Split Utilities')).toBeInTheDocument()
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

  it('marks the unbuilt tools as coming soon', () => {
    renderAt('/')

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

    expect(screen.getByText('Split Utilities')).toBeInTheDocument()
    expect(screen.queryByLabelText(/total bill/i)).not.toBeInTheDocument()
  })

  it('sends an unknown path home', () => {
    renderAt('/split-something-else')
    expect(screen.getByText('Split Meal')).toBeInTheDocument()
    expect(screen.queryByLabelText(/total bill/i)).not.toBeInTheDocument()
  })

  it('keeps the brand as a way home on every page', () => {
    renderAt('/split-meal')
    const header = screen.getByRole('banner')
    expect(
      within(header).getByRole('link', { name: /app harn/i }),
    ).toHaveAttribute('href', '/')
  })
})
