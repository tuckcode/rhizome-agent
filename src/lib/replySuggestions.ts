/**
 * What the composer offers you instead of a blank box (#51).
 *
 * Two shapes, and never both on the same turn:
 *
 * - **`options`** — the agent asked a closed question, so its own written
 *   choices become pills. Exactly right by construction: nothing is guessed,
 *   the agent already wrote the options down.
 * - **`completion`** — one obvious continuation, accepted with Tab.
 *
 * When the agent asked a question *and* a continuation looks obvious, the
 * options win and the completion is not rendered. Two suggestion mechanisms
 * firing at once is the clutter this exists to avoid.
 *
 * Deliberately not built here: suggestions derived from app state (unpushed
 * commits, a failed gate, a session still turning). That is case 2 in #51,
 * needs judgement about when to stay silent, and is worth far less than
 * reading a question the agent already asked.
 */

import {
  clauseWords,
  isConsequentialAsk,
  isDenyWord,
  looksSecret,
  predictedCompletion,
  suppressesReply,
} from './consequentialAsk'

/** One pill. */
export interface ReplyOption {
  /**
   * What the pill reads.
   *
   * Must name the action when picking it causes one — "Push 33 commits",
   * never "yes". A pill has to be aimed at rather than hit reflexively, which
   * is what makes it safe to offer an approval at all; that safety is gone the
   * moment the label stops saying what happens.
   */
  label: string
  /** What lands in the composer when it is picked. */
  text: string
}

export type ReplySuggestion =
  | { kind: 'options'; options: ReplyOption[] }
  | { kind: 'completion'; text: string }

/** Fewer than two is not a choice; more than four is a menu. */
export const MIN_REPLY_OPTIONS = 2
export const MAX_REPLY_OPTIONS = 4
const MAX_OPTION_LENGTH = 40

/**
 * Read the agent's last message and decide what to offer.
 *
 * `null` means offer nothing — the honest answer most of the time, and always
 * better than a weak suggestion. Most turns do not end in a question, which is
 * what keeps pills rare without any rule telling them to be.
 */
