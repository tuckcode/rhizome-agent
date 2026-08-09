import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { createElement, type ReactNode, type ComponentType } from 'react'

// Stub fetch to prevent jsdom@28 + Node 22 undici incompatibility.
// jsdom's JSDOMDispatcher passes an onError handler that Node 22's bundled
// undici rejects with InvalidArgumentError (UND_ERR_INVALID_ARG).
// Tests should never make real network requests — individual tests can
// override this stub via vi.mocked(fetch).mockImplementation(...).
const defaultFetchMock = () => Promise.resolve(new Response(null, { status: 418 }))
globalThis.fetch = vi.fn(defaultFetchMock) as typeof globalThis.fetch

// Stub WebSocket to prevent Node 22 + undici WebSocket incompatibility.
// undici's WebSocket dispatchEvent crashes with "The event argument must be
// an instance of Event" when running in jsdom environment.
// Tests should never open real WebSocket connections.
globalThis.WebSocket = class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  readyState = MockWebSocket.OPEN
  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  constructor(/* url: string, protocols?: string | string[] */) {
    // No-op: don't open real connections in tests
  }
  send(/* data: unknown */) {}
  close() { this.readyState = MockWebSocket.CLOSED }
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return true }
} as unknown as typeof WebSocket

// Mock scrollIntoView for jsdom (not implemented)
Element.prototype.scrollIntoView = vi.fn()

// Node 22 exposes an experimental Web Storage API that is unavailable unless
// --localstorage-file is set. That leaves globalThis.localStorage undefined
// (or broken) under Vitest/jsdom, so any test calling localStorage.clear()
// fails before assertions. Provide a full in-memory Storage polyfill when the
// real one is missing. Individual tests may still override via
// Object.defineProperty / vi.stubGlobal.
if (
  typeof globalThis.localStorage === 'undefined'
  || typeof globalThis.localStorage?.clear !== 'function'
) {
  class MemoryStorage implements Storage {
    private store = new Map<string, string>()

    get length(): number {
      return this.store.size
    }

    clear(): void {
      this.store.clear()
    }

    getItem(key: string): string | null {
      return this.store.has(key) ? this.store.get(key)! : null
    }

    key(index: number): string | null {
      return Array.from(this.store.keys())[index] ?? null
    }

    removeItem(key: string): void {
      this.store.delete(key)
    }

    setItem(key: string, value: string): void {
      this.store.set(String(key), String(value))
    }
  }

  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    writable: true,
    configurable: true,
  })
}

// Mock ResizeObserver for jsdom (not implemented)
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

// Mock IntersectionObserver for jsdom (not implemented)
globalThis.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof IntersectionObserver

// Mock @tauri-apps/plugin-opener for test environment
vi.mock('@tauri-apps/plugin-opener', () => ({
  openPath: vi.fn(),
  openUrl: vi.fn(),
  revealItemInDir: vi.fn(),
}))

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  if (vi.isMockFunction(globalThis.fetch)) {
    vi.mocked(globalThis.fetch).mockReset().mockImplementation(defaultFetchMock)
  } else {
    globalThis.fetch = vi.fn(defaultFetchMock) as typeof globalThis.fetch
  }
})

// Mock react-day-picker: Calendar component uses DayPicker which needs real DOM APIs not available in jsdom
vi.mock('react-day-picker', () => ({
  DayPicker: () => null,
  getDefaultClassNames: () => ({}),
}))

function getVirtualizedIndexes(length: number): number[] {
  if (length <= 200) return Array.from({ length }, (_, index) => index)

  const edgeSize = 50
  return [
    ...Array.from({ length: edgeSize }, (_, index) => index),
    ...Array.from({ length: edgeSize }, (_, index) => length - edgeSize + index),
  ]
}

// Mock react-virtuoso: JSDOM has no real viewport, so render a representative window for large lists.
vi.mock('react-virtuoso', () => ({
  Virtuoso: ({ data, itemContent, components }: {
    data?: unknown[]
    itemContent?: (index: number, item: unknown) => ReactNode
    components?: { Header?: ComponentType }
  }) => {
    const Header = components?.Header
    const resolvedData = data ?? []
    const renderedIndexes = getVirtualizedIndexes(resolvedData.length)
    return createElement('div', { 'data-testid': 'virtuoso-mock' },
      Header ? createElement(Header) : null,
      renderedIndexes.map((index) =>
        createElement('div', { key: index }, itemContent?.(index, resolvedData[index]))
      )
    )
  },
  GroupedVirtuoso: ({ groupCounts, groupContent, itemContent }: {
    groupCounts: number[]
    groupContent: (index: number) => ReactNode
    itemContent: (index: number, groupIndex: number) => ReactNode
  }) => {
    let globalIndex = 0
    return createElement('div', { 'data-testid': 'grouped-virtuoso-mock' },
      groupCounts?.map((count: number, groupIndex: number) => {
        const items = []
        for (let i = 0; i < count; i++) {
          items.push(createElement('div', { key: globalIndex }, itemContent(globalIndex, groupIndex)))
          globalIndex++
        }
        return createElement('div', { key: `group-${groupIndex}` },
          groupContent(groupIndex),
          ...items
        )
      })
    )
  },
}))
