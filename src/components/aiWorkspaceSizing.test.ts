import { describe, expect, it } from 'vitest'
import { workspaceClassName, workspaceStyle } from './aiWorkspaceSizing'

/**
 * Chat-primary expands the side workspace to own the majority of the shell.
 * It must NOT cover the editor column while doing so — `DESIGN.md` §5:
 * "Conversation owns >=55% width; note split is secondary, never full takeover."
 *
 * Regression: `056cb75` shipped expanded as `absolute inset-0`, which painted
 * the panel over the entire parent. Two Playwright smoke specs
 * (delete-note-nonblocking, save-before-note-switch) started failing because
 * the editor underneath was unreachable — proven by re-running them with
 * `ff_chat_primary_shell=0`, where both pass.
 */
describe('aiWorkspaceSizing — chat-primary must not cover the editor', () => {
  const size = { height: 540, width: 420 }

  it('keeps the expanded side workspace in normal flow, not painted over the shell', () => {
    const className = workspaceClassName('side')

    expect(className).not.toContain('absolute')
    expect(className).not.toContain('inset-0')
    expect(className).toContain('relative')
  })

  it('gives the expanded side workspace a bounded width so the editor keeps the rest', () => {
    const style = workspaceStyle('side', size, true)

    // undefined means "fill whatever the parent gives you" — that is the
    // takeover this guards against.
    expect(style).toBeDefined()
    expect(style?.width).toBeDefined()
  })

  it('leaves the editor a usable share — chat takes the majority, not all of it', () => {
    const width = workspaceStyle('side', size, true)?.width

    expect(typeof width).toBe('string')
    const percent = Number(String(width).replace('%', ''))
    expect(percent).toBeGreaterThanOrEqual(55)
    expect(percent).toBeLessThanOrEqual(75)
  })

  it('still honours the user-resized width when not expanded', () => {
    const style = workspaceStyle('side', size, false)

    expect(style?.width).toBe(420)
  })
})
