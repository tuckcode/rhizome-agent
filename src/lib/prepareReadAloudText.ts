const SPEECH_BRACKETS =
  /\[(pause|long-pause|laugh|chuckle|giggle|cry|sigh|breath|inhale|exhale|tsk|tongue-click|lip-smack|hum-tune)\]/gi

const WRAPPING_TAGS = [
  'whisper',
  'soft',
  'loud',
  'emphasis',
  'build-intensity',
  'decrease-intensity',
  'slow',
  'fast',
  'higher-pitch',
  'lower-pitch',
  'singing',
  'sing-song',
]

const READ_ALOUD_LIMIT = 15_000

export function prepareReadAloudText(source: string): string {
  let text = stripWrappingSpeechTags(source)
  text = text.replace(SPEECH_BRACKETS, '')
  text = text.replace(/```[\s\S]*?```/g, '\n[pause] Code block omitted.\n')
  text = text.replace(/^\|.*\|$/gm, (line) => tableRowToSentence(line))
  text = text.replace(/^#{1,6}\s+/gm, '')
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1')
  text = text.replace(/__([^_]+)__/g, '$1')
  text = text.replace(/(^|[^\w])\*([^*]+)\*(?!\w)/g, '$1$2')
  text = text.replace(/`([^`]+)`/g, '$1')
  text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return text
}

export function splitReadAloudText(source: string, limit = READ_ALOUD_LIMIT): string[] {
  const text = source.trim()
  if (!text) return []
  if (text.length <= limit) return [text]

  const parts: string[] = []
  let buffer = ''
  const flush = () => {
    const piece = buffer.trim()
    if (piece) parts.push(piece)
    buffer = ''
  }

  for (const paragraph of text.split(/\n\n+/)) {
    if (paragraph.length > limit) {
      flush()
      parts.push(...splitLongParagraph(paragraph, limit))
      continue
    }
    const next = buffer ? `${buffer}\n\n${paragraph}` : paragraph
    if (next.length > limit) flush()
    buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph
  }
  flush()
  return parts
}

function splitLongParagraph(paragraph: string, limit: number): string[] {
  const sentences = paragraph.split(/(?<=[.!?])\s+/)
  const parts: string[] = []
  let buffer = ''
  for (const sentence of sentences) {
    if (sentence.length > limit) {
      if (buffer) parts.push(buffer)
      buffer = ''
      for (let index = 0; index < sentence.length; index += limit) {
        parts.push(sentence.slice(index, index + limit))
      }
      continue
    }
    const next = buffer ? `${buffer} ${sentence}` : sentence
    if (next.length > limit) {
      parts.push(buffer)
      buffer = sentence
    } else {
      buffer = next
    }
  }
  if (buffer) parts.push(buffer)
  return parts
}

function stripWrappingSpeechTags(text: string): string {
  let result = text
  for (const name of WRAPPING_TAGS) {
    result = result.replace(new RegExp(`</?${name}>`, 'gi'), '')
  }
  return result
}

function tableRowToSentence(line: string): string {
  if (/^\|\s*-+/.test(line.replace(/\|/g, '|').trim()) && !/[A-Za-z0-9]/.test(line)) return ''
  const cells = line.split('|').map((cell) => cell.trim()).filter(Boolean)
  if (cells.every((cell) => /^:?-+:?$/.test(cell))) return ''
  if (cells.length === 0) return ''
  return `${cells.join(' ')}.`
}
