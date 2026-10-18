import type { AiAgentPermissionMode } from './aiAgentPermissionMode'
import { isKeptExternalAgentId } from './migrateRemovedHarnessChoices'
import type { AiTargetKind } from './aiTargets'

/**
 * Verbs that make a predicted reply an action the person did not type.
 * A hit stays silent so the option pills, when they exist, are the only offer.
 */
const CONSEQUENTIAL_VERBS = [
  'push',
  'delete',
  'remove',
  'drop',
  'deploy',
  'ship',
  'merge',
  'pay',
  'send',
  'post',
  'rm',
  'run',
  'migrate',
  'apply',
  'wipe',
  'reset',
  'force',
  'publish',
  'sync',
  'overwrite',
] as const

/** Normalized forms of a reply that approves without naming an action. */
const BARE_APPROVALS = new Set([
  'yes',
  'yep',
  'yeah',
  'ok',
  'okay',
  'sure',
  'go',
  'go ahead',
  'yes go ahead',
  'yes proceed',
  'proceed',
  'ready',
  'ready proceed',
  'do it',
  'do that',
  'approved',
  'approve',
])

const FILLER_CLAUSE = /^(?:proceed|continue|go ahead|go|do it|do that|yes|ok|okay|sure|ready|keep going|carry on|get started|finish)$/i

/** Writing or sending. A shared target next to one of these stays silent. */
const WRITE_OR_TRANSFER = new Set<string>([
  ...CONSEQUENTIAL_VERBS,
  'draft',
  'write',
  'add',
  'create',
])

const SHARED_TARGET = /\b(?:origin|remote|prod|production|main|master|vault)\b/

const NEXT_STEP = /^(?:next[,:]?\s+(?:i(?:'ll| will)|we(?:'ll| will))\s+|the next step is to\s+)([\s\S]+)$/i

const GHOST_VERBS = new Set([
  'writeup',
  'expandon',
  'elaborateon',
  'walkthrough',
  'makeanote',
  'jotdown',
  'createanote',
  'draft',
  'write',
  'summarize',
  'summarise',
  'outline',
  'explain',
  'rephrase',
  'rewrite',
  'shorten',
  'simplify',
  'proofread',
  'edit',
  'polish',
  'format',
  'continue',
  'fix',
  'translate',
  'brainstorm',
  'suggest',
  'list',
  'compare',
  'add',
])

const GHOST_OBJECTS = new Set([
  'typo',
  'typos',
  'intro',
  'introduction',
  'conclusion',
  'summary',
  'tldr',
  'outline',
  'draft',
  'note',
  'notes',
  'section',
  'paragraph',
  'point',
  'points',
  'mainpoints',
  'list',
  'poem',
  'title',
  'titles',
  'name',
  'names',
  'prosandcons',
  'introandconclusion',
  'qa',
  'cplusplus',
  'thread',
  'text',
])

const FIX_OBJECTS = new Set(['typo', 'typos', 'intro', 'introduction'])
const GHOST_DETERMINERS = new Set(['a', 'an', 'the', 'this', 'these', 'those', 'my', 'some', 'afew'])
const GHOST_ADJECTIVES = new Set(['second', 'main', 'new', 'short', 'next', 'quick', 'two', 'three'])
const IT_VERBS = new Set(['explain', 'summarize', 'summarise', 'translate'])
const THIS_VERBS = new Set(['summarize', 'summarise', 'translate'])

