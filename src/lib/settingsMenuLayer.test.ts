import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  SETTINGS_MENU_Z_CLASS,
  SETTINGS_MENU_Z_INDEX,
  SETTINGS_NESTED_MENU_Z_CLASS,
  SETTINGS_NESTED_MENU_Z_INDEX,
} from './settingsMenuLayer'

const PICKER = readFileSync(`${process.cwd()}/src/components/NativeChatModelPicker.tsx`, 'utf8')
const SELECT = readFileSync(`${process.cwd()}/src/components/ui/select.tsx`, 'utf8')
const CALENDAR = readFileSync(`${process.cwd()}/src/components/ui/calendar.tsx`, 'utf8')
const GIT = readFileSync(`${process.cwd()}/src/components/GitRepositorySelect.tsx`, 'utf8')

describe('settings menu z-index', () => {
  it('exposes one shared pair of overlay layers', () => {
    expect(SETTINGS_MENU_Z_INDEX).toBe(12000)
    expect(SETTINGS_MENU_Z_CLASS).toBe('z-[12000]')
    expect(SETTINGS_NESTED_MENU_Z_INDEX).toBe(13000)
    expect(SETTINGS_NESTED_MENU_Z_CLASS).toBe('z-[13000]')
  })

  it('uses the shared class on the Settings model menu', () => {
    expect(PICKER).toContain('SETTINGS_MENU_Z_CLASS')
    expect(PICKER).not.toContain("'z-[12000]'")
    expect(PICKER).not.toContain('"z-[12000]"')
  })

  it('uses the nested class where 13000 used to be hardcoded', () => {
    expect(SELECT).toContain('SETTINGS_MENU_Z_CLASS')
    expect(CALENDAR).toContain('SETTINGS_NESTED_MENU_Z_CLASS')
    expect(GIT).toContain('SETTINGS_NESTED_MENU_Z_CLASS')
    expect(SELECT).not.toContain('z-[12000]')
    expect(CALENDAR).not.toContain('z-[13000]')
    expect(GIT).not.toContain('z-[13000]')
  })
})
