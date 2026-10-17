import type { ReactElement } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function CommitSubjectTooltip({
  subject,
  side = 'top',
  children,
}: {
  subject: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  children: ReactElement
}) {
  if (!subject) return children

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} align="start" className="break-words">
        <span aria-hidden="true">{subject}</span>
      </TooltipContent>
    </Tooltip>
  )
}
