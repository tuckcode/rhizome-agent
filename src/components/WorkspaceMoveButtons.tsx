import { CaretDown, CaretUp } from '@phosphor-icons/react'
import { Button } from './ui/button'
import { createTranslator, type AppLocale } from '../lib/i18n'
import type { VaultOption } from './status-bar/types'
import type { VaultMoveDirection } from '../utils/vaultOrdering'
import type { workspaceIdentityFromVault } from '../utils/workspaces'

interface WorkspaceMoveButtonsProps {
  canMoveDown: boolean
  canMoveUp: boolean
  locale: AppLocale
  onMoveVault?: (path: string, direction: VaultMoveDirection) => void
  vault: VaultOption
  workspace: ReturnType<typeof workspaceIdentityFromVault>
}

export function WorkspaceMoveButtons({
  canMoveDown,
  canMoveUp,
  locale,
  onMoveVault,
  vault,
  workspace,
}: WorkspaceMoveButtonsProps) {
  const t = createTranslator(locale)
  const moveUpLabel = t('settings.workspaces.moveUpAria', { label: workspace.label })
  const moveDownLabel = t('settings.workspaces.moveDownAria', { label: workspace.label })

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => onMoveVault?.(vault.path, 'up')}
        disabled={!onMoveVault || !canMoveUp}
        aria-label={moveUpLabel}
        title={moveUpLabel}
        data-testid={`settings-workspace-move-up-${workspace.alias}`}
        className="text-muted-foreground hover:text-foreground"
      >
        <CaretUp size={15} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => onMoveVault?.(vault.path, 'down')}
        disabled={!onMoveVault || !canMoveDown}
        aria-label={moveDownLabel}
        title={moveDownLabel}
        data-testid={`settings-workspace-move-down-${workspace.alias}`}
        className="text-muted-foreground hover:text-foreground"
      >
        <CaretDown size={15} />
      </Button>
    </div>
  )
}
