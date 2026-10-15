import { Button } from '@/components/ui/button'
import { PEER_TOOL_EXIT_CHAT } from '../lib/peerToolExit'

export function PeerToolExitButton({
  label = PEER_TOOL_EXIT_CHAT,
  onClick,
  testId,
}: {
  label?: string
  onClick: () => void
  testId: string
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      data-testid={testId}
      aria-label={label}
      title={label}
    >
      {label}
    </Button>
  )
}
