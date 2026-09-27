import { BlockNoteEditor } from '@blocknote/core'
import type { EditorView } from '@tiptap/pm/view'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { schema } from '../components/editorSchema'
import { RICH_EDITOR_LINK_OPTIONS } from '../components/richEditorLinkOptions'

type ClickHandler = (view: EditorView, pos: number, event: MouseEvent) => boolean

function mountEditorWithLink() {
  const editor = BlockNoteEditor.create({ schema, links: RICH_EDITOR_LINK_OPTIONS })
  const host = document.createElement('div')
  document.body.append(host)
  editor.mount(host)
  editor.replaceBlocks(editor.document, [
    { type: 'paragraph', content: [{ type: 'link', href: 'https://example.com', content: 'example' }] },
  ])
  return { editor, host }
}

function linkClickHandler(view: EditorView): ClickHandler {
  const plugin = view.state.plugins.find((candidate) =>
    (candidate as unknown as { key: string }).key.startsWith('handleClickLink'),
  )
  return plugin!.props.handleClick as ClickHandler
}

function leftClickOn(target: HTMLElement): MouseEvent {
  const event = new MouseEvent('click', { button: 0 })
  Object.defineProperty(event, 'target', { value: target })
  return event
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('BlockNote link click handling', () => {
  // BlockNote 0.55 replaced the Tiptap openOnClick switch with links.onClick.
  // useEditorLinkActivation opens links through the guarded native opener.
  it('never opens an editor link with window.open', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const { editor, host } = mountEditorWithLink()
    const anchor = host.querySelector<HTMLAnchorElement>('a[data-inline-content-type="link"]')
    expect(anchor).not.toBeNull()

    const view = editor.prosemirrorView!
    const handled = linkClickHandler(view)(view, 1, leftClickOn(anchor!))

    expect(handled).toBe(false)
    expect(open).not.toHaveBeenCalled()
    editor._tiptapEditor.destroy()
  })
})
