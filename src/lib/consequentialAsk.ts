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

const PROCEED_WITH = /^(?:proceed|continue|go ahead)\s+with\b/i

/** Base verbs that may lead a Tab ghost. Inflections are not in this set. */
const SAFE_LEADING_VERBS = new Set([
  'draft',
  'write',
  'summarize',
  'outline',
  'explain',
  'add',
  'read',
  'search',
  'list',
  'show',
  'review',
  'check',
  'sketch',
  'start',
])

/** Writing or sending. A shared target next to one of these stays silent. */
const WRITE_OR_TRANSFER = new Set<string>([
  ...CONSEQUENTIAL_VERBS,
  'draft',
  'write',
  'add',
  'create',
])

const SHARED_TARGET = /\b(?:origin|remote|prod|production|main|master|vault)\b/

/**
 * Objects that do not name the work: pronouns, and the words a model uses
 * when it points at the previous paragraph instead of the action.
 */
const UNNAMED_OBJECTS = new Set([
  'it',
  'them',
  'this',
  'that',
  'him',
  'her',
  'those',
  'these',
  'one',
  'above',
  'below',
  'everything',
  'all',
  'so',
  'the above',
  'the below',
  'the rest',
  'the plan',
  'the changes',
  'the job',
  'the steps',
  'the fix',
])

const OBJECT_SKIP = new Set([
  'a',
  'an',
  'of',
  'to',
  'with',
  'for',
  'on',
  'in',
  'at',
  'into',
  'from',
  'up',
  'now',
  'just',
  'please',
  'again',
  'instead',
  'quickly',
  'immediately',
  'ahead',
  'out',
  'over',
  'off',
  'then',
  'too',
])

const LEADING_VERB_PHRASES = [
  ['take', 'care', 'of'],
  ['take', 'care'],
  ['clean', 'up'],
  ['go', 'ahead'],
  ['keep', 'going'],
  ['carry', 'on'],
  ['get', 'started'],
] as const

const NEXT_STEP = /^(?:next[,:]?\s+(?:i(?:'ll| will)|we(?:'ll| will))\s+|the next step is to\s+)(.+)$/i

