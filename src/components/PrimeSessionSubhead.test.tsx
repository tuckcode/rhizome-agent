import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PrimeSessionSubhead } from './PrimeSessionSubhead'

describe('PrimeSessionSubhead', () => {
  it('reports the session, model and vault it is talking to', () => {
    render(
      <PrimeSessionSubhead
        live
        sessionId="019fe641-61fa-73e9-82ef-91fc90097aab"
        model="xai / grok-4.5"
        vaultPath="/Users/dtc/Documents/Laputa"
      />,
    )

    expect(screen.getByText('Prime session live')).toBeInTheDocument()
    expect(screen.getByText('7aab')).toBeInTheDocument()
    expect(screen.getByText('xai / grok-4.5')).toBeInTheDocument()
    expect(screen.getByText('~/Documents/Laputa')).toBeInTheDocument()
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
    expect(screen.queryByText('model')).not.toBeInTheDocument()
    expect(screen.getByText('vault')).toBeInTheDocument()
  })

  it('starts a new chat from the subhead when given a handler', () => {
    const onNewChat = vi.fn()
    render(<PrimeSessionSubhead live onNewChat={onNewChat} />)

    fireEvent.click(screen.getByRole('button', { name: 'New chat' }))
    expect(onNewChat).toHaveBeenCalledTimes(1)
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
})
