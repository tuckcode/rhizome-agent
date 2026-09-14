import { describe, expect, it } from 'vitest'
import {
  isSensitiveDiagnosticKey,
  redactCredentialTokens,
  sanitizeDiagnosticText,
  TOKEN_REDACTION,
} from './sensitiveTextRedaction'

const GITHUB_PAT = ['ghp', 'A'.repeat(36)].join('_')
const OPENAI_KEY = ['sk', 'proj', 'B'.repeat(40)].join('-')
const SLACK_BOT = ['xoxb', '123456789012', '123456789012', 'C'.repeat(24)].join('-')
const VALID_SK = ['sk', 'A'.repeat(30)].join('-')
const SECOND_SK = ['sk', 'B'.repeat(30)].join('-')
const OPAQUE_MARKER = ['ASTRA_SYNTHETIC', 'Q'.repeat(28)].join('_')

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

  it('redacts a valid-length token after a short prefix in one segment', () => {
    const input = `sk-short,${VALID_SK}`
    const result = redactCredentialTokens(input)
    expect(result.count).toBeGreaterThan(0)
    expect(result.text).toBe(`sk-short,${TOKEN_REDACTION}`)
    expect(result.text).not.toContain(VALID_SK)
  })

  it('skips several invalid prefixes then redacts the first valid one', () => {
    const input = `sk-a,sk-bb,ghp_short,${VALID_SK}`
    const result = redactCredentialTokens(input)
    expect(result.count).toBe(1)
    expect(result.text).toBe(`sk-a,sk-bb,ghp_short,${TOKEN_REDACTION}`)
    expect(result.text).not.toContain(VALID_SK)
  })

  it('redacts multiple valid tokens in one string', () => {
    const result = redactCredentialTokens(`${VALID_SK} then ${SECOND_SK}`)
    expect(result.count).toBe(2)
    expect(result.text).toBe(`${TOKEN_REDACTION} then ${TOKEN_REDACTION}`)
    expect(result.text).not.toContain(VALID_SK)
    expect(result.text).not.toContain(SECOND_SK)
  })

  it('redacts a valid token beside JSON punctuation', () => {
    const result = redactCredentialTokens(`{"k":"${VALID_SK}"}`)
    expect(result.count).toBe(1)
    expect(result.text).toBe(`{"k":"${TOKEN_REDACTION}"}`)
    expect(result.text).not.toContain(VALID_SK)
  })

  it('redacts an xAI-prefixed token', () => {
    const xaiKey = ['xai', 'Z'.repeat(28)].join('-')
    const result = redactCredentialTokens(`provider ${xaiKey}`)
    expect(result.count).toBe(1)
    expect(result.text).toBe(`provider ${TOKEN_REDACTION}`)
    expect(result.text).not.toContain(xaiKey)
  })

  it('redacts Groq and GitHub PAT prefixes', () => {
    const groq = ['gsk', 'H'.repeat(28)].join('_')
    const pat = ['github', 'pat', 'J'.repeat(28)].join('_')
    const result = redactCredentialTokens(`keys ${groq} ${pat}`)
    expect(result.count).toBe(2)
    expect(result.text).toBe(`keys ${TOKEN_REDACTION} ${TOKEN_REDACTION}`)
    expect(result.text).not.toContain(groq)
    expect(result.text).not.toContain(pat)
  })

  it('redacts remaining GitHub, Stripe, and Slack prefixes', () => {
    const tokens = [
      ['gho', 'K'.repeat(28)].join('_'),
      ['ghs', 'L'.repeat(28)].join('_'),
      ['sk', 'live', 'M'.repeat(24)].join('_'),
      ['xoxp', '123456789012', 'N'.repeat(24)].join('-'),
    ]
    const result = redactCredentialTokens(`keys ${tokens.join(' ')}`)
    expect(result.count).toBe(4)
    expect(result.text).toBe(`keys ${TOKEN_REDACTION} ${TOKEN_REDACTION} ${TOKEN_REDACTION} ${TOKEN_REDACTION}`)
    for (const token of tokens) {
      expect(result.text).not.toContain(token)
    }
  })

  it('redacts leftover listed GitHub refresh, user-to-server, and Stripe test prefixes', () => {
    const tokens = [
      ['ghr', 'Q'.repeat(28)].join('_'),
      ['ghu', 'R'.repeat(28)].join('_'),
      ['sk', 'test', 'S'.repeat(24)].join('_'),
    ]
    const result = redactCredentialTokens(`keys ${tokens.join(' ')}`)
    expect(result.count).toBe(3)
    expect(result.text).toBe(`keys ${TOKEN_REDACTION} ${TOKEN_REDACTION} ${TOKEN_REDACTION}`)
    for (const token of tokens) {
      expect(result.text).not.toContain(token)
    }
  })

  it('redacts leftover listed Slack app, restricted, and enterprise prefixes', () => {
    const tokens = [
      ['xoxa', '123456789012', 'T'.repeat(24)].join('-'),
      ['xoxr', '123456789012', 'U'.repeat(24)].join('-'),
      ['xoxs', '123456789012', 'V'.repeat(24)].join('-'),
      ['xoxe', '123456789012', 'W'.repeat(24)].join('-'),
    ]
    const result = redactCredentialTokens(`keys ${tokens.join(' ')}`)
    expect(result.count).toBe(4)
    expect(result.text).toBe(`keys ${TOKEN_REDACTION} ${TOKEN_REDACTION} ${TOKEN_REDACTION} ${TOKEN_REDACTION}`)
    for (const token of tokens) {
      expect(result.text).not.toContain(token)
    }
  })

  it('leaves ordinary prose and short CSS classes unchanged', () => {
    const input = 'The spinner uses sk-circle next to sklearn and a note about tasks.'
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

  it('redacts a valid-length token after a short prefix in one segment', () => {
    const sanitized = sanitizeDiagnosticText({ text: `sk-short,${VALID_SK}` })
    expect(sanitized).toBe(`sk-short,${TOKEN_REDACTION}`)
    expect(sanitized).not.toContain(VALID_SK)
  })

  it('redacts assignment-style diagnostic secrets', () => {
    const passwordLine = sanitizeDiagnosticText({ text: `password=${OPAQUE_MARKER}` })
    const apiKeyLine = sanitizeDiagnosticText({ text: `API_KEY=${OPAQUE_MARKER}` })
    expect(passwordLine).not.toContain(OPAQUE_MARKER)
    expect(apiKeyLine).not.toContain(OPAQUE_MARKER)
    expect(passwordLine).toContain(TOKEN_REDACTION)
    expect(apiKeyLine).toContain(TOKEN_REDACTION)
  })

  it('redacts Authorization bearer text and credential query strings', () => {
    const headerLine = sanitizeDiagnosticText({
      text: `Authorization: Bearer ${OPAQUE_MARKER}`,
    })
    const urlLine = sanitizeDiagnosticText({
      text: `https://service.invalid/?api_key=${OPAQUE_MARKER}`,
    })
    const userinfoLine = sanitizeDiagnosticText({
      text: `https://user:${OPAQUE_MARKER}@service.invalid/path`,
    })
    expect(headerLine).not.toContain(OPAQUE_MARKER)
    expect(urlLine).not.toContain(OPAQUE_MARKER)
    expect(userinfoLine).not.toContain(OPAQUE_MARKER)
    expect(headerLine).toContain(TOKEN_REDACTION)
    expect(urlLine).toContain(TOKEN_REDACTION)
  })
})

