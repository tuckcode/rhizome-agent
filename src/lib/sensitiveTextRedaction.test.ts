import { describe, expect, it } from 'vitest'
import {
  redactCredentialTokens,
  sanitizeDiagnosticText,
  TOKEN_REDACTION,
} from './sensitiveTextRedaction'

const GITHUB_PAT = ['ghp', 'A'.repeat(36)].join('_')
const OPENAI_KEY = ['sk', 'proj', 'B'.repeat(40)].join('-')
const SLACK_BOT = ['xoxb', '123456789012', '123456789012', 'C'.repeat(24)].join('-')

describe('redactCredentialTokens', () => {
  it('replaces GitHub, OpenAI, and Slack tokens and returns the count', () => {
    const input = `token ${GITHUB_PAT} then ${OPENAI_KEY}\nand ${SLACK_BOT}`
    const result = redactCredentialTokens(input)
    expect(result.count).toBe(3)
    expect(result.text).toBe(`token ${TOKEN_REDACTION} then ${TOKEN_REDACTION}\nand ${TOKEN_REDACTION}`)
    expect(result.text).not.toContain(GITHUB_PAT)
    expect(result.text).not.toContain(OPENAI_KEY)
    expect(result.text).not.toContain(SLACK_BOT)
  })

  it('redacts Hugging Face, GitLab, and npm tokens', () => {
    const hf = ['hf', 'D'.repeat(32)].join('_')
    const gitlab = ['glpat', 'E'.repeat(24)].join('-')
    const npm = ['npm', 'F'.repeat(36)].join('_')
    const result = redactCredentialTokens(`keys ${hf} ${gitlab} ${npm}`)
    expect(result.count).toBe(3)
    expect(result.text).not.toContain(hf)
    expect(result.text).not.toContain(gitlab)
    expect(result.text).not.toContain(npm)
  })

  it('preserves whitespace, markdown, and absolute paths', () => {
    const input = `See /Users/luca/vault/note.md\n\n  keep  indent`
    const result = redactCredentialTokens(input)
    expect(result.count).toBe(0)
    expect(result.text).toBe(input)
  })

  it('does not treat SpinKit class names as OpenAI keys', () => {
    const input = 'sk-circle sk-child sk-wandering-cubes sk-fading-circle'
    const result = redactCredentialTokens(input)
    expect(result.count).toBe(0)
    expect(result.text).toBe(input)
  })

  it('redacts a quoted assignment without eating the surrounding syntax', () => {
    const result = redactCredentialTokens(`export TOKEN="${GITHUB_PAT}"`)
    expect(result.count).toBe(1)
    expect(result.text).toBe(`export TOKEN="${TOKEN_REDACTION}"`)
  })

  it('leaves short ghp_ fragments and ordinary prose alone', () => {
    const input = 'Please ask-to-Tasks, then ghp_short and sklearn.'
    const result = redactCredentialTokens(input)
    expect(result.count).toBe(0)
    expect(result.text).toBe(input)
  })
})

describe('sanitizeDiagnosticText', () => {
  it('still redacts paths and tokens and collapses whitespace', () => {
    const input = `Load failed for /Users/luca/Laputa/private.md\nwith token ${GITHUB_PAT}`
    expect(sanitizeDiagnosticText({ text: input })).toBe(
      `Load failed for [redacted-path] with token ${TOKEN_REDACTION}`,
    )
  })
})
