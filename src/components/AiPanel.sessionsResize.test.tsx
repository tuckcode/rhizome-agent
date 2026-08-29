import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiPanel } from './AiPanel'
import { TooltipProvider } from '@/components/ui/tooltip'
import { APP_STORAGE_KEYS } from '../constants/appStorage'
import type { VaultEntry } from '../types'

/**
 * #44 — the sessions column had a fixed 228px width, so long session titles
 * truncated with no way to see them.
 *
 * Its own file: the host-status mock is module-wide, and Prime has to look
 * attached for the sessions column to render at all.
 */
vi.mock('../lib/telemetry', () => ({ trackEvent: vi.fn() }))
vi.mock('../hooks/usePrimeHostStatus', () => ({
  usePrimeHostStatus: () => ({ running: true, installed: true, sessionId: 'sess_1' }),
  primeModelLabel: () => 'Grok 4.5',
}))

const makeEntry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  path: '/vault/note/test.md',
  filename: 'test.md',
  title: 'Test Note',
  isA: 'Note',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  archived: false,
  modifiedAt: 1700000000,
  createdAt: 1700000000,
  fileSize: 100,
  snippet: '',
  wordCount: 0,
  relationships: {},
  listPropertiesDisplay: [],
  outgoingLinks: [],
  properties: {},
  hasH1: false,
  ...overrides,
}) as VaultEntry

function renderPanel() {
  const entry = makeEntry()
  render(
    <TooltipProvider>
      <AiPanel
        onClose={vi.fn()}
        vaultPath="/tmp/vault"
        activeEntry={entry}
        entries={[entry]}
        defaultAiAgent="prime"
      />
    </TooltipProvider>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('AiPanel — the sessions column resizes', () => {
  it('widens when its right edge is dragged right, and remembers it', () => {
    renderPanel()

    const handle = screen.getByTestId('prime-sessions-resize')
    fireEvent.mouseDown(handle, { clientX: 228, clientY: 300 })
    fireEvent.mouseMove(window, { clientX: 288, clientY: 300 })
    fireEvent.mouseUp(window)

    expect(window.localStorage.getItem(APP_STORAGE_KEYS.chatSessionsWidth)).toBe('288')
  })

  /** A column dragged to nothing is a column you cannot get back. */
  it('stops at its bounds however far the drag goes', () => {
    renderPanel()

    const handle = screen.getByTestId('prime-sessions-resize')
    fireEvent.mouseDown(handle, { clientX: 228, clientY: 300 })
    fireEvent.mouseMove(window, { clientX: 5000, clientY: 300 })
    fireEvent.mouseUp(window)

    expect(window.localStorage.getItem(APP_STORAGE_KEYS.chatSessionsWidth)).toBe('420')
  })
})
