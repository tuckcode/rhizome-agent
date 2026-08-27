import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import MyceliumView from './MyceliumView'

const sidecarStarts: Array<Record<string, unknown> | undefined> = []

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: async (cmd: string, args?: Record<string, unknown>) => {
    if (cmd === 'list_prime_sessions') {
      return [{ name: 'sess-a.jsonl', path: '/tmp/sess-a.jsonl' }]
    }
    if (cmd === 'start_mindwalk_sidecar') {
      sidecarStarts.push(args)
      return { url: 'http://127.0.0.1:18765', mode: args?.path ? 'session' : 'overview' }
    }
    return null
  },
}))

describe('MyceliumView', () => {
  it('renders Rhizome chrome, overview list, embed, and Mindwalk attribution', async () => {
    render(<MyceliumView />)
    expect(screen.getByTestId('mycelium-view')).toBeInTheDocument()
    expect(screen.getByText('Mycelium')).toBeInTheDocument()
    expect(screen.getByTestId('mycelium-overview-list')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId('mycelium-embed')).toHaveAttribute('src', 'http://127.0.0.1:18765')
    })
    expect(screen.getByTestId('mycelium-attribution')).toHaveTextContent('Mindwalk (MIT)')
    expect(screen.queryByText(/PATH/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId('mycelium-missing-binary')).not.toBeInTheDocument()
  })

  it('retries the overview sidecar without switching to a session', async () => {
    render(<MyceliumView />)
    await waitFor(() => {
      expect(screen.getByTestId('mycelium-embed')).toBeInTheDocument()
    })
    sidecarStarts.length = 0
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => {
      expect(sidecarStarts).toHaveLength(1)
    })
    expect(sidecarStarts[0]?.path).toBeUndefined()
  })

  it('hides the session list when focused on this session', async () => {
    render(<MyceliumView focusSessionPath="/tmp/sess-a.jsonl" />)
    expect(screen.queryByTestId('mycelium-overview-list')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId('mycelium-session-scope')).toBeInTheDocument()
    })
  })

  // The host skins the embedded engine per theme, so the sidecar has to be
  // told which one. Without this the iframe renders Mindwalk's own palette.
  it('passes the document theme to the sidecar', async () => {
    document.documentElement.setAttribute('data-theme', 'light')
    sidecarStarts.length = 0
    render(<MyceliumView />)
    await waitFor(() => {
      expect(sidecarStarts).toHaveLength(1)
    })
    expect(sidecarStarts[0]?.theme).toBe('light')
    document.documentElement.removeAttribute('data-theme')
  })
})
