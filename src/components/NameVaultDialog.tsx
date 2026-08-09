import { type ChangeEvent, type FormEvent, useCallback, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { translate, type AppLocale } from '@/lib/i18n'
import { RHIZOME_VAULT_DEFAULT_NAME, sanitizeVaultFolderName } from '@/utils/gettingStartedVault'

interface NameVaultDialogProps {
  open: boolean
  locale?: AppLocale
  onCancel: () => void
  /** Receives the sanitized folder name; the caller then picks the parent folder. */
  onConfirm: (vaultName: string) => void
}

/**
 * Asks for the new vault's folder name before the parent-folder picker opens.
 *
 * The preview line shows the sanitized result, so a user typing something the
 * filesystem cannot accept (path separators, Windows-reserved characters) sees
 * what will actually be created rather than being silently corrected after the
 * fact. See `sanitizeVaultFolderName`.
 */
export function NameVaultDialog({ open, locale = 'en', onCancel, onConfirm }: NameVaultDialogProps) {
  const [name, setName] = useState(RHIZOME_VAULT_DEFAULT_NAME)

  const sanitized = sanitizeVaultFolderName(name)
  const willBeRenamed = sanitized !== name.trim() && name.trim().length > 0

  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value)
  }, [])

  // Reset on every close path (cancel, submit, outside-click, Escape) rather
  // than on open via an effect, so the next open always starts fresh without
  // setting state during render/effects.
  const handleCancel = useCallback(() => {
    setName(RHIZOME_VAULT_DEFAULT_NAME)
    onCancel()
  }, [onCancel])

  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault()
      onConfirm(sanitized)
      setName(RHIZOME_VAULT_DEFAULT_NAME)
    },
    [onConfirm, sanitized],
  )

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleCancel() }}>
      <DialogContent className="sm:max-w-[440px]" data-testid="name-vault-dialog">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{translate(locale, 'onboarding.nameVault.title')}</DialogTitle>
            <DialogDescription>
              {translate(locale, 'onboarding.nameVault.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Input
              autoFocus
              value={name}
              onChange={handleChange}
              aria-label={translate(locale, 'onboarding.nameVault.label')}
              placeholder={RHIZOME_VAULT_DEFAULT_NAME}
              data-testid="name-vault-input"
            />
            {willBeRenamed && (
              <p
                className="mt-2 text-[12px] text-muted-foreground"
                data-testid="name-vault-preview"
              >
                {translate(locale, 'onboarding.nameVault.preview', { name: sanitized })}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleCancel} data-testid="name-vault-cancel">
              {translate(locale, 'onboarding.nameVault.cancel')}
            </Button>
            <Button type="submit" data-testid="name-vault-confirm">
              {translate(locale, 'onboarding.nameVault.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
