import { CircleNotch as Loader2 } from '@phosphor-icons/react'
import { memo } from 'react'
import { cn } from '@/lib/utils'

interface DeleteProgressNoticeProps {
  count: number
}

function describeNotes(count: number): string {
  return count === 1 ? 'note' : `${count} notes`
}

export const DeleteProgressNotice = memo(function DeleteProgressNotice({
  count,
}: DeleteProgressNoticeProps) {
  if (count <= 0) return null

  return (
    <div
      className={cn(
        'fixed bottom-20 left-1/2 z-[1095] flex -translate-x-1/2 items-center gap-2 rounded-lg',
        'border border-[var(--border)] bg-[var(--bg-dialog)] px-4 py-2 text-[13px] text-foreground',
        'shadow-[0_4px_16px_var(--shadow-dialog)] animate-in slide-in-from-bottom-2 fade-in duration-200',
      )}
      data-testid="delete-progress-notice"
    >
      <Loader2 size={14} className="animate-spin text-muted-foreground" />
      <span>{`Deleting ${describeNotes(count)}...`}</span>
    </div>
  )
})
