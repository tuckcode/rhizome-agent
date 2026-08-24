import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { createTranslator, type AppLocale } from '../lib/i18n'

export interface PrimeActiveCloseDialogProps {
  open: boolean
  locale?: AppLocale
  onStopAndClose: () => void
  onKeepWorking: () => void
  onCancel: () => void
}

export function PrimeActiveCloseDialog({
  open,
  locale = 'en',
  onStopAndClose,
  onKeepWorking,
  onCancel,
}: PrimeActiveCloseDialogProps) {
  const t = createTranslator(locale)

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel() }}>
      <DialogContent data-testid="prime-active-close-dialog">
        <DialogHeader>
          <DialogTitle>{t('ai.close.activeTitle')}</DialogTitle>
          <DialogDescription>{t('ai.close.activeDescription')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button variant="outline" onClick={onKeepWorking}>
            {t('ai.close.keepWorking')}
          </Button>
          <Button onClick={onStopAndClose} data-testid="prime-active-close-stop">
            {t('ai.close.stopAndClose')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
