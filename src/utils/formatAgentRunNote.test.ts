import { describe, expect, it } from 'vitest'
import {
  formatAgentRunNote,
  looksLikeAgentRunLog,
  rewriteAgentRunNoteContent,
} from './formatAgentRunNote'

const RAW_RUN = `→ Asking local/rhizome: Grok Wiki Rhizome Vault Analysis

[preparing] starting tools
[tool] Grep
[tool] Grep is running.
[tool] Read README.md
[tool] Read README.md is running.
[spawned] child
[grok-auth] ok

agent: Grok CLI
mode: deep

The vault has three layers. Findings live in research notes.

duration: 2m 10s
`

describe('looksLikeAgentRunLog', () => {
  it('accepts a dump with tool and lifecycle lines', () => {
    expect(looksLikeAgentRunLog(RAW_RUN)).toBe(true)
  })

  it('leaves ordinary notes alone', () => {
    expect(looksLikeAgentRunLog('# Kernel notes\n\nDurable bit.')).toBe(false)
    expect(looksLikeAgentRunLog('See the [tool] in the drawer.')).toBe(false)
  })
})

describe('formatAgentRunNote', () => {
  it('puts the answer first and one row per tool', () => {
    const formatted = formatAgentRunNote(RAW_RUN)
    expect(formatted.rewritten).toBe(true)
    expect(formatted.title).toBe('Grok Wiki Rhizome Vault Analysis')
    expect(formatted.answer).toBe('The vault has three layers. Findings live in research notes.')
    expect(formatted.agent).toBe('Grok CLI')
    expect(formatted.mode).toBe('deep')
    expect(formatted.duration).toBe('2m 10s')
    expect(formatted.tools).toEqual([
      { name: 'Grep', target: '', duration: '', status: 'ok' },
      { name: 'Read', target: 'README.md', duration: '', status: 'ok' },
    ])
    expect(formatted.failedLifecycle).toEqual([])
  })

  it('keeps lifecycle lines only when they failed', () => {
    const formatted = formatAgentRunNote(`${RAW_RUN}\n[grok-auth] failed: token expired\n`)
    expect(formatted.failedLifecycle).toEqual(['[grok-auth] failed: token expired'])
  })

  it('marks a tool failed without a duplicate running row', () => {
    const formatted = formatAgentRunNote(`
[tool] Grep src/lib
[tool] Grep src/lib is running.
[tool] Grep src/lib failed
`)
    expect(formatted.tools).toEqual([
      { name: 'Grep', target: 'src/lib', duration: '', status: 'failed' },
    ])
  })
})

describe('rewriteAgentRunNoteContent', () => {
  it('writes H1, answer, collapsed run log, and frontmatter agent/mode', () => {
    const note = rewriteAgentRunNoteContent(RAW_RUN)
    expect(note).toContain('---\n')
    expect(note).toContain('title: "Grok Wiki Rhizome Vault Analysis"')
    expect(note).toContain('agent: "Grok CLI"')
    expect(note).toContain('mode: "deep"')
    expect(note).toContain('# Grok Wiki Rhizome Vault Analysis')
    expect(note.indexOf('The vault has three layers')).toBeLessThan(note.indexOf('<details>'))
    expect(note).toContain('<summary>Run log · 2 tools · 2m 10s</summary>')
    expect(note).toContain('Grep · — · — · ok')
    expect(note).toContain('Read · README.md · — · ok')
    expect(note).not.toContain('is running.')
    expect(note).not.toContain('[preparing]')
    expect(note).not.toContain('[spawned]')
    const body = note.replace(/^---[\s\S]*?---/, '')
    expect(body).not.toMatch(/^agent:/m)
    expect(body).not.toMatch(/^mode:/m)
    expect(note).toContain('Asked: local/rhizome: Grok Wiki Rhizome Vault Analysis')
  })

  it('merges agent and mode into existing frontmatter', () => {
    const note = rewriteAgentRunNoteContent(`---
type: Note
created: 2026-10-10
---

# Vault analysis

[tool] Grep
[tool] Read

agent: Grok CLI
mode: deep

The answer.
`)
    expect(note).toContain('type: "Note"')
    expect(note).toContain('created: "2026-10-10"')
    expect(note).toContain('agent: "Grok CLI"')
    expect(note).toContain('mode: "deep"')
    expect(note).toContain('# Vault analysis')
    expect(note).toContain('The answer.')
  })

  it('returns ordinary notes unchanged', () => {
    const ordinary = '---\ntype: Note\n---\n\n# Nota longa de teste - gerada 2\n'
    expect(rewriteAgentRunNoteContent(ordinary)).toBe(ordinary)
  })
})
