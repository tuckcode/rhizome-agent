import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { NameVaultDialog } from './NameVaultDialog'
import { RHIZOME_VAULT_DEFAULT_NAME } from '@/utils/gettingStartedVault'

describe('NameVaultDialog', () => {
  it('does not render when closed', () => {
    render(<NameVaultDialog open={false} onCancel={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.queryByTestId('name-vault-dialog')).not.toBeInTheDocument()
  })

  it('pre-fills the input with the default vault name', () => {
    render(<NameVaultDialog open onCancel={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.getByTestId('name-vault-input')).toHaveValue(RHIZOME_VAULT_DEFAULT_NAME)
  })

  it('confirms with the default name when submitted unchanged', () => {
    const onConfirm = vi.fn()
    render(<NameVaultDialog open onCancel={vi.fn()} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByTestId('name-vault-confirm'))
    expect(onConfirm).toHaveBeenCalledWith(RHIZOME_VAULT_DEFAULT_NAME)
  })

  it('confirms with a typed custom name', () => {
    const onConfirm = vi.fn()
    render(<NameVaultDialog open onCancel={vi.fn()} onConfirm={onConfirm} />)
    fireEvent.change(screen.getByTestId('name-vault-input'), { target: { value: 'Work Notes' } })
    fireEvent.click(screen.getByTestId('name-vault-confirm'))
    expect(onConfirm).toHaveBeenCalledWith('Work Notes')
  })

  it('confirms with the sanitized name, not the raw typed value', () => {
    const onConfirm = vi.fn()
    render(<NameVaultDialog open onCancel={vi.fn()} onConfirm={onConfirm} />)
    fireEvent.change(screen.getByTestId('name-vault-input'), { target: { value: '../../etc' } })
    fireEvent.click(screen.getByTestId('name-vault-confirm'))
    expect(onConfirm).toHaveBeenCalledWith('etc')
  })

  it('shows a sanitized-name preview only when the sanitized result differs from the typed value', () => {
    render(<NameVaultDialog open onCancel={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.queryByTestId('name-vault-preview')).not.toBeInTheDocument()

    fireEvent.change(screen.getByTestId('name-vault-input'), { target: { value: 'My:Vault?' } })
    expect(screen.getByTestId('name-vault-preview')).toHaveTextContent('MyVault')
  })

  it('calls onCancel and not onConfirm when cancelled', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    render(<NameVaultDialog open onCancel={onCancel} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByTestId('name-vault-cancel'))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('submitting the form (Enter in the input) confirms like clicking the button', () => {
    const onConfirm = vi.fn()
    render(<NameVaultDialog open onCancel={vi.fn()} onConfirm={onConfirm} />)
    const input = screen.getByTestId('name-vault-input')
    fireEvent.change(input, { target: { value: 'Work Notes' } })
    fireEvent.submit(input.closest('form')!)
    expect(onConfirm).toHaveBeenCalledWith('Work Notes')
  })
})
