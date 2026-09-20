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

function primeUpdateSection(status: PrimeUpdateStatus) {
  if (
    status.state === 'available' ||
    status.state === 'applying' ||
    status.state === 'applied' ||
    status.state === 'failed'
  ) {
    return status
  }
  return null
}

function showsReleasePageFallback(
  status: NonNullable<ReturnType<typeof primeUpdateSection>>,
): boolean {
  if (status.state !== 'failed') return false
  if (status.method === 'unknown' || status.method === 'mise' || status.method === 'asdf') {
    return true
  }
  return status.message.toLowerCase().includes('release page')
}

function UpdateSection({
  heading,
  notes,
  onUpdateNow,
  updateNowLabel,
  footnote,
  locale,
  testId,
  disabled,
  statusLine,
  errorLine,
  fallbackLabel,
  onFallback,
  hideInlineAction = false,
}: {
  heading: string
  notes: string
  onUpdateNow: () => void
  updateNowLabel: string
  footnote?: string
  locale: AppLocale
  testId: string
  disabled?: boolean
  statusLine?: string
  errorLine?: string
  fallbackLabel?: string
  onFallback?: () => void
  hideInlineAction?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{heading}</span>
        {!hideInlineAction && (
          <Button
            type="button"
            size="xs"
            onClick={onUpdateNow}
            disabled={disabled}
            data-testid={`${testId}-update-now`}
          >
            {updateNowLabel}
          </Button>
        )}
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
      {statusLine && (
        <p data-testid={`${testId}-applying`} style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>
          {statusLine}
        </p>
      )}
      {errorLine && (
        <p data-testid={`${testId}-error`} style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>
          {errorLine}
        </p>
      )}
      {onFallback && fallbackLabel && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={onFallback}
          data-testid={`${testId}-open-release`}
        >
          {fallbackLabel}
        </Button>
      )}
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
  const primeSection = primeUpdateSection(primeStatus)

  if (!rhizomeAvailable && !primeSection) return null

  const className = compact
    ? 'h-6 min-w-0 gap-1 rounded-sm px-1 py-0.5 text-[12px] font-medium text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground'
    : 'h-auto gap-1 rounded-sm px-1 py-0.5 text-[12px] font-medium text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground'

  const primeHeadingVersion =
    primeSection?.state === 'applied' ? primeSection.installedVersion : primeSection?.version
  const primeApplying = primeSection?.state === 'applying'
  const primeApplied = primeSection?.state === 'applied'

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
            {primeSection && primeHeadingVersion && (
              <UpdateSection
                heading={`Chat engine ${primeHeadingVersion}`}
                notes={primeSection.notes}
                onUpdateNow={() => {
                  void primeActions.applyEngineUpdate()
                }}
                updateNowLabel={translate(locale, 'update.updateNow')}
                footnote="Rhizome Agent never updates the Chat engine unattended. Update now applies it here after you click."
                locale={locale}
                testId="version-update-prime"
                hideInlineAction
                disabled={primeApplying || primeApplied}
                statusLine={
                  primeApplying
                    ? 'Applying the Chat engine update…'
                    : primeApplied
                      ? `Chat engine is now ${primeHeadingVersion}.`
                      : undefined
                }
                errorLine={primeSection.state === 'failed' ? primeSection.message : undefined}
                fallbackLabel={showsReleasePageFallback(primeSection) ? 'Open release page' : undefined}
                onFallback={
                  showsReleasePageFallback(primeSection)
                    ? () => {
                        primeActions.openPrimeReleasePage()
                      }
                    : undefined
                }
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
            {primeSection && (
              <Button
                type="button"
                onClick={() => {
                  void primeActions.applyEngineUpdate()
                }}
                disabled={primeApplying || primeApplied}
                data-testid="version-update-prime-update-now"
              >
                {primeApplied
                  ? 'Updated'
                  : primeApplying
                    ? 'Applying…'
                    : translate(locale, 'update.updateNow')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
