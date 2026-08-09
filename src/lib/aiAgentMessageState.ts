import type { Dispatch, SetStateAction } from 'react'
import type { AiAgentMessage } from './aiAgentConversation'

export interface ToolInvocation {
  tool: string
  input?: string
}

export function updateMessage(
  setMessages: Dispatch<SetStateAction<AiAgentMessage[]>>,
  messageId: string,
  updater: (message: AiAgentMessage) => AiAgentMessage,
): void {
  setMessages((current) => current.map((message) => (message.id === messageId ? updater(message) : message)))
}

export function markReasoningDone(
  setMessages: Dispatch<SetStateAction<AiAgentMessage[]>>,
  messageId: string,
): void {
  updateMessage(setMessages, messageId, (message) => (
    message.reasoningDone ? message : { ...message, reasoningDone: true }
  ))
}

function formatToolLabel(toolName: string): string {
  if (toolName === 'Bash') {
    return 'Ran shell command'
  }
  if (toolName === 'Write') return 'Wrote file'
  if (toolName === 'Edit') return 'Edited file'
  if (toolName === 'create_note') return 'Created note'
  if (toolName === 'open_note') return 'Open note'
  if (toolName === 'get_note') return 'Read note'
  if (toolName === 'Read') return 'Read file'
  return toolName
}

/** Vault-relative or absolute note path from common tool input shapes. */
export function notePathFromToolInput(toolName: string, input?: string): string | undefined {
  if (!input?.trim()) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(input)
  } catch {
    return undefined
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined
  const record = parsed as Record<string, unknown>
  const candidates = [
    record.path,
    record.file_path,
    record.filePath,
    record.note_path,
    record.notePath,
    record.target,
  ]
  for (const value of candidates) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (!trimmed) continue
    // Prefer markdown-looking paths for open-note UX; still allow extensionless wiki stems.
    if (LOOKS_LIKE_NOTE_PATH.test(trimmed) || OPEN_NOTE_TOOLS.has(toolName)) {
      return trimmed.replace(/\\/g, '/')
    }
  }
  return undefined
}

const OPEN_NOTE_TOOLS = new Set([
  'create_note',
  'open_note',
  'get_note',
  'Read',
  'Write',
  'Edit',
  'ui_open_note',
])

const LOOKS_LIKE_NOTE_PATH = /\.(md|markdown|txt)$/i

export function updateToolAction(
  message: AiAgentMessage,
  toolName: string,
  toolId: string,
  input?: string,
): AiAgentMessage {
  const path = notePathFromToolInput(toolName, input)
  const existing = message.actions.find((action) => action.toolId === toolId)
  if (existing) {
    return {
      ...message,
      actions: message.actions.map((action) => (
        action.toolId === toolId
          ? {
              ...action,
              input: input ?? action.input,
              path: path ?? action.path,
              label: action.label || formatToolLabel(toolName),
            }
          : action
      )),
    }
  }

  return {
    ...message,
    actions: [
      ...message.actions,
      {
        tool: toolName,
        toolId,
        label: path ? `${formatToolLabel(toolName)} · ${path}` : formatToolLabel(toolName),
        path,
        status: 'pending' as const,
        input,
      },
    ],
  }
}
