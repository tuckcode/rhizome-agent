import { BookOpen, Megaphone } from '@phosphor-icons/react'
import type { createTranslator } from '../lib/i18n'
import { rememberFeedbackDialogOpener } from '../lib/feedbackDialogOpener'
import { Button } from './ui/button'
import { SectionHeading, SettingsGroup, SettingsGroupItem } from './SettingsControls'

type Translate = ReturnType<typeof createTranslator>

interface AboutSettingsSectionProps {
  t: Translate
  onOpenFeedback?: () => void
  onOpenDocs?: () => void
}

export function AboutSettingsSection({
  t,
  onOpenFeedback,
  onOpenDocs,
}: AboutSettingsSectionProps) {
  return (
    <>
      <SectionHeading
        title={t('settings.about.title')}
        description={t('settings.about.description')}
      />
      <SettingsGroup>
        {onOpenFeedback ? (
          <SettingsGroupItem testId="settings-about-contribute">
            <div className="flex items-center justify-between gap-3">
              <span className="space-y-1">
                <span className="block text-sm font-medium text-foreground">{t('status.feedback.label')}</span>
                <span className="block text-xs leading-5 text-muted-foreground">{t('settings.about.contributeDescription')}</span>
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="settings-about-contribute-open"
                onClick={(event) => {
                  rememberFeedbackDialogOpener(event.currentTarget)
                  onOpenFeedback()
                }}
              >
                <Megaphone size={14} weight="regular" />
                {t('status.feedback.label')}
              </Button>
            </div>
          </SettingsGroupItem>
        ) : null}
        {onOpenDocs ? (
          <SettingsGroupItem testId="settings-about-docs">
            <div className="flex items-center justify-between gap-3">
              <span className="space-y-1">
                <span className="block text-sm font-medium text-foreground">{t('status.docs.label')}</span>
                <span className="block text-xs leading-5 text-muted-foreground">{t('settings.about.docsDescription')}</span>
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="settings-about-docs-open"
                onClick={onOpenDocs}
              >
                <BookOpen size={14} weight="regular" />
                {t('status.docs.label')}
              </Button>
            </div>
          </SettingsGroupItem>
        ) : null}
      </SettingsGroup>
    </>
  )
}
