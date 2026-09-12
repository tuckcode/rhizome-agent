import type { AiWorkspaceMode } from './aiWorkspaceSizing'
import { startResizeDrag } from '../utils/startResizeDrag'

export function WorkspaceResizeHandles({
  mode,
  onResize,
}: {
  mode: AiWorkspaceMode
  onResize: (deltaWidth: number, deltaHeight: number) => void
}) {
  if (mode === 'window') return null

  return (
    <>
      <div
        className="absolute inset-y-0 left-0 z-30 w-1 cursor-col-resize bg-transparent transition-colors hover:bg-border"
        data-testid="ai-workspace-left-resize"
        onMouseDown={(event) => startResizeDrag(event, 'col-resize', (deltaX) => onResize(-deltaX, 0))}
      />
    </>
  )
}
