import { render as rtlRender, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AiModelProvider } from '../lib/aiTargets'
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

const capabilities = {
  streaming: true,
  tools: false,
  vision: false,
  json_mode: false,
  reasoning: false,
}

const workOpenAi: AiModelProvider = {
  id: 'work-openai',
  name: 'Work OpenAI',
  kind: 'open_ai',
  api_key_storage: 'local_file',
  models: [{ id: 'gpt-4o', display_name: 'GPT-4o', capabilities }],
}

afterEach(() => {
  resetPrimeHostStatus()
})

function render(ui: ReactElement) {
  return rtlRender(<TooltipProvider>{ui}</TooltipProvider>)
}

function pickers() {
  return screen.getAllByTestId('native-chat-model-picker')
}

function chipPicker() {
  const chip = pickers().find((node) => node.getAttribute('data-variant') === 'chip')
  if (!chip) throw new Error('composer chip missing')
  return chip
}

function renderPair(next: Settings, nativeTarget: string | null, providers?: AiModelProvider[]) {
  render(
    <>
      <SettingsPanel open settings={next} onSave={vi.fn()} onClose={vi.fn()} />
      <ChatComposerDeck
        catalog="rhizome"
        nativeTarget={nativeTarget}
        providers={providers}
        onNativeTargetChange={vi.fn()}
      />
    </>,
  )
}

describe('Settings and the composer chip', () => {
  it('name the same default Rhizome model, with the chip showing the model name', () => {
    renderPair(settings, null)

    expect(pickers().map((node) => node.getAttribute('data-model-id'))).toEqual([
      'ollama/llama3.2',
      'ollama/llama3.2',
    ])
    const chip = chipPicker()
    const chipText = within(chip).getByTestId('native-chat-model-trigger-label').textContent ?? ''
    expect(chipText).toBe('llama3.2')
    const row = pickers().find((node) => node.getAttribute('data-variant') === 'row')
    expect(within(row!).getByTestId('native-chat-model-trigger-label').textContent).toContain(chipText)
    expect(within(chip).getByTestId('native-chat-model-trigger')).toHaveAccessibleName('llama3.2, Ollama')
  })

  it('keeps a user-picked model on both surfaces and starts the chip name with that model', () => {
    const picked = { ...settings, native_chat_target: 'work-openai/gpt-4o', ai_model_providers: [workOpenAi] }
    renderPair(picked, 'work-openai/gpt-4o', [workOpenAi])

    expect(pickers().map((node) => node.getAttribute('data-model-id'))).toEqual([
      'work-openai/gpt-4o',
      'work-openai/gpt-4o',
    ])
    const chip = chipPicker()
    expect(within(chip).getByTestId('native-chat-model-trigger-label')).toHaveTextContent('GPT-4o')
    expect(within(chip).getByTestId('native-chat-model-trigger')).toHaveAccessibleName(/^GPT-4o,/)
  })

  it('shows a removed model by its name on the chip, and the accessible name starts there', () => {
    const removed = { ...settings, native_chat_target: 'gone-openai/gpt-4o' }
    renderPair(removed, 'gone-openai/gpt-4o')

    expect(pickers().map((node) => node.getAttribute('data-model-id'))).toEqual([
      'gone-openai/gpt-4o',
      'gone-openai/gpt-4o',
    ])
    const chip = chipPicker()
    expect(within(chip).getByTestId('native-chat-model-trigger-label')).toHaveTextContent('gpt-4o')
    expect(within(chip).getByTestId('native-chat-model-trigger')).toHaveAccessibleName(/^gpt-4o,/)
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
      expect(pickers().map((node) => node.getAttribute('data-model-id'))).toEqual([
        'mock/mock-model',
        'mock/mock-model',
      ])
    })
    const chip = chipPicker()
    expect(within(chip).getByTestId('native-chat-model-trigger-label')).toHaveTextContent('Mock model')
    expect(within(chip).getByTestId('native-chat-model-trigger')).toHaveAccessibleName(/^Mock model,/)
  })
})
