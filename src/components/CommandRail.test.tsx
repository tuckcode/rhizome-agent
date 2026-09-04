import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommandRail } from './CommandRail'
import { APP_STORAGE_KEYS } from '../constants/appStorage'

const trackRailDestinationClicked = vi.fn()
vi.mock('../lib/productAnalytics', () => ({
  trackRailDestinationClicked: (destination: string) => trackRailDestinationClicked(destination),
}))

// ActionTooltip wraps its trigger in a Radix Tooltip; render children directly
// so the buttons are queryable without a TooltipProvider in the test tree.
vi.mock('./ui/action-tooltip', () => ({
  ActionTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

function renderRail(overrides: Partial<React.ComponentProps<typeof CommandRail>> = {}) {
  const props: React.ComponentProps<typeof CommandRail> = {
    locale: 'en',
    activeDestination: 'inbox',
    onSelectChat: vi.fn(),
    onSelectInbox: vi.fn(),
    onSelectGraph: vi.fn(),
    onSelectMycelium: vi.fn(),
    onSelectResearch: vi.fn(),
    onSelectChanges: vi.fn(),
    onOpenSettings: vi.fn(),
    ...overrides,
  }
  render(<CommandRail {...props} />)
  return props
}

describe('CommandRail', () => {
  beforeEach(() => {
    trackRailDestinationClicked.mockClear()
  })

  it('renders the destinations, Sessions space, and settings gear', () => {
    renderRail()
    expect(screen.getByTestId('command-rail')).toBeInTheDocument()
    expect(screen.getByTestId('command-rail-inbox')).toBeInTheDocument()
    expect(screen.getByTestId('command-rail-graph')).toBeInTheDocument()
    expect(screen.getByTestId('command-rail-research')).toBeInTheDocument()
    expect(screen.getByTestId('command-rail-changes')).toBeInTheDocument()
    expect(screen.getByTestId('command-rail-settings')).toBeInTheDocument()
  })

  it('fires the matching handler and tracks the destination when a rail button is clicked', () => {
    const props = renderRail()

    fireEvent.click(screen.getByTestId('command-rail-graph'))
    expect(props.onSelectGraph).toHaveBeenCalledOnce()
    expect(trackRailDestinationClicked).toHaveBeenCalledWith('graph')

    fireEvent.click(screen.getByTestId('command-rail-research'))
    expect(props.onSelectResearch).toHaveBeenCalledOnce()
    expect(trackRailDestinationClicked).toHaveBeenCalledWith('research')

    fireEvent.click(screen.getByTestId('command-rail-changes'))
    expect(props.onSelectChanges).toHaveBeenCalledOnce()
    expect(trackRailDestinationClicked).toHaveBeenCalledWith('changes')

    fireEvent.click(screen.getByTestId('command-rail-inbox'))
    expect(props.onSelectInbox).toHaveBeenCalledOnce()
    expect(trackRailDestinationClicked).toHaveBeenCalledWith('inbox')
  })

  it('marks the active destination with aria-pressed', () => {
    renderRail({ activeDestination: 'graph' })
    expect(screen.getByTestId('command-rail-graph')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('command-rail-inbox')).toHaveAttribute('aria-pressed', 'false')
  })

  it('opens settings from the gear without tracking a destination', () => {
    const props = renderRail()

    fireEvent.click(screen.getByTestId('command-rail-settings'))

    expect(props.onOpenSettings).toHaveBeenCalledOnce()
    // The gear is not a rail "destination".
    expect(trackRailDestinationClicked).not.toHaveBeenCalled()
  })
})

/**
 * The 2026-08-20 audit expanded the rail because an icon-only launcher hid
 * its available places. Atticus later chose a compact default: familiar
 * icons save room, while a readable hover label says what each one is and an
 * explicit expand action reveals the persistent Sessions area.
 */
describe('the rail puts navigation first and sessions in its empty middle', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts compact but keeps every destination discoverable by its accessible label', () => {
    renderRail()

    expect(screen.getByTestId('command-rail')).toHaveAttribute('data-expanded', 'false')
    for (const label of ['Chat', 'Inbox', 'Wiki Graph', 'Mycelium', 'Research', 'Changes', 'Settings']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('expands to show labels and mounts Sessions below all destinations', async () => {
    const onSessionsSlotReady = vi.fn()
    renderRail({ onSessionsSlotReady })

    fireEvent.mouseEnter(screen.getByTestId('command-rail'))

    await waitFor(() => expect(screen.getByText('Wiki Graph')).toBeInTheDocument())
    const sessions = screen.getByTestId('command-rail-sessions')
    expect(sessions).toBeInTheDocument()
    expect(onSessionsSlotReady).toHaveBeenCalledWith(sessions)
    expect(localStorage.getItem(APP_STORAGE_KEYS.commandRailExpanded)).toBeNull()
  })

  it('returns to compact mode when the pointer leaves an unpinned rail', async () => {
    renderRail()

    const rail = screen.getByTestId('command-rail')
    fireEvent.mouseEnter(rail)
    await waitFor(() => expect(rail).toHaveAttribute('data-expanded', 'true'))

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
    fireEvent.click(screen.getByRole('button', { name: 'Keep rail open' }))
    fireEvent.mouseMove(window, { clientX: 500, clientY: 220 })

    expect(rail).toHaveAttribute('data-expanded', 'true')
    expect(localStorage.getItem(APP_STORAGE_KEYS.commandRailExpanded)).toBe('1')
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

    expect(screen.queryByText('Notes')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand rail' })).toBeInTheDocument()
  })
})
