import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ChatPreflightBanner } from './ChatPreflightBanner'

let response: unknown = null
let thrown: Error | null = null
const calls: Array<Record<string, unknown> | undefined> = []

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: async (cmd: string, args?: Record<string, unknown>) => {
    if (cmd !== 'preflight_chat') return null
    calls.push(args)
    if (thrown) throw thrown
    return response
  },
}))

const ok = { status: 'ok' as const }

beforeEach(() => {
  response = null
  thrown = null
  calls.length = 0
})

describe('ChatPreflightBanner', () => {
  it('stays out of the way when nothing is blocking', async () => {
    response = { vault: ok, provider: ok }
    render(<ChatPreflightBanner vaultPath="/v" provider="opencode" />)
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(screen.queryByTestId('chat-preflight-banner')).not.toBeInTheDocument()
  })

  // C53: a blocked folder and a missing one look identical from inside the
  // app and have opposite fixes, so the remedy is the point of the banner.
  it('names the reason and the remedy', async () => {
    response = {
      vault: {
        status: 'failed',
        reason: 'macOS is blocking access to /Users/x/Documents/V',
        remedy: 'Grant access in System Settings → Privacy & Security → Files and Folders.',
      },
      provider: ok,
    }
    render(<ChatPreflightBanner vaultPath="/Users/x/Documents/V" provider="opencode" />)
    await waitFor(() => {
      expect(screen.getByTestId('chat-preflight-banner')).toBeInTheDocument()
    })
    expect(screen.getByTestId('chat-preflight-reason')).toHaveTextContent('macOS is blocking access')
    expect(screen.getByTestId('chat-preflight-remedy')).toHaveTextContent('Privacy & Security')
    expect(screen.getByTestId('chat-preflight-title')).toHaveClass('text-[12px]')
    expect(screen.getByTestId('chat-preflight-reason').parentElement).toHaveClass('text-[12px]')
    expect(screen.getByTestId('chat-preflight-banner').querySelector('svg')).toHaveClass(
      'text-[var(--accent-amber,var(--foreground))]',
    )
  })

  it('lists the vault before the provider', async () => {
    response = {
      vault: { status: 'failed', reason: 'vault trouble', remedy: 'fix the vault' },
      provider: { status: 'failed', reason: 'provider trouble', remedy: 'fix the provider' },
    }
    render(<ChatPreflightBanner vaultPath="/v" provider="ghost" />)
    await waitFor(() => {
      expect(screen.getAllByTestId('chat-preflight-reason')).toHaveLength(2)
    })
    const reasons = screen.getAllByTestId('chat-preflight-reason').map((n) => n.textContent)
    expect(reasons[0]).toBe('vault trouble')
  })

  // A preflight that cannot run must not become its own error banner — that
  // would be a second failure mode wearing the costume of the first.
  it('shows nothing when the check itself fails', async () => {
    thrown = new Error('command unavailable')
    render(<ChatPreflightBanner vaultPath="/v" provider="opencode" />)
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(screen.queryByTestId('chat-preflight-banner')).not.toBeInTheDocument()
  })

  it('re-checks when the vault changes, since a working setup can break', async () => {
    response = { vault: ok, provider: ok }
    const { rerender } = render(<ChatPreflightBanner vaultPath="/one" provider="opencode" />)
    await waitFor(() => expect(calls).toHaveLength(1))
    rerender(<ChatPreflightBanner vaultPath="/two" provider="opencode" />)
    await waitFor(() => expect(calls).toHaveLength(2))
    expect(calls[1]?.vaultPath).toBe('/two')
  })

  it('still preflights when no vault is attached', async () => {
    response = { vault: ok, provider: ok }
    render(<ChatPreflightBanner vaultPath="" provider="xai" />)
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0]?.vaultPath).toBe('')
    expect(screen.queryByTestId('chat-preflight-banner')).not.toBeInTheDocument()
  })

  it('can warn about the provider when no vault is attached', async () => {
    response = {
      vault: ok,
      provider: {
        status: 'failed',
        reason: 'xAI is not connected',
        remedy: 'Sign in from Terminal',
      },
    }
    render(<ChatPreflightBanner vaultPath="" provider="xai" />)
    await waitFor(() => {
      expect(screen.getByTestId('chat-preflight-banner')).toBeInTheDocument()
    })
    expect(screen.getByTestId('chat-preflight-reason')).toHaveTextContent('xAI is not connected')
  })
})
