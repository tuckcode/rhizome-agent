import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommandRail } from './CommandRail'
import { APP_STORAGE_KEYS } from '../constants/appStorage'

const { trackSessionsDrawerOpened } = vi.hoisted(() => ({ trackSessionsDrawerOpened: vi.fn() }))
vi.mock('../lib/productAnalytics', () => ({
  trackCommandRailPinChanged: () => {},
  trackSessionsDrawerOpened,
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
 * First launch opens the sessions list. A saved collapse still wins after that.
 */
describe('the rail puts sessions in its open middle', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(APP_STORAGE_KEYS.commandRailExpanded, '0')
  })

  it('starts expanded when nothing is saved, and does not write that choice yet', () => {
    localStorage.removeItem(APP_STORAGE_KEYS.commandRailExpanded)
    renderRail()

    expect(screen.getByTestId('command-rail')).toHaveAttribute('data-expanded', 'true')
    expect(screen.getByTestId('command-rail-sessions')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
    expect(localStorage.getItem(APP_STORAGE_KEYS.commandRailExpanded)).toBeNull()
  })

  it('expands to mount Sessions above Settings', async () => {
    const onSessionsSlotReady = vi.fn()
    renderRail({ onSessionsSlotReady })

    fireEvent.mouseEnter(screen.getByTestId('command-rail'))

    const sessions = await screen.findByTestId('command-rail-sessions')
    expect(sessions.parentElement).toHaveClass('overflow-hidden')
    expect(screen.getByTestId('command-rail-footer')).toHaveClass('z-10')
    expect(onSessionsSlotReady).toHaveBeenCalledWith(sessions)
    expect(localStorage.getItem(APP_STORAGE_KEYS.commandRailExpanded)).toBe('0')
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

    expect(screen.queryByTestId('command-rail-toggle')).not.toBeInTheDocument()
    expect(screen.getByTestId('command-rail-settings')).toBeInTheDocument()
  })

  it('keeps Settings next to the sidebar control when the rail is collapsed', () => {
    renderRail()

    const expand = screen.getByRole('button', { name: 'Expand sidebar' })
    const settings = screen.getByTestId('command-rail-settings')
    expect(expand.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByTestId('command-rail-toggle')).not.toBeInTheDocument()
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

  it('lets Settings work on the collapsed rail without expanding it', async () => {
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
    expect(screen.queryByTestId('command-rail-toggle')).not.toBeInTheDocument()
  })
})

/**
 * D1 — compact rail had Settings and Keep as rail only. Hover is the mouse
 * expand, and Keep as rail turns that off, so a keyboard user could not
 * reach Sessions at all.
 */
describe('the compact rail has a keyboard path to Sessions', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(APP_STORAGE_KEYS.commandRailExpanded, '0')
  })

  it('offers Expand sidebar in the compact tab order', () => {
    renderRail()

    const expand = screen.getByRole('button', { name: 'Expand sidebar' })
    const settings = screen.getByRole('button', { name: 'Settings' })

    expect(expand.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Keep as rail' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('command-rail-sessions')).not.toBeInTheDocument()
  })

  it('moves focus into Sessions after Expand so Tab can reach the list', async () => {
    const onSessionsSlotReady = (slot: HTMLDivElement | null) => {
      if (!slot || slot.querySelector('input')) return
      const input = document.createElement('input')
      input.setAttribute('aria-label', 'Search sessions')
      slot.append(input)
    }
    renderRail({ onSessionsSlotReady })

    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }))

    const search = await screen.findByLabelText('Search sessions')
    await waitFor(() => expect(search).toHaveFocus())
  })

  it('opens Sessions from Expand without pinning the rail', async () => {
    const onSessionsSlotReady = vi.fn()
    renderRail({ onSessionsSlotReady })

    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }))

    const sessions = await screen.findByTestId('command-rail-sessions')
    expect(screen.getByTestId('command-rail')).toHaveAttribute('data-expanded', 'true')
    expect(onSessionsSlotReady).toHaveBeenCalledWith(sessions)
    expect(localStorage.getItem(APP_STORAGE_KEYS.commandRailExpanded)).toBe('0')
    expect(localStorage.getItem(APP_STORAGE_KEYS.commandRailCompactLocked)).toBeNull()
  })

  it('collapses Sessions again from the sidebar control', async () => {
    renderRail()

    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }))
    await screen.findByTestId('command-rail-sessions')

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))

    expect(screen.getByTestId('command-rail')).toHaveAttribute('data-expanded', 'false')
    expect(screen.queryByTestId('command-rail-sessions')).not.toBeInTheDocument()
  })
})

