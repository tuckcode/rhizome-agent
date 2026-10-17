import type { AiAgentPermissionMode } from './aiAgentPermissionMode'
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

const FILLER_CLAUSE = /^(?:proceed|continue|go ahead|go|do it|do that|yes|ok|okay|sure|ready)$/i

const NEXT_STEP = /^(?:next[,:]?\s+(?:i(?:'ll| will)|we(?:'ll| will))\s+|the next step is to\s+)(.+)$/i

function straighten(text: string): string {
  return text.replace(/[’‘]/g, "'")
}

function normalizeWords(text: string): string {
  return straighten(text)
    .toLowerCase()
    .replace(/[—–]/g, ' ')
    .replace(/[-/]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** True when the text is an approval that does not name the action. */
export function isBareApproval(text: string): boolean {
  return BARE_APPROVALS.has(normalizeWords(text))
}

/** True when the action names a destructive or consequential verb. */
export function isConsequentialAsk(action: string): boolean {
  const normalized = normalizeWords(action)
  if (/\bclean\s+up\b/.test(normalized)) return true
  return CONSEQUENTIAL_VERBS.some((verb) => new RegExp(`\\b${verb}\\b`).test(normalized))
}

function cleanClause(raw: string): string | null {
  const clause = raw.replace(/[.]+$/, '').replace(/\s+/g, ' ').trim()
  if (clause.length < 3 || clause.length > 80) return null
  if (FILLER_CLAUSE.test(clause)) return null
  if (clause.split(' ').length < 2) return null
  return clause
}

function rawApprovalClause(sentence: string): { shape: 'yes' | 'ready'; clause: string } | null {
  const text = straighten(sentence).replace(/[?!.,]+$/g, '').trim()

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

  const can = text.match(/\bi can\s+(.+?)\s+if you(?:'d| would) like$/i)
  if (can?.[1]) return { shape: 'yes', clause: can[1] }

  return null
}

function isReadyOffer(text: string): boolean {
  return /let me know when you(?:'re| are) ready/i.test(text)
    || /when you(?:'re| are) ready[.?!]*$/i.test(text)
}

function isYesOffer(text: string): boolean {
  return /\bwant me to\b/i.test(text)
    || /\bshall i\b/i.test(text)
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
  const text = straighten(sentence).trim()
  if (!isReadyOffer(text) && !isYesOffer(text)) return undefined
  const found = rawApprovalClause(text)
  if (!found) return null
  const clause = cleanClause(found.clause)
  if (!clause || isConsequentialAsk(clause)) return null
  const prefix = found.shape === 'ready' ? 'Ready' : 'Yes'
  return `${prefix} — ${clause}`
}

/** Harmless next-step echo, or null when the step is absent, unclean, or consequential. */
function nextStepCompletion(sentence: string): string | null {
  const text = straighten(sentence).replace(/[?!]+$/, '').trim()
  const match = text.match(NEXT_STEP)
  if (!match?.[1]) return null
  const echo = match[1].replace(/[.]+$/, '').trim()
  if (
    echo.length < 3
    || echo.length > 80
    || /^(what|how|why|when|where|who|which)\b/i.test(echo)
    || isConsequentialAsk(echo)
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

/**
 * Whether the composer may show a predicted completion.
 * CLI agents (kind `agent`) and Power User show none: Codex runs
 * `--ask-for-approval never` in Power User, and a Tab accept would send
 * the action with no second prompt. A bare or consequential ghost is
 * refused for every target.
 */
export function allowPredictedCompletion(input: {
  text: string
  targetKind?: AiTargetKind | null
  permissionMode?: AiAgentPermissionMode | null
}): boolean {
  if (isBareApproval(input.text)) return false
  if (isConsequentialAsk(input.text)) return false
  if (input.targetKind === 'agent') return false
  if (input.permissionMode === 'power_user') return false
  return true
}
