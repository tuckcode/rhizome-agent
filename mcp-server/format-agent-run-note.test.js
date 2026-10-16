import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { looksLikeAgentRunLog, rewriteAgentRunNoteContent } from './format-agent-run-note.js'

describe('format-agent-run-note', () => {
  it('does not treat two quoted [tool] lines as a run log', () => {
    const quoted = [
      '# Research',
      '',
      'The dump said "[tool] Grep is running."',
      'and "[tool] Read is running."',
    ].join('\n')
    assert.equal(looksLikeAgentRunLog(quoted), false)
    assert.equal(rewriteAgentRunNoteContent(quoted), quoted)
  })

  it('keeps task items, link lines, extra headings, and fenced lines', () => {
    const note = rewriteAgentRunNoteContent(`---
type: Note
---

# Vault analysis

[preparing] start
[tool] Grep
[tool] Grep is running.

## Methods

- [ ] Check the inbox
- [x] Open [[Kernel]]

[Docs](https://example.com/docs)

\`\`\`
[tool] Fake is running.
console.log("inside")
\`\`\`

# Extra heading

The answer.

agent: Grok CLI
mode: deep
`)
    assert.match(note, /- \[ \] Check the inbox/)
    assert.match(note, /\[Docs\]\(https:\/\/example.com\/docs\)/)
    assert.match(note, /# Extra heading/)
    assert.match(note, /\[tool\] Fake is running\./)
    assert.match(note, /<summary>Run log · 1 tool/)
  })

  it('does not duplicate an existing agent or mode field', () => {
    const note = rewriteAgentRunNoteContent(`---
type: Note
agent: Grok CLI
mode: deep
---

# Vault analysis

[preparing] start
[tool] Grep
[tool] Grep is running.

The answer.
`)
    assert.equal(note.match(/^agent:/gm)?.length, 1)
    assert.equal(note.match(/^mode:/gm)?.length, 1)
    assert.match(note, /^agent: Grok CLI$/m)
    assert.doesNotMatch(note, /agent: "Grok CLI"/)
  })

  it('does not treat an indented agent field as a top-level key', () => {
    const note = rewriteAgentRunNoteContent(`---
type: Note
meta:
  agent: nested
---

# Vault analysis

[preparing] start
[tool] Grep
[tool] Grep is running.

The answer.

agent: Grok CLI
mode: deep
`)
    assert.match(note, /^ {2}agent: nested$/m)
    assert.match(note, /^agent: "Grok CLI"$/m)
  })

  it('keeps one-per-line tag lists and inline YAML lists', () => {
    const note = rewriteAgentRunNoteContent(`---
type: Note
tags:
  - research
  - vault
related: [a, b]
---

# Vault analysis

[preparing] start
[tool] Grep
[tool] Grep is running.

The answer.

agent: Grok CLI
mode: deep
`)
    assert.match(note, /tags:\n  - research\n  - vault/)
    assert.match(note, /related: \[a, b\]/)
    assert.doesNotMatch(note, /related: "\[a, b\]"/)
  })
})
