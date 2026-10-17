import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAiActivity } from './useAiActivity'

const tauri = vi.hoisted(() => ({ on: true }))

vi.mock('../mock-tauri', () => ({
  isTauri: () => tauri.on,
}))

let lastWsInstance: MockWebSocket | null = null
let wsConstructCount = 0

class MockWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 3

  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null
  private openHandler: (() => void) | null = null
  private closeHandler: (() => void) | null = null
  readyState = MockWebSocket.CONNECTING
  url: string

  constructor(url: string) {
    this.url = url
    wsConstructCount += 1
    lastWsInstance = this // eslint-disable-line @typescript-eslint/no-this-alias
  }

  set onopen(handler: (() => void) | null) {
    this.openHandler = handler
  }

  get onopen(): (() => void) | null {
    return this.openHandler
      ? () => {
          this.readyState = MockWebSocket.OPEN
          this.openHandler?.()
        }
      : null
  }

  set onclose(handler: (() => void) | null) {
    this.closeHandler = handler
  }

  get onclose(): (() => void) | null {
    return this.closeHandler
      ? () => {
          this.readyState = MockWebSocket.CLOSED
          this.closeHandler?.()
        }
      : null
  }

  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.()
  })
}

beforeEach(() => {
  tauri.on = true
  lastWsInstance = null
  wsConstructCount = 0
  vi.stubGlobal('WebSocket', MockWebSocket)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function sendWsMessage(data: Record<string, unknown>) {
  lastWsInstance?.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }))
}

