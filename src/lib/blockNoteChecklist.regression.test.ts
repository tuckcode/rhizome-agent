import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCheckListItemBlockSpec } from '../../node_modules/@blocknote/core/src/blocks/ListItem/CheckListItem/block'

const checkListItemSpec = createCheckListItemBlockSpec()

type CheckListItemBlock = Parameters<typeof checkListItemSpec.implementation.render>[0]
type CheckListItemEditor = Parameters<typeof checkListItemSpec.implementation.render>[1]
type RenderedCheckListItem = ReturnType<typeof checkListItemSpec.implementation.render>

type CheckListItemControlEditor = {
  getBlock: (id: string) => CheckListItemBlock | undefined
  updateBlock: (block: CheckListItemBlock, update: { props: { checked: boolean } }) => void
}

type CheckListItemLookup = CheckListItemControlEditor['getBlock']

function createCheckListItem(checked = false): CheckListItemBlock {
  return {
    id: 'check-list-item-1',
    type: 'checkListItem',
    props: { checked },
    content: [],
    children: [],
  } as CheckListItemBlock
}

function createEditor(getBlock: CheckListItemLookup): CheckListItemControlEditor {
  return {
    getBlock: vi.fn(getBlock),
    updateBlock: vi.fn(),
  }
}

function renderCheckListItem(editor: CheckListItemControlEditor, checked = false) {
  const block = createCheckListItem(checked)
  const view = checkListItemSpec.implementation.render(
    block,
    editor as CheckListItemEditor,
  ) as RenderedCheckListItem
  const host = document.createElement('div')
  host.appendChild(view.dom)
  document.body.appendChild(host)

  const checkbox = host.querySelector('input[type="checkbox"]')
  if (!(checkbox instanceof HTMLInputElement)) throw new Error('Expected checklist checkbox')

  return { block, checkbox, host, view }
}

function dispatchChange(checkbox: HTMLInputElement) {
  checkbox.dispatchEvent(new window.Event('change'))
}

function expectCheckboxChangeIgnored(getBlock: CheckListItemLookup) {
  const editor = createEditor(getBlock)
  const { block, checkbox, view } = renderCheckListItem(editor)
  checkbox.checked = true

  expect(() => dispatchChange(checkbox)).not.toThrow()
  expect(editor.getBlock).toHaveBeenCalledWith(block.id)
  expect(editor.updateBlock).not.toHaveBeenCalled()
  view.destroy?.()
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('patched BlockNote checklist controls', () => {
  const staleLookupCases: Array<[string, CheckListItemLookup]> = [
    ['when the target checklist block disappeared', () => undefined],
    ['when BlockNote throws during block lookup', () => {
      throw new Error('Block with ID check-list-item-1 not found')
    }],
  ]

  it.each(staleLookupCases)('ignores stale checkbox changes %s', (_name, getBlock) => {
    expectCheckboxChangeIgnored(getBlock)
  })

  it('applies live checkbox changes to the current checklist block', () => {
    const existingBlock = createCheckListItem()
    const editor = createEditor(() => existingBlock)

    const { block, checkbox, view } = renderCheckListItem(editor)
    checkbox.checked = true
    dispatchChange(checkbox)

    expect(editor.getBlock).toHaveBeenCalledWith(block.id)
    expect(editor.updateBlock).toHaveBeenCalledWith(existingBlock, {
      props: { checked: true },
    })
    view.destroy?.()
  })
})
