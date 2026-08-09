import type { MouseEvent as ReactMouseEvent } from 'react'
import { normalizeExternalUrl, openExternalUrl, openLocalFile } from '../utils/url'
import {
  isVaultAttachmentUrl,
  resolveVaultAttachmentPath,
} from '../utils/vaultAttachments'

const FILE_BLOCK_ACTION_SELECTOR = [
  '[data-file-block] .bn-file-name-with-icon',
  '[data-file-block] a[href]',
].join(', ')
const FILE_BLOCK_CONTAINER_SELECTOR = '[data-node-type="blockContainer"][data-id]'
const FILE_BLOCK_TYPES = new Set(['audio', 'file', 'image', 'video'])

type FileBlockCandidate = {
  type?: unknown
  props?: {
    url?: unknown
  }
}

type EditorBlockLookup = {
  getBlock?: (id: string) => FileBlockCandidate | null | undefined
}

type EditorUrlOpenRequest = {
  url: string
  vaultPath?: string
  source: 'file' | 'link'
}

type FileBlockClickRequest = {
  event: ReactMouseEvent<HTMLDivElement>
  editor: EditorBlockLookup
  vaultPath?: string
}

function blockContainerFor(target: HTMLElement): HTMLElement | null {
  return target.closest<HTMLElement>(FILE_BLOCK_CONTAINER_SELECTOR)
}

function blockFromContainer(options: {
  blockContainer: HTMLElement | null
  editor: EditorBlockLookup
}): FileBlockCandidate | null {
  const blockId = options.blockContainer?.dataset.id
  const getBlock = options.editor.getBlock
  if (!blockId || typeof getBlock !== 'function') return null

  try {
    return getBlock(blockId) ?? null
  } catch (error) {
    console.warn('[file] Ignored stale file block click:', error)
    return null
  }
}

function fileBlockUrl(block: FileBlockCandidate | null): string | null {
  if (!FILE_BLOCK_TYPES.has(String(block?.type))) return null

  const url = block?.props?.url
  return typeof url === 'string' && url.trim().length > 0 ? url : null
}

function fileBlockUrlFromTarget(options: {
  target: HTMLElement
  editor: EditorBlockLookup
}): string | null {
  if (!options.target.closest(FILE_BLOCK_ACTION_SELECTOR)) return null

  return fileBlockUrl(
    blockFromContainer({
      blockContainer: blockContainerFor(options.target),
      editor: options.editor,
    }),
  )
}

function openLocalAttachment(options: {
  localPath: string
  source: EditorUrlOpenRequest['source']
  vaultPath?: string
}) {
  void openLocalFile(options.localPath, options.vaultPath).catch((error) => {
    console.warn(`[${options.source}] Failed to open attachment:`, error)
  })
}

function openExternalLink(options: EditorUrlOpenRequest) {
  const normalized = normalizeExternalUrl(options.url)
  if (!normalized) return

  void openExternalUrl(normalized).catch((error) => {
    console.warn(`[${options.source}] Failed to open URL:`, error)
  })
}

export function openEditorAttachmentOrUrl(options: EditorUrlOpenRequest) {
  const localPath = resolveVaultAttachmentPath(options)
  if (localPath) {
    openLocalAttachment({ ...options, localPath })
    return
  }

  if (isVaultAttachmentUrl(options)) {
    console.warn(`[${options.source}] Ignored attachment outside active vault:`, options.url)
    return
  }

  openExternalLink(options)
}

export function handleEditorFileBlockClick(options: FileBlockClickRequest): boolean {
  const target = options.event.target
  if (!(target instanceof HTMLElement)) return false
  if (!target.closest(FILE_BLOCK_ACTION_SELECTOR)) return false

  options.event.preventDefault()
  options.event.stopPropagation()

  const url = fileBlockUrlFromTarget({ target, editor: options.editor })
  if (!url) return true

  openEditorAttachmentOrUrl({ url, vaultPath: options.vaultPath, source: 'file' })
  return true
}
