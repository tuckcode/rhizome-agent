import { describe, expect, it, vi } from 'vitest'
import {
  AI_COMPOSER_PREFILL_EVENT,
  AI_PROMPT_QUEUED_EVENT,
  NEW_AI_CHAT_EVENT,
  prefillAiComposer,
} from './aiPromptBridge'

describe('prefillAiComposer', () => {
  it('fills this thread and does not start a new chat or queue a send', () => {
    const prefill = vi.fn()
    const queued = vi.fn()
    const newChat = vi.fn()
    window.addEventListener(AI_COMPOSER_PREFILL_EVENT, prefill)
    window.addEventListener(AI_PROMPT_QUEUED_EVENT, queued)
    window.addEventListener(NEW_AI_CHAT_EVENT, newChat)

    prefillAiComposer('Look at this excerpt from “Custom Instructions”.')

    expect(prefill).toHaveBeenCalledOnce()
    expect((prefill.mock.calls[0][0] as CustomEvent<{ text: string }>).detail.text).toContain(
      'Custom Instructions',
    )
    expect(queued).not.toHaveBeenCalled()
    expect(newChat).not.toHaveBeenCalled()

    window.removeEventListener(AI_COMPOSER_PREFILL_EVENT, prefill)
    window.removeEventListener(AI_PROMPT_QUEUED_EVENT, queued)
    window.removeEventListener(NEW_AI_CHAT_EVENT, newChat)
  })
})
