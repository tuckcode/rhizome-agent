import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { AiPanelComposer } from './AiPanelChrome'

/**
 * C71 UI smoke: empty-box Up recalls the last send.
 * Walk/restore/mid-line rules are unit-tested in `composerPromptHistory.test.ts`
 * (contenteditable selection sync is too flaky for a second ArrowUp here).
 */
function ControlledComposer({ initial = 'first prompt' }: { initial?: string }) {
  const [input, setInput] = useState(initial)
  return (
    <AiPanelComposer
      entries={[]}
      agentLabel="Prime"
      agentReadiness="ready"
      input={input}
      inputRef={{ current: null }}
      isActive={false}
      onChange={setInput}
      onSend={() => setInput('')}
      onStop={vi.fn()}
    />
  )
}

describe('AiPanelComposer prompt history (C71)', () => {
  it('ArrowUp on an empty box recalls the last sent prompt', () => {
    render(<ControlledComposer />)
    fireEvent.click(screen.getByTestId('agent-send'))

    const editor = screen.getByTestId('agent-input')
    expect(editor.textContent ?? '').toBe('')

    fireEvent.keyDown(editor, { key: 'ArrowUp' })
    expect(editor.textContent).toContain('first prompt')
  })
})
