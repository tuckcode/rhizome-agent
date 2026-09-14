export const PATH_REDACTION = '[redacted-path]'
export const TOKEN_REDACTION = '[redacted-token]'

const LEADING_TOKEN_WRAPPERS = new Set(['"', "'", '`', '(', '[', '{'])
const SENSITIVE_KEYS = ['token', 'secret', 'password', 'authorization', 'cookie', 'session', 'apikey']
const TOKEN_PREFIXES = [
  'ghp_', 'gho_', 'ghr_', 'ghs_', 'ghu_', 'github_pat_', 'glpat-',
  'sk-', 'sk_live_', 'sk_test_', 'xai-', 'gsk_', 'hf_', 'npm_',
  'xoxa-', 'xoxb-', 'xoxp-', 'xoxr-', 'xoxs-', 'xoxe-',
]
const TRAILING_TOKEN_WRAPPERS = new Set(['"', "'", '`', ')', ']', '}', '.', ',', ';'])
const WHITESPACE = new Set([' ', '\t', '\n', '\r'])
/** Short CSS class names like `sk-circle` are not keys. Real tokens are longer. */
const MIN_CREDENTIAL_BODY_LENGTH = 20
const CREDENTIAL_BODY_CHAR_RE = /[A-Za-z0-9_-]/

interface RedactTextInput {
  redactTokens?: boolean
  text: string
}

interface RedactTokenInput {
  redactTokens: boolean
  token: string
}

interface TextValueInput {
  value: string
}

interface TokenInput {
  token: string
}

interface SegmentInput {
  segment?: string
}

interface TokenParts {
  core: string
  prefix: string
  suffix: string
}

export function redactPathText({ text }: RedactTextInput): string {
  return redactTextSegments({ text })
}

export function sanitizeDiagnosticText({ text }: RedactTextInput): string {
  const withSecrets = redactSensitiveDiagnosticSecrets({ text })
  return collapseWhitespace({
    text: redactTextSegments({ text: withSecrets, redactTokens: true }),
  }).trim()
}

/**
 * Replace credential-shaped tokens only. Preserves whitespace, punctuation,
 * and absolute paths — unlike {@link sanitizeDiagnosticText}, which is for
 * outbound diagnostics and collapses a note into one line.
 */
export function redactCredentialTokens(text: string): { text: string; count: number } {
  let redacted = ''
  let token = ''
  let count = 0
  for (const char of text) {
    if (WHITESPACE.has(char)) {
      const next = replaceCredentialToken(token)
      count += next.count
      redacted += next.token + char
      token = ''
    } else {
      token += char
    }
  }
  const next = replaceCredentialToken(token)
  count += next.count
  return { text: redacted + next.token, count }
}

export function isSensitiveDiagnosticKey({ text }: RedactTextInput): boolean {
  const normalized = normalizeDiagnosticKey({ text })
  return SENSITIVE_KEYS.some((sensitiveKey) => normalized.includes(sensitiveKey))
}

function normalizeDiagnosticKey({ text }: RedactTextInput): string {
  return text.toLowerCase().replace(/[_-]/g, '')
}

function redactSensitiveDiagnosticSecrets({ text }: RedactTextInput): string {
  return redactSensitiveAssignments({
    text: redactSensitiveHeaders({
      text: redactSensitiveUrls({ text }),
    }),
  })
}

function redactSensitiveUrls({ text }: RedactTextInput): string {
  let redacted = ''
  let cursor = 0
  for (const match of text.matchAll(/\bhttps?:\/\/[^\s]+/gi)) {
    const start = match.index ?? 0
    redacted += text.slice(cursor, start)
    redacted += redactOneUrl({ text: match[0] })
    cursor = start + match[0].length
  }
  return redacted + text.slice(cursor)
}

function redactOneUrl({ text }: RedactTextInput): string {
  try {
    const parsed = new URL(text)
    let redacted = text
    if (parsed.username || parsed.password) {
      const userinfo = parsed.password
        ? `${parsed.username}:${parsed.password}@`
        : `${parsed.username}@`
      if (redacted.includes(userinfo)) {
        redacted = redacted.replace(userinfo, `${TOKEN_REDACTION}@`)
      }
    }
    for (const [key, value] of parsed.searchParams.entries()) {
      if (!value || !isSensitiveDiagnosticKey({ text: key })) continue
      const assignment = `${key}=${value}`
      if (redacted.includes(assignment)) {
        redacted = redacted.replace(assignment, `${key}=${TOKEN_REDACTION}`)
      }
    }
    return redacted
  } catch {
    return text
  }
}

function redactSensitiveHeaders({ text }: RedactTextInput): string {
  return text.replace(
    /(^|[\s])((?:Authorization|Cookie)\s*:\s*)(\S.*)/gim,
    (_full, lead: string, prefix: string) => `${lead}${prefix}${TOKEN_REDACTION}`,
  )
}

