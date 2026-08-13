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

/** Mirrors `PrimeTranscriptItem` in `src-tauri/src/prime_sessions.rs`. */
export type PrimeTranscriptItem =
  | { kind: 'message'; id?: string; parentId?: string; message: PrimeMessage }
  | { kind: 'compaction'; id?: string; timestamp?: string; summary?: string; tokensBefore?: number }
  | { kind: 'modelChange'; id?: string; timestamp?: string; provider?: string; modelId?: string }

export interface PrimeMessage {
  role: string
  content: unknown
  timestamp?: number
  text: string
}

interface ContentBlock {
  type?: string
  text?: string
  thinking?: string
  name?: string
  id?: string
  input?: Record<string, unknown>
}

function blocksOf(content: unknown): ContentBlock[] {
  return Array.isArray(content) ? (content as ContentBlock[]) : []
}

/** Prime records a path under several key names depending on the tool. */
function pathFromInput(input: Record<string, unknown> | undefined): string | undefined {
  if (!input) return undefined
  for (const key of ['path', 'file_path', 'notePath', 'note_path']) {
    const value = input[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return undefined
}

/**
 * Tool calls in an assistant message, as action cards.
 *
 * Status is always `done`: this is history, and nothing replayed from a log is
 * still running. A card left `pending` would show a spinner forever.
 */
function actionsFrom(message: PrimeMessage, seed: number): AiAction[] {
  return blocksOf(message.content)
    .filter((block) => block.type === 'tool_use')
    .map((block, index) => {
      const path = pathFromInput(block.input)
      const tool = block.name ?? 'tool'
      return {
        tool,
        toolId: block.id ?? `replay-${seed}-${index}`,
        label: path ? `${tool} ${path}` : tool,
        ...(path ? { path } : {}),
        status: 'done' as const,
        ...(block.input ? { input: JSON.stringify(block.input) } : {}),
      }
    })
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
      // The summary is the only surviving record of the turns it replaced, so
      // it is shown, not reduced to a divider.
      turns.push({
        ...emptyTurn('', `replay-compaction-${index++}`),
        localMarker: 'compaction',
        response: item.summary,
      })
      continue
    }

    if (item.kind === 'modelChange') {
      const model = [item.provider, item.modelId].filter(Boolean).join(' / ')
      turns.push({
        ...emptyTurn('', `replay-model-${index++}`),
        localMarker: model ? `model · ${model}` : 'model changed',
      })
      continue
    }

    const { message } = item
    switch (message.role) {
      case 'user':
        turns.push({ ...emptyTurn(message.text, item.id ?? `replay-${index++}`) })
        break
      case 'assistant': {
        const turn = current()
        const reasoning = reasoningFrom(message)
        const actions = actionsFrom(message, index++)
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