const TAIL_STOP = new Set([
  'and', 'then', 'or', 'also', 'plus', 'but', 'so', 'to', 'by', 'before', 'after', 'while',
  'it', 'them', 'this', 'that', 'all', 'every', 'each', 'everything',
  'purge', 'trash', 'erase', 'truncate', 'now', 'please', 'go', 'ahead', 'proceed', 'yes', 'do',
])
const EXPLAIN_STOP = new Set([
  ...TAIL_STOP,
  'once', 'via', 'using', 'with', 'on', 'in', 'into', 'for', 'from', 'as', 'well', 'followed',
  'it', 'them', 'this', 'that', 'all', 'every', 'each', 'now',
])
const DENY_WORD = /^(?:push|delete|remove|drop|deploy|ship|merge|pay|send|post|rm|run|migrate|apply|wipe|reset|force|publish|sync|overwrite|commit|rebase|revert|execute|approve|install|kill|purge|trash|erase|truncate)(?:s|es|d|ed|ing)?$/i
const DENY_ING = /^(?:delet|remov|merg|migrat|wip|approv|execut|purg|eras|truncat|runn|dropp|shipp|committ)ing$/i
const LANGUAGES = new Set([
  'english', 'french', 'spanish', 'german', 'italian', 'portuguese', 'dutch',
  'japanese', 'chinese', 'korean', 'russian', 'arabic', 'hindi', 'polish', 'swedish',
])
const SINGULAR_EDIT_OBJECTS = new Set([
  'note', 'section', 'intro', 'introduction', 'paragraph', 'typo',
  'draft', 'outline', 'summary', 'conclusion', 'list', 'tldr',
])
const SINGULAR_EDIT_VERBS = new Set(['rewrite', 'edit', 'format', 'fix'])
const WRITE_DETERMINER_VERBS = new Set([
  ...SINGULAR_EDIT_VERBS,
  'shorten', 'simplify', 'polish', 'rephrase', 'continue',
  'elaborateon', 'expandon', 'translate', 'add', 'write', 'writeup', 'jotdown', 'proofread',
])
const EXPLAIN_TOOLS = new Set(['git', 'npm', 'pnpm', 'docker', 'rm', 'sudo', 'kubectl'])
const EXPLAIN_APPROVAL = new Set([
  'go', 'ahead', 'please', 'proceed', 'yes', 'do', 'now',
  'afterwards', 'immediately', 'everywhere', 'later', 'first', 'again', 'too', 'also',
])
const NO_THREAD_TEXT_NAME = new Set(['add', 'write', 'edit', 'writeup'])

function visibleClause(raw: string): string | null {
  const clause = prepareText(raw).replace(/[.]+$/, '').trim()
  if (!clause || clause.length > 200) return null
  return clause
}

function ghostHasStructuralBreak(text: string): boolean {
  if (/[\n\r]/.test(text)) return true
  if (/^\s*[-*•]/m.test(text) || /\n\s*[-*•]/.test(text)) return true
  const protectedText = text
    .replace(/\bwrite-up\b/gi, 'write up')
    .replace(/\bre-write\b/gi, 'rewrite')
    .replace(/\bq&a\b/gi, 'qa')
    .replace(/\bc\+\+/gi, 'cplusplus')
    .replace(/\btl;dr\b/gi, 'tldr')
  if (/[—–→/]|->|=>/.test(protectedText)) return true
  if (/[—–-]/.test(protectedText)) return true
  if (/[,;:&+()[\]{}:]/.test(protectedText)) return true
  return false
}

function ghostTokens(display: string): string[] | null {
  if (ghostHasStructuralBreak(display)) return null
  if (looksSecret(display)) return null
  let text = display.toLowerCase()
  text = text.replace(/\bq&a\b/g, ' qa ')
  text = text.replace(/\bc\+\+/g, ' cplusplus ')
  text = text.replace(/\btl;dr\b/g, ' tldr ')
  text = text.replace(/\bre-write\b/g, 'rewrite')
  text = text.replace(/\bwrite-up\b/g, 'write up')
  text = text.replace(/\bpros and cons\b/g, ' prosandcons ')
  text = text.replace(/\bintro and conclusion\b/g, ' introandconclusion ')
  text = text.replace(/\bmain points\b/g, ' mainpoints ')
  text = text.replace(/\bwrite up\b/g, ' writeup ')
  text = text.replace(/\bexpand on\b/g, ' expandon ')
  text = text.replace(/\belaborate on\b/g, ' elaborateon ')
  text = text.replace(/\bwalk through\b/g, ' walkthrough ')
  text = text.replace(/\bmake a note\b/g, ' makeanote ')
  text = text.replace(/\bjot down\b/g, ' jotdown ')
  text = text.replace(/\bcreate a note\b/g, ' createanote ')
  text = text.replace(/\b(?:in|into) this note\b/g, ' destthis ')
  text = text.replace(/\b(?:in|into) the note\b/g, ' dest ')
  text = text.replace(/\b(?:in|into) my notes\b/g, ' dest ')
  text = text.replace(/\bfor me\b/g, ' forme ')
  text = text.replace(/\bthat mentions?\b/g, ' thatmentions ')
  text = text.replace(/\ba few\b/g, ' afew ')
  text = text.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return null
  return text.split(' ')
}

function messageBlocksGhost(fullMessage: string | undefined, display: string): boolean {
  const source = fullMessage ?? display
  return looksSecret(source) || looksDangerousCommand(source)
}

