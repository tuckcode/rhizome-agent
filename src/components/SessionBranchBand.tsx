import { GitFork } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createTranslator, type AppLocale } from '../lib/i18n'
import {
  sessionTreeBranchCount,
  sessionTreeBranchGroups,
  type PrimeSessionTree,
} from '../lib/primeSessionTree'

/**
 * Branches *inside* the current conversation (#17).
 *
 * The sessions drawer switches between conversations. This strip stays on
 * this one and names the fork points so a wrong turn is recoverable. Renders
 * nothing when the tree is linear — same silence rule as the activity band.
 */
export function SessionBranchBand({
  locale = 'en',
  tree,
  onSelect,
  busyId,
  error,
}: {
  locale?: AppLocale
  tree: PrimeSessionTree
  onSelect: (targetId: string) => void
  busyId?: string | null
  error?: string | null
}) {
  const t = createTranslator(locale)
  const groups = sessionTreeBranchGroups(tree)
  const count = sessionTreeBranchCount(tree)

  if (groups.length === 0) return null

  return (
    <div
      className="flex shrink-0 flex-col gap-1 border-b border-border px-3 py-1 font-mono text-[10px] tracking-[0.02em]"
      data-testid="session-branch-band"
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <GitFork size={11} weight="regular" aria-hidden="true" />
        <span>{t('ai.activity.branches', { count })}</span>
      </div>
      {groups.map((group) => (
        <ul
          key={group.map((row) => row.id).join(':')}
          className="flex flex-col gap-0.5"
          aria-label={t('ai.activity.branches', { count })}
        >
          {group.map((row) => (
            <li key={row.id} className="flex min-w-0 items-center gap-2" data-testid="session-branch-row">
              {row.current ? (
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {row.title}
                  <span className="text-muted-foreground"> · {t('ai.activity.branchCurrent')}</span>
                </span>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className={cn('h-auto min-w-0 flex-1 justify-start px-0 py-0 font-mono text-[10px]')}
                  data-testid="session-branch-select"
                  disabled={busyId === row.id}
                  onClick={() => onSelect(row.id)}
                >
                  <span className="truncate">{row.title}</span>
                </Button>
              )}
            </li>
          ))}
        </ul>
      ))}
      {error ? (
        <p className="text-destructive" data-testid="session-branch-error">
          {error}
        </p>
      ) : null}
    </div>
  )
}
