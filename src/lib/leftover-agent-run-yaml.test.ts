import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover agent-run YAML and tool count', () => {
  it('matches only unindented YAML keys', () => {
    const ts = readFileSync(`${process.cwd()}/src/utils/formatAgentRunNote.ts`, 'utf8')
    const js = readFileSync(`${process.cwd()}/mcp-server/format-agent-run-note.js`, 'utf8')
    const rs = readFileSync(`${process.cwd()}/src-tauri/src/agent_run_note.rs`, 'utf8')
    expect(ts).toContain('return colon > 0 && line.slice(0, colon) === key')
    expect(js).toContain('return colon > 0 && line.slice(0, colon) === key')
    expect(rs).toContain('.is_some_and(|(name, _)| name == key)')
    expect(ts).not.toContain('.trim() === key')
    expect(js).not.toContain('.trim() === key')
  })

  it('prints 1 tool in the singular', () => {
    const ts = readFileSync(`${process.cwd()}/src/utils/formatAgentRunNote.ts`, 'utf8')
    const js = readFileSync(`${process.cwd()}/mcp-server/format-agent-run-note.js`, 'utf8')
    const rs = readFileSync(`${process.cwd()}/src-tauri/src/agent_run_note.rs`, 'utf8')
    expect(ts).toContain("return n === 1 ? 'tool' : 'tools'")
    expect(js).toContain("return n === 1 ? 'tool' : 'tools'")
    expect(rs).toContain('fn tool_count_label(n: usize) -> &\'static str {')
    expect(rs).toContain('if n == 1 {')
    expect(rs).toContain('"tool"')
  })
})
