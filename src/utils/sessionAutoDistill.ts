/**
 * After an AI turn finishes, optionally distill the turn into the wiki.
 * Host-owned (not agent-whim) — mirrors mem0/Zep "extract after the fact."
 * Default OFF — explicit `true` opts in. (The Desktop repo defaults this ON;
 * the fork deliberately flipped it, see the note on the enable check below.)
 */

const MIN_ASSISTANT_CHARS = 80

export function isSessionAutoDistillEnabled(
  value: boolean | null | undefined,
): boolean {
  // Product default OFF: durable saves should be explicit promote/save (grill Q24),
  // not silent post-turn wiki writes. Explicit true opts in.
  return value === true
}

/** True when the assistant payload is a transport/auth failure, not knowledge. */
export function isTransientAgentFailureText(text: string): boolean {
  const t = text.trim()
  if (!t) return true
  if (/^Error:/iu.test(t)) return true
  if (/finished without returning a reply/iu.test(t)) return true
  // Provider / OAuth / RPC host failures (must not become wiki "concepts")
  if (/OAuth session expired/iu.test(t)) return true
  if (/Failed to authenticate/iu.test(t)) return true
  if (/could not be refreshed/iu.test(t)) return true
  if (/invalid args request for command/iu.test(t)) return true
  if (/missing field vaultPath/iu.test(t)) return true
  if (/prime.?agent is not available/iu.test(t)) return true
  if (/not authenticated/iu.test(t) && t.length < 400) return true
  if (/^Request was aborted/iu.test(t)) return true
  return false
}

/** Build distill input from one chat turn. Null = skip (too short / empty). */
export function buildSessionAutoDistillText(
  userMessage: string,
  assistantResponse: string,
): string | null {
  const user = userMessage.trim()
  const assistant = assistantResponse.trim()
  if (!assistant || assistant.length < MIN_ASSISTANT_CHARS) return null
  if (isTransientAgentFailureText(assistant)) return null

  const parts = [
    'Extract durable knowledge worth saving to the wiki from this conversation turn.',
    'Skip chitchat, transient debugging, and anything already saved.',
    '',
    '## User',
    user || '(no user text)',
    '',
    '## Assistant',
    assistant,
  ]
  return parts.join('\n')
}

export function turnAlreadyCalledDistill(
  toolNames: Iterable<string>,
): boolean {
  for (const name of toolNames) {
    const n = name.toLowerCase()
    if (n.includes('rhizome_distill') || n === 'distill') return true
  }
  return false
}

export interface QueueSessionAutoDistillArgs {
  vaultPath: string
  userMessage: string
  assistantResponse: string
  toolNames?: Iterable<string>
  /** Injected invoke for tests. */
  startJob?: (args: {
    jobId: string
    name: string
    args: Record<string, string>
  }) => Promise<unknown>
}

/**
 * Fire-and-forget distill of the completed turn. Returns true if a job was queued.
 */
export async function queueSessionAutoDistill(
  args: QueueSessionAutoDistillArgs,
): Promise<boolean> {
  if (args.toolNames && turnAlreadyCalledDistill(args.toolNames)) return false
  const text = buildSessionAutoDistillText(args.userMessage, args.assistantResponse)
  if (!text || !args.vaultPath) return false

  const jobId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `auto-distill-${Date.now()}`

  const payload = {
    jobId,
    name: 'rhizome_distill',
    args: {
      text,
      vaultPath: args.vaultPath,
      project: '',
      trigger: 'session_auto',
    },
  }

  if (args.startJob) {
    await args.startJob(payload)
    return true
  }

  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('start_rhizome_job', payload)
  return true
}
