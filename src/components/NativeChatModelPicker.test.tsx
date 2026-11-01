import { act, fireEvent, render as rtlRender, screen, waitFor, within } from '@testing-library/react'
import { useEffect, useState, type ReactElement } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMissingAiAgentsStatus } from '../lib/aiAgents'
import type { AiModelProvider } from '../lib/aiTargets'
import { NATIVE_CHAT_MODEL_CHIP_MAX_WIDTH_CLASS } from '../lib/composerMenuSide'
import { createTranslator } from '../lib/i18n'
import { resetPrimeHostStatus } from '../hooks/usePrimeHostStatus'
import { resetPrimeModelCatalog } from '../lib/primeModelCatalog'
import { resetListProviderModelsCache } from '../lib/listProviderModels'
import {
  consumeProviderSettingsFocus,
  subscribeProviderSettingsFocus,
} from '../lib/providerSettingsFocus'
import { SETTINGS_MENU_Z_CLASS } from '../lib/settingsMenuLayer'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { ConnectedProvidersSummary } from './ConnectedProvidersSummary'
import { NativeChatModelPicker } from './NativeChatModelPicker'

function render(ui: ReactElement) {
  return rtlRender(<TooltipProvider>{ui}</TooltipProvider>)
}

const invoked = vi.hoisted(() => ({
  calls: [] as Array<{ cmd: string; args?: Record<string, unknown> }>,
}))

const host = vi.hoisted(() => ({
  hold: null as Promise<void> | null,
  release: null as (() => void) | null,
  fail: false,
  emptyOnce: false,
}))

vi.mock('../lib/callHost', () => ({
  callHost: vi.fn(async (cmd: string, args?: Record<string, unknown>) => {
    invoked.calls.push({ cmd, args })
    if (host.hold) await host.hold
    if (host.fail) throw new Error('provider offline')
    if (cmd === 'get_available_prime_models') {
      return [
        { id: 'grok-4.5', name: 'Grok 4.5', provider: 'xai' },
        { id: 'claude-opus-5', name: 'Claude Opus 5', provider: 'anthropic' },
        { id: 'mock-model', name: 'Mock model', provider: 'mock' },
        { id: 'hermes-4-405b', name: 'Hermes 4 405B', provider: 'nous-portal' },
      ]
    }
    if (cmd === 'get_prime_session_host_status') {
      return {
        installed: true,
        version: '1.0',
        running: true,
        sessionId: 's1',
        isStreaming: false,
        binaryPath: '/bin/prime',
        modelProvider: 'xai',
        modelId: 'grok-4.5',
        modelName: 'Grok 4.5',
      }
    }
    if (cmd === 'native_model_vision') {
      const target = String(args?.target ?? '')
      return target.includes('gpt-4o') ? 'yes' : 'unknown'
    }
    if (cmd === 'oauth_status' || cmd === 'oauth_sign_out' || cmd === 'oauth_cancel') {
      return {
        provider: 'openai',
        enabled: false,
        signed_in: false,
        usable: false,
        email: null,
        revoked: true,
      }
    }
    if (cmd === 'oauth_sign_in') {
      return {
        provider: 'openai',
        enabled: true,
        signed_in: true,
        usable: true,
        email: 'plus@example.com',
        revoked: true,
      }
    }
    if (cmd !== 'list_ai_model_provider_models' && cmd !== 'discover_ai_models') return []
    const provider = args?.provider as { kind?: string; id?: string } | undefined
    if (host.emptyOnce && provider?.id === 'work-openai') {
      host.emptyOnce = false
      return []
    }
    if (provider?.kind === 'ollama') return ['llama3.2', 'qwen2.5']
    if (provider?.id === 'work-openai') return ['gpt-4o', 'gpt-5']
    return []
  }),
}))

vi.mock('../lib/productAnalytics', () => ({
  trackRhizomeModelChanged: vi.fn(),
  trackPrimeModelChanged: vi.fn(),
}))

vi.mock('../utils/aiProviderSecrets', () => ({
  saveAiModelProviderApiKey: vi.fn(async () => {}),
  testAiModelProvider: vi.fn(async () => 'OK'),
}))

vi.mock('../lib/telemetry', () => ({
  trackEvent: vi.fn(),
}))

beforeEach(() => {
  invoked.calls = []
  host.hold = null
  host.release = null
  host.fail = false
  host.emptyOnce = false
  resetPrimeModelCatalog()
  resetPrimeHostStatus()
  resetListProviderModelsCache()
})

afterEach(() => {
  resetPrimeHostStatus()
  resetPrimeModelCatalog()
  resetListProviderModelsCache()
})

const capabilities = {
  streaming: true,
  tools: false,
  vision: false,
  json_mode: false,
  reasoning: { state: 'unknown' as const },
}

const configured: AiModelProvider[] = [
  {
    id: 'work-openai',
    name: 'Work OpenAI',
    kind: 'open_ai',
    api_key_storage: 'local_file',
    models: [
      {
        id: 'gpt-4o',
        display_name: 'GPT-4o',
        capabilities,
      },
    ],
  },
]

/** Every remote catalog kind except Gemini, so the footer counts one keyless provider. */
const keyedExceptGemini: AiModelProvider[] = [
  configured[0],
  {
    id: 'work-router',
    name: 'Work OpenRouter',
    kind: 'open_router',
    api_key_storage: 'local_file',
    models: [{ id: 'openai/gpt-4.1-mini', display_name: 'GPT-4.1 mini', capabilities }],
  },
  {
    id: 'work-compat',
    name: 'Work custom',
    kind: 'open_ai_compatible',
    api_key_storage: 'local_file',
    models: [{ id: 'gpt-4.1-mini', display_name: 'GPT-4.1 mini', capabilities }],
  },
]

