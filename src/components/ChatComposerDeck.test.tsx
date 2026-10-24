import { fireEvent, render as rtlRender, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { describe, expect, it, vi } from 'vitest'
import { NativeLiveSlotProvider } from '../lib/nativeLiveSlotContext'
import { createNativeLiveSlot, rememberNativeSession, resetNativeLiveSessions } from '../lib/nativeChatTranscript'
import { rememberNativeSessionTarget } from '../lib/nativeSessionTarget'
import { ChatComposerDeck } from './ChatComposerDeck'

vi.mock('../lib/productAnalytics', () => ({
  trackComposerPillOpened: vi.fn(),
  trackPrimeModelChanged: vi.fn(),
  trackRhizomeModelChanged: vi.fn(),
}))

function render(ui: ReactElement) {
  return rtlRender(<TooltipProvider>{ui}</TooltipProvider>)
}

describe('ChatComposerDeck', () => {
  it('names the open note as context when Frame B has a split', () => {
    render(
      <ChatComposerDeck
        contextLabel="memory-loop.md"
      />,
    )

    expect(screen.getByTestId('chat-composer-deck')).toHaveTextContent('ctx · memory-loop.md')
  })

  it('puts the native model chip on the composer strip (#38 / #9)', () => {
    render(
      <ChatComposerDeck
        nativeTarget="open_ai/gpt-4.1-mini"
        onNativeTargetChange={vi.fn()}
      />,
    )

    expect(screen.getByTestId('native-chat-model-picker')).toBeInTheDocument()
    expect(screen.getByTestId('native-chat-model-trigger').tagName).toBe('BUTTON')
    expect(screen.queryByTestId('prime-model-chip')).not.toBeInTheDocument()
  })

  it('drops the Prime label chip and the skills chip (native audit 2026-09-26)', () => {
    // Chat is Prime-only and the header status says whether it is live. The
    // skill label lives in ChatComposerBar's Tools menu.
    render(<ChatComposerDeck />)

    expect(screen.queryByTestId('composer-agent-pill')).not.toBeInTheDocument()
    expect(screen.queryByTestId('composer-skills-pill')).not.toBeInTheDocument()
  })

  it('does not duplicate the vault switcher on the composer strip', () => {
    render(<ChatComposerDeck />)

    expect(screen.queryByTestId('composer-vault-pill')).not.toBeInTheDocument()
    expect(screen.getByTestId('chat-composer-deck')).not.toHaveTextContent('Laputa')
  })

  it('puts the Rhizome catalog chip on the composer row when Prime is not live', () => {
    render(
      <ChatComposerDeck
        catalog="rhizome"
        nativeTarget="open_ai/gpt-4.1-mini"
        onNativeTargetChange={vi.fn()}
      />,
    )

    const deck = screen.getByTestId('chat-composer-deck')
    const picker = screen.getByTestId('native-chat-model-picker')
    expect(deck.contains(picker)).toBe(true)
    expect(picker).toHaveAttribute('data-engine', 'native')
    expect(screen.getByTestId('native-chat-model-trigger')).toHaveClass('h-6')
    expect(screen.queryByTestId('prime-model-chip')).not.toBeInTheDocument()
  })

  it('keeps the native chip on a Prime chat and does not mount PrimeModelPicker', () => {
    render(
      <ChatComposerDeck
        catalog="prime"
        nativeTarget="open_ai/gpt-4o"
        onNativeTargetChange={vi.fn()}
      />,
    )

    expect(screen.getByTestId('native-chat-model-picker')).toBeInTheDocument()
    expect(screen.getByTestId('native-chat-model-picker')).toHaveAttribute('data-engine', 'prime')
    expect(screen.queryByTestId('prime-model-chip')).not.toBeInTheDocument()
  })

  it('hosts the agent activity pill on the composer row', () => {
    render(
      <ChatComposerDeck
        activity={<span data-testid="status-agents-pill">Agents idle</span>}
      />,
    )

    expect(screen.getByTestId('status-agents-pill')).toBeInTheDocument()
  })

  it('shows the session footnote from the panel live slot', async () => {
    resetNativeLiveSessions()
    const slot = createNativeLiveSlot('conv-footnote')
    rememberNativeSession(slot, 'native-footnote')
    rememberNativeSessionTarget('native-footnote', 'ollama/llama3.2')
    render(
      <NativeLiveSlotProvider slot={slot}>
        <ChatComposerDeck
          catalog="rhizome"
          nativeTarget="open_ai/gpt-4.1-mini"
          onNativeTargetChange={vi.fn()}
        />
      </NativeLiveSlotProvider>,
    )

    fireEvent.pointerDown(
      screen.getByTestId('native-chat-model-trigger'),
      new PointerEvent('pointerdown', { bubbles: true, button: 0 }),
    )
    expect(await screen.findByTestId('native-chat-model-new-chats')).toHaveTextContent(
      'This chat stays on llama3.2',
    )
    resetNativeLiveSessions()
  })
})
