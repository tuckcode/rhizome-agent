import { describe, expect, it } from 'vitest'
import appCommandManifest from './appCommandManifest.json'

type ManifestCommand = (typeof appCommandManifest.commands)[keyof typeof appCommandManifest.commands]

function commandByKey(key: keyof typeof appCommandManifest.commands): ManifestCommand {
  return appCommandManifest.commands[key]
}

function commandsWithAccelerator(accelerator: string): Array<[string, ManifestCommand]> {
  return Object.entries(appCommandManifest.commands).filter(
    ([, command]) => command.shortcut?.accelerator === accelerator,
  )
}

function viewMenuLabel(commandKey: keyof typeof appCommandManifest.commands): string | null {
  const viewMenu = appCommandManifest.menus.find((menu) => menu.label === 'View')
  const item = viewMenu?.items.find(
    (entry) => entry.kind === 'command' && entry.command === commandKey,
  )
  return item && 'label' in item ? String(item.label) : null
}

function fileMenuLabel(commandKey: keyof typeof appCommandManifest.commands): string | null {
  const fileMenu = appCommandManifest.menus.find((menu) => menu.label === 'File')
  const item = fileMenu?.items.find(
    (entry) => entry.kind === 'command' && entry.command === commandKey,
  )
  return item && 'label' in item ? String(item.label) : null
}

describe('appCommandManifest leftover shortcuts', () => {
  it('maps CmdOrCtrl+1 to Chat only (viewEditorOnly)', () => {
    const command = commandByKey('viewEditorOnly')
    expect(command.id).toBe('view-editor-only')
    expect(command.shortcut?.accelerator).toBe('CmdOrCtrl+1')
    expect(command.route).toEqual({ kind: 'view-mode', value: 'editor-only' })
    expect(viewMenuLabel('viewEditorOnly')).toBe('Chat only')
    expect(commandsWithAccelerator('CmdOrCtrl+1')).toEqual([['viewEditorOnly', command]])
  })

  it('maps CmdOrCtrl+2 to Notes, Browse closed (viewEditorList)', () => {
    const command = commandByKey('viewEditorList')
    expect(command.id).toBe('view-editor-list')
    expect(command.shortcut?.accelerator).toBe('CmdOrCtrl+2')
    expect(command.route).toEqual({ kind: 'view-mode', value: 'editor-list' })
    expect(viewMenuLabel('viewEditorList')).toBe('Notes, Browse closed')
    expect(commandsWithAccelerator('CmdOrCtrl+2')).toEqual([['viewEditorList', command]])
  })

  it('maps CmdOrCtrl+3 to Notes, Browse open (viewAll)', () => {
    const command = commandByKey('viewAll')
    expect(command.id).toBe('view-all')
    expect(command.shortcut?.accelerator).toBe('CmdOrCtrl+3')
    expect(command.route).toEqual({ kind: 'view-mode', value: 'all' })
    expect(viewMenuLabel('viewAll')).toBe('Notes, Browse open')
    expect(commandsWithAccelerator('CmdOrCtrl+3')).toEqual([['viewAll', command]])
  })

  it('maps CmdOrCtrl+N to New Note (fileNewNote)', () => {
    const command = commandByKey('fileNewNote')
    expect(command.id).toBe('file-new-note')
    expect(command.shortcut?.accelerator).toBe('CmdOrCtrl+N')
    expect(command.route).toEqual({ kind: 'handler', handler: 'onCreateNote' })
    expect(fileMenuLabel('fileNewNote')).toBe('New Note')
    expect(commandsWithAccelerator('CmdOrCtrl+N')).toEqual([['fileNewNote', command]])
  })
})
