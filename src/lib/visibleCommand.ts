export type VisibleCommandPart =
  | { kind: 'text'; text: string }
  | { kind: 'newline' }
  | { kind: 'hidden'; hex: string }

const HIDDEN_CATEGORY = /\p{Cf}|\p{Cc}|\p{Zl}|\p{Zp}/u
const EXTRA_HIDDEN = new Set([
  0x061C,
  0x180E,
  0x115F,
  0x1160,
  0x3164,
  0xFFA0,
])

export function commandHasHiddenChars(command: string): boolean {
  return visibleCommandParts(command).some((part) => part.kind === 'hidden')
}

export function visibleCommandParts(command: string): VisibleCommandPart[] {
  const parts: VisibleCommandPart[] = []
  const chars = [...command]
  let text = ''

  function flushText() {
    if (!text) return
    parts.push({ kind: 'text', text })
    text = ''
  }

  for (const char of chars) {
    if (char === '\n') {
      flushText()
      parts.push({ kind: 'newline' })
      continue
    }
    const code = char.codePointAt(0)
    if (code !== undefined && isHiddenCodePoint(code, char)) {
      flushText()
      parts.push({ kind: 'hidden', hex: code.toString(16).toUpperCase().padStart(4, '0') })
      continue
    }
    text += char
  }
  flushText()
  return parts
}

function isHiddenCodePoint(code: number, char: string): boolean {
  if (code === 0x0A) return false
  if (HIDDEN_CATEGORY.test(char)) return true
  if (code >= 0xFE00 && code <= 0xFE0F) return true
  if (code >= 0xE0100 && code <= 0xE01EF) return true
  return EXTRA_HIDDEN.has(code)
}
