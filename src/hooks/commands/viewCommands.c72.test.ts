import { describe, expect, it, vi } from 'vitest'
import en from '../../lib/locales/en.json'
import appCommandManifest from '../../shared/appCommandManifest.json'
import { buildViewCommands } from './viewCommands'

describe('C72 view labels', () => {
  it('names ⌘2 Notes with Browse closed, not Chat + Inbox', () => {
    const commands = buildViewCommands({
      hasActiveNote: false,
      activeNoteModified: false,
      onSetViewMode: vi.fn(),
      onToggleInspector: vi.fn(),
      zoomLevel: 1,
      onZoomIn: vi.fn(),
      onZoomOut: vi.fn(),
      onZoomReset: vi.fn(),
      noteListColumnsLabel: 'Customize note list columns',
    })
    const list = commands.find((command) => command.id === 'view-editor-list')
    expect(list?.label).toBe('Notes, Browse closed')
    expect(list?.label).not.toBe('Chat + Inbox')
    expect(list?.keywords).toEqual(expect.arrayContaining(['inbox', 'notes', 'browse']))
  })

  it('names ⌘3 Notes with Browse open, not Chat + Notes', () => {
    const commands = buildViewCommands({
      hasActiveNote: false,
      activeNoteModified: false,
      onSetViewMode: vi.fn(),
      onToggleInspector: vi.fn(),
      zoomLevel: 1,
      onZoomIn: vi.fn(),
      onZoomOut: vi.fn(),
      onZoomReset: vi.fn(),
      noteListColumnsLabel: 'Customize note list columns',
    })
    const all = commands.find((command) => command.id === 'view-all')
    expect(all?.label).toBe('Notes, Browse open')
    expect(all?.label).not.toBe('Chat + Notes')
  })

  it('keeps English palette and View-menu copy on the new name', () => {
    expect(en['command.view.editorNoteList']).toBe('Notes, Browse closed')
    const viewMenu = appCommandManifest.menus.find((menu) => menu.label === 'View')
    const listItem = viewMenu?.items.find(
      (item) => item.kind === 'command' && item.command === 'viewEditorList',
    )
    expect(listItem && 'label' in listItem ? listItem.label : null).toBe(
      'Notes, Browse closed',
    )
    expect(en['command.view.fullLayout']).toBe('Notes, Browse open')
    expect(en['menu.view.allPanels']).toBe('Notes, Browse open')
    const allItem = viewMenu?.items.find(
      (item) => item.kind === 'command' && item.command === 'viewAll',
    )
    expect(allItem && 'label' in allItem ? allItem.label : null).toBe(
      'Notes, Browse open',
    )
  })
})
