import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Settings } from '../types'
import { resetPrimeHostStatus } from '../hooks/usePrimeHostStatus'
import { ChatComposerDeck } from './ChatComposerDeck'
import { SettingsPanel } from './SettingsPanel'

vi.mock('../lib/productAnalytics', () => ({
  trackComposerPillOpened: vi.fn(),
  trackPrimeModelChanged: vi.fn(),
  trackPrimeThinkingLevelChanged: vi.fn(),
  trackPrimeModelsFreeOnly: vi.fn(),
  trackRhizomeModelChanged: vi.fn(),
}))

vi.mock('../lib/telemetry', () => ({
  trackEvent: vi.fn(),
}))

const settings = {
  auto_pull_interval_minutes: null,
  git_enabled: null,
  autogit_enabled: null,
  autogit_idle_threshold_seconds: null,
  autogit_inactive_threshold_seconds: null,
  auto_advance_inbox_after_organize: null,
  telemetry_consent: null,
  crash_reporting_enabled: null,
  analytics_enabled: null,
  anonymous_id: null,
  release_channel: null,
  automatic_update_checks_enabled: null,
  theme_mode: null,
  ui_language: null,
  date_display_format: null,
  default_ai_agent: null,
  hide_gitignored_files: null,
  block_secret_files: null,
  all_notes_show_pdfs: null,
  all_notes_show_images: null,
  all_notes_show_unsupported: null,
} as Settings

function labels(): string[] {
  return screen.getAllByTestId('native-chat-model-trigger-label').map((node) => node.textContent ?? '')
}

afterEach(() => {
  resetPrimeHostStatus()
})

describe('Settings and the composer chip', () => {
  it('show the same Rhizome model when the chat engine is native', () => {
    render(
      <>
        <SettingsPanel open settings={settings} onSave={vi.fn()} onClose={vi.fn()} />
        <ChatComposerDeck catalog="rhizome" nativeTarget={null} onNativeTargetChange={vi.fn()} />
      </>,
    )

    expect(labels()).toEqual(['Ollama · llama3.2', 'Ollama · llama3.2'])
  })

  it('show the Prime host model on both surfaces when the chat engine is Prime', async () => {
    render(
      <>
        <SettingsPanel
          open
          settings={{ ...settings, chat_engine: 'prime' }}
          onSave={vi.fn()}
          onClose={vi.fn()}
        />
        <ChatComposerDeck
          catalog="prime"
          vaultPath="/vault"
          nativeTarget={null}
          onNativeTargetChange={vi.fn()}
        />
      </>,
    )

    await waitFor(() => {
      expect(labels()).toEqual(['Mock model', 'Mock model'])
    })
  })
})