function ghostGrammarAccepts(display: string, fullMessage?: string): boolean {
  if (messageBlocksGhost(fullMessage, display)) return false
  const tokens = ghostTokens(display)
  if (!tokens || tokens.length === 0) return false
  const verb = tokens[0]
  if (!verb) return false
  let index = 1
  if (verb === 'find' || verb === 'search') {
    if (GHOST_DETERMINERS.has(tokens[index] ?? '')) index += 1
    if (tokens[index] !== 'note' && tokens[index] !== 'notes') return false
    index += 1
    if (tokens[index] !== 'thatmentions') return false
    index += 1
    const tail = tokens.slice(index)
    if (tail.length < 1 || tail.length > 2) return false
    if (looksSecret(tail.join(' '))) return false
    return tail.every((token) => (
      /^[a-z0-9]+$/.test(token)
      && !TAIL_STOP.has(token)
      && !isDenyWord(token)
    ))
  }
  if (!GHOST_VERBS.has(verb)) return false
  if (verb === 'makeanote' || verb === 'createanote') {
    if (tokens.some((token) => token === 'it' || token === 'this' || token === 'that')) return false
    if (index < tokens.length && (tokens[index] === 'dest' || tokens[index] === 'forme' || tokens[index] === 'destthis')) {
      index += 1
    }
    return index === tokens.length
  }
  let determiner = ''
  if (GHOST_DETERMINERS.has(tokens[index] ?? '')) {
    determiner = tokens[index] ?? ''
    index += 1
  }
  while (GHOST_ADJECTIVES.has(tokens[index] ?? '')) index += 1
  const object = tokens[index]
  if (!object) return false
  index += 1
  if (object === 'it' || object === 'this' || object === 'that') {
    const vaultWrite = verb === 'write' || verb === 'add' || verb === 'draft' || verb === 'writeup'
      || verb === 'rewrite' || verb === 'edit' || verb === 'fix' || verb === 'format'
    if (vaultWrite) return false
  }
  if (object === 'it') {
    if (!IT_VERBS.has(verb)) return false
  } else if (object === 'this') {
    if (!THIS_VERBS.has(verb)) return false
  } else if (object === 'that') {
    return false
  } else if (!GHOST_OBJECTS.has(object)) {
    return false
  } else if (verb === 'fix' && !FIX_OBJECTS.has(object)) {
    return false
  }
  if (WRITE_DETERMINER_VERBS.has(verb) && (determiner === 'my' || determiner === 'these' || determiner === 'those')) {
    return false
  }
  if (SINGULAR_EDIT_VERBS.has(verb)) {
    if (!SINGULAR_EDIT_OBJECTS.has(object)) return false
  }
  if (NO_THREAD_TEXT_NAME.has(verb) && (object === 'thread' || object === 'text' || object === 'name' || object === 'names')) {
    return false
  }
  if (index < tokens.length && (tokens[index] === 'dest' || tokens[index] === 'forme' || tokens[index] === 'destthis')) {
    if (SINGULAR_EDIT_VERBS.has(verb) && tokens[index] !== 'destthis') return false
    index += 1
  }
  return index === tokens.length
}

function prepareText(text: string): string {
  return text.normalize('NFKC').replace(/\p{Cf}/gu, '').replace(/[’‘]/g, "'")
}

/**
 * A secret, a raw credential, or inline code anywhere in the text.
 * Boundaries are letters only, so API_KEY and access_token still match.
 */