describe('useAiActivity', () => {
  it('initializes with null highlight', () => {
    const { result } = renderHook(() => useAiActivity())
    expect(result.current.highlightElement).toBeNull()
    expect(result.current.highlightPath).toBeNull()
  })

  it('connects to ws://localhost:9711 inside the desktop app', () => {
    renderHook(() => useAiActivity())
    expect(lastWsInstance).not.toBeNull()
    expect(lastWsInstance!.url).toBe('ws://localhost:9711')
  })

  it('does not open the UI bridge socket in the browser build', () => {
    tauri.on = false
    renderHook(() => useAiActivity())
    expect(lastWsInstance).toBeNull()
  })

  it('logs a bridge failure at debug and backs off before the next try', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    renderHook(() => useAiActivity())
    const first = lastWsInstance
    act(() => { first?.onerror?.() })
    act(() => { first?.onclose?.() })
    expect(debug).toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(2999) })
    expect(lastWsInstance).toBe(first)
    act(() => { vi.advanceTimersByTime(1) })
    const second = lastWsInstance
    expect(second).not.toBe(first)
    act(() => { second?.onclose?.() })
    act(() => { vi.advanceTimersByTime(5999) })
    expect(lastWsInstance).toBe(second)
    act(() => { vi.advanceTimersByTime(1) })
    expect(lastWsInstance).not.toBe(second)
    debug.mockRestore()
  })

  it('keeps retrying through a slow restart when those tries never connect', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    renderHook(() => useAiActivity())
    act(() => { lastWsInstance?.onopen?.() })
    act(() => { lastWsInstance?.onclose?.() })
    for (let retry = 0; retry < 8; retry += 1) {
      act(() => { vi.advanceTimersByTime(30_000) })
      const failed = lastWsInstance
      act(() => { failed?.onclose?.() })
      expect(debug).not.toHaveBeenCalledWith('[ai-activity] UI bridge dropped; stopped reconnecting')
    }
    act(() => { vi.advanceTimersByTime(30_000) })
    expect(lastWsInstance).not.toBeNull()
    debug.mockRestore()
  })

  it('resets the drop count after a minute of healthy connection', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    renderHook(() => useAiActivity())
    for (let drop = 0; drop < 4; drop += 1) {
      act(() => { lastWsInstance?.onopen?.() })
      act(() => { lastWsInstance?.onclose?.() })
      act(() => { vi.advanceTimersByTime(30_000) })
    }
    act(() => { lastWsInstance?.onopen?.() })
    act(() => { vi.advanceTimersByTime(60_000) })
    for (let drop = 0; drop < 4; drop += 1) {
      const current = lastWsInstance
      act(() => { current?.onclose?.() })
      act(() => { vi.advanceTimersByTime(30_000) })
      expect(lastWsInstance).not.toBe(current)
    }
    expect(debug).not.toHaveBeenCalledWith('[ai-activity] UI bridge dropped; stopped reconnecting')
    debug.mockRestore()
  })

  it('opens only one socket when focus fires during a pending reconnect backoff', () => {
    renderHook(() => useAiActivity())
    expect(wsConstructCount).toBe(1)
    act(() => { lastWsInstance?.onclose?.() })
    expect(wsConstructCount).toBe(1)
    act(() => { window.dispatchEvent(new Event('focus')) })
    expect(wsConstructCount).toBe(2)
    act(() => { vi.advanceTimersByTime(30_000) })
    expect(wsConstructCount).toBe(2)
  })

  it('does not open a second socket on focus while the first is still connecting', () => {
    renderHook(() => useAiActivity())
    expect(wsConstructCount).toBe(1)
    expect(lastWsInstance!.readyState).toBe(MockWebSocket.CONNECTING)
    act(() => { window.dispatchEvent(new Event('focus')) })
    expect(wsConstructCount).toBe(1)
  })

  it('reconnects on the online event after giving up', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    renderHook(() => useAiActivity())
    for (let drop = 0; drop < 5; drop += 1) {
      act(() => { lastWsInstance?.onopen?.() })
      const current = lastWsInstance
      act(() => { current?.onclose?.() })
      act(() => { vi.advanceTimersByTime(30_000) })
    }
    const givenUp = lastWsInstance
    act(() => { window.dispatchEvent(new Event('online')) })
    expect(lastWsInstance).not.toBe(givenUp)
    debug.mockRestore()
  })

  it('reconnects when the document becomes visible after giving up', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    renderHook(() => useAiActivity())
    for (let drop = 0; drop < 5; drop += 1) {
      act(() => { lastWsInstance?.onopen?.() })
      const current = lastWsInstance
      act(() => { current?.onclose?.() })
      act(() => { vi.advanceTimersByTime(30_000) })
    }
    const givenUp = lastWsInstance
    act(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(lastWsInstance).not.toBe(givenUp)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    debug.mockRestore()
  })

  it('skips wake while the document is hidden', () => {
    renderHook(() => useAiActivity())
    for (let drop = 0; drop < 5; drop += 1) {
      act(() => { lastWsInstance?.onopen?.() })
      act(() => { lastWsInstance?.onclose?.() })
      act(() => { vi.advanceTimersByTime(30_000) })
    }
    const countAtGiveUp = wsConstructCount
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    act(() => { window.dispatchEvent(new Event('focus')) })
    expect(wsConstructCount).toBe(countAtGiveUp)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  })

  it('removes focus, online, and visibility listeners on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const docRemoveSpy = vi.spyOn(document, 'removeEventListener')
    const { unmount } = renderHook(() => useAiActivity())
    unmount()
    expect(removeSpy).toHaveBeenCalledWith('focus', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(docRemoveSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
    removeSpy.mockRestore()
    docRemoveSpy.mockRestore()
  })

  it('reconnects on window focus after giving up', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    renderHook(() => useAiActivity())
    for (let drop = 0; drop < 5; drop += 1) {
      act(() => { lastWsInstance?.onopen?.() })
      const current = lastWsInstance
      act(() => { current?.onclose?.() })
      act(() => { vi.advanceTimersByTime(30_000) })
    }
    const givenUp = lastWsInstance
    act(() => { window.dispatchEvent(new Event('focus')) })
    expect(lastWsInstance).not.toBe(givenUp)
    expect(debug).toHaveBeenCalledWith('[ai-activity] UI bridge dropped; stopped reconnecting')
    debug.mockRestore()
  })

  it('sets highlight on ui_action highlight message', () => {
    const { result } = renderHook(() => useAiActivity())
    act(() => {
      sendWsMessage({ type: 'ui_action', action: 'highlight', element: 'editor', path: '/vault/test.md' })
    })
    expect(result.current.highlightElement).toBe('editor')
    expect(result.current.highlightPath).toBe('/vault/test.md')
  })

  it('auto-clears highlight after 800ms', () => {
    const { result } = renderHook(() => useAiActivity())
    act(() => {
      sendWsMessage({ type: 'ui_action', action: 'highlight', element: 'tab', path: '/vault/note.md' })
    })
    expect(result.current.highlightElement).toBe('tab')
    act(() => { vi.advanceTimersByTime(800) })
    expect(result.current.highlightElement).toBeNull()
    expect(result.current.highlightPath).toBeNull()
  })

  it('resets timer on repeated highlight messages', () => {
    const { result } = renderHook(() => useAiActivity())
    act(() => {
      sendWsMessage({ type: 'ui_action', action: 'highlight', element: 'editor' })
    })
    act(() => { vi.advanceTimersByTime(500) })
    // Second message resets the timer
    act(() => {
      sendWsMessage({ type: 'ui_action', action: 'highlight', element: 'notelist' })
    })
    expect(result.current.highlightElement).toBe('notelist')
    act(() => { vi.advanceTimersByTime(500) })
    // Still active — only 500ms since the second message
    expect(result.current.highlightElement).toBe('notelist')
    act(() => { vi.advanceTimersByTime(300) })
    expect(result.current.highlightElement).toBeNull()
  })

  it('ignores non-ui_action messages', () => {
    const { result } = renderHook(() => useAiActivity())
    act(() => {
      sendWsMessage({ type: 'other', action: 'highlight', element: 'editor' })
    })
    expect(result.current.highlightElement).toBeNull()
  })

  it('ignores malformed JSON', () => {
    const { result } = renderHook(() => useAiActivity())
    act(() => {
      lastWsInstance?.onmessage?.(new MessageEvent('message', { data: 'not json' }))
    })
    expect(result.current.highlightElement).toBeNull()
  })

  it('closes WebSocket on unmount', () => {
    const { unmount } = renderHook(() => useAiActivity())
    unmount()
    expect(lastWsInstance!.close).toHaveBeenCalled()
  })

  it('handles highlight with no path', () => {
    const { result } = renderHook(() => useAiActivity())
    act(() => {
      sendWsMessage({ type: 'ui_action', action: 'highlight', element: 'properties' })
    })
    expect(result.current.highlightElement).toBe('properties')
    expect(result.current.highlightPath).toBeNull()
  })

  it('calls onOpenNote callback on open_note action', () => {
    const onOpenNote = vi.fn()
    renderHook(() => useAiActivity({ onOpenNote }))
    act(() => {
      sendWsMessage({ type: 'ui_action', action: 'open_note', path: 'project/foo.md' })
    })
    expect(onOpenNote).toHaveBeenCalledWith('project/foo.md')
  })

  it('calls onOpenTab callback on open_tab action', () => {
    const onOpenTab = vi.fn()
    renderHook(() => useAiActivity({ onOpenTab }))
    act(() => {
      sendWsMessage({ type: 'ui_action', action: 'open_tab', path: 'note/bar.md' })
    })
    expect(onOpenTab).toHaveBeenCalledWith('note/bar.md')
  })

  it('calls onSetFilter callback on set_filter action', () => {
    const onSetFilter = vi.fn()
    renderHook(() => useAiActivity({ onSetFilter }))
    act(() => {
      sendWsMessage({ type: 'ui_action', action: 'set_filter', filterType: 'Project' })
    })
    expect(onSetFilter).toHaveBeenCalledWith('Project')
  })

  it('calls onVaultChanged callback on vault_changed action', () => {
    const onVaultChanged = vi.fn()
    renderHook(() => useAiActivity({ onVaultChanged }))
    act(() => {
      sendWsMessage({ type: 'ui_action', action: 'vault_changed', path: 'note/new.md' })
    })
    expect(onVaultChanged).toHaveBeenCalledWith('note/new.md')
  })

  it('does not call onOpenNote when path is missing', () => {
    const onOpenNote = vi.fn()
    renderHook(() => useAiActivity({ onOpenNote }))
    act(() => {
      sendWsMessage({ type: 'ui_action', action: 'open_note' })
    })
    expect(onOpenNote).not.toHaveBeenCalled()
  })

  it('reconnects on close after delay', () => {
    renderHook(() => useAiActivity())
    const firstWs = lastWsInstance
    act(() => { firstWs?.onclose?.() })
    act(() => { vi.advanceTimersByTime(3000) })
    expect(lastWsInstance).not.toBe(firstWs)
  })
})

describe('the agent asking to celebrate', () => {
  it('passes the message and attribution through', () => {
    const onCelebrate = vi.fn()
    renderHook(() => useAiActivity({ onCelebrate }))

    act(() => {
      sendWsMessage({ type: 'ui_action', action: 'celebrate', message: 'Migration landed', from: 'Prime' })
    })

    expect(onCelebrate).toHaveBeenCalledWith({ message: 'Migration landed', from: 'Prime' })
  })

  /** Confetti with no words is a complete request. */
  it('accepts a bare celebration', () => {
    const onCelebrate = vi.fn()
    renderHook(() => useAiActivity({ onCelebrate }))

    act(() => {
      sendWsMessage({ type: 'ui_action', action: 'celebrate' })
    })

    expect(onCelebrate).toHaveBeenCalledWith({ message: undefined, from: undefined })
  })
})
