import { useCallback, useState } from 'react'
import { useMcpStatus } from './useMcpStatus'
import type { AppLocale } from '../lib/i18n'

type ToastHandler = (message: string) => void
type McpDialogAction = 'connect' | 'disconnect' | null
type McpDialogMutation = () => Promise<boolean>

async function runDialogMutation(
  action: Exclude<McpDialogAction, null>,
  setBusyAction: (action: McpDialogAction) => void,
  setOpen: (open: boolean) => void,
  mutate: McpDialogMutation,
) {
  setBusyAction(action)
  try {
    if (await mutate()) setOpen(false)
  } finally {
    setBusyAction(null)
  }
}

export function useMcpSetupDialogController(
  vaultPath: string,
  onToast: ToastHandler,
  locale: AppLocale,
) {
  const [open, setOpen] = useState(false)
  const [busyAction, setBusyAction] = useState<McpDialogAction>(null)
  const {
    mcpStatus,
    connectMcp,
    disconnectMcp,
    mcpConfigSnippet,
    opencodeMcpConfigSnippet,
    mcpConfigLoading,
    mcpConfigError,
    loadMcpConfigSnippets,
    copyMcpConfig,
    copyOpenCodeMcpConfig,
  } = useMcpStatus(vaultPath, onToast, locale)

  const openDialog = useCallback(() => {
    setOpen(true)
  }, [])

  const closeDialog = useCallback(() => {
    if (busyAction !== null) return
    setOpen(false)
  }, [busyAction])

  const connect = useCallback(
    () => runDialogMutation('connect', setBusyAction, setOpen, connectMcp),
    [connectMcp],
  )

  const disconnect = useCallback(
    () => runDialogMutation('disconnect', setBusyAction, setOpen, disconnectMcp),
    [disconnectMcp],
  )

  const copyManualConfig = useCallback(() => {
    void copyMcpConfig()
  }, [copyMcpConfig])

  const copyOpenCodeManualConfig = useCallback(() => {
    void copyOpenCodeMcpConfig()
  }, [copyOpenCodeMcpConfig])

  const loadManualConfig = useCallback(() => {
    void loadMcpConfigSnippets().catch(() => undefined)
  }, [loadMcpConfigSnippets])

  return {
    busyAction,
    closeDialog,
    connect,
    copyManualConfig,
    copyOpenCodeManualConfig,
    disconnect,
    loadManualConfig,
    manualConfigError: mcpConfigError,
    manualConfigLoading: mcpConfigLoading,
    manualConfigSnippet: mcpConfigSnippet,
    opencodeManualConfigSnippet: opencodeMcpConfigSnippet,
    open,
    openDialog,
    status: mcpStatus,
  }
}
