import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ColorSwatch, ColorEditableValue } from './ColorInput'

describe('ColorSwatch', () => {
  it('renders a swatch button with the given color', () => {
    render(<ColorSwatch color="#3b82f6" />)
    const swatch = screen.getByTestId('color-swatch')
    expect(swatch).toBeTruthy()
    // Browser normalizes hex to rgb() in computed style
    expect(swatch.style.background).toBeTruthy()
  })

  it('contains a hidden color input', () => {
    render(<ColorSwatch color="#ff0000" />)
    const input = screen.getByTestId('color-picker-input') as HTMLInputElement
    expect(input.type).toBe('color')
    expect(input.value).toBe('#ff0000')
  })

  it('calls onChange when color is picked', () => {
    const onChange = vi.fn()
    render(<ColorSwatch color="#ff0000" onChange={onChange} />)
    const input = screen.getByTestId('color-picker-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '#00ff00' } })
    expect(onChange).toHaveBeenCalledWith('#00ff00')
  })

  it('opens color input on Enter key', () => {
    const clickSpy = vi.fn()
    render(<ColorSwatch color="#ff0000" />)
    const input = screen.getByTestId('color-picker-input') as HTMLInputElement
    input.click = clickSpy
    const swatch = screen.getByTestId('color-swatch')
    fireEvent.keyDown(swatch, { key: 'Enter' })
    expect(clickSpy).toHaveBeenCalled()
  })

  it('opens color input on Space key', () => {
    const clickSpy = vi.fn()
    render(<ColorSwatch color="#ff0000" />)
    const input = screen.getByTestId('color-picker-input') as HTMLInputElement
    input.click = clickSpy
    const swatch = screen.getByTestId('color-swatch')
    fireEvent.keyDown(swatch, { key: ' ' })
    expect(clickSpy).toHaveBeenCalled()
  })
})

describe('ColorEditableValue', () => {
  it('left-aligns the text display in view mode', () => {
    render(<ColorEditableValue value="#3b82f6" isEditing={false} onStartEdit={vi.fn()} onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('#3b82f6')).toHaveClass('text-left')
  })

  it('shows swatch when value is a valid hex color', () => {
    render(<ColorEditableValue value="#3b82f6" isEditing={false} onStartEdit={vi.fn()} onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByTestId('color-swatch')).toBeTruthy()
  })

  it('does not show swatch when value is not a color', () => {
    render(<ColorEditableValue value="hello world" isEditing={false} onStartEdit={vi.fn()} onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByTestId('color-swatch')).toBeNull()
  })

  it('does not show swatch for empty string', () => {
    render(<ColorEditableValue value="" isEditing={false} onStartEdit={vi.fn()} onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByTestId('color-swatch')).toBeNull()
  })

  it('shows swatch in edit mode for valid color', () => {
    render(<ColorEditableValue value="#ff0000" isEditing={true} onStartEdit={vi.fn()} onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByTestId('color-swatch')).toBeTruthy()
    expect(screen.getByTestId('color-text-input')).toBeTruthy()
  })

  it('updates value when color is picked', () => {
    const onSave = vi.fn()
    render(<ColorEditableValue value="#ff0000" isEditing={false} onStartEdit={vi.fn()} onSave={onSave} onCancel={vi.fn()} />)
    const input = screen.getByTestId('color-picker-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '#00ff00' } })
    expect(onSave).toHaveBeenCalledWith('#00ff00')
  })

  it('text field works independently in edit mode', () => {
    const onSave = vi.fn()
    render(<ColorEditableValue value="#ff0000" isEditing={true} onStartEdit={vi.fn()} onSave={onSave} onCancel={vi.fn()} />)
    const textInput = screen.getByTestId('color-text-input') as HTMLInputElement
    fireEvent.change(textInput, { target: { value: '#0000ff' } })
    fireEvent.keyDown(textInput, { key: 'Enter' })
    expect(onSave).toHaveBeenCalledWith('#0000ff')
  })

  it('Escape cancels edit', () => {
    const onCancel = vi.fn()
    render(<ColorEditableValue value="#ff0000" isEditing={true} onStartEdit={vi.fn()} onSave={vi.fn()} onCancel={onCancel} />)
    const textInput = screen.getByTestId('color-text-input') as HTMLInputElement
    fireEvent.keyDown(textInput, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
  })
})
