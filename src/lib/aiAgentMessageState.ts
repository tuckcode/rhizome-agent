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
  return toolName
}

export function updateToolAction(
  message: AiAgentMessage,
  toolName: string,
  toolId: string,
  input?: string,
): AiAgentMessage {
  const existing = message.actions.find((action) => action.toolId === toolId)
  if (existing) {
    return {
      ...message,
      actions: message.actions.map((action) => (
        action.toolId === toolId ? { ...action, input: input ?? action.input } : action
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
        label: formatToolLabel(toolName),
        status: 'pending' as const,
        input,
      },
    ],
  }
}
