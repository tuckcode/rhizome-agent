import emojiData from 'unicode-emoji-json'

/**
 * Detects whether a string is a single emoji (as opposed to a Phosphor icon name).
 * Used to differentiate emoji note icons from kebab-case Phosphor icon names.
 */
export function isEmoji(value: string): boolean {
  if (!value) return false
  // Phosphor icon names are always lowercase ASCII with hyphens
  if (/^[a-z][a-z0-9-]*$/.test(value)) return false
  // Match a single emoji (including compound emoji with ZWJ, skin tones, variation selectors, flags)
  const emojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\ufe0f)(\u200d(\p{Emoji_Presentation}|\p{Emoji}\ufe0f)|\p{Emoji_Modifier})*$/u
  return emojiRegex.test(value)
}

export interface EmojiEntry {
  emoji: string
  name: string
  group: string
}

/** Category groups in display order. */
export const EMOJI_GROUPS = [
  'Smileys & Emotion',
  'People & Body',
  'Animals & Nature',
  'Food & Drink',
  'Travel & Places',
  'Activities',
  'Objects',
  'Symbols',
  'Flags',
] as const

/** Short labels for category tabs. */
export const GROUP_SHORT_LABELS: Record<string, string> = {
  'Smileys & Emotion': 'Smileys',
  'People & Body': 'People',
  'Animals & Nature': 'Nature',
  'Food & Drink': 'Food',
  'Travel & Places': 'Travel',
  Activities: 'Activities',
  Objects: 'Objects',
  Symbols: 'Symbols',
  Flags: 'Flags',
}

/** Representative emoji for each category tab. */
export const GROUP_ICONS: Record<string, string> = {
  'Smileys & Emotion': '😀',
  'People & Body': '👋',
  'Animals & Nature': '🐻',
  'Food & Drink': '🍔',
  'Travel & Places': '✈️',
  Activities: '⚽',
  Objects: '💡',
  Symbols: '❤️',
  Flags: '🏁',
}

type RawEmojiData = Record<string, { name: string; group: string }>

const raw = emojiData as RawEmojiData

/** Full emoji list with English names and categories. */
export const ALL_EMOJIS: EmojiEntry[] = Object.entries(raw).map(([emoji, data]) => ({
  emoji,
  name: data.name,
  group: data.group,
}))

/** Emojis grouped by category, in display order. */
export const EMOJIS_BY_GROUP: Map<string, EmojiEntry[]> = (() => {
  const map = new Map<string, EmojiEntry[]>()
  for (const group of EMOJI_GROUPS) {
    map.set(group, ALL_EMOJIS.filter(e => e.group === group))
  }
  return map
})()

/** Searches emojis by English name. Returns matching entries. */
export function searchEmojis(query: string): EmojiEntry[] {
  if (!query.trim()) return ALL_EMOJIS
  const terms = query.toLowerCase().trim().split(/\s+/)
  return ALL_EMOJIS.filter(e => {
    const name = e.name.toLowerCase()
    return terms.every(t => name.includes(t))
  })
}
