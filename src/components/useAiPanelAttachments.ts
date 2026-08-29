import { useCallback, useState } from 'react'
import {
  MAX_IMAGES_PER_MESSAGE,
  readImageAttachment,
  type AttachmentRejection,
  type ComposerAttachment,
} from '../lib/composerAttachments'
import { trackComposerImagesAttached } from '../lib/productAnalytics'
import { translate, type AppLocale } from '../lib/i18n'

/** Why an attachment was refused, in words the user can act on. */
const ATTACHMENT_REJECTION_KEYS: Record<AttachmentRejection, Parameters<typeof translate>[1]> = {
  too_large: 'ai.composer.attachmentTooLarge',
  unsupported_type: 'ai.composer.attachmentUnsupported',
  unreadable: 'ai.composer.attachmentUnreadable',
}

interface UseAiPanelAttachmentsArgs {
  locale: AppLocale
  onUnsupportedAiPaste?: (message: string) => void
  /**
   * `null`/`undefined` means Prime did not report modalities, and silence is
   * not a refusal: only an explicit `false` warns the user their image will
   * not be seen.
   */
  modelAcceptsImages: boolean | null | undefined
  modelName?: string | null
  modelId?: string | null
}

interface UseAiPanelAttachmentsResult {
  attachments: ComposerAttachment[]
  /** Read straight off the host status — no catalog fetch, no id to match. */
  attachImages: (files: File[]) => void
  removeAttachment: (id: string) => void
  /** Called on every accepted send so an attachment never rides along with a later, unrelated turn. */
  clearAttachments: () => void
}

/**
 * Images staged for the next message.
 *
 * Owned outside the composer because the composer is stateless about the
 * message it is building — the same reason `input` lives in the panel.
 */
export function useAiPanelAttachments({
  locale,
  onUnsupportedAiPaste,
  modelAcceptsImages,
  modelName,
  modelId,
}: UseAiPanelAttachmentsArgs): UseAiPanelAttachmentsResult {
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])

  /**
   * Warn when the running model cannot see the image.
   *
   * The first cut fetched the model catalog and looked the model up — and the
   * warning never fired in the app. Reading `modelAcceptsImages` straight off
   * the host status was the fix.
   */
  const warnIfModelIsTextOnly = useCallback(() => {
    if (modelAcceptsImages !== false) return
    onUnsupportedAiPaste?.(translate(locale, 'ai.composer.attachmentTextOnlyModel', {
      model: modelName ?? modelId ?? '',
    }))
  }, [locale, onUnsupportedAiPaste, modelAcceptsImages, modelId, modelName])

  const attachImages = useCallback((files: File[]) => {
    void (async () => {
      const results = await Promise.all(files.map(readImageAttachment))
      const accepted = results.flatMap((result) => (result.ok ? [result.attachment] : []))
      // Every rejection is said out loud. A silently dropped attachment is the
      // exact failure this repo keeps rediscovering: an unusable state that
      // looks like a working one.
      for (const result of results) {
        if (result.ok) continue
        onUnsupportedAiPaste?.(translate(locale, 'ai.composer.attachmentRejected', {
          name: result.name,
          reason: translate(locale, ATTACHMENT_REJECTION_KEYS[result.reason]),
        }))
      }
      if (accepted.length === 0) return
      // Say something only when Prime has actually told us the model is
      // text-only. Unknown modalities stay silent — the same refusal to guess
      // that `partitionModelsByConnection` makes about credentials.
      warnIfModelIsTextOnly()
      setAttachments((current) => {
        const next = [...current, ...accepted]
        if (next.length > MAX_IMAGES_PER_MESSAGE) {
          onUnsupportedAiPaste?.(translate(locale, 'ai.composer.attachmentTooMany', {
            count: String(MAX_IMAGES_PER_MESSAGE),
          }))
        }
        return next.slice(0, MAX_IMAGES_PER_MESSAGE)
      })
      trackComposerImagesAttached(accepted.length)
    })()
  }, [locale, onUnsupportedAiPaste, warnIfModelIsTextOnly])

  const removeAttachment = useCallback((id: string) => {
    setAttachments((current) => current.filter((attachment) => attachment.id !== id))
  }, [])

  const clearAttachments = useCallback(() => setAttachments([]), [])

  return { attachments, attachImages, removeAttachment, clearAttachments }
}
