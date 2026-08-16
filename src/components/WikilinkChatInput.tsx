import type { CSSProperties } from 'react'
import type { VaultEntry } from '../types'
import type { NoteReference } from '../utils/ai-context'
import { InlineWikilinkInput } from './InlineWikilinkInput'
import type { CommandMenuAction, CommandMenuEntry } from '../lib/primeCommandMenu'

interface WikilinkChatInputProps {
  entries: VaultEntry[]
  value: string
  onChange: (value: string) => void
  onSend: (text: string, references: NoteReference[]) => void
  onUnsupportedPaste?: (message: string) => void
  disabled?: boolean
  placeholder?: string
  placeholderClassName?: string
  inputRef?: React.RefObject<HTMLDivElement | null>
  editorClassName?: string
  editorStyle?: CSSProperties
  commandEntries?: CommandMenuEntry[]
  commandDisabled?: Record<string, string>
  commandSkillLabel?: string
  commandInstantLabel?: string
  onCommandAction?: (action: CommandMenuAction, nextValue: string) => void
}

export function WikilinkChatInput({
  entries,
  value,
  onChange,
  onSend,
  onUnsupportedPaste,
  disabled,
  placeholder,
  placeholderClassName,
  inputRef,
  editorClassName,
  editorStyle,
  commandEntries,
  commandDisabled,
  commandSkillLabel,
  commandInstantLabel,
  onCommandAction,
}: WikilinkChatInputProps) {
  return (
    <InlineWikilinkInput
      entries={entries}
      value={value}
      onChange={onChange}
      onSubmit={onSend}
      onUnsupportedPaste={onUnsupportedPaste}
      disabled={disabled}
      placeholder={placeholder}
      placeholderClassName={placeholderClassName}
      inputRef={inputRef}
      editorClassName={editorClassName}
      editorStyle={editorStyle}
      commandEntries={commandEntries}
      commandDisabled={commandDisabled}
      commandSkillLabel={commandSkillLabel}
      commandInstantLabel={commandInstantLabel}
      onCommandAction={onCommandAction}
    />
  )
}
