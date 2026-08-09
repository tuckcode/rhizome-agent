import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { shouldStripAutoLinkedLocalFileMarkMock } = vi.hoisted(() => ({
  shouldStripAutoLinkedLocalFileMarkMock: vi.fn(),
}))

vi.mock('../utils/editorLinkAutolink', () => ({
  shouldStripAutoLinkedLocalFileMark: shouldStripAutoLinkedLocalFileMarkMock,
}))

import { useFilenameAutolinkGuard } from './useFilenameAutolinkGuard'

function Harness({ editor }: { editor: unknown }) {
  useFilenameAutolinkGuard(editor as never)
  return null
}

function createEditor({
  nodes = [],
  docChanged = true,
  withEvents = true,
  withLinkMark = true,
}: {
  nodes?: Array<{ node: unknown; pos: number }>
  docChanged?: boolean
  withEvents?: boolean
  withLinkMark?: boolean
}) {
  let updateHandler:
    | ((payload: { transaction: { docChanged?: boolean; getMeta: (key: string) => unknown } }) => void)
    | undefined

  const removeMark = vi.fn()
  const setMeta = vi.fn()
  const dispatch = vi.fn()
  const descendants = vi.fn((callback: (node: unknown, pos: number) => void) => {
    for (const entry of nodes) {
      callback(entry.node, entry.pos)
    }
  })

  const tiptap = {
    schema: {
      marks: {
        ...(withLinkMark ? { link: 'link-mark' } : {}),
      },
    },
    state: {
      doc: { descendants },
      tr: {
        docChanged,
        removeMark,
        setMeta,
      },
    },
    ...(withEvents
      ? {
          on: vi.fn((event: string, handler: typeof updateHandler) => {
            if (event === 'update') {
              updateHandler = handler
            }
          }),
          off: vi.fn(),
        }
      : {}),
    view: {
      dispatch,
    },
  }

  return {
    editor: {
      _tiptapEditor: tiptap,
    },
    tiptap,
    descendants,
    removeMark,
    setMeta,
    dispatch,
    getUpdateHandler: () => updateHandler,
  }
}

describe('useFilenameAutolinkGuard extra coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not subscribe when the editor lacks an event API', () => {
    const fixture = createEditor({ withEvents: false })

    render(<Harness editor={fixture.editor} />)

    expect('on' in fixture.tiptap).toBe(false)
    expect(fixture.descendants).not.toHaveBeenCalled()
  })

  it('skips traversal when the editor has no link mark registered', () => {
    const fixture = createEditor({ withLinkMark: false })

    render(<Harness editor={fixture.editor} />)
    fixture.getUpdateHandler()?.({
      transaction: {
        docChanged: true,
        getMeta: vi.fn(() => undefined),
      },
    })

    expect(fixture.descendants).not.toHaveBeenCalled()
    expect(fixture.dispatch).not.toHaveBeenCalled()
  })

  it('ignores text nodes whose marks are not accidental filename links', () => {
    shouldStripAutoLinkedLocalFileMarkMock.mockReturnValue(false)
    const fixture = createEditor({
      nodes: [
        {
          node: {
            isText: true,
            nodeSize: 8,
            text: 'draft.md',
            marks: [{ type: 'link-mark', attrs: { href: 'draft.md' } }],
          },
          pos: 5,
        },
        {
          node: {
            isText: true,
            nodeSize: 6,
            text: 'notes',
            marks: [{ type: 'other-mark', attrs: { href: 'notes' } }],
          },
          pos: 20,
        },
        {
          node: {
            isText: false,
            nodeSize: 3,
            text: null,
            marks: [],
          },
          pos: 40,
        },
      ],
    })

    render(<Harness editor={fixture.editor} />)
    fixture.getUpdateHandler()?.({
      transaction: {
        docChanged: true,
        getMeta: vi.fn(() => undefined),
      },
    })

    expect(shouldStripAutoLinkedLocalFileMarkMock).toHaveBeenCalledWith({
      href: { raw: 'draft.md' },
      text: { raw: 'draft.md' },
    })
    expect(fixture.removeMark).not.toHaveBeenCalled()
    expect(fixture.dispatch).not.toHaveBeenCalled()
  })
})
