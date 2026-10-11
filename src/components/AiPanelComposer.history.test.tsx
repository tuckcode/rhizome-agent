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

  it('does not store an Enter that is ignored while a turn runs', () => {
    function ActiveNoSteer() {
      const [input, setInput] = useState('ignored mid-turn')
      return (
        <AiPanelComposer
          entries={[]}
          agentLabel="Prime"
          agentReadiness="ready"
          input={input}
          inputRef={{ current: null }}
          isActive
          onChange={setInput}
          onSend={() => setInput('')}
          onStop={vi.fn()}
        />
      )
    }

    render(<ActiveNoSteer />)
    const editor = screen.getByTestId('agent-input')
    fireEvent.keyDown(editor, { key: 'Enter' })
    expect(editor.textContent ?? '').toBe('')

    fireEvent.keyDown(editor, { key: 'ArrowUp' })
    expect(editor.textContent ?? '').not.toContain('ignored mid-turn')
  })
})