function secretReason(text: string): string | null {
  const prepared = prepareText(text)
  if (hasDangerousBacktick(prepared)) return 'backtick'
  if (hasSecretAssignment(prepared)) return 'assign'
  if (hasMixedScriptWord(prepared)) return 'script'
  if (hasSuspiciousDigits(prepared)) return 'digits'
  if (hasCredentialToken(prepared)) return 'token'
  if (hasPasswordishToken(prepared)) return 'pwtoken'
  if (hasShortBase64(prepared)) return 'b64'
  if (/(?<![a-z0-9])sk-live-/i.test(prepared)) return 'sk-live'
  if (/(?<![a-z0-9])sk-/i.test(prepared)) return 'sk'
  if (/(?<![a-z0-9])(?:ghp_|gho_|github_pat_)/i.test(prepared)) return 'ghp'
  if (/(?<![a-z])akia/i.test(prepared)) return 'akia'
  if (/(?<![a-z])bearer(?![a-z])/i.test(prepared)) return 'bearer'
  if (/(?<![a-z0-9])eyj/i.test(prepared)) return 'eyj'
  if (looksLikeSharedSecret(prepared)) return 'shared'
  const lower = collapseSpacedLetters(stripCombiningMarks(prepared)).toLowerCase()
  const checks: [string, RegExp][] = [
    ['p@ss', /(?<![a-z])p@sswords?(?![a-z])/],
    ['pass word', /(?<![a-z])pass[- ]words?(?![a-z])/],
    ['passcode', /(?<![a-z])passcodes?(?![a-z])/],
    ['code is', /(?<![a-z])(?:codes?|cards?|logins?|cvv|ssn)\s*(?:=|:|is)\s*\S/],
    ['cvv', /(?<![a-z])(?:cvv|ssn)\b/],
    ['api key', /(?<![a-z])api[_ ]?keys?(?![a-z])/],
    ['private key', /(?<![a-z])private[_ ]?keys?(?![a-z])/],
    ['password', /(?<![a-z])passwords?(?![a-z])/],
    ['passphrase', /(?<![a-z])passphrases?(?![a-z])/],
    ['passwd', /(?<![a-z])passwd(?![a-z])/],
    ['pwd', /(?<![a-z])pwd(?![a-z])/],
    ['pin', /(?<![a-z])pins?(?![a-z])/],
    ['otp', /(?<![a-z])otp(?![a-z])/],
    ['recovery', /(?<![a-z])recovery[_ ]codes?(?![a-z])/],
    ['seed', /(?<![a-z])seed[_ ]phrases?(?![a-z])/],
    ['mnemonic', /(?<![a-z])mnemonics?(?![a-z])/],
    ['token', /(?<![a-z])tokens?(?![a-z])/],
    ['secret', /(?<![a-z])secrets?(?![a-z])/],
    ['credential', /(?<![a-z])credentials?(?![a-z])/],
    ['key', /(?<![a-z])keys?(?![a-z])/],
    ['ssh', /(?<![a-z])ssh(?![a-z])/],
    ['id_rsa', /(?<![a-z0-9])id_rsa(?![a-z0-9])/],
    ['keychain', /(?<![a-z])keychain(?![a-z])/],
    ['env', /\.env(?![a-z])/i],
    ['pem', /\.pem(?![a-z])/i],
  ]
  for (const [name, pattern] of checks) {
    if (pattern.test(lower)) return name
  }
  return null
}

export function looksSecret(text: string): boolean {
  return secretReason(text) !== null
}

function caseSwitches(word: string): number {
  let switches = 0
  for (let index = 1; index < word.length; index += 1) {
    const previous = word[index - 1] ?? ''
    const current = word[index] ?? ''
    const previousUpper = previous >= 'A' && previous <= 'Z'
    const currentUpper = current >= 'A' && current <= 'Z'
    const previousLower = previous >= 'a' && previous <= 'z'
    const currentLower = current >= 'a' && current <= 'z'
    if ((previousUpper && currentLower) || (previousLower && currentUpper)) switches += 1
  }
  return switches
}

function hasShortBase64(text: string): boolean {
  const pattern = /(?<![A-Za-z0-9+/=])([A-Za-z0-9+/=]{8,24})(?![A-Za-z0-9+/=])/g
  for (const match of text.matchAll(pattern)) {
    const piece = match[1] ?? ''
    if (/^[A-Z][a-z]+$/.test(piece)) continue
    if (/^[A-Z][a-z]+(?:[A-Z][a-z]+)+$/.test(piece)) continue
    if (/^[a-z]+(?:[A-Z][a-z0-9]+)+$/.test(piece)) continue
    if (/^[0-9a-f]{7,12}$/i.test(piece)) continue
    if (isProductToken(piece)) continue
    const hasDigitOrSign = /[0-9+=]/.test(piece)
    if (piece.includes('/') && !/[+=]/.test(piece)) continue
    if (hasDigitOrSign || caseSwitches(piece) >= 3) return true
  }
  return false
}

function hasMixedScriptWord(text: string): boolean {
  return text.split(/\s+/).some((word) => {
    let latin = false
    let other = false
    for (const char of word) {
      if (/\p{Script=Latin}/u.test(char)) latin = true
      else if (/\p{Script=Cyrillic}/u.test(char) || /\p{Script=Greek}/u.test(char)) other = true
    }
    return latin && other
  })
}

