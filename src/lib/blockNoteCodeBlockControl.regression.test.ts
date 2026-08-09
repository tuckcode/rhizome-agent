import { createCodeBlockSpec } from '@blocknote/core'
import { codeBlockOptions } from '@blocknote/code-block'
import { afterEach, describe, expect, it, vi } from 'vitest'

const codeBlockSpec = createCodeBlockSpec({
  ...codeBlockOptions,
  defaultLanguage: 'text',
  supportedLanguages: {
    text: { name: 'Plain Text' },
    typescript: { name: 'TypeScript', aliases: ['ts'] },
  },
})

type CodeBlock = Parameters<typeof codeBlockSpec.implementation.render>[0]
type CodeBlockEditor = Parameters<typeof codeBlockSpec.implementation.render>[1]
type RenderedCodeBlock = ReturnType<typeof codeBlockSpec.implementation.render>

type CodeBlockControlEditor = {
  isEditable: boolean
  getBlock: (id: string) => CodeBlock | undefined
  updateBlock: (id: string, update: { props: { language: string } }) => void
}

type CodeBlockLookup = CodeBlockControlEditor['getBlock']

function createCodeBlock(): CodeBlock {
  return {
    id: 'code-block-1',
    type: 'codeBlock',
    props: { language: 'text' },
    content: [],
    children: [],
  } as CodeBlock
}

function createEditor(getBlock: CodeBlockLookup): CodeBlockControlEditor {
  return {
    isEditable: true,
    getBlock: vi.fn(getBlock),
    updateBlock: vi.fn(),
  }
}

function renderLanguageSelect(editor: CodeBlockControlEditor) {
  const block = createCodeBlock()
  const view = codeBlockSpec.implementation.render(
    block,
    editor as CodeBlockEditor,
  ) as RenderedCodeBlock
  const host = document.createElement('div')
  host.appendChild(view.dom)
  document.body.appendChild(host)

  const select = host.querySelector('select')
  if (!select) throw new Error('Expected code block language select')

  return { block, host, select, view }
}

function dispatchChange(select: HTMLSelectElement) {
  select.dispatchEvent(new window.Event('change'))
}

function expectLanguageChangeIgnored(getBlock: CodeBlockLookup) {
  const editor = createEditor(getBlock)
  const { block, select, view } = renderLanguageSelect(editor)
  select.value = 'typescript'

  expect(() => dispatchChange(select)).not.toThrow()
  expect(editor.getBlock).toHaveBeenCalledWith(block.id)
  expect(editor.updateBlock).not.toHaveBeenCalled()
  view.destroy?.()
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('patched BlockNote code block controls', () => {
  const staleLookupCases: Array<[string, CodeBlockLookup]> = [
    ['when the target code block disappeared', () => undefined],
    ['when BlockNote throws during block lookup', () => {
      throw new Error('Block with ID code-block-1 not found')
    }],
  ]

  it.each(staleLookupCases)('ignores stale language changes %s', (_name, getBlock) => {
    expectLanguageChangeIgnored(getBlock)
  })

  it('keeps live language changes wired to the code block update', () => {
    const existingBlock = createCodeBlock()
    const editor = createEditor(() => existingBlock)

    const { block, select, view } = renderLanguageSelect(editor)
    select.value = 'typescript'
    dispatchChange(select)

    expect(editor.getBlock).toHaveBeenCalledWith(block.id)
    expect(editor.updateBlock).toHaveBeenCalledWith(block.id, {
      props: { language: 'typescript' },
    })
    view.destroy?.()
  })
})
