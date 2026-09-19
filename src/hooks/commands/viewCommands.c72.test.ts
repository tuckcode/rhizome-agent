import { describe, expect, it, vi } from 'vitest'
import appCommandManifest from '../../shared/appCommandManifest.json'
import { buildViewCommands } from './viewCommands'

describe('C72 view labels', () => {
  it('names ⌘1 Chat and ⌘4 Read', () => {
    const commands = buildViewCommands({
      hasActiveNote: false,
      activeNoteModified: false,
      onSetViewMode: vi.fn(),
      onReadLayout: vi.fn(),
      onResetLayout: vi.fn(),
      onToggleInspector: vi.fn(),
      zoomLevel: 1,
      onZoomIn: vi.fn(),
      onZoomOut: vi.fn(),
      onZoomReset: vi.fn(),
      noteListColumnsLabel: 'Customize note list columns',
    })
    expect(commands.find((command) => command.id === 'view-editor')?.label).toBe('Chat')
    expect(commands.find((command) => command.id === 'view-read')?.label).toBe('Read')
    expect(commands.find((command) => command.id === 'view-reset-layout')?.label).toBe('Reset layout')
  })

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
    expect(list?.label).toBe('Notes')
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
    expect(all?.label).toBe('Workbench')
    expect(all?.label).not.toBe('Chat + Notes')
  })

  it('keeps English palette and View-menu copy on the new name', () => {
    const viewMenu = appCommandManifest.menus.find((menu) => menu.label === 'View')
    const listItem = viewMenu?.items.find(
      (item) => item.kind === 'command' && item.command === 'viewEditorList',
    )
    expect(listItem && 'label' in listItem ? listItem.label : null).toBe(
      'Notes',
    )
    const allItem = viewMenu?.items.find(
      (item) => item.kind === 'command' && item.command === 'viewAll',
    )
    expect(allItem && 'label' in allItem ? allItem.label : null).toBe(
      'Workbench',
    )
    const chatItem = viewMenu?.items.find(
      (item) => item.kind === 'command' && item.command === 'viewEditorOnly',
    )
    expect(chatItem && 'label' in chatItem ? chatItem.label : null).toBe('Chat')
    const readItem = viewMenu?.items.find(
      (item) => item.kind === 'command' && item.command === 'viewRead',
    )
    expect(readItem && 'label' in readItem ? readItem.label : null).toBe('Read')
  })
})
