import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { queueAiPrompt, takeQueuedAiPrompt } from '../utils/aiPromptBridge'
import { claimQueuedPromptSend, useAiPanelPromptQueue } from './useAiPanelPromptQueue'

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    startTransition: () => {
      // Hold the queued prompt so a second effect flush can race the first.
    },
  }
})

describe('claimQueuedPromptSend', () => {
  it('lets the first flush through and rejects a second flush of the same id', () => {
    const sentPromptIdRef = { current: null as number | null }
    expect(claimQueuedPromptSend(sentPromptIdRef, 7)).toBe(true)
    expect(claimQueuedPromptSend(sentPromptIdRef, 7)).toBe(false)
    expect(claimQueuedPromptSend(sentPromptIdRef, 8)).toBe(true)
  })
})

describe('useAiPanelPromptQueue send-once guard', () => {
  afterEach(() => {
    takeQueuedAiPrompt()
  })

  it('sends a queued prompt once when the effect flushes twice', () => {
    const sendMessage = vi.fn()
    const clearConversation = vi.fn()
    let input = ''
    const setInput = vi.fn((value: string) => {
      input = value
    })
    const agent = { clearConversation, sendMessage }

    const { rerender } = renderHook(
      ({ agent: nextAgent, input: nextInput }) => useAiPanelPromptQueue({
        agent: nextAgent,
        currentTargetId: 'agent:prime',
        input: nextInput,
        isActive: false,
        setInput,
      }),
      { initialProps: { agent, input } },
    )

    act(() => {
      queueAiPrompt('hello from cmdk', [])
    })
    rerender({ agent, input: 'hello from cmdk' })

    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(sendMessage).toHaveBeenCalledWith('hello from cmdk', [])
    expect(clearConversation).toHaveBeenCalledTimes(1)

    rerender({ agent: { clearConversation, sendMessage }, input: 'hello from cmdk' })

    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(clearConversation).toHaveBeenCalledTimes(1)
  })
})