describe('isSensitiveDiagnosticKey', () => {
  it('matches api key names across snake, camel, and ENV style', () => {
    expect(isSensitiveDiagnosticKey({ text: 'api_key' })).toBe(true)
    expect(isSensitiveDiagnosticKey({ text: 'apiKey' })).toBe(true)
    expect(isSensitiveDiagnosticKey({ text: 'OPENAI_API_KEY' })).toBe(true)
    expect(isSensitiveDiagnosticKey({ text: 'api-key' })).toBe(true)
    expect(isSensitiveDiagnosticKey({ text: 'apikey' })).toBe(true)
  })

  it('still matches authorization, cookie, and password keys', () => {
    expect(isSensitiveDiagnosticKey({ text: 'Authorization' })).toBe(true)
    expect(isSensitiveDiagnosticKey({ text: 'Cookie' })).toBe(true)
    expect(isSensitiveDiagnosticKey({ text: 'password' })).toBe(true)
  })

  it('leaves ordinary diagnostic field names alone', () => {
    expect(isSensitiveDiagnosticKey({ text: 'buildNumber' })).toBe(false)
    expect(isSensitiveDiagnosticKey({ text: 'releaseChannel' })).toBe(false)
    expect(isSensitiveDiagnosticKey({ text: 'message' })).toBe(false)
  })
})

describe('redactCredentialTokens coverage limit', () => {
  it('stays prefix-only for plain password assignments', () => {
    const result = redactCredentialTokens(`password=${OPAQUE_MARKER}`)
    expect(result.count).toBe(0)
    expect(result.text).toBe(`password=${OPAQUE_MARKER}`)
  })
})