/**
 * D2 — hover expand overlays ~194px of Chat. The overlay must not steal
 * clicks, and leaving while a session search or rename still has focus
 * must not drop that work.
 */
describe('a hover-expanded rail does not steal Chat clicks', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(APP_STORAGE_KEYS.commandRailExpanded, '0')
  })

  it('turns off pointer events on the overlay so Chat under it stays clickable', async () => {
    renderRail()
    const rail = screen.getByTestId('command-rail')

    fireEvent.mouseEnter(rail)
    await waitFor(() => expect(rail).toHaveAttribute('data-expanded', 'true'))

    expect(rail).toHaveAttribute('data-overlay', 'false')
    expect(rail.style.pointerEvents).not.toBe('none')
    expect(rail.style.marginRight).toBe('')
  })

  it('collapses a pinned rail from the sidebar control', () => {
    localStorage.setItem(APP_STORAGE_KEYS.commandRailExpanded, '1')
    const onPinnedChange = vi.fn()
    renderRail({ onPinnedChange })

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))

    expect(onPinnedChange).toHaveBeenCalledWith(false)
    expect(screen.getByTestId('command-rail')).toHaveAttribute('data-pinned', 'false')
    expect(screen.getByTestId('command-rail')).toHaveAttribute('data-expanded', 'false')
    expect(localStorage.getItem(APP_STORAGE_KEYS.commandRailExpanded)).toBe('0')
  })

  it('reports collapsed width at rest and the open width while the rail is expanded', async () => {
    const onLayoutWidthChange = vi.fn()
    renderRail({ onLayoutWidthChange, width: 240 })

    expect(onLayoutWidthChange).toHaveBeenCalledWith(46)

    fireEvent.mouseEnter(screen.getByTestId('command-rail'))
    await waitFor(() => expect(onLayoutWidthChange).toHaveBeenCalledWith(240))
  })

  it('keeps a pinned rail in flow so it is not an overlay', () => {
    localStorage.setItem(APP_STORAGE_KEYS.commandRailExpanded, '1')
    renderRail()

    const rail = screen.getByTestId('command-rail')
    expect(rail).toHaveAttribute('data-overlay', 'false')
    expect(rail).toHaveAttribute('data-expanded', 'true')
    expect(rail.style.pointerEvents).not.toBe('none')
  })

  it('closes the overlay when the pointer is over Chat rather than rail chrome', async () => {
    renderRail()
    const rail = screen.getByTestId('command-rail')
    vi.spyOn(rail, 'getBoundingClientRect').mockReturnValue({
      bottom: 600,
      height: 600,
      left: 0,
      right: 240,
      top: 0,
      width: 240,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    fireEvent.mouseEnter(rail)
    await waitFor(() => expect(rail).toHaveAttribute('data-expanded', 'true'))
    fireEvent.mouseMove(window, { clientX: 120, clientY: 220 })

    await waitFor(() => expect(rail).toHaveAttribute('data-expanded', 'false'))
    expect(screen.queryByTestId('command-rail-sessions')).not.toBeInTheDocument()
  })

  it('keeps Sessions mounted while a control inside it still has focus', async () => {
    const onSessionsSlotReady = (slot: HTMLDivElement | null) => {
      if (!slot || slot.querySelector('input')) return
      const input = document.createElement('input')
      input.setAttribute('aria-label', 'Search sessions')
      slot.append(input)
    }
    renderRail({ onSessionsSlotReady })
    const rail = screen.getByTestId('command-rail')

    fireEvent.mouseEnter(rail)
    const sessions = await screen.findByTestId('command-rail-sessions')
    const search = sessions.querySelector('input')
    expect(search).not.toBeNull()
    search?.focus()

    fireEvent.mouseMove(window, { clientX: 500, clientY: 220 })
    await new Promise((resolve) => setTimeout(resolve, 220))

    expect(rail).toHaveAttribute('data-expanded', 'true')
    expect(screen.getByTestId('command-rail-sessions')).toBeInTheDocument()
    expect(search).toHaveFocus()
  })
})

