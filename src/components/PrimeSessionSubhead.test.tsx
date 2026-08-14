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
})