function redactSensitiveAssignments({ text }: RedactTextInput): string {
  return text.replace(
    /([A-Za-z_][A-Za-z0-9_-]*)(\s*[=:]\s*)(?:Bearer\s+)?(\S+)/g,
    (full, key: string, _sep: string, rawValue: string) => {
      if (!isSensitiveDiagnosticKey({ text: key })) return full
      let suffix = ''
      let value = rawValue
      while (value.length > 0 && TRAILING_TOKEN_WRAPPERS.has(value.at(-1) ?? '')) {
        suffix = `${value.at(-1) ?? ''}${suffix}`
        value = value.slice(0, -1)
      }
      if (!value) return full
      const prefixLength = full.length - rawValue.length
      return `${full.slice(0, prefixLength)}${TOKEN_REDACTION}${suffix}`
    },
  )
}

function redactTextSegments({ text, redactTokens = false }: RedactTextInput): string {
  let redacted = ''
  let token = ''
  for (const char of text) {
    if (WHITESPACE.has(char)) {
      redacted += redactToken({ token, redactTokens }) + char
      token = ''
    } else {
      token += char
    }
  }
  return redacted + redactToken({ token, redactTokens })
}

function redactToken({ token, redactTokens }: RedactTokenInput): string {
  if (!token) return token

  const parts = tokenParts({ token })
  if (isAbsolutePath({ value: parts.core })) return `${parts.prefix}${PATH_REDACTION}${parts.suffix}`
  if (redactTokens) {
    const replaced = replaceCredentialToken(token)
    if (replaced.count > 0) return replaced.token
  }
  return token
}

function replaceCredentialToken(token: string): { token: string; count: number } {
  if (!token) return { token, count: 0 }
  const parts = tokenParts({ token })
  let core = parts.core
  let count = 0
  let searchFrom = 0
  while (searchFrom < core.length) {
    const match = findCredentialSpan(core, searchFrom)
    if (!match) break
    core = `${core.slice(0, match.start)}${TOKEN_REDACTION}${core.slice(match.end)}`
    count += 1
    searchFrom = match.start + TOKEN_REDACTION.length
  }
  if (count === 0) return { token, count: 0 }
  return {
    token: `${parts.prefix}${core}${parts.suffix}`,
    count,
  }
}

function findCredentialSpan(value: string, searchFrom = 0): { start: number; end: number } | null {
  let found: { start: number; end: number } | null = null
  for (const prefix of TOKEN_PREFIXES) {
    let idx = value.indexOf(prefix, searchFrom)
    while (idx !== -1) {
      const bodyStart = idx + prefix.length
      let bodyEnd = bodyStart
      while (bodyEnd < value.length && CREDENTIAL_BODY_CHAR_RE.test(value.charAt(bodyEnd))) {
        bodyEnd += 1
      }
      if (bodyEnd - bodyStart >= MIN_CREDENTIAL_BODY_LENGTH) {
        if (!found || idx < found.start || (idx === found.start && bodyEnd > found.end)) {
          found = { start: idx, end: bodyEnd }
        }
        break
      }
      const nextFrom = idx + 1
      if (nextFrom <= idx) break
      idx = value.indexOf(prefix, nextFrom)
    }
  }
  return found
}

function tokenParts({ token }: TokenInput): TokenParts {
  let start = 0
  let end = token.length
  while (start < end && LEADING_TOKEN_WRAPPERS.has(token.at(start) ?? '')) start += 1
  while (end > start && TRAILING_TOKEN_WRAPPERS.has(token.at(end - 1) ?? '')) end -= 1
  return {
    prefix: token.slice(0, start),
    core: token.slice(start, end),
    suffix: token.slice(end),
  }
}

function isAbsolutePath({ value }: TextValueInput): boolean {
  return isUnixAbsolutePath({ value }) || isWindowsAbsolutePath({ value })
}

function isUnixAbsolutePath({ value }: TextValueInput): boolean {
  return value.startsWith('/') && value.split('/').filter(Boolean).length >= 2
}

function isWindowsAbsolutePath({ value }: TextValueInput): boolean {
  // Backslash form: C:\Users\luca\docs\file.md
  const segments = value.split('\\').filter(Boolean)
  if (segments.length >= 3 && isWindowsDriveSegment({ segment: segments[0] })) return true
  // Forward-slash form: C:/Users/luca/docs/file.md
  const forwardSegments = value.split('/').filter(Boolean)
  return forwardSegments.length >= 3 && isWindowsDriveSegment({ segment: forwardSegments[0] })
}

function isWindowsDriveSegment({ segment }: SegmentInput): boolean {
  const letter = segment?.at(0)
  return segment?.length === 2
    && letter !== undefined
    && letter.toLowerCase() !== letter.toUpperCase()
    && segment.at(1) === ':'
}

function collapseWhitespace({ text }: RedactTextInput): string {
  let collapsed = ''
  let pendingWhitespace = false
  for (const char of text) {
    if (WHITESPACE.has(char)) {
      pendingWhitespace = true
    } else {
      if (pendingWhitespace && collapsed.length > 0) collapsed += ' '
      collapsed += char
      pendingWhitespace = false
    }
  }
  return collapsed
}
