import { readFileSync } from 'node:fs'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_STORAGE_KEYS } from '../constants/appStorage'
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
  beforeEach(() => {
    window.localStorage.clear()
    sidecarStarts.length = 0
  })

  it('renders Rhizome chrome, overview list, embed, and Mindwalk attribution', async () => {
    render(<MyceliumView />)
    expect(screen.getByTestId('mycelium-view')).toBeInTheDocument()
    expect(screen.getByText('Mycelium')).toBeInTheDocument()
    expect(screen.getByTestId('mycelium-overview-list')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId('mycelium-embed')).toHaveAttribute('src', 'http://127.0.0.1:18765')
    })
    expect(screen.getByTestId('mycelium-embed').tagName).toBe('IFRAME')
    expect(screen.queryByRole('link', { name: /mindwalk/i })).not.toBeInTheDocument()
    const source = readFileSync(`${process.cwd()}/src/components/MyceliumView.tsx`, 'utf8')
    expect(source).not.toContain('window.open')
    expect(source).not.toContain('openUrl')
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
    expect(screen.queryByTestId('mycelium-sessions-resize')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId('mycelium-session-scope')).toBeInTheDocument()
    })
  })

  it('widens when its right edge is dragged right, and remembers it', async () => {
    render(<MyceliumView />)
    const handle = await screen.findByTestId('mycelium-sessions-resize')
    const list = screen.getByTestId('mycelium-overview-list')
    expect(list).toHaveStyle({ width: '224px' })

    fireEvent.mouseDown(handle, { clientX: 224, clientY: 300 })
    fireEvent.mouseMove(document, { clientX: 284, clientY: 300 })
    fireEvent.mouseUp(document)

    expect(list).toHaveStyle({ width: '284px' })
    expect(window.localStorage.getItem(APP_STORAGE_KEYS.myceliumSessionsWidth)).toBe('284')
  })

  it('stops at its bounds however far the drag goes', async () => {
    render(<MyceliumView />)
    const handle = await screen.findByTestId('mycelium-sessions-resize')

    fireEvent.mouseDown(handle, { clientX: 224, clientY: 300 })
    fireEvent.mouseMove(document, { clientX: 5000, clientY: 300 })
    fireEvent.mouseUp(document)

    expect(window.localStorage.getItem(APP_STORAGE_KEYS.myceliumSessionsWidth)).toBe('420')
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
