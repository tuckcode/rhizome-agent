export type VisibleCommandPart =
  | { kind: 'text'; text: string }
  | { kind: 'newline' }
  | { kind: 'hidden'; hex: string }

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

  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index] ?? ''
    const next = chars[index + 1]
    if (char === '\r' && next === '\n') {
      flushText()
      parts.push({ kind: 'newline' })
      index += 1
      continue
    }
    if (char === '\n') {
      flushText()
      parts.push({ kind: 'newline' })
      continue
    }
    const code = char.codePointAt(0)
    if (code !== undefined && isHiddenCodePoint(code)) {
      flushText()
      parts.push({ kind: 'hidden', hex: code.toString(16).toUpperCase().padStart(4, '0') })
      continue
    }
    text += char
  }
  flushText()
  return parts
}

function isHiddenCodePoint(code: number): boolean {
  if (code === 0x0A) return false
  if (code <= 0x1F) return true
  if (code >= 0x7F && code <= 0x9F) return true
  if (code >= 0x200B && code <= 0x200F) return true
  if (code >= 0x202A && code <= 0x202E) return true
  if (code >= 0x2066 && code <= 0x2069) return true
  return code === 0xFEFF
}
