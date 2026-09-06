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

  it('blocks unrelated chrome so custom menus keep ownership', () => {
    const chrome = document.createElement('button')
    chrome.textContent = 'Sessions'
    document.body.appendChild(chrome)

    expect(shouldAllowNativeContextMenu(chrome)).toBe(false)
    chrome.remove()
  })
})
