import type { ReactElement } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export function CommitSubjectTooltip({
  subject,
  children,
}: {
  subject: string
  children: ReactElement
}) {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top" align="start">
          {subject}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
