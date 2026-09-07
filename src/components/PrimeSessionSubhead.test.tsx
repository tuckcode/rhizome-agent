import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PrimeSessionSubhead } from './PrimeSessionSubhead'

describe('PrimeSessionSubhead', () => {
  it('reports the session and vault it is talking to', () => {
    render(
      <PrimeSessionSubhead
        live
        sessionId="019fe641-61fa-73e9-82ef-91fc90097aab"
        vaultPath="/Users/dtc/Documents/Laputa"
      />,
    )

    expect(screen.getByText('Prime session live')).toBeInTheDocument()
    expect(screen.getByText('7aab')).toBeInTheDocument()
    expect(screen.getByText('~/Documents/Laputa')).toBeInTheDocument()
    expect(screen.queryByTestId('prime-model-thinking-control')).not.toBeInTheDocument()
  })

  /** A full home path spends most of its width on the part every path shares. */
  it('never shows the absolute home path', () => {
    render(<PrimeSessionSubhead live vaultPath="/Users/dtc/Documents/Laputa" />)

    expect(screen.queryByText('/Users/dtc/Documents/Laputa')).not.toBeInTheDocument()
  })

  it('says it is idle when the host is not running', () => {
    render(<PrimeSessionSubhead live={false} />)

    expect(screen.getByText('Prime idle')).toBeInTheDocument()
  })

  /**
   * A fresh host has no session and no model yet. Empty segments must be
   * omitted rather than rendered as `sess_` with nothing after it.
   */
  it('omits segments it has no value for', () => {
    render(<PrimeSessionSubhead live vaultPath="/Users/dtc/vault" />)

    expect(screen.queryByText(/sess_/)).not.toBeInTheDocument()
    expect(screen.getByText('vault')).toBeInTheDocument()
  })

  it('starts a new chat from the subhead when given a handler', () => {
    const onNewChat = vi.fn()
    render(<PrimeSessionSubhead live onNewChat={onNewChat} />)

    fireEvent.click(screen.getByRole('button', { name: 'New chat' }))
    expect(onNewChat).toHaveBeenCalledTimes(1)
  })

  it('opens this session footprint from the in-session button', () => {
    const onOpenFootprint = vi.fn()
    render(<PrimeSessionSubhead live onOpenFootprint={onOpenFootprint} />)

    fireEvent.click(screen.getByTestId('prime-session-footprint'))
    expect(onOpenFootprint).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Mycelium')).toBeInTheDocument()
  })
  /**
   * A session outlives the window now (ADR-0163), so how long it has been
   * running is no longer implied by how long the app has been open — and it is
   * what separates a session that is working from one that is stuck.
   */
  it('shows how long the attached session has been running', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-15T11:30:00.000Z'))
    render(<PrimeSessionSubhead live startedAt="2026-08-15T09:00:00.000Z" />)

    expect(screen.getByText('up')).toBeInTheDocument()
    expect(screen.getByText('2h 30m')).toBeInTheDocument()
    vi.useRealTimers()
  })

  /**
   * Nothing is confirming the session is alive when the host is down, so an
   * age would be an assertion the strip cannot back up.
   */
  it('shows no uptime when the host is not live', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-15T11:30:00.000Z'))
    render(<PrimeSessionSubhead live={false} startedAt="2026-08-15T09:00:00.000Z" />)

    expect(screen.queryByText('up')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  /** A session with no start time omits the segment rather than guessing. */
  it('omits uptime when the session start is unknown', () => {
    render(<PrimeSessionSubhead live sessionId="abcd-1234" />)

    expect(screen.queryByText('up')).not.toBeInTheDocument()
  })
  /**
   * Connecting to a service Rhizome does not own brings failure modes owning a
   * child process did not. ADR-0163 requires each be visible and actionable —
   * a spinner, or a bare "idle", is what this replaces.
   */
  it('names the action for a service that is not running', () => {
    render(<PrimeSessionSubhead live={false} problem={{ code: 'service_unreachable' }} />)

    expect(screen.getByText(/prime-agent status/)).toBeInTheDocument()
    expect(screen.queryByText('Prime idle')).not.toBeInTheDocument()
  })

  it('names the action when Prime is not installed', () => {
    render(<PrimeSessionSubhead live={false} problem={{ code: 'not_installed' }} />)

    expect(screen.getByText(/npm i -g prime-agent/)).toBeInTheDocument()
  })

  /** A version floor is only actionable if it says which version. */
  it('names both versions when the service is too old', () => {
    render(
      <PrimeSessionSubhead
        live={false}
        problem={{ code: 'service_too_old', installedVersion: '0.6.4', requiredVersion: '0.7.1' }}
      />,
    )

    const message = screen.getByText(/too old/)
    expect(message).toHaveTextContent('0.6.4')
    expect(message).toHaveTextContent('0.7.1')
  })

  /** A daemon that does not report its version still gets a target to hit. */
  it('still names the required version when the installed one is unknown', () => {
    render(
      <PrimeSessionSubhead
        live={false}
        problem={{ code: 'service_too_old', requiredVersion: '0.7.1' }}
      />,
    )

    expect(screen.getByText(/too old/)).toHaveTextContent('0.7.1')
  })

  /** Connected is connected — a stale problem must not shout over it. */
  it('shows the live state rather than a problem once connected', () => {
    render(<PrimeSessionSubhead live problem={{ code: 'not_installed' }} />)

    expect(screen.getByText('Prime session live')).toBeInTheDocument()
    expect(screen.queryByText(/npm i -g/)).not.toBeInTheDocument()
  })

  /**
   * This strip is the window's title bar. Selectable text wins a drag against
   * the drag region, so the pointer sweeps a selection and the window never
   * moves — leaving a maximised window with no obvious place to grab it.
   * Reported from use, 2026-09-05.
   */
  it('does not let a drag select its text instead of moving the window', () => {
    const { container } = render(<PrimeSessionSubhead live sessionId="abc123" vaultPath="/vault" />)

    const strip = container.firstElementChild
    expect(strip).toHaveClass('select-none')
  })
})
