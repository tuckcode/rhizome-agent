import { useState, type CSSProperties } from 'react'
import { Package } from '@phosphor-icons/react'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { ActionTooltip } from './ui/action-tooltip'
import { translate, type AppLocale } from '../lib/i18n'
import type { UpdateStatus, UpdateActions } from '../hooks/useUpdater'
import type { PrimeUpdateStatus, PrimeUpdateActions } from '../hooks/usePrimeUpdate'

export interface VersionUpdateIndicatorProps {
  rhizomeStatus: UpdateStatus
  rhizomeActions: UpdateActions
  primeStatus: PrimeUpdateStatus
  primeActions: PrimeUpdateActions
  compact?: boolean
  locale?: AppLocale
}

const dotStyle: CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: '50%',
  background: 'var(--accent-green)',
  flexShrink: 0,
}

const badgeStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
}

function isRhizomeAvailable(status: UpdateStatus): status is Extract<UpdateStatus, { state: 'available' }> {
  return status.state === 'available'
}

function isPrimeAvailable(status: PrimeUpdateStatus): status is Extract<PrimeUpdateStatus, { state: 'available' }> {
  return status.state === 'available'
}

function UpdateSection({
  heading,
  notes,
  onUpdateNow,
  updateNowLabel,
  footnote,
  locale,
  testId,
}: {
  heading: string
  notes: string
  onUpdateNow: () => void
  updateNowLabel: string
  footnote?: string
  locale: AppLocale
  testId: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{heading}</span>
        <Button type="button" size="xs" onClick={onUpdateNow} data-testid={`${testId}-update-now`}>
          {updateNowLabel}
        </Button>
      </div>
      <pre
        data-testid={`${testId}-notes`}
        style={{
          whiteSpace: 'pre-wrap',
          fontFamily: 'inherit',
          fontSize: 12,
          color: 'var(--muted-foreground)',
          background: 'var(--hover)',
          borderRadius: 6,
          padding: 8,
          margin: 0,
          maxHeight: 160,
          overflowY: 'auto',
        }}
      >
        {notes.trim() || translate(locale, 'versionUpdate.noNotes')}
      </pre>
      {footnote && (
        <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>{footnote}</p>
      )}
    </div>
  )
}

export function VersionUpdateIndicator({
  rhizomeStatus,
  rhizomeActions,
  primeStatus,
  primeActions,
  compact = false,
  locale = 'en',
}: VersionUpdateIndicatorProps) {
  const [open, setOpen] = useState(false)

  const rhizomeAvailable = isRhizomeAvailable(rhizomeStatus)
  const primeAvailable = isPrimeAvailable(primeStatus)

  if (!rhizomeAvailable && !primeAvailable) return null

  const className = compact
    ? 'h-6 min-w-0 gap-1 rounded-sm px-1 py-0.5 text-[12px] font-medium text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground'
    : 'h-auto gap-1 rounded-sm px-1 py-0.5 text-[12px] font-medium text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground'

  return (
    <>
      <ActionTooltip copy={{ label: translate(locale, 'versionUpdate.badgeLabel') }} side="top">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className={className}
          onClick={() => setOpen(true)}
          aria-label={translate(locale, 'versionUpdate.badgeLabel')}
          data-testid="status-version-update"
        >
          <span style={badgeStyle}>
            <Package size={13} weight="regular" />
            <span data-testid="status-version-update-dot" style={dotStyle} aria-hidden="true" />
          </span>
        </Button>
      </ActionTooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="version-update-modal">
          <DialogHeader>
            <DialogTitle>{translate(locale, 'versionUpdate.modalTitle')}</DialogTitle>
            <DialogDescription>{translate(locale, 'versionUpdate.modalDescription')}</DialogDescription>
          </DialogHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {rhizomeAvailable && (
              <UpdateSection
                heading={translate(locale, 'versionUpdate.rhizomeHeading', { version: rhizomeStatus.displayVersion })}
                notes={rhizomeStatus.notes ?? ''}
                onUpdateNow={() => {
                  rhizomeActions.startDownload()
                  setOpen(false)
                }}
                updateNowLabel={translate(locale, 'update.updateNow')}
                locale={locale}
                testId="version-update-rhizome"
              />
            )}
            {primeAvailable && (
              <UpdateSection
                heading={translate(locale, 'versionUpdate.primeHeading', { version: primeStatus.version })}
                notes={primeStatus.notes}
                onUpdateNow={() => {
                  primeActions.openPrimeReleasePage()
                }}
                updateNowLabel={translate(locale, 'update.updateNow')}
                footnote={translate(locale, 'versionUpdate.primeNeverAutoUpdates')}
                locale={locale}
                testId="version-update-prime"
              />
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              data-testid="version-update-maybe-later"
            >
              {translate(locale, 'versionUpdate.maybeLater')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
