import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AiModelProvider } from '../lib/aiTargets'
import { NATIVE_CHAT_MODEL_CHIP_MAX_WIDTH_CLASS } from '../lib/composerMenuSide'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { NativeChatModelPicker } from './NativeChatModelPicker'

vi.mock('../lib/callHost', () => ({
  callHost: vi.fn(async (cmd: string, args?: { provider?: { kind?: string } }) => {
    if (cmd !== 'discover_ai_models') return []
    if (args?.provider?.kind === 'ollama') return ['llama3.2', 'qwen2.5']
    return []
  }),
}))

vi.mock('../lib/productAnalytics', () => ({
  trackRhizomeModelChanged: vi.fn(),
}))

const configured: AiModelProvider[] = [
  {
    id: 'work-openai',
    name: 'Work OpenAI',
    kind: 'open_ai',
    models: [
      {
        id: 'gpt-4o',
        display_name: 'GPT-4o',
        capabilities: {
          streaming: true,
          tools: false,
          vision: false,
          json_mode: false,
          reasoning: false,
        },
      },
    ],
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
    expect(screen.getByTestId('native-chat-model-free_tier_auto')).toHaveTextContent('Free tier')
  })

  it('merges a live discover when the menu opens', async () => {
    render(<NativeChatModelPicker value={null} onChange={vi.fn()} />)

    openMenu()
    await waitFor(() => {
      expect(screen.getByTestId('native-chat-model-ollama/qwen2.5')).toBeInTheDocument()
    })
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

  it('names the chip Model: current name and keeps a compact muted control', () => {
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
    expect(chip).toHaveAccessibleName('Model: Work OpenAI · GPT-4o')
    expect(chip).toHaveClass('rounded-md')
    expect(chip).toHaveClass('h-6')
    expect(chip).toHaveClass('self-center')
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
      expect(note).toHaveTextContent('Applies to new chats')
      expect(note).toHaveClass('text-[12px]')
      expect(note).toHaveClass('text-muted-foreground')
      expect(note.className).not.toMatch(/text-\[11px\]/)
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
    expect(chip).toHaveAttribute('title', LONG_NAME)
    expect(screen.getByTestId('native-chat-model-trigger-label')).toHaveClass('truncate')

    openMenu()
    await waitFor(() => {
      expect(screen.getByTestId('native-chat-model-work-openai/anthropic-claude-opus-4-very-long-id')).toHaveAttribute(
        'title',
        LONG_NAME,
      )
    })
    expect(
      screen.getByTestId('native-chat-model-work-openai/anthropic-claude-opus-4-very-long-id'),
    ).toHaveTextContent(LONG_NAME)
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
   * no overflow-hidden ancestor. The menu must sit on document.body.
   */
  function overflowHiddenAncestor(node: HTMLElement): HTMLElement | null {
    let current = node.parentElement
    while (current && current !== document.body && current !== document.documentElement) {
      if (current.classList.contains('overflow-hidden')) return current
      current = current.parentElement
    }
    return null
  }

  function expectMenuInPortal(menu: HTMLElement) {
    expect(document.body.contains(menu)).toBe(true)
    expect(overflowHiddenAncestor(menu)).toBeNull()
  }

  it('opens the composer chip menu in a portal and selects a model', async () => {
    const onChange = vi.fn()
    render(
      <div className="h-8 overflow-hidden" data-testid="composer-clip-trap">
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
})


