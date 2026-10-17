import type { ReactElement } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function CommitSubjectTooltip({
  subject,
  side = 'top',
  sideOffset = 4,
  children,
}: {
  subject: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  sideOffset?: number
  children: ReactElement
}) {
  if (!subject) return children

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} sideOffset={sideOffset} align="start" className="break-words">
        <span aria-hidden="true">{subject}</span>
      </TooltipContent>
    </Tooltip>
  )
}
