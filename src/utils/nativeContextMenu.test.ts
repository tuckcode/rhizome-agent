import { describe, expect, it } from 'vitest'
import { shouldAllowNativeContextMenu } from './nativeContextMenu'

describe('shouldAllowNativeContextMenu', () => {
  it('allows Chat message text so Copy works without keyboard shortcuts', () => {
    const message = document.createElement('div')
    message.setAttribute('data-testid', 'ai-message')
    const span = document.createElement('span')
    span.textContent = 'selected reply'
    message.appendChild(span)
    document.body.appendChild(message)

    expect(shouldAllowNativeContextMenu(span)).toBe(true)
    message.remove()
  })

  it('allows the Chat composer so Paste works on right-click', () => {
    const input = document.createElement('div')
    input.setAttribute('data-testid', 'agent-input')
    document.body.appendChild(input)

    expect(shouldAllowNativeContextMenu(input)).toBe(true)
    input.remove()
  })

  it('allows a marked surface so the note editor can keep Paste and Select All', () => {
    const root = document.createElement('div')
    root.setAttribute('data-allow-native-context-menu', '')
    const child = document.createElement('p')
    child.textContent = 'note body'
    root.appendChild(child)
    document.body.appendChild(root)

    expect(shouldAllowNativeContextMenu(child)).toBe(true)
    root.remove()
  })

  it('allows the assistant reply block so Copy works on selected answer text', () => {
    const block = document.createElement('div')
    block.setAttribute('data-testid', 'ai-response-block')
    const span = document.createElement('span')
    span.textContent = 'selected answer'
    block.appendChild(span)
    document.body.appendChild(block)

    expect(shouldAllowNativeContextMenu(span)).toBe(true)
    block.remove()
  })

  it('allows the latest-reply marker so Copy still works on that strip', () => {
    const marker = document.createElement('div')
    marker.setAttribute('data-testid', 'ai-local-marker')
    document.body.appendChild(marker)

    expect(shouldAllowNativeContextMenu(marker)).toBe(true)
    marker.remove()
  })

  it('blocks unrelated chrome so custom menus keep ownership', () => {
    const chrome = document.createElement('button')
    chrome.textContent = 'Sessions'
    document.body.appendChild(chrome)

    expect(shouldAllowNativeContextMenu(chrome)).toBe(false)
    chrome.remove()
  })
})
