import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CreateNoteDialog } from './CreateNoteDialog'

describe('CreateNoteDialog', () => {
  const onCreate = vi.fn()
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when not open', () => {
    const { container } = render(
      <CreateNoteDialog open={false} onClose={onClose} onCreate={onCreate} />
    )
    expect(container.querySelector('form')).toBeNull()
  })

  it('shows title input and type buttons when open', () => {
    render(<CreateNoteDialog open={true} onClose={onClose} onCreate={onCreate} />)
    expect(screen.getByPlaceholderText('Enter note title...')).toBeInTheDocument()
    expect(screen.getByText('Note')).toBeInTheDocument()
    expect(screen.getByText('Project')).toBeInTheDocument()
    expect(screen.getByText('Topic')).toBeInTheDocument()
  })

  it('disables Create button when title is empty', () => {
    render(<CreateNoteDialog open={true} onClose={onClose} onCreate={onCreate} />)
    expect(screen.getByText('Create')).toBeDisabled()
  })

  it('enables Create button when title is entered', () => {
    render(<CreateNoteDialog open={true} onClose={onClose} onCreate={onCreate} />)
    const input = screen.getByPlaceholderText('Enter note title...')
    fireEvent.change(input, { target: { value: 'My Note' } })
    expect(screen.getByText('Create')).not.toBeDisabled()
  })

  it('calls onCreate with trimmed title and selected type', () => {
    render(<CreateNoteDialog open={true} onClose={onClose} onCreate={onCreate} />)
    const input = screen.getByPlaceholderText('Enter note title...')
    fireEvent.change(input, { target: { value: '  My Project  ' } })

    // Select Project type
    fireEvent.click(screen.getByText('Project'))

    // Submit
    fireEvent.click(screen.getByText('Create'))

    expect(onCreate).toHaveBeenCalledWith('My Project', 'Project')
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onCreate on form submit (Enter key)', () => {
    render(<CreateNoteDialog open={true} onClose={onClose} onCreate={onCreate} />)
    const input = screen.getByPlaceholderText('Enter note title...')
    fireEvent.change(input, { target: { value: 'Test' } })
    fireEvent.submit(input.closest('form')!)

    expect(onCreate).toHaveBeenCalledWith('Test', 'Note')
  })

  it('does not submit when title is whitespace', () => {
    render(<CreateNoteDialog open={true} onClose={onClose} onCreate={onCreate} />)
    const input = screen.getByPlaceholderText('Enter note title...')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.submit(input.closest('form')!)

    expect(onCreate).not.toHaveBeenCalled()
  })

  it('calls onClose on Cancel button', () => {
    render(<CreateNoteDialog open={true} onClose={onClose} onCreate={onCreate} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('uses defaultType when provided', () => {
    render(<CreateNoteDialog open={true} onClose={onClose} onCreate={onCreate} defaultType="Project" />)
    const input = screen.getByPlaceholderText('Enter note title...')
    fireEvent.change(input, { target: { value: 'New Project' } })
    fireEvent.submit(input.closest('form')!)

    expect(onCreate).toHaveBeenCalledWith('New Project', 'Project')
  })

  it('renders custom types', () => {
    render(
      <CreateNoteDialog open={true} onClose={onClose} onCreate={onCreate} customTypes={['Recipe', 'Book']} />
    )
    expect(screen.getByText('Recipe')).toBeInTheDocument()
    expect(screen.getByText('Book')).toBeInTheDocument()
  })

  it('allows selecting a custom type', () => {
    render(
      <CreateNoteDialog open={true} onClose={onClose} onCreate={onCreate} customTypes={['Recipe']} />
    )
    const input = screen.getByPlaceholderText('Enter note title...')
    fireEvent.change(input, { target: { value: 'Pasta Recipe' } })
    fireEvent.click(screen.getByText('Recipe'))
    fireEvent.submit(input.closest('form')!)

    expect(onCreate).toHaveBeenCalledWith('Pasta Recipe', 'Recipe')
  })
})
