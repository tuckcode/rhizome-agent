import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommandRail } from './CommandRail'
import { APP_STORAGE_KEYS } from '../constants/appStorage'

vi.mock('../lib/productAnalytics', () => ({
  trackCommandRailPinChanged: () => {},
}))

// ActionTooltip wraps its trigger in a Radix Tooltip; render children directly
// so the buttons are queryable without a TooltipProvider in the test tree.
vi.mock('./ui/action-tooltip', () => ({
  ActionTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

function renderRail(overrides: Partial<React.ComponentProps<typeof CommandRail>> = {}) {
  const props: React.ComponentProps<typeof CommandRail> = {
    locale: 'en',
    onOpenSettings: vi.fn(),
    ...overrides,
  }
  render(<CommandRail {...props} />)
  return props
}

describe('CommandRail', () => {
  it('renders Sessions space and settings gear without Chat or Research destinations', () => {
    renderRail()
    expect(screen.getByTestId('command-rail')).toBeInTheDocument()
    expect(screen.queryByTestId('command-rail-chat')).not.toBeInTheDocument()
    expect(screen.queryByTestId('command-rail-research')).not.toBeInTheDocument()
    expect(screen.queryByTestId('command-rail-changes')).not.toBeInTheDocument()
    expect(screen.getByTestId('command-rail-settings')).toBeInTheDocument()
  })

  it('opens settings from the gear', () => {
    const props = renderRail()

    fireEvent.click(screen.getByTestId('command-rail-settings'))

    expect(props.onOpenSettings).toHaveBeenCalledOnce()
  })
})

/**
 * The 2026-08-20 audit expanded the rail because an icon-only launcher hid
 * its available places. Atticus later chose a compact default: familiar
 * icons save room, while a readable hover label says what each one is and an
 * explicit expand action reveals the persistent Sessions area.
 */
describe('the rail puts sessions in its open middle', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts compact with Settings discoverable by its accessible label', () => {
    renderRail()

    expect(screen.getByTestId('command-rail')).toHaveAttribute('data-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Chat' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Research' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Changes' })).not.toBeInTheDocument()
  })

  it('expands to mount Sessions above Settings', async () => {
    const onSessionsSlotReady = vi.fn()
    renderRail({ onSessionsSlotReady })

    fireEvent.mouseEnter(screen.getByTestId('command-rail'))

    const sessions = await screen.findByTestId('command-rail-sessions')
    expect(sessions).toBeInTheDocument()
    expect(onSessionsSlotReady).toHaveBeenCalledWith(sessions)
    expect(localStorage.getItem(APP_STORAGE_KEYS.commandRailExpanded)).toBeNull()
  })

  it('keeps Settings as a gear when the rail is expanded, pin on the left', async () => {
    renderRail()

    fireEvent.mouseEnter(screen.getByTestId('command-rail'))
    await waitFor(() => expect(screen.getByTestId('command-rail')).toHaveAttribute('data-expanded', 'true'))

    expect(screen.queryByTestId('command-rail-chat')).not.toBeInTheDocument()
    expect(screen.queryByTestId('command-rail-inbox')).not.toBeInTheDocument()
    expect(screen.queryByTestId('command-rail-changes')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByTestId('command-rail-settings')).not.toHaveTextContent('Settings')

    const pin = screen.getByTestId('command-rail-toggle')
    const settings = screen.getByTestId('command-rail-settings')
    expect(pin.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps Settings above the pin when the rail is collapsed', () => {
    renderRail()

    const settings = screen.getByTestId('command-rail-settings')
    const pin = screen.getByTestId('command-rail-toggle')
    expect(settings.compareDocumentPosition(pin) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('returns to compact mode when the pointer leaves an unpinned rail', async () => {
    renderRail()

    const rail = screen.getByTestId('command-rail')
    fireEvent.mouseEnter(rail)
    await waitFor(() => expect(rail).toHaveAttribute('data-expanded', 'true'))
    await new Promise((resolve) => setTimeout(resolve, 30))

    fireEvent.mouseMove(window, { clientX: 500, clientY: 220 })
    await waitFor(() => expect(rail).toHaveAttribute('data-expanded', 'false'))
    expect(screen.queryByTestId('command-rail-sessions')).not.toBeInTheDocument()
  })

  it('ignores a false leave whose pointer coordinates remain inside the rail', async () => {
    renderRail()

    const rail = screen.getByTestId('command-rail')
    vi.spyOn(rail, 'getBoundingClientRect').mockReturnValue({
      bottom: 600,
      height: 600,
      left: 0,
      right: 168,
      top: 0,
      width: 168,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    fireEvent.mouseEnter(rail)
    await waitFor(() => expect(rail).toHaveAttribute('data-expanded', 'true'))
    fireEvent.mouseMove(window, { clientX: 40, clientY: 220 })

    await new Promise((resolve) => setTimeout(resolve, 220))
    expect(rail).toHaveAttribute('data-expanded', 'true')
  })

  it('can be pinned open after hover expansion', async () => {
    renderRail()

    const rail = screen.getByTestId('command-rail')
    fireEvent.mouseEnter(rail)
    await waitFor(() => expect(rail).toHaveAttribute('data-expanded', 'true'))
    fireEvent.click(screen.getByRole('button', { name: 'Pin sidebar' }))
    fireEvent.mouseMove(window, { clientX: 500, clientY: 220 })

    expect(rail).toHaveAttribute('data-expanded', 'true')
    expect(localStorage.getItem(APP_STORAGE_KEYS.commandRailExpanded)).toBe('1')
  })

  it('lets Settings and Pin work on the collapsed rail without expanding it', async () => {
    const props = renderRail()
    const rail = screen.getByTestId('command-rail')
    const footer = screen.getByTestId('command-rail-footer')

    fireEvent.mouseEnter(footer)
    await new Promise((resolve) => setTimeout(resolve, 200))

    expect(rail).toHaveAttribute('data-expanded', 'false')
    fireEvent.click(screen.getByTestId('command-rail-settings'))
    expect(props.onOpenSettings).toHaveBeenCalledOnce()
    expect(rail).toHaveAttribute('data-expanded', 'false')
  })

  it('can pin the collapsed rail so hover no longer expands it', async () => {
    renderRail()
    const rail = screen.getByTestId('command-rail')

    fireEvent.click(screen.getByRole('button', { name: 'Keep as rail' }))
    expect(rail).toHaveAttribute('data-compact-locked', 'true')
    expect(localStorage.getItem(APP_STORAGE_KEYS.commandRailCompactLocked)).toBe('1')

    fireEvent.mouseEnter(rail)
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(rail).toHaveAttribute('data-expanded', 'false')

    fireEvent.click(screen.getByRole('button', { name: 'Allow sidebar to expand' }))
    expect(rail).toHaveAttribute('data-compact-locked', 'false')
  })

  it('widens from its right edge and remembers the chosen width', async () => {
    renderRail()

    const rail = screen.getByTestId('command-rail')
    fireEvent.mouseEnter(rail)
    await waitFor(() => expect(rail).toHaveAttribute('data-expanded', 'true'))
    const handle = screen.getByRole('separator', { name: 'Resize Sessions sidebar' })

    fireEvent.mouseDown(handle, { clientX: 168 })
    fireEvent.mouseMove(window, { clientX: 248 })
    fireEvent.mouseUp(window)

    expect(rail).toHaveStyle({ width: '320px' })
    expect(localStorage.getItem('rhizome:command-rail-width')).toBe('320')
    expect(rail).toHaveAttribute('data-pinned', 'true')
  })

  it('stays collapsed when that is what the machine remembers', () => {
    localStorage.setItem(APP_STORAGE_KEYS.commandRailExpanded, '0')

    renderRail()

    expect(screen.queryByTestId('command-rail-sessions')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Keep as rail' })).toBeInTheDocument()
  })
})
