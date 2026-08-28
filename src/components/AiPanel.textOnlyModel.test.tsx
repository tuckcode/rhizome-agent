import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AiPanel } from './AiPanel'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { VaultEntry } from '../types'

/**
 * The text-only-model warning, in its own file because the host-status mock
 * below is module-wide and would change every other AiPanel test.
 *
 * This exists because the warning did not fire in the running app on the first
 * two attempts. It pins the half that is ours: given a status saying the model
 * is text-only, pasting an image must say so. Whether the *status* carries
 * that flag is the Rust side's job, covered by `model_accepts_images` tests.
 */

vi.mock('../lib/telemetry', () => ({ trackEvent: vi.fn() }))
vi.mock('../hooks/usePrimeHostStatus', () => ({
  usePrimeHostStatus: () => ({
    running: true,
    installed: true,
    modelProvider: 'opencode',
    modelId: 'hy3-free',
    modelName: 'Hy3 Free',
    modelAcceptsImages: false,
  }),
  primeModelLabel: () => 'Hy3 Free',
}))

const makeEntry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  path: '/vault/note/test.md',
  filename: 'test.md',
  title: 'Test Note',
  isA: 'Note',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: null,
  archived: false,
  modifiedAt: 1700000000,
  createdAt: 1700000000,
  fileSize: 100,
  snippet: '',
  wordCount: 0,
  relationships: {},
  icon: null,
  color: null,
  order: null,
  sidebarLabel: null,
  template: null,
  sort: null,
  view: null,
  visible: null,
  organized: false,
  favorite: false,
  favoriteIndex: null,
  listPropertiesDisplay: [],
  outgoingLinks: [],
  properties: {},
  hasH1: false,
  ...overrides,
})

describe('AiPanel — the running model cannot see images', () => {
  it('warns on paste, and attaches anyway', async () => {
    const onUnsupportedAiPaste = vi.fn()
    const entry = makeEntry()

    render(
      <TooltipProvider>
        <AiPanel
          onClose={vi.fn()}
          vaultPath="/tmp/vault"
          activeEntry={entry}
          entries={[entry]}
          onUnsupportedAiPaste={onUnsupportedAiPaste}
        />
      </TooltipProvider>,
    )

    fireEvent.paste(screen.getByTestId('agent-input'), {
      clipboardData: {
        getData: vi.fn(() => ''),
        files: [new File(['image'], 'shot.png', { type: 'image/png' })],
        items: [{ kind: 'file', type: 'image/png' }],
      },
    })

    // Informs, never blocks: the attachment still lands, because credential
    // and capability detection is best-effort and being wrong must not stop
    // someone sending an image to a model that does take them.
    expect(await screen.findByTestId('composer-attachments')).toBeInTheDocument()
    await waitFor(() => {
      expect(onUnsupportedAiPaste).toHaveBeenCalledWith(
        expect.stringContaining('does not accept images'),
      )
    })
  })
})