function hasSuspiciousDigits(text: string): boolean {
  const pattern = /(?<![0-9])(\d{4,})(?![0-9])/g
  for (const match of text.matchAll(pattern)) {
    const digits = match[1] ?? ''
    const value = Number(digits)
    if (digits.length === 4 && value >= 1900 && value <= 2099) continue
    const before = text.slice(Math.max(0, match.index - 16), match.index)
    const after = text.slice(match.index + digits.length, match.index + digits.length + 12)
    if (/\d{4}-\d{2}-\d{2}/.test(text.slice(Math.max(0, match.index - 8), match.index + digits.length + 6))) {
      continue
    }
    if (/\s*(?:dollars?|words?|errors?|chapters?)\b/i.test(after)) continue
    if (/(?:is|=|:)\s*$/i.test(before)) {
      if (/(?:number|zip|order|room|(?:build\s+)?id)\s+is\s*$/i.test(before)) continue
      return true
    }
    if (/(?<![a-z])(?:code|pin|otp|cvv|ssn|card|password|passwd|pwd|passcode|token|secret|key)s?\s*$/i.test(before)) {
      return true
    }
  }
  return false
}

function hasCredentialToken(text: string): boolean {
  const pattern = /(?<!\S)(\S{8,})(?!\S)/g
  for (const match of text.matchAll(pattern)) {
    const token = match[1] ?? ''
    if (!/[A-Z]/.test(token) || !/[a-z]/.test(token) || !/[0-9]/.test(token)) continue
    if (isProductToken(token) && !usedAsCredential(text, match.index ?? 0, token)) continue
    return true
  }
  return false
}

function isProductToken(token: string): boolean {
  if (!/^[A-Za-z]+\d{1,4}$/.test(token)) return false
  if (/[A-Z]/.test(token)) return true
  const digits = token.match(/\d+$/)?.[0] ?? ''
  return digits === '64' || digits === '128' || digits === '256' || digits === '512' || digits === '1024' || digits === '2048'
}

function usedAsCredential(text: string, index: number, token: string): boolean {
  const after = text.slice(index + token.length)
  const near = text.slice(Math.max(0, index - 16), index)
  return /^\s+is\b/i.test(after) || /\bis\s+$/i.test(near) || /\buse\s+$/i.test(near)
}

function collapseSpacedLetters(text: string): string {
  return text.replace(/\b(?:[A-Za-z] ){3,}[A-Za-z]\b/g, (run) => run.replace(/ /g, ''))
}

function hasPasswordishToken(text: string): boolean {
  const pattern = /(?<![A-Za-z0-9])([A-Za-z]+\d[A-Za-z0-9]*)(?![A-Za-z0-9])/g
  for (const match of text.matchAll(pattern)) {
    const token = match[1] ?? ''
    if (token.length < 6 || token.length > 16) continue
    if (/^[0-9a-f]{7,12}$/i.test(token)) continue
    if (isProductToken(token) && !usedAsCredential(text, match.index ?? 0, token)) continue
    return true
  }
  return false
}

function looksLikeSharedSecret(text: string): boolean {
  const lower = text.toLowerCase()
  if (/\buse\s+\S+(?:\s+\S+){0,5}\s+to sign in\b/.test(lower)) return true
  if (/\bcombo\s+is\s+\S/.test(lower)) return true
  if (/\bis\s+[a-z]+\d[a-z0-9]*(?![a-z0-9.])/i.test(lower)) return true
  return false
}

function hasSecretAssignment(text: string): boolean {
  return /(?<![a-z])(?:api[_ ]?key|token|secret|password|passwd|pwd|access[_ ]?token|client[_ ]?secret|github[_ ]?token)\w*\s*=\s*\S/i.test(text)
    || /\?[A-Za-z0-9_]+=/.test(text)
}

