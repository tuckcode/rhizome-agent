import type { useCreateBlockNote } from '@blocknote/react'

export function clearTableResizeState(editor: ReturnType<typeof useCreateBlockNote>) {
  const view = editor._tiptapEditor?.view
  if (!view || view.isDestroyed) return

  const resizePluginKey = view.state.plugins.find((plugin: { key?: unknown }) => (
    typeof plugin.key === 'string' && plugin.key.startsWith('tableColumnResizing')
  ))?.key
  if (!resizePluginKey) return

  try {
    view.dispatch(
      view.state.tr.setMeta(resizePluginKey, {
        setHandle: -1,
        setDragging: null,
      }),
    )
  } catch (error) {
    console.warn('Failed to clear table resize state before raw mode toggle:', error)
  }
}
