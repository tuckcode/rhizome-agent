import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { requireAuditOpener, UI_AUDIT_SCREENS } from './uiAuditScreens'

describe('requireAuditOpener', () => {
  it('throws when the opener is missing, instead of letting the spec continue', () => {
    expect(() => requireAuditOpener(false, 'changes')).toThrow(
      /cannot find the control that opens "changes"/,
    )
    expect(() => requireAuditOpener(false, 'changes')).toThrow(/Do not skip/)
  })

  it('lets a found opener through', () => {
    expect(() => requireAuditOpener(true, 'research')).not.toThrow()
  })
})

describe('UI_AUDIT_SCREENS', () => {
  it('walks the current top-level destinations, not the old Changes rail button', () => {
    expect(UI_AUDIT_SCREENS.map((screen) => screen.name)).toEqual([
      'chat',
      'research',
    ])
    expect(UI_AUDIT_SCREENS.some((screen) => screen.name === 'changes')).toBe(false)
    expect(UI_AUDIT_SCREENS.find((screen) => screen.name === 'research')?.command).toBe(
      'Open Research',
    )
  })
})

describe('ui-audit spec', () => {
  const spec = readFileSync(`${process.cwd()}/tests/smoke/ui-audit.spec.ts`, 'utf8')

  it('does not skip a missing opener and audit Chat instead', () => {
    expect(spec).not.toContain('if (await rail.count())')
    expect(spec).toContain('requireAuditOpener')
    expect(spec).not.toMatch(/buttonName:\s*'Changes'/)
  })
})
