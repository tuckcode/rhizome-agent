import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import appCommandManifest from './appCommandManifest.json'

type ManifestCommand = (typeof appCommandManifest.commands)[keyof typeof appCommandManifest.commands]

function commandByKey(key: keyof typeof appCommandManifest.commands): ManifestCommand {
  return appCommandManifest.commands[key]
}

function commandShortcutAccelerator(command: ManifestCommand): string | undefined {
  const accelerator = 'shortcut' in command ? command.shortcut?.accelerator : undefined
  return typeof accelerator === 'string' ? accelerator : undefined
}

function commandsWithAccelerator(accelerator: string): Array<[string, ManifestCommand]> {
  return Object.entries(appCommandManifest.commands).filter(
    ([, command]) => commandShortcutAccelerator(command) === accelerator,
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
  it('maps CmdOrCtrl+1 to Chat (viewEditorOnly)', () => {
    const command = commandByKey('viewEditorOnly')
    expect(command.id).toBe('view-editor-only')
    expect(commandShortcutAccelerator(command)).toBe('CmdOrCtrl+1')
    expect(command.route).toEqual({ kind: 'view-mode', value: 'editor-only' })
    expect(viewMenuLabel('viewEditorOnly')).toBe('Chat')
    expect(commandsWithAccelerator('CmdOrCtrl+1')).toEqual([['viewEditorOnly', command]])
  })

  it('maps CmdOrCtrl+2 to Notes (viewEditorList)', () => {
    const command = commandByKey('viewEditorList')
    expect(command.id).toBe('view-editor-list')
    expect(commandShortcutAccelerator(command)).toBe('CmdOrCtrl+2')
    expect(command.route).toEqual({ kind: 'view-mode', value: 'editor-list' })
    expect(viewMenuLabel('viewEditorList')).toBe('Notes')
    expect(commandsWithAccelerator('CmdOrCtrl+2')).toEqual([['viewEditorList', command]])
  })

  it('maps CmdOrCtrl+3 to Workbench (viewAll)', () => {
    const command = commandByKey('viewAll')
    expect(command.id).toBe('view-all')
    expect(commandShortcutAccelerator(command)).toBe('CmdOrCtrl+3')
    expect(command.route).toEqual({ kind: 'view-mode', value: 'all' })
    expect(viewMenuLabel('viewAll')).toBe('Workbench')
    expect(commandsWithAccelerator('CmdOrCtrl+3')).toEqual([['viewAll', command]])
  })

  it('maps CmdOrCtrl+N to New Note (fileNewNote)', () => {
    const command = commandByKey('fileNewNote')
    expect(command.id).toBe('file-new-note')
    expect(commandShortcutAccelerator(command)).toBe('CmdOrCtrl+N')
    expect(command.route).toEqual({ kind: 'handler', handler: 'onCreateNote' })
    expect(fileMenuLabel('fileNewNote')).toBe('New Note')
    expect(commandsWithAccelerator('CmdOrCtrl+N')).toEqual([['fileNewNote', command]])
  })

  it('gives Views Ctrl+Cmd on Mac and Ctrl+Shift elsewhere, never CmdOrCtrl+Alt', () => {
    const views = ['goResearch', 'goGraph', 'goMycelium', 'goChanges', 'goHistory'] as const
    for (const key of views) {
      const command = commandByKey(key)
      if (!('shortcut' in command) || !command.shortcut) {
        throw new Error(`missing shortcut for ${key}`)
      }
      expect(command.shortcut.combo).toBe('command-and-ctrl')
      expect(command.shortcut.accelerator).toEqual({
        macos: expect.stringMatching(/^Ctrl\+Cmd\+[1-5]$/),
        default: expect.stringMatching(/^Ctrl\+Shift\+[1-5]$/),
      })
    }
    expect(JSON.stringify(appCommandManifest)).not.toContain('CmdOrCtrl+Alt')
  })

  it('keeps Ctrl+Cmd+digit off Chat/Notes and BlockNote heading shortcuts', () => {
    expect(commandShortcutAccelerator(commandByKey('viewEditorOnly'))).toBe('CmdOrCtrl+1')
    expect(commandShortcutAccelerator(commandByKey('viewEditorList'))).toBe('CmdOrCtrl+2')
    expect(commandShortcutAccelerator(commandByKey('viewAll'))).toBe('CmdOrCtrl+3')
    const heading = readFileSync(
      `${process.cwd()}/node_modules/@blocknote/core/src/blocks/Heading/block.ts`,
      'utf8',
    )
    expect(heading).toContain('Mod-Alt-${level}')
    expect(heading).not.toMatch(/Mod-Ctrl|Ctrl-Mod|Mod-Control/)
  })
})
