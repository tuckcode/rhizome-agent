import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createTranslator } from '../lib/i18n'
import { APP_COMMAND_IDS, APP_COMMAND_MENU_SECTIONS, getAppCommandMenuSections } from './appCommandCatalog'

const catalogSource = readFileSync(`${process.cwd()}/src/hooks/appCommandCatalog.ts`, 'utf8')

describe('appCommandCatalog', () => {
  it('keeps the AI panel toggle in the View menu', () => {
    const viewMenu = APP_COMMAND_MENU_SECTIONS.find(section => section.label === 'View')

    expect(viewMenu?.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        commandId: APP_COMMAND_IDS.viewToggleAiChat,
        label: 'Toggle AI Panel',
        menuItemId: APP_COMMAND_IDS.viewToggleAiChat,
      }),
    ]))
  })

  it('keeps Chat + Inbox as a catalog alias for Notes, Browse closed', () => {
    expect(catalogSource).toContain("'Chat + Inbox': 'command.view.editorNoteList'")
    expect(catalogSource).toContain("'Notes, Browse closed': 'command.view.editorNoteList'")

    const viewMenu = getAppCommandMenuSections(createTranslator('en')).find(section => section.label === 'View')
    expect(viewMenu?.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        commandId: APP_COMMAND_IDS.viewEditorList,
        label: 'Notes, Browse closed',
      }),
    ]))
    expect(
      viewMenu?.items.some(item => item.kind === 'command' && item.label === 'Chat + Inbox'),
    ).toBe(false)
  })

  it('keeps Chat + Notes as a catalog alias for Notes, Browse open', () => {
    expect(catalogSource).toContain("'Chat + Notes': 'command.view.fullLayout'")
    expect(catalogSource).toContain("'Notes, Browse open': 'command.view.fullLayout'")

    const viewMenu = getAppCommandMenuSections(createTranslator('en')).find(section => section.label === 'View')
    expect(viewMenu?.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        commandId: APP_COMMAND_IDS.viewAll,
        label: 'Notes, Browse open',
      }),
    ]))
    expect(
      viewMenu?.items.some(item => item.kind === 'command' && item.label === 'Chat + Notes'),
    ).toBe(false)
  })

  it('localizes custom desktop menu labels', () => {
    const viewMenu = getAppCommandMenuSections(createTranslator('zh-CN')).find(section => section.label === '视图')

    expect(viewMenu?.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        commandId: APP_COMMAND_IDS.viewToggleAiChat,
        label: '切换 AI 面板',
        menuItemId: APP_COMMAND_IDS.viewToggleAiChat,
      }),
      expect.objectContaining({
        commandId: APP_COMMAND_IDS.viewZoomReset,
        label: '实际大小',
      }),
    ]))
  })
})