function prepareText(text: string): string {
  return text.normalize('NFKC').replace(/\p{Cf}/gu, '').replace(/[’‘]/g, "'")
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

function dropLeadingVerb(words: string[]): string[] {
  for (const phrase of LEADING_VERB_PHRASES) {
    if (phrase.every((word, index) => words[index] === word)) {
      return words.slice(phrase.length)
    }
  }
  return words.slice(1)
}

/** The object points at "that" or "the above" instead of a named action. */
function isUnnamedObject(words: string[]): boolean {
  if (words.length < 2) return false
  const rest = dropLeadingVerb(words)
  const raw = rest.join(' ')
  if (UNNAMED_OBJECTS.has(raw)) return true
  const withoutPrep = raw.replace(/^(?:of|with|to|for)\s+/, '')
  if (UNNAMED_OBJECTS.has(withoutPrep)) return true
  const content = rest.filter((word) => !OBJECT_SKIP.has(word))
  if (content.length === 0) return false
  return UNNAMED_OBJECTS.has(content.join(' '))
}

function hasNonAsciiLeadingVerb(words: string[]): boolean {
  const verb = words[0]
  return Boolean(verb && !isAsciiWord(verb))
}

function hasWriteVerbBesideSharedTarget(words: string[]): boolean {
  const joined = words.join(' ')
  if (!SHARED_TARGET.test(joined)) return false
  if (/\bclean\s+up\b/.test(joined)) return true
  return words.some((word) => WRITE_OR_TRANSFER.has(word))
}

/**
 * you / me / I, or the agent's own "my". "my vault" with a read verb is the
 * listener's vault and stays. "my" produced by swapping "your" is not this.
 */
function hasAgentPronoun(original: string): boolean {
  const text = prepareText(original)
  if (/\byou\b(?!')/i.test(text)) return true
  if (/\bme\b/i.test(text)) return true
  if (/\bi\b/i.test(text)) return true
  if (/\bmy\b/i.test(text) && !/\bmy\s+(?:origin|remote|prod|production|main|master|vault)\b/i.test(text)) {
    return true
  }
  return false
}

function isCreateANote(words: string[]): boolean {
  return words[0] === 'create' && words[1] === 'a' && words[2] === 'note'
}

/** Leading verb is a safe base form, or the clause is "create a note". */
function hasSafeLeadingVerb(words: string[]): boolean {
  const verb = words[0]
  if (!verb || !isAsciiWord(verb)) return false
  if (isCreateANote(words)) return true
  return SAFE_LEADING_VERBS.has(verb)
}

function clauseIsOfferSafe(clause: string, original = clause): boolean {
  const words = clauseWords(clause)
  const joined = words.join(' ')
  if (!joined) return false
  if (PROCEED_WITH.test(joined)) return false
  if (FILLER_CLAUSE.test(joined)) return false
  if (hasNonAsciiLeadingVerb(words)) return false
  if (isUnnamedObject(words)) return false
  if (hasAgentPronoun(original)) return false
  if (!hasSafeLeadingVerb(words)) return false
  if (isConsequentialAsk(joined)) return false
  return true
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
  if (words.some((word) => isAsciiWord(word) && (CONSEQUENTIAL_VERBS as readonly string[]).includes(word))) {
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
    /^let me know when you(?:'re| are) ready and i(?:'ll| will)\s+(.+)$/i,
  )
  if (readyAnd?.[1]) return { shape: 'ready', clause: readyAnd[1] }

  const whenThen = text.match(/^when you(?:'re| are) ready,?\s+i(?:'ll| will)\s+(.+)$/i)
  if (whenThen?.[1]) return { shape: 'ready', clause: whenThen[1] }

  const illWhen = text.match(/^i(?:'ll| will)\s+(.+?)\s+when you(?:'re| are) ready$/i)
  if (illWhen?.[1]) return { shape: 'ready', clause: illWhen[1] }

  const want = text.match(/\bwant me to\s+(.+)$/i)
  if (want?.[1]) return { shape: 'yes', clause: want[1] }

  const shall = text.match(/\bshall i\s+(.+)$/i)
  if (shall?.[1]) return { shape: 'yes', clause: shall[1] }

  const should = text.match(/\bshould i\s+(.+)$/i)
  if (should?.[1]) return { shape: 'yes', clause: should[1] }

  const would = text.match(/\bwould you like me to\s+(.+)$/i)
  if (would?.[1]) return { shape: 'yes', clause: would[1] }

  const can = text.match(/\bi can\s+(.+?)\s+if you(?:'d| would) like$/i)
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
function approvalCompletionText(sentence: string): string | null | undefined {
  const text = prepareText(sentence).trim()
  if (!isReadyOffer(text) && !isYesOffer(text)) return undefined
  const found = rawApprovalClause(text)
  if (!found) return null
  const clause = cleanClause(found.clause)
  if (!clause || !clauseIsOfferSafe(clause)) return null
  return `Yes — ${clause}`
}

/** Harmless next-step echo, or null when the step is absent, unclean, or not allowlisted. */
function nextStepCompletion(sentence: string): string | null {
  const text = prepareText(sentence).replace(/[?!]+$/, '').trim()
  const match = text.match(NEXT_STEP)
  if (!match?.[1]) return null
  const original = match[1].replace(/[.]+$/, '').trim()
  const echo = swapListenerPossessives(original)
  if (
    echo.length < 3
    || echo.length > 80
    || /^(what|how|why|when|where|who|which)\b/i.test(echo)
    || !clauseIsOfferSafe(echo, original)
  ) {
    return null
  }
  return echo.charAt(0).toUpperCase() + echo.slice(1)
}

/**
 * The one Tab ghost for this sentence, or null.
 * An approval is named or absent. A next-step echo is harmless or absent.
 */
export function predictedCompletion(sentence: string): string | null {
  const approval = approvalCompletionText(sentence)
  if (approval !== undefined) return approval
  return nextStepCompletion(sentence)
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