export function suggestReply(agentMessage: string): ReplySuggestion | null {
  const trimmed = agentMessage.trim()
  if (suppressesReply(trimmed)) return null

  // A newline or bullet inside the offer sentence is not a closed choice.
  // A blank line before that sentence does not count.
  const offerSentence = lastSentenceOf(trimmed)
  if (
    /[\n\r]/.test(offerSentence)
    && (
      /\b(?:want me to|shall i|should i|would you like me to)\b/i.test(offerSentence)
      || /\bi can\b[\s\S]+?\bif you(?:'d| would) like/i.test(offerSentence)
    )
  ) {
    return null
  }

  const paragraphs = trimmed.split(/\n\s*\n/).map((part) => part.trim()).filter((part) => part.length > 0)
  const lastParagraph = paragraphs[paragraphs.length - 1] ?? trimmed
  const nestedList = /(?:^|\n)[ \t]{2,}[-*•]\s+/.test(trimmed)
  const offerAfterList = nestedList && /\b(?:want me to|shall i|should i|would you like me to)\b/i.test(lastParagraph)

  // Closed-question pills win when both could apply. Never both.
  if (!offerAfterList && trimmed.match(/\?+!*$/)) {
    const withoutQuestion = trimmed.replace(/[?!]+$/, '').trim()

    const numberedOptions = tryExtractNumberedOptions(withoutQuestion)
    if (numberedOptions !== null) {
      return numberedOptions
    }

    const bulletOptions = tryExtractBulletOptions(withoutQuestion)
    if (bulletOptions !== null) {
      return bulletOptions
    }

    const orOptions = tryExtractOrOptions(withoutQuestion)
    if (orOptions !== null) {
      return orOptions
    }

    const actionOptions = tryExtractActionYesNo(withoutQuestion, trimmed)
    if (actionOptions !== null) {
      return actionOptions
    }
  }

  return tryExtractCompletion(trimmed)
}

/**
 * One obvious continuation for Tab, or null. Never a bare "yes".
 *
 * Reads the last sentence so a buried "want me to" earlier in the turn does
 * not become a ghost after the agent has already moved on.
 */
function lastSentenceOf(text: string): string {
  const paragraphs = text.split(/\n\s*\n/).map((part) => part.trim()).filter((part) => part.length > 0)
  const tail = paragraphs.length > 1 ? paragraphs[paragraphs.length - 1] ?? text : text
  const sentences = tail
    .split(/(?<=[.!?])(?:\s+|$)/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
  return sentences[sentences.length - 1] ?? tail
}

function tryExtractCompletion(text: string): ReplySuggestion | null {
  const completion = predictedCompletion(lastSentenceOf(text), text)
  if (!completion) return null
  return { kind: 'completion', text: completion }
}

/**
 * Extract options from "X or Y" patterns. Split on " or " FIRST, then
 * strip lead-in from the first part by finding the last ":" or "—", or
 * by stripping common question prefixes if no separator is found.
 */
function tryExtractOrOptions(text: string): ReplySuggestion | null {
  if (!text.includes(' or ')) {
    return null
  }

  // Split on " or " FIRST
  const orParts = text.split(/ or /)
  if (orParts.length < MIN_REPLY_OPTIONS || orParts.length > MAX_REPLY_OPTIONS) {
    return null
  }

  const options: string[] = []

  // Process first part: strip lead-in
  let firstPart = orParts[0].trim()

  // Strategy 1: Find last ":" or "—" separator
  const lastColonIdx = firstPart.lastIndexOf(':')
  const lastDashIdx = firstPart.lastIndexOf('—')
  const stripIdx = Math.max(lastColonIdx, lastDashIdx)

  if (stripIdx !== -1) {
    firstPart = firstPart.slice(stripIdx + 1).trim()
  } else {
    // Strategy 2: If no explicit separator, try to strip common question prefixes
    firstPart = firstPart.replace(
      /^(should\s+i\s+|want\s+me\s+to\s+|can\s+i\s+|would\s+you\s+|could\s+i\s+)/i,
      ''
    ).trim()
  }

  // If first part is empty or too long after stripping, return null
  if (firstPart.length === 0 || firstPart.length > MAX_OPTION_LENGTH) {
    return null
  }

  // Handle commas in the first part (for lists like "A, B, or C")
  if (firstPart.includes(',')) {
    const commaItems = firstPart.split(',').map(s => s.trim()).filter(s => s.length > 0)
    options.push(...commaItems)
  } else {
    options.push(firstPart)
  }

  // Process remaining parts (after the first)
  for (let i = 1; i < orParts.length; i++) {
    const part = orParts[i].trim()

    // Handle commas in remaining parts (unlikely but possible)
    if (part.includes(',')) {
      const commaItems = part.split(',').map(s => s.trim()).filter(s => s.length > 0)
      options.push(...commaItems)
    } else {
      options.push(part)
    }
  }

  // Validate
  if (options.length < MIN_REPLY_OPTIONS || options.length > MAX_REPLY_OPTIONS) {
    return null
  }

  // Check that all options are short enough
  if (options.some(opt => opt.length > MAX_OPTION_LENGTH)) {
    return null
  }

  return {
    kind: 'options',
    options: options.map(opt => ({ label: opt, text: opt }))
  }
}

/**
 * Extract options from numbered lists like "1. X 2. Y — which?"
 */
function tryExtractNumberedOptions(text: string): ReplySuggestion | null {
  // Look for numbered items anywhere in the text
  const numberedPattern = /\d+\.\s+/
  if (!numberedPattern.test(text)) {
    return null
  }

  // Find the first numbered item
  const startIdx = text.search(/\d+\.\s+/)
  if (startIdx === -1) {
    return null
  }

  const fromFirstNumber = text.slice(startIdx)

  // Split on numbered markers
  const parts = fromFirstNumber.split(/\s*\d+\.\s+/).filter(p => p.trim().length > 0)

  if (parts.length < MIN_REPLY_OPTIONS || parts.length > MAX_REPLY_OPTIONS) {
    return null
  }

  // Clean up each item
  const options = parts.map(part => {
    // Remove trailing separators and question words
    const cleaned = part.replace(/[—–-].*$/, '').trim()
    return {
      label: cleaned,
      text: cleaned
    }
  })

  // Validate all options are short enough
  if (options.some(opt => opt.label.length > MAX_OPTION_LENGTH)) {
    return null
  }

  return { kind: 'options', options }
}

/**
 * Extract options from bullet lists like "- X\n- Y — which?"
 */
function tryExtractBulletOptions(text: string): ReplySuggestion | null {
  // Split into lines and find bullets
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  const bulletLines = lines.filter(line => /^[-*•]\s+/.test(line))

  if (bulletLines.length < MIN_REPLY_OPTIONS || bulletLines.length > MAX_REPLY_OPTIONS) {
    return null
  }

  // Extract and clean items
  const options = bulletLines.map(line => {
    const withoutBullet = line.replace(/^[-*•]\s+/, '')
    const cleaned = withoutBullet.replace(/[—–-].*$/, '').trim()
    return {
      label: cleaned,
      text: cleaned
    }
  })

  // Validate all options are short enough
  if (options.some(opt => opt.label.length > MAX_OPTION_LENGTH)) {
    return null
  }

  return { kind: 'options', options }
}

/**
 * Extract options from yes/no action questions — but ONLY if the text
 * is already in imperative form. Return null if uncertain.
 * Negative option is always "No".
 */
function tryExtractActionYesNo(text: string, fullMessage: string): ReplySuggestion | null {
  const normalized = text.trim()
  const sentence = lastSentenceOf(`${normalized}?`).replace(/[?!]+$/, '').trim()
  if (sentence.length < 3) return null

  const echoesWholeMessage = sentence !== normalized
  if (echoesWholeMessage) {
    if (multiSentenceEchoTailUnsafe(sentence, normalized)) return null
    const question = `${sentence}?`
    // Consent on the last sentence is a Tab completion, not a yes/no pill echo.
    if (predictedCompletion(question, fullMessage)) return null
  }

  // Must NOT contain " or " — that's handled by tryExtractOrOptions
  if (normalized.includes(' or ') || sentence.includes(' or ')) {
    return null
  }

  // Must NOT be a numbered or bulleted list (check the whole offer, not only the tail)
  if (/\d+\./.test(normalized) || /^[-*•]\s+/.test(normalized) || /\n[-*•]\s+/.test(normalized)) {
    return null
  }

  // Reject open questions (what, how, why, when, where, who, which, etc.)
  const openQuestionStart =
    /^(what|how|why|when|where|who|which|whose|can you|could you|would you|should you|want me|should i|shall i|would i|any\s)/i
  if (openQuestionStart.test(sentence)) {
    return null
  }

  if (sentence.length > MAX_OPTION_LENGTH) {
    return null
  }

  if (
    looksSecret(sentence)
    || isConsequentialAsk(sentence)
    || clauseWords(sentence).some(isDenyWord)
  ) {
    return null
  }

  const affirmativeLabel = sentence
  return {
    kind: 'options',
    options: [
      { label: affirmativeLabel, text: affirmativeLabel },
      { label: 'No', text: 'No' }
    ]
  }
}

const ABBREVIATION_BEFORE_TAIL =
  /\b(?:e\.g|i\.e|etc|vs|Mr|Mrs|Ms|Dr|St|Jr|Sr)\.$/i

const LOWERCASE_ABBREV_BEFORE_TAIL = /\b(?:approx|dept|est|fig|inc|misc|no|pt|ref|vol)\.$/i

const TAIL_STARTS_WITH_CAPITAL_OR_DIGIT = /^["'(]?[\p{Lu}\p{N}]/u

/** False split from `lastSentenceOf` on abbreviations, code ticks, or bad tails. */
function multiSentenceEchoTailUnsafe(sentence: string, normalized: string): boolean {
  if (!TAIL_STARTS_WITH_CAPITAL_OR_DIGIT.test(sentence)) return true
  const prefix = normalized.slice(0, normalized.length - sentence.length).trimEnd()
  if (ABBREVIATION_BEFORE_TAIL.test(prefix)) return true
  if (/(?:^|\s)[A-Z]\.$/.test(prefix)) return true
  if (/\s[A-Z][a-z]{0,4}\.$/.test(prefix)) return true
  if (/\b[A-Z](?:\.[A-Z])+\.$/.test(prefix)) return true
  if (LOWERCASE_ABBREV_BEFORE_TAIL.test(prefix)) return true
  const backticks = sentence.match(/`/g)?.length ?? 0
  if (backticks % 2 === 1) return true
  return false
}