function hasDangerousBacktick(text: string): boolean {
  const spans = text.match(/`[^`\n]+`/g) ?? []
  return spans.some((span) => {
    const inner = span.slice(1, -1)
    return /=/.test(inner)
      || looksDangerousCommand(inner)
      || /\bgit\s+push\b/i.test(inner)
      || /(?<![a-z])(?:key|token|secret|password)s?(?![a-z])/i.test(inner)
  })
}

function stripCombiningMarks(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '')
}

function looksDangerousCommand(text: string): boolean {
  const prepared = prepareText(text)
  return /\brm\s+-[rf]{1,2}\b/i.test(prepared)
    || /\brm\s+-R\b/.test(prepared)
    || /(?:^|\s)--(?:force|hard)\b/i.test(prepared)
    || /\bgit\s+push\s+-f\b/i.test(prepared)
    || /\bgit\s+clean\s+-f/i.test(prepared)
    || /\bdrop\s+table\b/i.test(prepared)
    || /\bdelete\s+from\b/i.test(prepared)
    || /\btruncate\s+table\b/i.test(prepared)
    || /(?:^|\n)(?: {4}|\t)(?![-*•])\S/.test(prepared)
    || /hooks\.slack\.com/i.test(prepared)
    || /https?:\/\/\S*\/reset\b/i.test(prepared)
}

export function suppressesReply(text: string): boolean {
  return looksSecret(text) || looksDangerousCommand(text)
}

function isDenyWord(word: string): boolean {
  return DENY_WORD.test(word) || DENY_ING.test(word)
}

function countsAsExplainDeny(parts: string[], index: number): boolean {
  const word = parts[index] ?? ''
  if (!DENY_ING.test(word)) return DENY_WORD.test(word)
  const previous = parts[index - 1]
  const next = parts[index + 1]
  if (next === 'the' || next === 'a' || next === 'an') return true
  if (parts.slice(0, index).some((part) => EXPLAIN_TOOLS.has(part) || DENY_WORD.test(part))) return true
  return previous !== undefined && !/^(?:the|a|an|how|why|what)$/.test(previous)
}

function clauseWords(action: string): string[] {
  const prepared = prepareText(action)
    .replace(/^(?:yes|ready)\s*[—–-]\s*/i, '')
    .toLowerCase()
    .replace(/[—–]/g, ' ')
    .replace(/[-/]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!prepared) return []
  return prepared.split(' ')
}

function normalizeWords(text: string): string {
  return prepareText(text)
    .toLowerCase()
    .replace(/[—–]/g, ' ')
    .replace(/[-/]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isAsciiWord(word: string): boolean {
  for (const char of word) {
    if (char.charCodeAt(0) > 127) return false
  }
  return word.length > 0
}

function sharedTargetsAreNoteTitles(joined: string): boolean {
  const hits = joined.match(/\b(?:origin|remote|prod|production|main|master|vault)\b/g) ?? []
  if (hits.length === 0) return false
  return hits.every((hit) => {
    if (hit === 'main') return /\bmain\s+notes?\b/.test(joined)
    if (hit === 'master') return /\bmaster\s+notes?\b/.test(joined)
    return false
  })
}

function hasWriteVerbBesideSharedTarget(words: string[]): boolean {
  const joined = words.join(' ')
  if (!SHARED_TARGET.test(joined)) return false
  if (sharedTargetsAreNoteTitles(joined)) return false
  if (/\bclean\s+up\b/.test(joined)) return true
  return words.some((word) => WRITE_OR_TRANSFER.has(word))
}

function swapListenerPossessives(echo: string): string {
  return echo
    .replace(/\byours\b/gi, 'mine')
    .replace(/\byour\b(?!')/gi, 'my')
}

/** True when the text is an approval that does not name the action. */
export function isBareApproval(text: string): boolean {
  return BARE_APPROVALS.has(normalizeWords(text))
}

/**
 * Second guard: a consequential verb, or a shared target sitting next to a
 * write or transfer verb. A read of "main" or "vault" is not this.
 */
export function isConsequentialAsk(action: string): boolean {
  const words = clauseWords(action)
  const joined = words.join(' ')
  if (!joined) return false
  if (/\bclean\s+up\b/.test(joined)) return true
  if (words.some((word, index) => {
    if (!isAsciiWord(word) || !(CONSEQUENTIAL_VERBS as readonly string[]).includes(word)) return false
    // "the post" / "a post" is a noun. "merge sort" is a noun.
    if (word === 'post' && (words[index - 1] === 'the' || words[index - 1] === 'a')) return false
    if (word === 'merge' && words[index + 1] === 'sort') return false
    return true
  })) {
    return true
  }
  return hasWriteVerbBesideSharedTarget(words)
}

function cleanClause(raw: string): string | null {
  const clause = prepareText(raw).replace(/[.]+$/, '').replace(/\s+/g, ' ').trim()
  if (clause.length < 3 || clause.length > 80) return null
  if (FILLER_CLAUSE.test(clause)) return null
  if (clause.split(' ').length < 2) return null
  return clause
}

function rawApprovalClause(sentence: string): { shape: 'yes' | 'ready'; clause: string } | null {
  const text = prepareText(sentence).replace(/[?!.,]+$/g, '').trim()

  const readyAnd = text.match(
    /^let me know when you(?:'re| are) ready and i(?:'ll| will)\s+([\s\S]+)$/i,
  )
  if (readyAnd?.[1]) return { shape: 'ready', clause: readyAnd[1] }

  const whenThen = text.match(/^when you(?:'re| are) ready,?\s+i(?:'ll| will)\s+([\s\S]+)$/i)
  if (whenThen?.[1]) return { shape: 'ready', clause: whenThen[1] }

  const illWhen = text.match(/^i(?:'ll| will)\s+([\s\S]+?)\s+when you(?:'re| are) ready$/i)
  if (illWhen?.[1]) return { shape: 'ready', clause: illWhen[1] }

  const want = text.match(/\bwant me to\s+([\s\S]+)$/i)
  if (want?.[1]) return { shape: 'yes', clause: want[1] }

  const shall = text.match(/\bshall i\s+([\s\S]+)$/i)
  if (shall?.[1]) return { shape: 'yes', clause: shall[1] }

  const should = text.match(/\bshould i\s+([\s\S]+)$/i)
  if (should?.[1]) return { shape: 'yes', clause: should[1] }

  const would = text.match(/\bwould you like me to\s+([\s\S]+)$/i)
  if (would?.[1]) return { shape: 'yes', clause: would[1] }

  const can = text.match(/\bi can\s+([\s\S]+?)\s+if you(?:'d| would) like$/i)
  if (can?.[1]) return { shape: 'yes', clause: can[1] }

  return null
}

function isReadyOffer(text: string): boolean {
  return /when you(?:'re| are) ready\b/i.test(text)
}

function isYesOffer(text: string): boolean {
  return /\bwant me to\b/i.test(text)
    || /\bshall i\b/i.test(text)
    || /\bshould i\b/i.test(text)
    || /\bwould you like me to\b/i.test(text)
    || /\bi can\b[\s\S]+?\bif you(?:'d| would) like/i.test(text)
}

/**
 * The action a consent offer named, or null when nothing clean can be kept
 * (a bare "Shall I proceed?" is the usual miss).
 */
export function captureActionClause(sentence: string): string | null {
  const found = rawApprovalClause(sentence)
  if (!found) return null
  return cleanClause(found.clause)
}

/**
 * Named approval ghost, null when the offer must stay silent, undefined when
 * the sentence is not an approval offer.
 */
function explainTopicOk(topic: string): boolean {
  const parts = topic.split(' ').filter((word) => word.length > 0)
  if (parts.length < 1 || parts.length > 5) return false
  if (parts.some((word) => EXPLAIN_STOP.has(word) || EXPLAIN_APPROVAL.has(word) || !/^[a-z0-9]+$/.test(word))) {
    return false
  }
  if (looksSecret(topic)) return false
  const denyAt = parts.flatMap((word, index) => {
    if (word === 'merge' && parts[index + 1] === 'sort') return []
    if (word === 'sort' && parts[index - 1] === 'merge') return []
    if (word === 'apply' && parts[index + 1] === 'functions') return []
    if (word === 'functions' && parts[index - 1] === 'apply') return []
    return countsAsExplainDeny(parts, index) ? [index] : []
  })
  if (denyAt.length > 1) return false
  if (denyAt.length === 1) {
    const at = denyAt[0] ?? 0
    const next = parts[at + 1]
    if (next === 'the' || next === 'a' || next === 'an') return false
    const previous = parts[at - 1]
    const afterTool = previous !== undefined && EXPLAIN_TOOLS.has(previous)
    const isTool = EXPLAIN_TOOLS.has(parts[at] ?? '')
    const isLast = at === parts.length - 1
    if (!isLast && !afterTool && !isTool) return false
    if (!isLast) {
      for (let index = at + 1; index < parts.length; index += 1) {
        const word = parts[index] ?? ''
        if (
          countsAsExplainDeny(parts, index)
          || EXPLAIN_APPROVAL.has(word)
          || word === 'the'
          || word === 'a'
          || word === 'an'
        ) {
          return false
        }
      }
    }
  }
  return true
}

/** Narrow restores for clauses the closed grammar does not already accept. */
function restoreGhostClause(display: string, fullMessage?: string): boolean {
  if (ghostHasStructuralBreak(display) || messageBlocksGhost(fullMessage, display)) return false
  const clause = display.toLowerCase().replace(/\s+/g, ' ')
    .replace(/\bwrite-up\b/g, 'write up')
    .replace(/\bre-write\b/g, 'rewrite')
    .trim()
  if (/^read the readme(?:\.md| md)?$/.test(clause)) return true
  const explained = clause.match(/^explain (?:how )?(.+?)(?: works)?$/)
  if (explained?.[1] && explainTopicOk(explained[1])) return true
  if (/^write up the (?:meeting |call |standup |interview |lecture )?(?:notes|summary)$/.test(clause)) return true
  if (/^find (?:related|similar) notes$/.test(clause)) return true
  if (/^compare the (?:two |three )?(?:approaches|options)$/.test(clause)) return true
  if (/^draft a reply(?: to the (?:email|message|thread))?$/.test(clause)) return true
  const translated = clause.match(/^translate (?:this|it) (?:to|into) ([a-z]+)$/)
  if (translated?.[1] && LANGUAGES.has(translated[1])) return true
  if (/^summarize what you (?:said|sent|found|wrote)$/.test(clause)) return true
  const called = clause.match(/^create a note called ([a-z0-9]+(?: [a-z0-9]+){0,3})$/)
  if (
    called?.[1]
    && explainTopicOk(called[1])
    && !isDenyWord(called[1])
    && !called[1].split(' ').some((word) => isDenyWord(word))
  ) {
    return true
  }
  return false
}

function approvalCompletionText(sentence: string, fullMessage?: string): string | null | undefined {
  const text = prepareText(sentence).trim()
  if (!isReadyOffer(text) && !isYesOffer(text)) return undefined
  const found = rawApprovalClause(text)
  if (!found) return null
  const clause = visibleClause(found.clause)
  if (!clause) return null
  const swapped = swapListenerPossessives(clause)
  if (!ghostGrammarAccepts(swapped, fullMessage) && !restoreGhostClause(swapped, fullMessage)) return null
  return `Yes — ${swapped}`
}

/** Harmless next-step echo, or null when the step is absent, unclean, or not allowlisted. */
function nextStepCompletion(sentence: string, fullMessage?: string): string | null {
  const text = prepareText(sentence).replace(/[?!]+$/, '').trim()
  const match = text.match(NEXT_STEP)
  if (!match?.[1]) return null
  const original = match[1].replace(/[.]+$/, '').trim()
  const echo = swapListenerPossessives(original)
  const yearTail = echo.match(/\s+for the (?:19|20)\d{2} ([a-z]+)$/i)
  const core = yearTail && !isDenyWord(yearTail[1] ?? '') ? echo.slice(0, echo.length - yearTail[0].length) : echo
  if (!ghostGrammarAccepts(core, fullMessage) && !restoreGhostClause(core, fullMessage)) return null
  const shown = echo.charAt(0).toUpperCase() + echo.slice(1)
  return shown
}

/**
 * The one Tab ghost for this sentence, or null.
 * An approval is named or absent. A next-step echo is harmless or absent.
 */
export function predictedCompletion(sentence: string, fullMessage?: string): string | null {
  const source = fullMessage ?? sentence
  const approval = approvalCompletionText(sentence, source)
  if (approval !== undefined) return approval
  return nextStepCompletion(sentence, source)
}

function isNativeStreamAgent(agentId: string | null | undefined): boolean {
  if (!agentId || isKeptExternalAgentId(agentId)) return false
  return agentId === 'prime' || agentId === 'hermes'
}

/**
 * Whether the composer may show a predicted completion.
 * Rhizome's native stream and an API model may, in Safe mode.
 * External CLIs (Codex, Claude Code), Power User, and a missing target may not.
 * Codex runs `--ask-for-approval never` in Power User.
 */
export function allowPredictedCompletion(input: {
  text: string
  targetKind?: AiTargetKind | null
  agentId?: string | null
  permissionMode?: AiAgentPermissionMode | null
}): boolean {
  if (isBareApproval(input.text)) return false
  if (input.permissionMode !== 'safe') return false
  if (input.targetKind === 'api_model') return true
  if (input.targetKind === 'agent' && isNativeStreamAgent(input.agentId)) return true
  return false
}
