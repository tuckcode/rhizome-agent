/** Last-wins top-level JSON object fields, matching serde_json `Value`. */

const JSON_WS = /[ \t\n\r]/u
const JSON_NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u

export function topLevelJsonValueLiterals(raw: string): Record<string, string> | undefined {
  const input = raw.trim()
  if (!input.startsWith('{')) return undefined
  let index = 1
  const last: Record<string, string> = {}
  index = skipWs(input, index)
  if (input[index] === '}') return finishObject(input, index + 1, last)
  while (index < input.length) {
    index = skipWs(input, index)
    const key = parseJsonString(input, index)
    if (!key) return undefined
    index = skipWs(input, key.end)
    if (input[index] !== ':') return undefined
    index = skipWs(input, index + 1)
    const value = readRawValue(input, index)
    if (!value) return undefined
    last[key.decoded] = value.raw
    index = skipWs(input, value.end)
    if (input[index] === ',') {
      index += 1
      continue
    }
    if (input[index] === '}') return finishObject(input, index + 1, last)
    return undefined
  }
  return undefined
}

function finishObject(
  input: string,
  index: number,
  last: Record<string, string>,
): Record<string, string> | undefined {
  const end = skipWs(input, index)
  return end === input.length ? last : undefined
}

function skipWs(input: string, index: number): number {
  while (index < input.length && JSON_WS.test(input[index] ?? '')) index += 1
  return index
}

function parseJsonString(
  input: string,
  start: number,
): { decoded: string; end: number } | undefined {
  if (input[start] !== '"') return undefined
  let index = start + 1
  let decoded = ''
  while (index < input.length) {
    const char = input[index]
    if (char === '"') return { decoded, end: index + 1 }
    if (char === '\\') {
      const next = input[index + 1]
      if (next === 'u') {
        const hex = input.slice(index + 2, index + 6)
        if (!/^[0-9a-fA-F]{4}$/u.test(hex)) return undefined
        decoded += String.fromCharCode(Number.parseInt(hex, 16))
        index += 6
        continue
      }
      const escaped = escapeChar(next)
      if (escaped === undefined) return undefined
      decoded += escaped
      index += 2
      continue
    }
    if ((char?.charCodeAt(0) ?? 0) < 0x20) return undefined
    decoded += char
    index += 1
  }
  return undefined
}

function escapeChar(char: string | undefined): string | undefined {
  if (char === '"') return '"'
  if (char === '\\') return '\\'
  if (char === '/') return '/'
  if (char === 'b') return '\b'
  if (char === 'f') return '\f'
  if (char === 'n') return '\n'
  if (char === 'r') return '\r'
  if (char === 't') return '\t'
  return undefined
}

function readRawValue(input: string, start: number): { raw: string; end: number } | undefined {
  const char = input[start]
  if (char === '"') {
    const parsed = parseJsonString(input, start)
    if (!parsed) return undefined
    return { raw: input.slice(start, parsed.end), end: parsed.end }
  }
  if (char === '{' || char === '[') {
    const end = skipContainer(input, start)
    if (end === undefined) return undefined
    return { raw: input.slice(start, end), end }
  }
  if (input.startsWith('true', start)) return { raw: 'true', end: start + 4 }
  if (input.startsWith('false', start)) return { raw: 'false', end: start + 5 }
  if (input.startsWith('null', start)) return { raw: 'null', end: start + 4 }
  const number = JSON_NUMBER.exec(input.slice(start))
  if (!number) return undefined
  return { raw: number[0], end: start + number[0].length }
}

function skipContainer(input: string, start: number): number | undefined {
  const open = input[start]
  const close = open === '{' ? '}' : ']'
  let index = start + 1
  let depth = 1
  while (index < input.length && depth > 0) {
    const char = input[index]
    if (char === '"') {
      const parsed = parseJsonString(input, index)
      if (!parsed) return undefined
      index = parsed.end
      continue
    }
    if (char === '{' || char === '[') depth += 1
    else if (char === '}' || char === ']') {
      if ((char === '}' && close === ']') || (char === ']' && close === '}')) return undefined
      depth -= 1
    }
    index += 1
  }
  return depth === 0 ? index : undefined
}
