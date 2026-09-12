import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { ChatTeardropText } from '@phosphor-icons/react'
import { getContextMenuPositionStyle } from './contextMenuPosition'

function selectedTextInside(root: HTMLElement): string {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return ''
  const range = selection.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer)) return ''
  return selection.toString().trim()
}

interface AskChatExcerptMenuProps {
  children: ReactNode
  onAsk: (excerpt: string) => void
}

/**
 * Highlight in the open note, then Ask Chat about this.
 * Stays in the current thread — it fills the composer, it does not start a new chat.
 */
export function AskChatExcerptMenu({ children, onAsk }: AskChatExcerptMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; excerpt: string } | null>(null)

  const close = useCallback(() => setMenu(null), [])

  const handleContextMenu = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const root = rootRef.current
    if (!root) return
    const excerpt = selectedTextInside(root)
    if (!excerpt) return
    event.preventDefault()
    event.stopPropagation()
    setMenu({ x: event.clientX, y: event.clientY, excerpt })
  }, [])

  useEffect(() => {
    if (!menu) return
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return
      close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [close, menu])

  return (
    <div ref={rootRef} className="flex min-h-0 min-w-0 flex-1 flex-col" onContextMenu={handleContextMenu}>
      {children}
      {menu ? (
        <div
          ref={menuRef}
          role="menu"
          data-testid="ask-chat-excerpt-menu"
          className="fixed z-[12000] rounded-md border bg-popover p-1 shadow-md"
          style={getContextMenuPositionStyle(menu, { minWidth: 220 })}
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[13px] hover:bg-accent"
            onClick={() => {
              onAsk(menu.excerpt)
              close()
            }}
          >
            <ChatTeardropText size={14} />
            Ask Chat about this
          </button>
        </div>
      ) : null}
    </div>
  )
}
