import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommandRail } from './CommandRail'

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
    activeDestination: 'notes',
    onSelectNotes: vi.fn(),
    onSelectGraph: vi.fn(),
    onOpenResearch: vi.fn(),
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

  it('renders the four destinations and the settings gear', () => {
    renderRail()
    expect(screen.getByTestId('command-rail')).toBeInTheDocument()
    expect(screen.getByTestId('command-rail-notes')).toBeInTheDocument()
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
    expect(props.onOpenResearch).toHaveBeenCalledOnce()
    expect(trackRailDestinationClicked).toHaveBeenCalledWith('research')

    fireEvent.click(screen.getByTestId('command-rail-changes'))
    expect(props.onSelectChanges).toHaveBeenCalledOnce()
    expect(trackRailDestinationClicked).toHaveBeenCalledWith('changes')

    fireEvent.click(screen.getByTestId('command-rail-notes'))
    expect(props.onSelectNotes).toHaveBeenCalledOnce()
    expect(trackRailDestinationClicked).toHaveBeenCalledWith('notes')
  })

  it('marks the active destination with aria-pressed', () => {
    renderRail({ activeDestination: 'graph' })
    expect(screen.getByTestId('command-rail-graph')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('command-rail-notes')).toHaveAttribute('aria-pressed', 'false')
  })

  it('opens settings from the gear without tracking a destination', () => {
    const props = renderRail()

    fireEvent.click(screen.getByTestId('command-rail-settings'))

    expect(props.onOpenSettings).toHaveBeenCalledOnce()
    // The gear is not a rail "destination".
    expect(trackRailDestinationClicked).not.toHaveBeenCalled()
  })
})
