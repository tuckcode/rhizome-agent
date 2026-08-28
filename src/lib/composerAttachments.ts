/**
 * Images attached to a chat message.
 *
 * Prime has taken images all along — `docs/rpc.md` gives `prompt`, `steer` and
 * `follow_up` an optional `images` array of
 * `{"type":"image","data":"<base64>","mimeType":"image/png"}`. Rhizome sent
 * `message` alone and blocked the paste in the composer, so "only text is
 * supported" was our own refusal, not a limit of the engine.
 *
 * This module is the whole conversion: clipboard or drop payload in, the exact
 * wire shape out. Keeping it a pure module means the caps and the refusals are
 * testable without a DOM event or a running daemon.
 */

/**
 * What every vision model in Prime's catalog accepts. Deliberately not "any
 * `image/*`": TIFF, BMP and SVG are images to the browser and errors to the
 * provider, and a refusal here reads better than a 400 three seconds later.
 * SVG is also markup, so it has no business being decoded on our side.
 */
export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const

/**
 * Per-image byte cap, before base64 (which adds about a third).
 *
 * The daemon protocol is newline-delimited JSON over a unix socket, so an
 * oversized paste is not one slow message — it is one enormous line, and the
 * session stalls behind it. 5 MB covers any screenshot from a retina display.
 */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/** Per-message cap, for the same reason. */
export const MAX_IMAGES_PER_MESSAGE = 4

export interface ComposerAttachment {
  id: string
  /** Base64, no `data:` prefix — that prefix is a browser artifact. */
  data: string
  mimeType: string
  name: string
  byteSize: number
}

export interface PrimeImageContent {
  type: 'image'
  data: string
  mimeType: string
}

export type AttachmentRejection = 'unsupported_type' | 'too_large' | 'unreadable'

export type ReadAttachmentResult =
  | { ok: true; attachment: ComposerAttachment }
  | { ok: false; reason: AttachmentRejection; name: string }

export function isSupportedImageType(type: string): boolean {
  return (IMAGE_MIME_TYPES as readonly string[]).includes(type)
}

/**
 * The images in a paste or drop, ignoring everything else.
 *
 * A mixed payload keeps its images rather than being refused whole: pasting a
 * screenshot alongside text is the ordinary case, not an edge one.
 */
export function imageFilesFromTransfer(transfer: DataTransfer | null): File[] {
  if (!transfer) return []
  return Array.from(transfer.files ?? []).filter((file) => isSupportedImageType(file.type))
}

/**
 * Read one file into the base64 payload Prime wants.
 *
 * Returns a reason rather than throwing, because every rejection here is
 * something the user needs told — a silent drop is exactly the failure this
 * repo keeps finding (an unusable state that looks like a working one).
 */
export async function readImageAttachment(file: File): Promise<ReadAttachmentResult> {
  if (!isSupportedImageType(file.type)) {
    return { ok: false, reason: 'unsupported_type', name: file.name }
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, reason: 'too_large', name: file.name }
  }

  const dataUrl = await readAsDataUrl(file)
  if (dataUrl === null) return { ok: false, reason: 'unreadable', name: file.name }

  const data = dataUrl.slice(dataUrl.indexOf(',') + 1)
  if (!data) return { ok: false, reason: 'unreadable', name: file.name }

  return {
    ok: true,
    attachment: {
      id: attachmentId(file),
      data,
      mimeType: file.type,
      name: file.name || 'pasted image',
      byteSize: file.size,
    },
  }
}

/**
 * The `images` field for a `prompt` / `steer` / `follow_up` command.
 *
 * `null`, never `[]`, when there is nothing to send: a text-only turn has to
 * stay byte-identical to what Rhizome sent before this existed, so that
 * shipping image support cannot change how ordinary chat behaves.
 */
export function toPrimeImages(attachments: ComposerAttachment[]): PrimeImageContent[] | null {
  if (attachments.length === 0) return null
  return attachments.slice(0, MAX_IMAGES_PER_MESSAGE).map((attachment) => ({
    type: 'image',
    data: attachment.data,
    mimeType: attachment.mimeType,
  }))
}

function attachmentId(file: File): string {
  const salt = Math.random().toString(36).slice(2, 8)
  return `${file.name || 'image'}-${file.size}-${salt}`
}

function readAsDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}
