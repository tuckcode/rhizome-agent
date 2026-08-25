export const PATH_REDACTION = '[redacted-path]'
export const TOKEN_REDACTION = '[redacted-token]'

const LEADING_TOKEN_WRAPPERS = new Set(['"', "'", '`', '(', '[', '{'])
const SENSITIVE_KEYS = ['token', 'secret', 'password', 'authorization', 'cookie', 'session']
const TOKEN_PREFIXES = ['ghp_', 'gho_', 'ghr_', 'ghs_', 'ghu_', 'github_pat_', 'sk-', 'xoxa-', 'xoxb-', 'xoxp-', 'xoxr-', 'xoxs-']
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
  return collapseWhitespace({ text: redactTextSegments({ text, redactTokens: true }) }).trim()
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
  const lowerText = text.toLowerCase()
  return SENSITIVE_KEYS.some((sensitiveKey) => lowerText.includes(sensitiveKey))
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
  if (redactTokens && isTokenLike({ value: parts.core })) return `${parts.prefix}${TOKEN_REDACTION}${parts.suffix}`
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
    const idx = value.indexOf(prefix, searchFrom)
    if (idx === -1) continue
    const bodyStart = idx + prefix.length
    let bodyEnd = bodyStart
    while (bodyEnd < value.length && CREDENTIAL_BODY_CHAR_RE.test(value.charAt(bodyEnd))) {
      bodyEnd += 1
    }
    if (bodyEnd - bodyStart < MIN_CREDENTIAL_BODY_LENGTH) continue
    if (!found || idx < found.start || (idx === found.start && bodyEnd > found.end)) {
      found = { start: idx, end: bodyEnd }
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

function isTokenLike({ value }: TextValueInput): boolean {
  return findCredentialSpan(value) !== null
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
