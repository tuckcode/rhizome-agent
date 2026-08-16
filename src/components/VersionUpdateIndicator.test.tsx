import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { VersionUpdateIndicator } from './VersionUpdateIndicator'
import { TooltipProvider } from './ui/tooltip'
import type { UpdateStatus, UpdateActions } from '../hooks/useUpdater'
import type { PrimeUpdateStatus, PrimeUpdateActions } from '../hooks/usePrimeUpdate'

function makeRhizomeActions(overrides?: Partial<UpdateActions>): UpdateActions {
  return {
    startDownload: vi.fn(),
    openReleaseNotes: vi.fn(),
    dismiss: vi.fn(),
    ...overrides,
  }
}

function makePrimeActions(overrides?: Partial<PrimeUpdateActions>): PrimeUpdateActions {
  return {
    checkForPrimeUpdate: vi.fn(),
    openPrimeReleasePage: vi.fn(),
    ...overrides,
  }
}

const idleRhizome: UpdateStatus = { state: 'idle' }
const idlePrime: PrimeUpdateStatus = { state: 'idle' }

function rhizomeAvailable(overrides?: Partial<Extract<UpdateStatus, { state: 'available' }>>): UpdateStatus {
  return {
    state: 'available',
    version: '2026.4.16',
    displayVersion: '2026.4.16',
    notes: 'Bug fixes and improvements',
    ...overrides,
  }
}

function primeAvailable(overrides?: Partial<Extract<PrimeUpdateStatus, { state: 'available' }>>): PrimeUpdateStatus {
  return {
    state: 'available',
    version: '0.7.2',
    notes: '- Fixed a focus bug',
    url: 'https://github.com/PrimeIntellect-ai/prime-agent/releases/tag/v0.7.2',
    ...overrides,
  }
}

function renderIndicator({
  rhizomeStatus = idleRhizome,
  primeStatus = idlePrime,
  rhizomeActions = makeRhizomeActions(),
  primeActions = makePrimeActions(),
}: {
  rhizomeStatus?: UpdateStatus
  primeStatus?: PrimeUpdateStatus
  rhizomeActions?: UpdateActions
  primeActions?: PrimeUpdateActions
} = {}) {
  const view = render(
    <TooltipProvider>
      <VersionUpdateIndicator
        rhizomeStatus={rhizomeStatus}
        rhizomeActions={rhizomeActions}
        primeStatus={primeStatus}
        primeActions={primeActions}
      />
    </TooltipProvider>,
  )
  return { ...view, rhizomeActions, primeActions }
}

describe('VersionUpdateIndicator', () => {
  it('renders nothing when neither Rhizome nor Prime has an update', () => {
    renderIndicator()
    expect(screen.queryByTestId('status-version-update')).not.toBeInTheDocument()
  })

  it('renders nothing while Rhizome is only checking, downloading, or ready (not "available")', () => {
    renderIndicator({ rhizomeStatus: { state: 'checking' } })
    expect(screen.queryByTestId('status-version-update')).not.toBeInTheDocument()
  })

  it('shows a single badge with a green dot when Rhizome has an update', () => {
    renderIndicator({ rhizomeStatus: rhizomeAvailable() })
    expect(screen.getByTestId('status-version-update')).toBeInTheDocument()
    expect(screen.getByTestId('status-version-update-dot')).toBeInTheDocument()
  })

  it('shows the same single badge when only Prime has an update', () => {
    renderIndicator({ primeStatus: primeAvailable() })
    expect(screen.getByTestId('status-version-update')).toBeInTheDocument()
  })

  it('does not render two separate badges when both Rhizome and Prime have updates', () => {
    renderIndicator({ rhizomeStatus: rhizomeAvailable(), primeStatus: primeAvailable() })
    expect(screen.getAllByTestId('status-version-update')).toHaveLength(1)
  })

  it('clicking the badge opens a modal naming Rhizome as the one updating', () => {
    renderIndicator({ rhizomeStatus: rhizomeAvailable({ displayVersion: '2026.4.16' }) })

    fireEvent.click(screen.getByTestId('status-version-update'))

    expect(screen.getByTestId('version-update-modal')).toBeInTheDocument()
    expect(screen.getByText('Rhizome 2026.4.16')).toBeInTheDocument()
    expect(screen.queryByText(/^Prime /)).not.toBeInTheDocument()
  })

  it('clicking the badge opens a modal naming Prime as the one updating, with its real changelog', () => {
    renderIndicator({ primeStatus: primeAvailable({ version: '0.7.2', notes: '- Fixed a focus bug' }) })

    fireEvent.click(screen.getByTestId('status-version-update'))

    expect(screen.getByText('Prime 0.7.2')).toBeInTheDocument()
    expect(screen.getByTestId('version-update-prime-notes')).toHaveTextContent('- Fixed a focus bug')
  })

  it('shows both sections, each named, when both have updates', () => {
    renderIndicator({ rhizomeStatus: rhizomeAvailable(), primeStatus: primeAvailable() })

    fireEvent.click(screen.getByTestId('status-version-update'))

    expect(screen.getByText('Rhizome 2026.4.16')).toBeInTheDocument()
    expect(screen.getByText('Prime 0.7.2')).toBeInTheDocument()
  })

  it('Rhizome "Update now" starts the real download flow and closes the modal', () => {
    const { rhizomeActions } = renderIndicator({ rhizomeStatus: rhizomeAvailable() })

    fireEvent.click(screen.getByTestId('status-version-update'))
    fireEvent.click(screen.getByTestId('version-update-rhizome-update-now'))

    expect(rhizomeActions.startDownload).toHaveBeenCalledOnce()
    expect(screen.queryByTestId('version-update-modal')).not.toBeInTheDocument()
  })

  it('Prime "Update now" opens the real release page rather than updating unattended', () => {
    const { primeActions } = renderIndicator({ primeStatus: primeAvailable() })

    fireEvent.click(screen.getByTestId('status-version-update'))
    fireEvent.click(screen.getByTestId('version-update-prime-update-now'))

    expect(primeActions.openPrimeReleasePage).toHaveBeenCalledOnce()
    // Prime is never touched directly -- confirm nothing resembling an
    // in-app install/update action exists for it.
    expect(screen.getByText(/never updates automatically/)).toBeInTheDocument()
  })

  it('Maybe later closes the modal without triggering either update', () => {
    const { rhizomeActions, primeActions } = renderIndicator({
      rhizomeStatus: rhizomeAvailable(),
      primeStatus: primeAvailable(),
    })

    fireEvent.click(screen.getByTestId('status-version-update'))
    fireEvent.click(screen.getByTestId('version-update-maybe-later'))

    expect(screen.queryByTestId('version-update-modal')).not.toBeInTheDocument()
    expect(rhizomeActions.startDownload).not.toHaveBeenCalled()
    expect(primeActions.openPrimeReleasePage).not.toHaveBeenCalled()
  })
})
