import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { renderUpdaterUserMessage, shouldLinkUpdaterReleasesPage } from '../lib/updaterUserMessages'

interface ToastProps {
  message: string | null
  onDismiss: () => void
  actionLabel?: string
  onAction?: () => void
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
}

function ToastAction({ label, onClick, onDismiss }: { label: string; onClick: () => void; onDismiss: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 px-2"
      onClick={() => {
        onClick()
        onDismiss()
      }}
    >
      {label}
    </Button>
  )
}

export function Toast({ message, onDismiss, actionLabel, onAction, secondaryActionLabel, onSecondaryAction }: ToastProps) {
  const hasAction = Boolean(actionLabel && onAction)

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(onDismiss, hasAction ? 6000 : 2000)
    return () => clearTimeout(timer)
  }, [hasAction, message, onDismiss])

  if (!message) return null

  return (
    <div
      role="status"
      className={cn(
        "fixed bottom-8 left-1/2 -translate-x-1/2 z-[1100]",
        "flex items-center gap-3",
        "bg-secondary px-5 py-2 rounded-lg text-[13px] text-[var(--text-secondary)]",
        "shadow-[0_4px_16px_var(--shadow-dialog)]",
        "animate-in slide-in-from-bottom-2 fade-in duration-200",
      )}
    >
      <span>{renderUpdaterUserMessage(message, { linkReleasesPage: shouldLinkUpdaterReleasesPage(message) })}</span>
      {hasAction && actionLabel && onAction ? (
        <ToastAction label={actionLabel} onClick={onAction} onDismiss={onDismiss} />
      ) : null}
      {hasAction && secondaryActionLabel && onSecondaryAction ? (
        <ToastAction label={secondaryActionLabel} onClick={onSecondaryAction} onDismiss={onDismiss} />
      ) : null}
    </div>
  )
}
