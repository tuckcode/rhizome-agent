import { type RefObject } from 'react'
import {
  Archive,
  ArrowCounterClockwise,
  CirclesThree,
  ClipboardText,
  PencilSimple,
  ChatTeardropText,
  type Icon,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { getContextMenuPositionStyle } from './contextMenuPosition'
import type { PrimeSessionSummary } from '../lib/primeSessionMeta'

export type PrimeSessionContextMenuState = {
  x: number
  y: number
  session: PrimeSessionSummary
}

interface MenuItem {
  icon: Icon
  label: string
  onSelect: () => void
  testId: string
}

interface PrimeSessionListContextMenuProps {
  ctxMenu: PrimeSessionContextMenuState | null
  ctxMenuRef: RefObject<HTMLDivElement | null>
  onOpen: (session: PrimeSessionSummary) => void
  onRename: (session: PrimeSessionSummary) => void
  onSetArchived: (session: PrimeSessionSummary, archived: boolean) => void
  onOpenMycelium?: (sessionPath: string) => void
  onCopyPath: (sessionPath: string) => void
  onClose: () => void
}

function buildItems({
  session,
  onOpen,
  onRename,
  onSetArchived,
  onOpenMycelium,
  onCopyPath,
  selectAction,
}: {
  session: PrimeSessionSummary
  onOpen: (session: PrimeSessionSummary) => void
  onRename: (session: PrimeSessionSummary) => void
  onSetArchived: (session: PrimeSessionSummary, archived: boolean) => void
  onOpenMycelium?: (sessionPath: string) => void
  onCopyPath: (sessionPath: string) => void
  selectAction: (run: () => void) => void
}): MenuItem[] {
  const items: MenuItem[] = [
    {
      icon: ChatTeardropText,
      label: 'Open',
      testId: 'prime-session-ctx-open',
      onSelect: () => selectAction(() => onOpen(session)),
    },
    {
      icon: PencilSimple,
      label: 'Rename',
      testId: 'prime-session-ctx-rename',
      onSelect: () => selectAction(() => onRename(session)),
    },
  ]

  if (session.archived) {
    items.push({
      icon: ArrowCounterClockwise,
      label: 'Restore',
      testId: 'prime-session-ctx-restore',
      onSelect: () => selectAction(() => onSetArchived(session, false)),
    })
  } else {
    items.push({
      icon: Archive,
      label: 'Archive',
      testId: 'prime-session-ctx-archive',
      onSelect: () => selectAction(() => onSetArchived(session, true)),
    })
  }

  if (onOpenMycelium) {
    items.push({
      icon: CirclesThree,
      label: 'View in Mycelium',
      testId: 'prime-session-ctx-mycelium',
      onSelect: () => selectAction(() => onOpenMycelium(session.path)),
    })
  }

  items.push({
    icon: ClipboardText,
    label: 'Copy path',
    testId: 'prime-session-ctx-copy-path',
    onSelect: () => selectAction(() => onCopyPath(session.path)),
  })

  return items
}

export function PrimeSessionListContextMenu({
  ctxMenu,
  ctxMenuRef,
  onOpen,
  onRename,
  onSetArchived,
  onOpenMycelium,
  onCopyPath,
  onClose,
}: PrimeSessionListContextMenuProps) {
  if (!ctxMenu) return null

  const selectAction = (run: () => void) => {
    onClose()
    run()
  }

  const items = buildItems({
    session: ctxMenu.session,
    onOpen,
    onRename,
    onSetArchived,
    onOpenMycelium,
    onCopyPath,
    selectAction,
  })

  return (
    <div
      ref={ctxMenuRef}
      className="fixed z-[12000] rounded-md border bg-popover p-1 shadow-md"
      style={getContextMenuPositionStyle(ctxMenu, { minWidth: 200 })}
      data-testid="prime-session-context-menu"
    >
      {items.map((item) => {
        const IconComponent = item.icon
        return (
          <Button
            key={item.testId}
            type="button"
            variant="ghost"
            data-testid={item.testId}
            className="flex h-auto w-full cursor-default items-center justify-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={item.onSelect}
          >
            <IconComponent size={16} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
          </Button>
        )
      })}
    </div>
  )
}
