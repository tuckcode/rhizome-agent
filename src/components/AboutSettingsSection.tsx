import { BookOpen, Megaphone } from '@phosphor-icons/react'
import rhizomeOrganicHero from '../assets/brand/rhizome-organic-hero.png'
import { RHIZOME_DOCS_URL } from '../constants/feedback'
import type { createTranslator } from '../lib/i18n'
import { rememberFeedbackDialogOpener } from '../lib/feedbackDialogOpener'
import { openExternalUrl } from '../utils/url'
import { Button } from './ui/button'
import { SectionHeading, SettingsGroup, SettingsGroupItem } from './SettingsControls'

const RHIZOME_LICENSE_URL = `${RHIZOME_DOCS_URL}/blob/main/LICENSE`
const TOLARIA_SOURCE_URL = 'https://github.com/refactoringhq/tolaria'

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
      <img
        src={rhizomeOrganicHero}
        alt="Rhizome"
        width={1774}
        height={887}
        loading="lazy"
        decoding="async"
        className="mb-4 block h-auto w-full rounded-lg"
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
        <SettingsGroupItem testId="settings-about-legal">
          <div className="space-y-1">
            <p className="text-xs leading-5 text-muted-foreground">{t('settings.about.legalNotice')}</p>
            <p className="text-xs leading-5 text-muted-foreground">{t('settings.about.tolariaCredit')}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <Button
                type="button"
                variant="link"
                size="xs"
                className="h-auto px-0 py-0 text-xs"
                onClick={() => void openExternalUrl(RHIZOME_DOCS_URL)}
              >
                {t('settings.about.sourceLink')}
              </Button>
              <Button
                type="button"
                variant="link"
                size="xs"
                className="h-auto px-0 py-0 text-xs"
                onClick={() => void openExternalUrl(RHIZOME_LICENSE_URL)}
              >
                {t('settings.about.licenseLink')}
              </Button>
              <Button
                type="button"
                variant="link"
                size="xs"
                className="h-auto px-0 py-0 text-xs"
                onClick={() => void openExternalUrl(TOLARIA_SOURCE_URL)}
              >
                {t('settings.about.tolariaLink')}
              </Button>
            </div>
          </div>
        </SettingsGroupItem>
      </SettingsGroup>
    </>
  )
}