const LONG_NAME = 'Work OpenAI · anthropic-claude-opus-4-very-long-id'

function openMenu(testId = 'native-chat-model-trigger') {
  fireEvent.pointerDown(
    screen.getByTestId(testId),
    new PointerEvent('pointerdown', { bubbles: true, button: 0 }),
  )
}

function mockTriggerBox(top: number, bottom: number, innerHeight = 640) {
  const trigger = screen.getByTestId('native-chat-model-trigger')
  vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
    x: 16,
    y: top,
    top,
    bottom,
    left: 16,
    right: 160,
    width: 144,
    height: bottom - top,
    toJSON: () => ({}),
  })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: innerHeight })
}

describe('NativeChatModelPicker', () => {
  it('seeds Settings and the composer from the same Rhizome catalog', async () => {
    const onChange = vi.fn()
    render(
      <NativeChatModelPicker
        value="open_ai/gpt-4o"
        onChange={onChange}
        providers={configured}
      />,
    )

    expect(screen.getByTestId('native-chat-model-picker')).toBeInTheDocument()
    openMenu()
    await waitFor(() => {
      expect(screen.getByTestId('native-chat-model-menu')).toHaveTextContent('Work OpenAI')
    })
    expect(screen.getByTestId('native-chat-model-work-openai/gpt-4o')).toHaveTextContent('GPT-4o')
    expect(screen.getByTestId('native-chat-model-work-openai/gpt-4o')).not.toHaveTextContent('Work OpenAI ·')
    expect(await screen.findByTestId('native-chat-model-vision')).toHaveTextContent('Vision')
    expect(screen.getByTestId('native-chat-model-free_tier_auto')).toHaveTextContent('Taproot')
    expect(screen.getByTestId('native-chat-model-free_tier_auto')).not.toHaveTextContent('free_tier_auto')
  })

  it('merges a live discover when the menu opens', async () => {
    render(<NativeChatModelPicker value={null} onChange={vi.fn()} />)

    openMenu()
    await waitFor(() => {
      expect(screen.getByTestId('native-chat-model-ollama/qwen2.5')).toBeInTheDocument()
    })
  })

  it('lists live models for a keyed provider and shows a brief loading state', async () => {
    host.hold = new Promise<void>((resolve) => {
      host.release = resolve
    })
    render(
      <NativeChatModelPicker
        variant="chip"
        value="work-openai/gpt-4o"
        onChange={vi.fn()}
        providers={configured}
      />,
    )
    openMenu()
    const loading = await screen.findAllByTestId('native-chat-model-loading')
    expect(loading[0]).toHaveTextContent('Loading…')
    await act(async () => {
      host.release?.()
    })
    await waitFor(() => {
      expect(screen.getByTestId('native-chat-model-work-openai/gpt-5')).toHaveTextContent('gpt-5')
    })
    expect(screen.queryByTestId('native-chat-model-loading')).not.toBeInTheDocument()
  })

  it('keeps a well-formed discovered target even before the menu opens', () => {
    render(
      <NativeChatModelPicker value="open_ai/gpt-4o" onChange={vi.fn()} providers={configured} />,
    )

    expect(screen.getByTestId('native-chat-model-trigger')).toHaveTextContent('Work OpenAI · GPT-4o')
  })

  it('labels a deleted provider and tells the user how to recover', async () => {
    render(
      <NativeChatModelPicker
        value="gone-openai/gpt-4o"
        onChange={vi.fn()}
        providers={configured}
      />,
    )

    expect(screen.getByTestId('native-chat-model-trigger')).toHaveTextContent('Provider removed')
    expect(screen.getByTestId('native-chat-removed-provider')).toHaveTextContent(
      "This model's provider was removed. Pick another model, or add the provider back in Settings → AI Agents.",
    )

    openMenu()
    await waitFor(() => {
      expect(screen.getByTestId('native-chat-model-gone-openai/gpt-4o')).toHaveTextContent(
        'Provider removed',
      )
    })
  })

  it('names the chip with the shared Provider · model label and keeps a compact muted control', async () => {
    render(
      <NativeChatModelPicker
        variant="chip"
        value="open_ai/gpt-4o"
        onChange={vi.fn()}
        providers={configured}
      />,
    )

    const chip = screen.getByTestId('native-chat-model-trigger')
    expect(chip.tagName).toBe('BUTTON')
    expect(chip).toHaveAccessibleName('Work OpenAI · GPT-4o, work-openai/gpt-4o')
    expect(screen.getByTestId('native-chat-model-trigger-label')).toHaveTextContent('Work OpenAI · GPT-4o')
    chip.focus()
    const tooltip = (await screen.findAllByTestId('native-chat-model-tooltip'))[0]
    expect(tooltip).toHaveTextContent('Work OpenAI · GPT-4o')
    const tooltipId = within(tooltip).getAllByTestId('native-chat-model-tooltip-id')[0]
    expect(tooltipId).toHaveTextContent('work-openai/gpt-4o')
    expect(tooltipId).toHaveClass('font-mono')
    expect(chip).toHaveClass('rounded-md')
    expect(chip).toHaveClass('h-6')
    expect(chip).toHaveClass('text-[12px]')
    expect(chip).toHaveClass('self-center')
    expect(chip).toHaveClass('bg-transparent')
    expect(chip).toHaveClass('hover:bg-accent/50')
    expect(chip).toHaveClass('data-[state=open]:bg-accent')
    expect(chip).toHaveClass('gap-1')
    expect(chip.className).toMatch(/outline-2/)
    expect(chip.className).not.toMatch(/text-primary|accent-green|bg-primary/)
  })

  it('tells the chip menu that a pick applies to new chats, not this one', async () => {
    render(
      <NativeChatModelPicker
        variant="chip"
        value="open_ai/gpt-4o"
        onChange={vi.fn()}
        providers={configured}
      />,
    )

    openMenu()
    await waitFor(() => {
      const note = screen.getByTestId('native-chat-model-new-chats')
      expect(note).toHaveTextContent('New chats use this model.')
      expect(note).toHaveClass('px-2')
      expect(note).toHaveClass('py-1.5')
      expect(note).toHaveClass('text-[12px]')
      expect(note).toHaveClass('text-muted-foreground')
      expect(note.className).not.toMatch(/text-\[11px\]/)
      expect(note.className).not.toMatch(/border-t/)
      expect(screen.getByTestId('native-chat-model-footer-sep')).toHaveClass('my-2')
      expect(screen.getByTestId('native-chat-model-footer-sep')).toHaveClass('h-px')
      expect(screen.getByTestId('native-chat-model-footer-sep')).toHaveClass('w-full')
      expect(screen.getByTestId('native-chat-model-footer-sep')).toHaveClass('bg-border-subtle')
    })
  })

  it('keeps the Settings row label as Model, not the unknown-model fallback', () => {
    render(
      <NativeChatModelPicker value="open_ai/gpt-4o" onChange={vi.fn()} providers={configured} />,
    )

    expect(screen.getByTestId('native-chat-model-picker')).toHaveTextContent('Model')
    expect(screen.queryByTestId('native-chat-model-new-chats')).not.toBeInTheDocument()
  })

  it('cuts a long chip label with an ellipsis and keeps the full name on the tooltip and menu', async () => {
    const longProvider: AiModelProvider[] = [
      {
        ...configured[0],
        models: [
          {
            ...configured[0].models[0],
            id: 'anthropic-claude-opus-4-very-long-id',
            display_name: 'anthropic-claude-opus-4-very-long-id',
          },
        ],
      },
    ]
    render(
      <NativeChatModelPicker
        variant="chip"
        value="work-openai/anthropic-claude-opus-4-very-long-id"
        onChange={vi.fn()}
        providers={longProvider}
      />,
    )

    const chip = screen.getByTestId('native-chat-model-trigger')
    expect(chip).toHaveClass(NATIVE_CHAT_MODEL_CHIP_MAX_WIDTH_CLASS)
    expect(screen.getByTestId('native-chat-model-trigger-label')).toHaveTextContent('Work OpenAI · anthropic-claude-opus-4-very-long-id')
    expect(screen.getByTestId('native-chat-model-trigger-provider')).toHaveClass('min-w-0', 'shrink-[999]', 'truncate')
    expect(screen.getByTestId('native-chat-model-trigger-model')).toHaveClass('min-w-0', 'truncate')
    expect(screen.getByTestId('native-chat-model-trigger-model')).not.toHaveClass('shrink-0')
    expect(screen.getByTestId('native-chat-model-trigger-model')).not.toHaveClass('shrink-[999]')
    expect(screen.getByTestId('native-chat-model-trigger-model')).toHaveTextContent('anthropic-claude-opus-4-very-long-id')
    expect(screen.getByTestId('native-chat-model-trigger-provider')).toHaveTextContent('Work OpenAI')
    chip.focus()
    expect(await screen.findByTestId('native-chat-model-tooltip')).toHaveTextContent(LONG_NAME)

    openMenu()
    await waitFor(() => {
      expect(screen.getByTestId('native-chat-model-work-openai/anthropic-claude-opus-4-very-long-id')).toHaveAttribute(
        'title',
        'anthropic-claude-opus-4-very-long-id',
      )
    })
    const row = screen.getByTestId('native-chat-model-work-openai/anthropic-claude-opus-4-very-long-id')
    expect(row).toHaveTextContent('anthropic-claude-opus-4-very-long-id')
    expect(row.querySelector('.truncate')).not.toBeNull()
    expect(row.querySelector('.truncate')).toHaveAttribute('title', 'anthropic-claude-opus-4-very-long-id')
  })

  it('lets the provider span shrink before the model name on a narrow chip', () => {
    render(
      <NativeChatModelPicker
        variant="chip"
        value="work-openai/gpt-4o"
        onChange={vi.fn()}
        providers={configured}
      />,
    )

    const label = screen.getByTestId('native-chat-model-trigger-label')
    expect(label).toHaveClass('min-w-0')
    expect(label).toHaveClass('overflow-hidden')
    const provider = screen.getByTestId('native-chat-model-trigger-provider')
    const model = screen.getByTestId('native-chat-model-trigger-model')
    expect(provider).toHaveClass('min-w-0', 'shrink-[999]', 'truncate')
    expect(model).toHaveClass('min-w-0', 'truncate')
    expect(model).not.toHaveClass('shrink-0')
    expect(model).not.toHaveClass('shrink-[999]')
    expect(label).toHaveTextContent('Work OpenAI · GPT-4o')
    expect(screen.getByTestId('native-chat-model-trigger')).toHaveAccessibleName(
      'Work OpenAI · GPT-4o, work-openai/gpt-4o',
    )
  })

  it('focuses the Settings key field after Add key without returning focus to the chip', async () => {
    function Harness() {
      const [focusRowId, setFocusRowId] = useState<string | null>(null)
      useEffect(() => {
        return subscribeProviderSettingsFocus((focus) => {
          setFocusRowId(focus.rowId)
        })
      }, [])
      return (
        <>
          <NativeChatModelPicker
            variant="chip"
            value={null}
            onChange={vi.fn()}
            providers={[]}
            onOpenProviders={() => {}}
          />
          <ConnectedProvidersSummary
            t={createTranslator('en')}
            agents={createMissingAiAgentsStatus()}
            providers={[]}
            onChange={vi.fn()}
            onOpen={vi.fn()}
            focusRowId={focusRowId}
            onFocusConsumed={() => {
              setFocusRowId(null)
            }}
          />
        </>
      )
    }

    render(<Harness />)
    openMenu()
    const addKey = await screen.findAllByTestId('native-chat-model-add-key')
    await act(async () => {
      fireEvent.click(addKey[0])
    })
    await waitFor(() => {
      const field = document.querySelector<HTMLInputElement>('[data-key-for]')
      expect(field).not.toBeNull()
      expect(document.activeElement).toBe(field)
    })
  })

  it('styles the chip menu panel and lists model ids under sentence-case groups', async () => {
    render(
      <NativeChatModelPicker
        variant="chip"
        value="work-openai/gpt-4o"
        onChange={vi.fn()}
        providers={configured}
      />,
    )
    mockTriggerBox(420, 444)
    openMenu()
    const menu = await screen.findByTestId('native-chat-model-menu')
    expect(menu).toHaveClass('bg-popover')
    expect(menu).toHaveClass('text-popover-foreground')
    expect(menu).toHaveClass('border-border')
    expect(menu).toHaveClass('rounded-lg')
    expect(menu).toHaveClass('shadow-md')
    expect(menu).toHaveClass('p-1')
    expect(menu).toHaveClass('w-[18rem]')
    expect(menu).toHaveAttribute('data-side', 'top')
    expect(screen.getByTestId('native-chat-model-filter')).toHaveAttribute('placeholder', 'Filter models')
    expect(screen.getByTestId('native-chat-model-filter')).toHaveClass('h-8')
    expect(screen.getByTestId('native-chat-model-filter')).toHaveClass('text-[13px]')
    const group = screen.getAllByTestId('native-chat-model-provider')[0]
    expect(group.className).toMatch(/text-\[11px\]/)
    expect(group.className).not.toMatch(/uppercase/)
    const row = screen.getByTestId('native-chat-model-work-openai/gpt-4o')
    expect(row).toHaveClass('h-8')
    expect(row).toHaveClass('rounded-md')
    expect(row).toHaveClass('text-[13px]')
    expect(row).toHaveClass('focus:bg-[var(--state-menu-hover)]')
    expect(row).toHaveClass('data-[highlighted]:bg-[var(--state-menu-hover)]')
    expect(row).toHaveClass('data-[selected=true]:bg-[var(--state-menu-selected)]')
    expect(row).toHaveClass('data-[highlighted]:shadow-[inset_2px_0_0_var(--accent-blue)]')
    expect(row).toHaveClass('text-foreground')
    expect(row).toHaveClass('focus:text-foreground')
    expect(row).toHaveClass('data-[highlighted]:text-foreground')
    expect(row.className).not.toMatch(/bg-accent\/60/)
    expect(screen.getByTestId('native-chat-model-selected-check')).toHaveClass('text-foreground')
    expect(screen.getByTestId('native-chat-model-selected-check')).not.toHaveClass('text-primary')
    const sep = screen.getAllByTestId('native-chat-model-group-sep')[0]
    expect(sep).toHaveClass('my-2')
    expect(sep).toHaveClass('h-px')
    expect(sep).toHaveClass('w-full')
    expect(sep).toHaveClass('bg-border-subtle')
    expect(menu).toHaveClass('overflow-hidden')
    expect(menu).toHaveClass('overflow-y-hidden')
    expect(screen.getByTestId('native-chat-model-filter-row')).toHaveClass('border-b')
    expect(screen.getByTestId('native-chat-model-filter-row')).toHaveClass('border-border')
    expect(screen.getByTestId('native-chat-model-list').contains(screen.getByTestId('native-chat-model-filter'))).toBe(false)
    expect(screen.getByTestId('native-chat-model-list')).toHaveClass('overflow-y-auto')
    expect(screen.getByTestId('native-chat-model-filter')).toHaveFocus()
  })

  it('shows keyless providers as disabled rows and links the footer to Connected', async () => {
    const onOpenProviders = vi.fn()
    render(
      <NativeChatModelPicker
        variant="chip"
        value={null}
        onChange={vi.fn()}
        providers={[]}
        onOpenProviders={onOpenProviders}
      />,
    )
    openMenu()
    await waitFor(() => {
      const gemini = screen.getByTestId('native-chat-model-gemini/gemini-2.5-flash')
      expect(gemini).toHaveAttribute('aria-disabled', 'true')
      expect(gemini).not.toHaveTextContent('Needs an API key')
      expect(screen.getAllByTestId('native-chat-model-reason').some((node) => node.textContent === 'Needs an API key')).toBe(true)
      expect(screen.getByTestId('native-chat-model-open-providers')).toHaveTextContent(
        'need attention',
      )
      expect(screen.getByTestId('native-chat-model-keyless-note').textContent).not.toMatch(
        /1 providers/,
      )
      expect(screen.getByTestId('native-chat-model-open-settings').tagName).toBe('BUTTON')
      expect(screen.getByTestId('native-chat-model-open-settings')).toHaveClass('text-[var(--feedback-warning-text)]')
      expect(screen.getByTestId('native-chat-model-open-settings')).toHaveClass('hover:underline')
      expect(screen.getByTestId('native-chat-model-open-settings').className).toMatch(/outline-2/)
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('native-chat-model-open-settings'))
    })
    expect(onOpenProviders).toHaveBeenCalledOnce()
    expect(consumeProviderSettingsFocus()).toEqual({
      tab: 'agents',
      rowId: 'connected-providers',
    })

    openMenu()
    await waitFor(() => {
      expect(screen.getByTestId('native-chat-model-filter')).toBeInTheDocument()
    })
    fireEvent.change(screen.getByTestId('native-chat-model-filter'), {
      target: { value: 'zzzz-no-such-model' },
    })
    expect(screen.getByTestId('native-chat-models-empty')).toHaveTextContent('No models match')
    fireEvent.click(screen.getByTestId('native-chat-models-clear-filter'))
    expect(screen.getByTestId('native-chat-model-filter')).toHaveValue('')
    expect(screen.queryByTestId('native-chat-models-empty')).not.toBeInTheDocument()
  })

  it('counts providers that are not set up, including one missing key', async () => {
    render(
      <NativeChatModelPicker
        variant="chip"
        value={null}
        onChange={vi.fn()}
        providers={keyedExceptGemini}
        onOpenProviders={vi.fn()}
      />,
    )
    openMenu()
    const note = await screen.findByTestId('native-chat-model-keyless-note')
    expect(note.textContent).toMatch(/need attention/)
    expect(note.textContent).not.toMatch(/1 providers/)
  })

  it('caps the model list and pins the filter and footer', async () => {
    render(
      <NativeChatModelPicker
        variant="chip"
        value="work-openai/gpt-4o"
        onChange={vi.fn()}
        providers={configured}
      />,
    )
    openMenu()
    const list = await screen.findByTestId('native-chat-model-list')
    expect(list).toHaveClass('max-h-[min(60vh,420px)]')
    expect(list).toHaveClass('overflow-y-auto')
    expect(list.contains(screen.getByTestId('native-chat-model-filter'))).toBe(false)
    expect(list.contains(screen.getByTestId('native-chat-model-footer'))).toBe(false)
    expect(screen.getByTestId('native-chat-model-filter-row')).toHaveClass('shrink-0')
    expect(screen.getByTestId('native-chat-model-footer')).toHaveClass('shrink-0')
  })

  it('scrolls the selected row into view when the menu opens', async () => {
    const scrollIntoView = vi.fn()
    HTMLElement.prototype.scrollIntoView = scrollIntoView
    render(
      <NativeChatModelPicker
        variant="chip"
        value="work-openai/gpt-4o"
        onChange={vi.fn()}
        providers={configured}
      />,
    )
    openMenu()
    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled()
    })
    const selected = screen.getByTestId('native-chat-model-work-openai/gpt-4o')
    expect(selected).toHaveAttribute('data-selected', 'true')
  })

  it('marks a failed live list as offline and keeps the saved rows', async () => {
    host.fail = true
    render(
      <NativeChatModelPicker
        variant="chip"
        value="work-openai/gpt-4o"
        onChange={vi.fn()}
        providers={configured}
      />,
    )
    openMenu()
    const row = await screen.findByTestId('native-chat-model-work-openai/gpt-4o')
    expect(row).not.toHaveAttribute('aria-disabled')
    expect(row).toHaveTextContent('GPT-4o')
    expect(screen.getAllByTestId('native-chat-model-offline').some((node) => node.textContent === "Couldn't load models")).toBe(true)
    expect(screen.getAllByTestId('native-chat-model-offline')[0]).toHaveClass('block')
    expect(screen.getAllByTestId('native-chat-model-retry').length).toBeGreaterThan(0)
    expect(screen.getByTestId('native-chat-model-ollama/llama3.2')).toHaveAttribute('aria-disabled', 'true')
  })

  it('retries a cached empty list from the group header', async () => {
    host.emptyOnce = true
    render(
      <NativeChatModelPicker
        variant="chip"
        value="work-openai/gpt-4o"
        onChange={vi.fn()}
        providers={configured}
      />,
    )
    openMenu()
    const header = (await screen.findAllByTestId('native-chat-model-provider'))
      .find((node) => node.textContent?.includes('Work OpenAI'))
    expect(header).toBeTruthy()
    expect(within(header as HTMLElement).getByTestId('native-chat-model-offline')).toHaveTextContent('No models found')
    fireEvent.click(within(header as HTMLElement).getByTestId('native-chat-model-retry'))
    await waitFor(() => {
      expect(screen.getByTestId('native-chat-model-work-openai/gpt-5')).toBeInTheDocument()
    })
  })

  it('keeps cached rows usable while Loading… is muted', async () => {
    const onChange = vi.fn()
    host.hold = new Promise<void>((resolve) => {
      host.release = resolve
    })
    render(
      <NativeChatModelPicker
        variant="chip"
        value="work-openai/gpt-4o"
        onChange={onChange}
        providers={configured}
      />,
    )
    openMenu()
    const loading = await screen.findAllByTestId('native-chat-model-loading')
    expect(loading[0]).toHaveClass('text-muted-foreground')
    await act(async () => {
      fireEvent.click(screen.getByTestId('native-chat-model-work-openai/gpt-4o'))
    })
    expect(onChange).toHaveBeenCalledWith('work-openai/gpt-4o')
    await act(async () => {
      host.release?.()
    })
  })

  it('styles the attention footer with the warning token', async () => {
    render(
      <NativeChatModelPicker
        variant="chip"
        value={null}
        onChange={vi.fn()}
        providers={[]}
        onOpenProviders={vi.fn()}
      />,
    )
    openMenu()
    const link = await screen.findByTestId('native-chat-model-open-settings')
    const note = screen.getByTestId('native-chat-model-keyless-note')
    expect(note).not.toHaveClass('text-primary')
    expect(link).toHaveClass('text-[var(--feedback-warning-text)]')
    expect(link.className).toMatch(/underline/)
  })

  it('does not mark catalog locals offline when the user never set them up', async () => {
    host.fail = true
    render(
      <NativeChatModelPicker
        variant="chip"
        value={null}
        onChange={vi.fn()}
        providers={[]}
      />,
    )
    openMenu()
    await waitFor(() => {
      expect(screen.queryByTestId('native-chat-model-loading')).not.toBeInTheDocument()
    })
    expect(screen.queryByTestId('native-chat-model-offline')).not.toBeInTheDocument()
  })

  it('prefixes a colliding display name with the provider', async () => {
    const openai: AiModelProvider = {
      id: 'openai',
      name: 'OpenAI',
      kind: 'open_ai',
      api_key_storage: 'local_file',
      models: [{
        id: 'gpt-4o',
        display_name: 'GPT-4o',
        capabilities: configured[0].models[0].capabilities,
      }],
    }
    const azure: AiModelProvider = {
      id: 'azure',
      name: 'Azure',
      kind: 'open_ai_compatible',
      api_key_storage: 'local_file',
      models: [{
        id: 'gpt-4o',
        display_name: 'GPT-4o',
        capabilities: configured[0].models[0].capabilities,
      }],
    }
    render(
      <NativeChatModelPicker
        variant="chip"
        value="openai/gpt-4o"
        onChange={vi.fn()}
        providers={[openai, azure]}
      />,
    )
    openMenu()
    await waitFor(() => {
      expect(screen.getByTestId('native-chat-model-openai/gpt-4o')).toHaveTextContent('GPT-4o')
      expect(screen.getByTestId('native-chat-model-openai/gpt-4o')).not.toHaveTextContent('OpenAI ·')
    })
    expect(screen.getByTestId('native-chat-model-azure/gpt-4o')).toHaveTextContent('GPT-4o')
    const headers = screen.getAllByTestId('native-chat-model-provider').map((node) => node.textContent ?? '')
    expect(headers.some((text) => text.startsWith('OpenAI'))).toBe(true)
    expect(headers.some((text) => text.startsWith('Azure'))).toBe(true)
  })

  it('paints group dividers with the input-border token', async () => {
    render(
      <NativeChatModelPicker
        variant="chip"
        value="work-openai/gpt-4o"
        onChange={vi.fn()}
        providers={configured}
      />,
    )
    openMenu()
    await waitFor(() => {
      expect(screen.getAllByTestId('native-chat-model-group-sep')[0]).toHaveClass(
        'bg-border-subtle',
      )
    })
    expect(screen.getByTestId('native-chat-model-footer-sep')).toHaveClass('bg-border-subtle')
  })

  it('keeps the selected keyless model in the list, not only on the chip', async () => {
    render(
      <NativeChatModelPicker
        variant="chip"
        value="gemini/gemini-2.5-flash"
        onChange={vi.fn()}
        providers={[]}
      />,
    )

    expect(screen.getByTestId('native-chat-model-trigger-label')).toHaveTextContent('Gemini · gemini-2.5-flash')
    expect(screen.getByTestId('native-chat-model-trigger')).toHaveAccessibleName(/^Gemini · gemini-2\.5-flash/)
    openMenu()
    await waitFor(() => {
      expect(screen.getByTestId('native-chat-model-gemini/gemini-2.5-flash')).toBeInTheDocument()
    })
    expect(screen.getByTestId('native-chat-model-gemini/gemini-2.5-flash')).toHaveAttribute(
      'data-selected',
      'true',
    )
    const hidden = screen.getByTestId('native-chat-model-openai/gpt-4.1-mini')
    expect(hidden).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getAllByTestId('native-chat-model-reason').some((node) => node.textContent === 'Needs an API key')).toBe(true)
  })

  it('opens the chip menu upward when there is room above', async () => {
    render(
      <NativeChatModelPicker
        variant="chip"
        value="open_ai/gpt-4o"
        onChange={vi.fn()}
        providers={configured}
      />,
    )
    mockTriggerBox(420, 444)
    openMenu()
    await waitFor(() => {
      expect(screen.getByTestId('native-chat-model-menu')).toHaveAttribute('data-side', 'top')
    })
  })

  it('flips the chip menu down when the chip sits near the top of a short panel', async () => {
    render(
      <NativeChatModelPicker
        variant="chip"
        value="open_ai/gpt-4o"
        onChange={vi.fn()}
        providers={configured}
      />,
    )
    mockTriggerBox(8, 32)
    openMenu()
    await waitFor(() => {
      expect(screen.getByTestId('native-chat-model-menu')).toHaveAttribute('data-side', 'bottom')
    })
  })

  it('changes the model from the keyboard and returns focus to the chip on Escape', async () => {
    const onChange = vi.fn()
    render(
      <NativeChatModelPicker
        variant="chip"
        value="open_ai/gpt-4o"
        onChange={onChange}
        providers={configured}
      />,
    )

    const chip = screen.getByTestId('native-chat-model-trigger')
    chip.focus()
    expect(chip).toHaveFocus()
    await act(async () => {
      fireEvent.keyDown(chip, { key: 'Enter' })
    })
    await waitFor(() => {
      expect(screen.getByTestId('native-chat-model-menu')).toBeInTheDocument()
    })

    const item = screen.getByTestId('native-chat-model-free_tier_auto')
    await act(async () => {
      item.focus()
      fireEvent.keyDown(item, { key: 'Enter' })
      fireEvent.click(item)
    })
    expect(onChange).toHaveBeenCalledWith('free_tier_auto')

    await act(async () => {
      openMenu()
    })
    await waitFor(() => {
      expect(screen.getByTestId('native-chat-model-menu')).toBeInTheDocument()
    })
    await act(async () => {
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    })
    await waitFor(() => {
      expect(screen.queryByTestId('native-chat-model-menu')).not.toBeInTheDocument()
    })
    expect(chip).toHaveFocus()
  })

  /**
   * jsdom has no layout, so visibility cannot prove a menu escaped a clip.
   * Walk parents (not the menu itself — it uses overflow-y-auto) and require
   * no clipping ancestor: overflow-hidden/clip as a class, inline style, or
   * computed style. The menu must sit on document.body.
   */
  const CLIP_OVERFLOW = new Set(['hidden', 'clip'])

  function overflowTokenClips(value: string | null | undefined): boolean {
    if (!value) return false
    return value.split(/\s+/).some((token) => CLIP_OVERFLOW.has(token))
  }

  function elementClipsOverflow(el: HTMLElement): boolean {
    if (
      el.classList.contains('overflow-hidden')
      || el.classList.contains('overflow-clip')
    ) {
      return true
    }
    if (
      overflowTokenClips(el.style.overflow)
      || overflowTokenClips(el.style.overflowX)
      || overflowTokenClips(el.style.overflowY)
    ) {
      return true
    }
    const computed = getComputedStyle(el)
    return (
      overflowTokenClips(computed.overflow)
      || overflowTokenClips(computed.overflowX)
      || overflowTokenClips(computed.overflowY)
    )
  }

  function isMenuChrome(el: HTMLElement): boolean {
    const id = el.getAttribute('data-testid')
    return (
      id === 'native-chat-model-menu'
      || id === 'native-chat-model-list'
      || id === 'native-chat-model-filter-row'
      || id === 'native-chat-model-footer'
    )
  }

  function overflowHiddenAncestor(node: HTMLElement): HTMLElement | null {
    let current = node.parentElement
    while (current && current !== document.body && current !== document.documentElement) {
      if (!isMenuChrome(current) && elementClipsOverflow(current)) return current
      current = current.parentElement
    }
    return null
  }

  function expectMenuInPortal(menu: HTMLElement) {
    expect(document.body.contains(menu)).toBe(true)
    expect(overflowHiddenAncestor(menu)).toBeNull()
  }

  it('treats overflow-clip, inline overflow, and computed overflow as clip ancestors', () => {
    const style = document.createElement('style')
    style.textContent = '.computed-clip { overflow: hidden }'
    document.head.appendChild(style)

    const cases: Array<{ name: string; apply: (el: HTMLElement) => void }> = [
      { name: 'overflow-clip class', apply: (el) => { el.className = 'overflow-clip' } },
      { name: 'inline overflow hidden', apply: (el) => { el.style.overflow = 'hidden' } },
      { name: 'inline overflow clip', apply: (el) => { el.style.overflow = 'clip' } },
      { name: 'computed overflow hidden', apply: (el) => { el.className = 'computed-clip' } },
    ]

    try {
      for (const next of cases) {
        const trap = document.createElement('div')
        next.apply(trap)
        const leaf = document.createElement('div')
        trap.appendChild(leaf)
        document.body.appendChild(trap)
        expect(overflowHiddenAncestor(leaf), next.name).toBe(trap)
        trap.remove()
      }

      const visible = document.createElement('div')
      const leaf = document.createElement('div')
      visible.appendChild(leaf)
      document.body.appendChild(visible)
      expect(overflowHiddenAncestor(leaf)).toBeNull()
      visible.remove()
    } finally {
      style.remove()
    }
  })

  it.each([
    { name: 'overflow-hidden class', className: 'h-8 overflow-hidden', style: undefined },
    { name: 'overflow-clip class', className: 'h-8 overflow-clip', style: undefined },
    { name: 'inline overflow hidden', className: 'h-8', style: { overflow: 'hidden' } },
    { name: 'inline overflow clip', className: 'h-8', style: { overflow: 'clip' } },
  ])('opens the composer chip menu in a portal past $name and selects a model', async ({ className, style }) => {
    const onChange = vi.fn()
    render(
      <div className={className} style={style} data-testid="composer-clip-trap">
        <NativeChatModelPicker
          variant="chip"
          value="open_ai/gpt-4o"
          onChange={onChange}
          providers={configured}
        />
      </div>,
    )

    openMenu()
    const menu = await screen.findByTestId('native-chat-model-menu')
    const trap = screen.getByTestId('composer-clip-trap')
    expectMenuInPortal(menu)
    expect(trap.contains(menu)).toBe(false)

    const option = await screen.findByTestId('native-chat-model-free_tier_auto')
    expect(overflowHiddenAncestor(option)).toBeNull()
    expect(trap.contains(option)).toBe(false)
    await act(async () => {
      fireEvent.click(option)
    })
    expect(onChange).toHaveBeenCalledWith('free_tier_auto')
  })

  it('portals the chip menu outside a dialog content box and selects a model', async () => {
    const onChange = vi.fn()
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Model</DialogTitle>
          <div className="h-8 overflow-hidden" data-testid="dialog-clip-trap">
            <NativeChatModelPicker
              variant="chip"
              value="open_ai/gpt-4o"
              onChange={onChange}
              providers={configured}
            />
          </div>
        </DialogContent>
      </Dialog>,
    )

    openMenu()
    const menu = await screen.findByTestId('native-chat-model-menu')
    const dialog = document.querySelector('[data-slot="dialog-content"]')
    expect(dialog).toBeInstanceOf(HTMLElement)
    expectMenuInPortal(menu)
    expect((dialog as HTMLElement).contains(menu)).toBe(false)
    expect(screen.getByTestId('dialog-clip-trap').contains(menu)).toBe(false)

    const option = await screen.findByTestId('native-chat-model-free_tier_auto')
    expect(overflowHiddenAncestor(option)).toBeNull()
    expect((dialog as HTMLElement).contains(option)).toBe(false)
    expect(screen.getByTestId('dialog-clip-trap').contains(option)).toBe(false)
    await act(async () => {
      fireEvent.click(option)
    })
    expect(onChange).toHaveBeenCalledWith('free_tier_auto')
  })

  it('keeps the Settings menu at z-[12000] with the settings portal marker', async () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Settings</DialogTitle>
          <NativeChatModelPicker
            value="open_ai/gpt-4o"
            onChange={vi.fn()}
            providers={configured}
          />
        </DialogContent>
      </Dialog>,
    )

    openMenu()
    const menu = await screen.findByTestId('native-chat-model-menu')
    expect(menu).toHaveClass(SETTINGS_MENU_Z_CLASS)
    expect(menu).toHaveAttribute('data-settings-panel-portal', 'true')
  })

  it('does not mark the composer chip menu as a settings portal', async () => {
    render(
      <NativeChatModelPicker
        variant="chip"
        value="open_ai/gpt-4o"
        onChange={vi.fn()}
        providers={configured}
      />,
    )

    openMenu()
    const menu = await screen.findByTestId('native-chat-model-menu')
    expect(menu).not.toHaveAttribute('data-settings-panel-portal')
    expect(menu).not.toHaveClass(SETTINGS_MENU_Z_CLASS)
  })

  it('writes native_chat_target on the native engine and does not call set_prime_model', async () => {
    const onChange = vi.fn()
    render(
      <NativeChatModelPicker
        engine="native"
        variant="chip"
        value="open_ai/gpt-4o"
        onChange={onChange}
        providers={configured}
      />,
    )

    expect(screen.getByTestId('native-chat-model-picker')).toHaveAttribute('data-engine', 'native')
    openMenu()
    await act(async () => {
      fireEvent.click(await screen.findByTestId('native-chat-model-free_tier_auto'))
    })
    expect(onChange).toHaveBeenCalledWith('free_tier_auto')
    expect(invoked.calls.some((call) => call.cmd === 'set_prime_model')).toBe(false)
    expect(invoked.calls.some((call) => call.cmd === 'list_ai_model_provider_models')).toBe(true)
  })

  it('reads the Prime host model and writes set_prime_model on the Prime engine', async () => {
    const onChange = vi.fn()
    render(
      <NativeChatModelPicker
        engine="prime"
        variant="chip"
        vaultPath="/vault"
        value="open_ai/gpt-4o"
        onChange={onChange}
        providers={configured}
      />,
    )

    expect(screen.getByTestId('native-chat-model-picker')).toHaveAttribute('data-engine', 'prime')
    await waitFor(() => {
      expect(screen.getByTestId('native-chat-model-trigger-label')).toHaveTextContent('Grok 4.5')
    })

    openMenu()
    await waitFor(() => {
      expect(screen.getByTestId('native-chat-model-anthropic/claude-opus-5')).toHaveTextContent('Claude Opus 5')
    })
    expect(screen.queryByTestId('native-chat-model-new-chats')).not.toBeInTheDocument()
    expect(invoked.calls.some((call) => call.cmd === 'list_ai_model_provider_models')).toBe(false)
    expect(invoked.calls.some((call) => call.cmd === 'get_available_prime_models')).toBe(true)

    await act(async () => {
      fireEvent.click(screen.getByTestId('native-chat-model-anthropic/claude-opus-5'))
    })
    await waitFor(() => {
      expect(invoked.calls).toContainEqual({
        cmd: 'set_prime_model',
        args: { provider: 'anthropic', modelId: 'claude-opus-5' },
      })
    })
    expect(invoked.calls.some((call) => call.cmd === 'ensure_prime_session_host')).toBe(true)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows Prime provider display names on chip menu group headers', async () => {
    render(
      <NativeChatModelPicker
        engine="prime"
        variant="chip"
        vaultPath="/vault"
        value={null}
        onChange={vi.fn()}
      />,
    )

    openMenu()
    await waitFor(() => {
      expect(screen.getByTestId('native-chat-model-nous-portal/hermes-4-405b')).toBeInTheDocument()
    })

    const headers = screen.getAllByTestId('native-chat-model-provider').map((el) => el.textContent)
    expect(headers).toEqual(['Anthropic', 'Mock', 'Nous Portal', 'xAI (Grok)'])
  })
})


