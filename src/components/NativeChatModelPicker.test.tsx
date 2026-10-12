import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AiModelProvider } from '../lib/aiTargets'
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
})
