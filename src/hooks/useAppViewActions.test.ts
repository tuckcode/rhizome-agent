import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ViewDefinition, ViewFile } from '../types'
import { useAppViewActions } from './useAppViewActions'

const mockInvokeFn = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvokeFn(...args),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (...args: unknown[]) => mockInvokeFn(...args),
}))

vi.mock('../lib/telemetry', () => ({
  trackEvent: vi.fn(),
}))

/** A board view with keys this app version does not know. */
const board = {
  name: 'Board',
  icon: null,
  color: null,
  order: 0,
  sort: null,
  filters: { all: [] },
  presentation: { type: 'board', groupBy: 'Status', columns: ['Done'], cardSize: 'large' },
  futureSetting: { nested: true },
} as ViewDefinition

const boardView: ViewFile = { filename: 'board.yml', definition: board }

function renderActions(editingView: { definition: ViewDefinition, filename: string } | null = null) {
  const setToastMessage = vi.fn()
  const vault = {
    markVaultUnavailable: vi.fn(),
    reloadFolders: vi.fn(),
    reloadVault: vi.fn().mockResolvedValue(undefined),
    reloadViews: vi.fn().mockResolvedValue(undefined),
    views: [boardView],
  }
  const hook = renderHook(() => useAppViewActions({
    editingView,
    graphDefaultWorkspacePath: '/vault',
    handleSetSelection: vi.fn(),
    multiWorkspaceEnabled: false,
    notes: {
      createTypeEntrySilent: vi.fn(),
      handleCreateType: vi.fn(),
      handleUpdateFrontmatter: vi.fn(),
    },
    onOpenEditView: vi.fn(),
    resolvedPath: '/vault',
    selection: { kind: 'view', filename: 'board.yml' },
    setToastMessage,
    vault,
    visibleEntries: [],
  }))
  return { ...hook, setToastMessage }
}

function savedDefinition(): unknown {
  const call = mockInvokeFn.mock.calls.find(([command]) => command === 'save_view_cmd')
  return (call?.[1] as { definition: unknown } | undefined)?.definition
}

describe('useAppViewActions keeps unknown view keys', () => {
  beforeEach(() => {
    mockInvokeFn.mockReset()
    mockInvokeFn.mockResolvedValue(null)
  })

  it('on rename', async () => {
    const { result, setToastMessage } = renderActions()

    await act(async () => {
      result.current.handleSidebarUpdateViewDefinition('board.yml', { name: 'Renamed' })
    })

    expect(savedDefinition()).toEqual({ ...board, name: 'Renamed' })
    expect(setToastMessage).toHaveBeenCalledWith('View "Renamed" renamed')
  })

  it('on an inline update', async () => {
    const { result } = renderActions()

    await act(async () => {
      await result.current.handleUpdateViewDefinition('board.yml', { icon: 'star' })
    })

    expect(savedDefinition()).toEqual({ ...board, icon: 'star' })
  })

  it('when the edit dialog saves only the fields it knows', async () => {
    const { result } = renderActions({ definition: board, filename: 'board.yml' })
    const fromDialog: ViewDefinition = {
      name: 'Board',
      icon: 'kanban',
      color: null,
      sort: null,
      filters: { all: [] },
    }

    await act(async () => {
      await result.current.handleCreateOrUpdateView(fromDialog)
    })

    expect(savedDefinition()).toEqual({ ...board, icon: 'kanban' })
  })
})
