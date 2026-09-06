/**
 * Replaying a Prime session log into the chat panel's conversation shape.
 *
 * Two different models meet here. Prime's log is a flat list of role-tagged
 * messages; the panel renders *turns* (`AiAgentMessage`: one user message with
 * the response, reasoning and tool cards that answered it). This folds the
 * first into the second.
 *
 * Frame A of the design system is the contract for what a rehydrated turn has
 * to show: the user bubble, collapsible reasoning, tool cards with status, and
 * the response prose. A replay that kept only prose would render as if the
 * agent had done nothing.
 */

import type { AiAction } from '../components/AiMessage'
import type { AiAgentMessage } from './aiAgentConversation'
import { normalizeMessageTimestampMs } from '../utils/messageTimestamp'

/** Mirrors `PrimeTranscriptItem` in `src-tauri/src/prime_sessions.rs`. */
export type PrimeTranscriptItem =
  | {
      kind: 'message'
      id?: string
      parentId?: string
      message: PrimeMessage
      /** Tool calls, already unwrapped from their shell wrapper in Rust. */
      tools?: PrimeTranscriptTool[]
    }
  | { kind: 'compaction'; id?: string; parentId?: string; timestamp?: string; summary?: string; tokensBefore?: number }
  | { kind: 'modelChange'; id?: string; parentId?: string; timestamp?: string; provider?: string; modelId?: string }
  | { kind: 'branchSummary'; id?: string; parentId?: string; fromId?: string; summary?: string }

export interface PrimeTranscriptTool {
  id?: string
  tool: string
  path?: string
  detail?: string
}

export interface PrimeMessage {
  role: string
  content: unknown
  timestamp?: number
  text: string
}

interface ContentBlock {
  type?: string
  thinking?: string
}

function blocksOf(content: unknown): ContentBlock[] {
  return Array.isArray(content) ? (content as ContentBlock[]) : []
}

/**
 * Tool calls on a replayed message, as action cards.
 *
 * Reads the `tools` the Rust side already unwrapped rather than re-parsing
 * content blocks. The vault skill shells out through ipython, and duplicating
 * that unwrap here would give a replayed card a different name from the live
 * one it is replaying.
 *
 * Status is always `done`: this is history, and nothing replayed from a log is
 * still running. A card left `pending` would spin forever.
 */
function actionsFrom(tools: PrimeTranscriptTool[] | undefined, seed: number): AiAction[] {
  return (tools ?? []).map((tool, index) => ({
    tool: tool.tool,
    toolId: tool.id ?? `replay-${seed}-${index}`,
    label: tool.detail ?? (tool.path ? `${tool.tool} ${tool.path}` : tool.tool),
    ...(tool.path ? { path: tool.path } : {}),
    status: 'done' as const,
  }))
}

function reasoningFrom(message: PrimeMessage): string {
  return blocksOf(message.content)
    .filter((block) => block.type === 'thinking')
    .map((block) => block.thinking ?? '')
    .filter(Boolean)
    .join('\n\n')
}

function emptyTurn(userMessage: string, id: string): AiAgentMessage {
  return { userMessage, actions: [], id }
}

/**
 * Fold a replayed transcript into turns.
 *
 * An assistant message with no preceding user message still gets a turn with
 * an empty prompt rather than being dropped — after a compaction the log
 * legitimately opens mid-conversation, and silently discarding those messages
 * would make a resumed session look like it started later than it did.
 */
/**
 * The current branch of a forked log, walking parentId from the live leaf.
 *
 * The on-disk jsonl keeps every sibling. A transcript that replayed the whole
 * file would mix the turn we abandoned with the one we are on. Missing leaf
 * or unknown id returns the original list so a stale pointer cannot blank
 * the panel.
 */
export function transcriptAlongBranch(
  items: PrimeTranscriptItem[],
  leafId: string | null | undefined,
): PrimeTranscriptItem[] {
  const leaf = leafId?.trim()
  if (!leaf) return items
  const byId = new Map<string, PrimeTranscriptItem>()
  for (const item of items) {
    if (item.id) byId.set(item.id, item)
  }
  if (!byId.has(leaf)) return items
  const keep = new Set<string>()
  let current: string | undefined = leaf
  while (current && !keep.has(current)) {
    keep.add(current)
    current = byId.get(current)?.parentId
  }
  return items.filter((item) => item.id !== undefined && keep.has(item.id))
}

function markerPreview(text: string | undefined, max = 140): string | undefined {
  const line = (text ?? '')
    .split('\n')
    .map((part) => part.replace(/^#+\s*/, '').trim())
    .find(Boolean)
  if (!line) return undefined
  if (line.length <= max) return line
  return `${line.slice(0, max - 1)}…`
}

export function primeTranscriptToConversation(items: PrimeTranscriptItem[]): AiAgentMessage[] {
  const turns: AiAgentMessage[] = []
  let index = 0

  const current = (): AiAgentMessage => {
    const last = turns[turns.length - 1]
    if (last && last.localMarker === undefined) return last
    const turn = emptyTurn('', `replay-${index++}`)
    turns.push(turn)
    return turn
  }

  for (const item of items) {
    if (item.kind === 'compaction') {
      // The summary is the only surviving record of the turns it replaced.
      // It rides on the marker, not as a fake assistant message — #18.
      const preview = markerPreview(item.summary)
      const tokens =
        typeof item.tokensBefore === 'number' ? ` · ${item.tokensBefore} tokens before` : ''
      turns.push({
        ...emptyTurn('', `replay-compaction-${index++}`),
        localMarker: preview
          ? `Compacted this conversation${tokens}\n${preview}`
          : `Compacted this conversation${tokens}`,
      })
      continue
    }

    if (item.kind === 'modelChange') {
      const model = [item.provider, item.modelId].filter(Boolean).join(' / ')
      turns.push({
        ...emptyTurn('', `replay-model-${index++}`),
        localMarker: model ? `Model changed · ${model}` : 'Model changed',
      })
      continue
    }

    if (item.kind === 'branchSummary') {
      const preview = markerPreview(item.summary)
      turns.push({
        ...emptyTurn('', `replay-fork-${index++}`),
        localMarker: preview
          ? `Branched from this conversation\n${preview}`
          : 'Branched from this conversation',
      })
      continue
    }

    const { message } = item
    switch (message.role) {
      case 'user':
        turns.push({
          ...emptyTurn(message.text, item.id ?? `replay-${index++}`),
          // What `fork` branches from. Absent on live turns by necessity.
          primeEntryId: item.id,
          createdAtMs: normalizeMessageTimestampMs(message.timestamp),
        })
        break
      case 'assistant': {
        const turn = current()
        const reasoning = reasoningFrom(message)
        const actions = actionsFrom(item.tools, index++)
        if (reasoning) {
          turn.reasoning = turn.reasoning ? `${turn.reasoning}\n\n${reasoning}` : reasoning
          turn.reasoningDone = true
        }
        if (actions.length) turn.actions = [...turn.actions, ...actions]
        if (message.text) {
          turn.response = turn.response ? `${turn.response}\n\n${message.text}` : message.text
        }
        break
      }
      case 'compactionSummary':
        // Carries `summary` rather than `content`; the compaction item above
        // already renders it, so this would be a duplicate.
        break
      default:
        // toolResult and custom carry no prose of their own — their effect is
        // already visible on the assistant turn's action cards.
        break
    }
  }

  return turns
}
