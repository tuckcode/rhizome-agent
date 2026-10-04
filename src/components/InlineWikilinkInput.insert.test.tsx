import { useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { InlineWikilinkInput } from './InlineWikilinkInput'
import { insertAiComposerText } from '../utils/aiPromptBridge'

function Composer({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial)
  return (
    <InlineWikilinkInput
      entries={[]}
      value={value}
      onChange={setValue}
    />
  )
}

function placeCaret(editor: HTMLElement, offset: number) {
  const text = editor.firstChild
  if (!text) throw new Error('composer has no text')
  const range = document.createRange()
  range.setStart(text, offset)
  range.collapse(true)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
  fireEvent.mouseUp(editor)
}

describe('empty composer caret', () => {
  it('places the caret in the box on click, before any typing', () => {
    render(<Composer initial="" />)
    const editor = screen.getByTestId('agent-input')
    expect(editor.querySelector('br')).toBeTruthy()
    fireEvent.focus(editor)
    const selection = window.getSelection()
    expect(editor.contains(selection?.anchorNode ?? null)).toBe(true)
    expect(selection?.isCollapsed).toBe(true)
  })
})

describe('insertAiComposerText', () => {
  it('inserts at the end when the caret has not moved', () => {
    render(<Composer initial="Hello" />)
    act(() => {
      insertAiComposerText(' there')
    })
    expect(screen.getByTestId('agent-input')).toHaveTextContent('Hello there')
  })

  it('inserts at the caret inside the draft', () => {
    render(<Composer initial="Hello world" />)
    placeCaret(screen.getByTestId('agent-input'), 5)
    act(() => {
      insertAiComposerText(',')
    })
    expect(screen.getByTestId('agent-input')).toHaveTextContent('Hello, world')
  })
})