/**
 * Native audit 2026-09-26: "In a narrow window, use a temporary drawer that
 * closes after conversation selection." When the shell cannot give the rail
 * its own column, Expand opens a drawer over Chat behind a scrim — a clear
 * modal boundary, so no control sits hidden and clickable underneath.
 */
describe('the Sessions drawer in a narrow window', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(APP_STORAGE_KEYS.commandRailExpanded, '0')
  })

  function openDrawer(overrides: Partial<React.ComponentProps<typeof CommandRail>> = {}) {
    const onLayoutWidthChange = vi.fn()
    renderRail({ drawer: true, width: 240, onLayoutWidthChange, ...overrides })
    fireEvent.click(screen.getByTestId('command-rail-expand'))
    return { onLayoutWidthChange }
  }

  it('opens over Chat behind a scrim and keeps its collapsed layout width', () => {
    const { onLayoutWidthChange } = openDrawer()
    const rail = screen.getByTestId('command-rail')
    expect(rail).toHaveAttribute('data-expanded', 'true')
    expect(rail).toHaveAttribute('data-drawer', 'true')
    expect(screen.getByTestId('command-rail-drawer-scrim')).toBeInTheDocument()
    expect(onLayoutWidthChange).not.toHaveBeenCalledWith(240)
    expect(rail.style.pointerEvents).not.toBe('none')
    expect(trackSessionsDrawerOpened).toHaveBeenCalled()
  })

  it('closes when the scrim is clicked', () => {
    openDrawer()
    fireEvent.click(screen.getByTestId('command-rail-drawer-scrim'))
    expect(screen.getByTestId('command-rail')).toHaveAttribute('data-expanded', 'false')
  })

  it('closes on Escape', () => {
    openDrawer()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByTestId('command-rail')).toHaveAttribute('data-expanded', 'false')
  })

  it('closes after a conversation is picked', () => {
    const props: React.ComponentProps<typeof CommandRail> = {
      locale: 'en', onOpenSettings: vi.fn(), drawer: true, drawerCloseSignal: 0,
    }
    const { rerender } = render(<CommandRail {...props} />)
    fireEvent.click(screen.getByTestId('command-rail-expand'))
    expect(screen.getByTestId('command-rail')).toHaveAttribute('data-expanded', 'true')
    rerender(<CommandRail {...props} drawerCloseSignal={1} />)
    expect(screen.getByTestId('command-rail')).toHaveAttribute('data-expanded', 'false')
  })

  it('does not open from hover', () => {
    vi.useFakeTimers()
    renderRail({ drawer: true })
    fireEvent.mouseEnter(screen.getByTestId('command-rail'))
    vi.advanceTimersByTime(2000)
    expect(screen.getByTestId('command-rail')).toHaveAttribute('data-expanded', 'false')
    vi.useRealTimers()
  })

  it('stays an in-flow column when the shell has room', () => {
    renderRail({ drawer: false })
    fireEvent.click(screen.getByTestId('command-rail-expand'))
    expect(screen.getByTestId('command-rail')).toHaveAttribute('data-drawer', 'false')
    expect(screen.queryByTestId('command-rail-drawer-scrim')).not.toBeInTheDocument()
  })
})
