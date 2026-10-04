import type { NoteReference } from './ai-context'

export const OPEN_AI_CHAT_EVENT = 'tolaria:open-ai-chat'
export const AI_PROMPT_QUEUED_EVENT = 'tolaria:ai-prompt-queued'
/** Fill the Chat composer without sending or starting a new conversation. */
export const AI_COMPOSER_PREFILL_EVENT = 'rhizome:ai-composer-prefill'
export const NEW_AI_CHAT_EVENT = 'tolaria:new-ai-chat'
export const AI_WORKSPACE_DOCK_REQUESTED_EVENT = 'tolaria:ai-workspace-dock-requested'
export const AI_WORKSPACE_OPEN_NOTE_REQUESTED_EVENT = 'tolaria:ai-workspace-open-note-requested'
export const AI_WORKSPACE_FILE_CREATED_EVENT = 'tolaria:ai-workspace-file-created'
export const AI_WORKSPACE_FILE_MODIFIED_EVENT = 'tolaria:ai-workspace-file-modified'
export const AI_WORKSPACE_VAULT_CHANGED_EVENT = 'tolaria:ai-workspace-vault-changed'
/** File > New Folder. The create form is local state inside FolderTree, so the
 *  menu/palette command reaches it through the same window-event bridge the AI
 *  workspace commands already use rather than lifting that state to App. */
export const CREATE_FOLDER_REQUESTED_EVENT = 'rhizome:create-folder-requested'

export function requestCreateFolder(): void {
  window.dispatchEvent(new CustomEvent(CREATE_FOLDER_REQUESTED_EVENT))
}

export interface QueuedAiPrompt {
  id: number
  text: string
  references: NoteReference[]
  targetId?: string
}

let nextQueuedPromptId = 1
let pendingPrompt: QueuedAiPrompt | null = null

export function queueAiPrompt(
  text: string,
  references: NoteReference[],
  targetId?: string,
): QueuedAiPrompt {
  const queuedPrompt = {
    id: nextQueuedPromptId++,
    text,
    references,
    targetId,
  }
  pendingPrompt = queuedPrompt
  window.dispatchEvent(new Event(AI_PROMPT_QUEUED_EVENT))
  return queuedPrompt
}

export function takeQueuedAiPrompt(): QueuedAiPrompt | null {
  const queuedPrompt = pendingPrompt
  pendingPrompt = null
  return queuedPrompt
}

export function prefillAiComposer(text: string): void {
  window.dispatchEvent(new CustomEvent(AI_COMPOSER_PREFILL_EVENT, { detail: { text } }))
}

/** Insert text at the composer's caret. Does not send. */
export const AI_COMPOSER_INSERT_EVENT = 'rhizome:ai-composer-insert'

export interface ComposerInsertDetail {
  text?: string
  /** When set, the caret gets a quote chip tied to this reply. */
  quoted?: boolean
  messageId?: string
}

export function insertAiComposerText(text: string): void {
  window.dispatchEvent(new CustomEvent<ComposerInsertDetail>(AI_COMPOSER_INSERT_EVENT, { detail: { text } }))
}

/** Insert a quote of an agent reply at the composer's caret. Does not send. */
export function insertAiComposerQuote(text: string, messageId?: string): void {
  const detail: ComposerInsertDetail = { text, quoted: true }
  if (messageId) detail.messageId = messageId
  window.dispatchEvent(new CustomEvent<ComposerInsertDetail>(AI_COMPOSER_INSERT_EVENT, { detail }))
}

export function requestOpenAiChat() {
  window.dispatchEvent(new Event(OPEN_AI_CHAT_EVENT))
}

export function requestNewAiChat() {
  requestOpenAiChat()
  window.setTimeout(() => window.dispatchEvent(new Event(NEW_AI_CHAT_EVENT)), 0)
}

export function requestDockAiWorkspace() {
  window.dispatchEvent(new Event(AI_WORKSPACE_DOCK_REQUESTED_EVENT))
}
