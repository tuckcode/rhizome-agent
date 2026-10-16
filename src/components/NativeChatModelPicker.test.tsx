import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AiModelProvider } from '../lib/aiTargets'
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
    fireEvent.pointerDown(
      screen.getByTestId('native-chat-model-trigger'),
      new PointerEvent('pointerdown', { bubbles: true, button: 0 }),
    )
    await waitFor(() => {
      expect(screen.getByTestId('native-chat-model-menu')).toHaveTextContent('Work OpenAI')
    })
    expect(screen.getByTestId('native-chat-model-work-openai/gpt-4o')).toHaveTextContent('GPT-4o')
    expect(screen.getByTestId('native-chat-model-free_tier_auto')).toHaveTextContent('Free tier')
  })

  it('merges a live discover when the menu opens', async () => {
    render(<NativeChatModelPicker value={null} onChange={vi.fn()} />)

    fireEvent.pointerDown(
      screen.getByTestId('native-chat-model-trigger'),
      new PointerEvent('pointerdown', { bubbles: true, button: 0 }),
    )
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

    fireEvent.pointerDown(
      screen.getByTestId('native-chat-model-trigger'),
      new PointerEvent('pointerdown', { bubbles: true, button: 0 }),
    )
    await waitFor(() => {
      expect(screen.getByTestId('native-chat-model-gone-openai/gpt-4o')).toHaveTextContent(
        'Provider removed',
      )
    })
  })

  /**
   * jsdom has no layout, so visibility cannot prove a menu escaped a clip.
   * Walk parents (not the menu itself — it uses overflow-y-auto) and require
   * no overflow-hidden / overflow-clip ancestor, including inline overflow
   * styles. The menu must sit on document.body.
   */
  function clipsDescendants(node: HTMLElement): boolean {
    if (node.classList.contains('overflow-hidden') || node.classList.contains('overflow-clip')) {
      return true
    }
    const computed = window.getComputedStyle(node)
    const values = [
      node.style.overflow,
      node.style.overflowX,
      node.style.overflowY,
      computed.overflow,
      computed.overflowX,
      computed.overflowY,
    ]
    return values.some((value) => value === 'hidden' || value === 'clip')
  }

  function clippingAncestor(node: HTMLElement): HTMLElement | null {
    let current = node.parentElement
    while (current && current !== document.body && current !== document.documentElement) {
      if (clipsDescendants(current)) return current
      current = current.parentElement
    }
    return null
  }

  function expectMenuInPortal(menu: HTMLElement) {
    expect(document.body.contains(menu)).toBe(true)
    expect(clippingAncestor(menu)).toBeNull()
  }

  function openMenu() {
    fireEvent.pointerDown(
      screen.getByTestId('native-chat-model-trigger'),
      new PointerEvent('pointerdown', { bubbles: true, button: 0 }),
    )
  }

  it('opens the Settings model menu in a portal and selects a model', async () => {
    const onChange = vi.fn()
    render(
      <div className="h-8 overflow-clip" data-testid="settings-clip-trap">
        <NativeChatModelPicker
          value="open_ai/gpt-4o"
          onChange={onChange}
          providers={configured}
        />
      </div>,
    )

    openMenu()
    const menu = await screen.findByTestId('native-chat-model-menu')
    const trap = screen.getByTestId('settings-clip-trap')
    expectMenuInPortal(menu)
    expect(trap.contains(menu)).toBe(false)

    const option = await screen.findByTestId('native-chat-model-free_tier_auto')
    expect(clippingAncestor(option)).toBeNull()
    expect(trap.contains(option)).toBe(false)
    await act(async () => {
      fireEvent.click(option)
    })
    expect(onChange).toHaveBeenCalledWith('free_tier_auto')
  })

  it('portals the Settings model menu outside a dialog content box and selects a model', async () => {
    const onChange = vi.fn()
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Model</DialogTitle>
          <div style={{ overflow: 'hidden' }} data-testid="dialog-clip-trap">
            <NativeChatModelPicker
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
    expect(clippingAncestor(option)).toBeNull()
    expect((dialog as HTMLElement).contains(option)).toBe(false)
    expect(screen.getByTestId('dialog-clip-trap').contains(option)).toBe(false)
    await act(async () => {
      fireEvent.click(option)
    })
    expect(onChange).toHaveBeenCalledWith('free_tier_auto')
  })
})
