import { BlockNoteEditor } from '@blocknote/core'
import { BlockNoteViewRaw } from '@blocknote/react'
import { render } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { schema } from './editorSchema'
import {
  richEditorClipboardPayload,
  selectedEditorDomHtml,
  selectedEditorPlainText,
  writeRichEditorClipboardPayload,
} from './editorRichCopy'

function createMountedEditor() {
  const mount = globalThis.document.createElement('div')
  globalThis.document.body.appendChild(mount)
  const editor = BlockNoteEditor.create({
    initialContent: [
      {
        type: 'table',
        content: {
          type: 'tableContent',
          rows: [
            { cells: ['Name', 'Status'] },
            { cells: ['Copy', 'Rich'] },
          ],
        },
      },
      {
        type: 'bulletListItem',
        content: [
          {
            type: 'text',
            text: 'Bold bullet',
            styles: { bold: true },
          },
        ],
      },
    ],
  })
  editor.mount(mount)

  return {
    editor,
    cleanup: () => {
      editor.unmount()
      mount.remove()
    },
  }
}

describe('richEditorClipboardPayload', () => {
  it('keeps single and multi wikilink targets in copied markdown', () => {
    const editor = BlockNoteEditor.create({
      schema,
      initialContent: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'See ', styles: {} },
          { type: 'wikilink', props: { target: 'Project Alpha' } },
          { type: 'text', text: ' and ', styles: {} },
          { type: 'wikilink', props: { target: 'team/Beta|Beta Team' } },
        ],
      }],
    })
    // BlockNote 0.55 renders React inline content (wikilinks) through the
    // view's element renderer, so mount the editor the way the app does.
    const view = render(createElement(BlockNoteViewRaw, { editor: editor as never }))

    try {
      editor._tiptapEditor.commands.selectAll()

      const payload = richEditorClipboardPayload(editor)

      expect(payload?.markdown).toContain('[[Project Alpha]]')
      expect(payload?.markdown).toContain('[[team/Beta|Beta Team]]')
    } finally {
      view.unmount()
    }
  })

  it('writes plain markdown clipboard data for wikilink selections', () => {
    const clipboardData = { setData: vi.fn() }

    writeRichEditorClipboardPayload(clipboardData, {
      blocknoteHtml: '<p>See Alpha</p>',
      html: '<p>See Alpha</p>',
      markdown: 'See [[Project Alpha]] & <done>\n',
    })

    expect(clipboardData.setData).not.toHaveBeenCalledWith('blocknote/html', '<p>See Alpha</p>')
    expect(clipboardData.setData).toHaveBeenCalledWith('text/plain', 'See [[Project Alpha]] & <done>')
    expect(clipboardData.setData).toHaveBeenCalledWith('text/markdown', 'See [[Project Alpha]] & <done>\n')
    expect(clipboardData.setData).toHaveBeenCalledWith(
      'text/html',
      '<p>See [[Project Alpha]] &amp; &lt;done&gt;</p>',
    )

    const richClipboardData = { setData: vi.fn() }
    writeRichEditorClipboardPayload(richClipboardData, {
      blocknoteHtml: '<strong>Bold copy</strong>',
      html: '<strong>Bold copy</strong>',
      markdown: '**Bold copy**\n',
    })

    expect(richClipboardData.setData).toHaveBeenCalledWith('blocknote/html', '<strong>Bold copy</strong>')
    expect(richClipboardData.setData).toHaveBeenCalledWith('text/html', '<strong>Bold copy</strong>')
    expect(richClipboardData.setData).not.toHaveBeenCalledWith('text/markdown', '**Bold copy**\n')
  })

  it('writes wikilink markdown as plain text for normal paste targets', () => {
    const clipboardData = { setData: vi.fn() }

    writeRichEditorClipboardPayload(clipboardData, {
      blocknoteHtml: '<p><span class="wikilink" data-target="file-name">File Name</span></p>',
      html: '<p><span class="wikilink" data-target="file-name">File Name</span></p>',
      markdown: '[[file-name]]\n',
    })

    expect(clipboardData.setData).toHaveBeenCalledWith('text/plain', '[[file-name]]')
  })

  it('restores DOM wikilinks when editor markdown payload is unavailable', () => {
    const paragraph = globalThis.document.createElement('p')
    paragraph.append('See ')
    const wikilink = globalThis.document.createElement('span')
    wikilink.setAttribute('data-inline-content-type', 'wikilink')
    wikilink.setAttribute('data-target', 'file-name')
    wikilink.textContent = 'File Name'
    paragraph.appendChild(wikilink)
    globalThis.document.body.appendChild(paragraph)

    try {
      const range = globalThis.document.createRange()
      range.selectNodeContents(paragraph)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)

      expect(selectedEditorPlainText(selection as Selection, range)).toBe('See [[file-name]]')
      expect(selectedEditorDomHtml(range)).toBe('<p>See [[file-name]]</p>')
    } finally {
      window.getSelection()?.removeAllRanges()
      paragraph.remove()
    }
  })

  it('preserves semantic table and list markup from a mounted BlockNote selection', () => {
    const { cleanup, editor } = createMountedEditor()

    try {
      editor._tiptapEditor.commands.selectAll()

      const payload = richEditorClipboardPayload(editor)

      expect(payload?.html).toContain('<table>')
      expect(payload?.html).toContain('<tr>')
      expect(payload?.html).toContain('<td ')
      expect(payload?.html).toContain('<ul>')
      expect(payload?.html).toContain('<li>')
      expect(payload?.html).toContain('<strong>Bold bullet</strong>')
      expect(payload?.blocknoteHtml).toContain('data-content-type="bulletListItem"')
    } finally {
      cleanup()
    }
  })

  it('skips empty selections so callers can fall back to DOM cloning', () => {
    const { cleanup, editor } = createMountedEditor()

    try {
      expect(richEditorClipboardPayload(editor)).toBeNull()
    } finally {
      cleanup()
    }
  })
})
