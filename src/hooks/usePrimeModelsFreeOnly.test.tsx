import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { usePrimeModelsFreeOnly } from './usePrimeModelsFreeOnly'

function Consumer({ id }: { id: string }) {
  const [freeOnly, setFreeOnly] = usePrimeModelsFreeOnly()
  return (
    <button type="button" data-testid={id} onClick={() => setFreeOnly(!freeOnly)}>
      {freeOnly ? 'free' : 'all'}
    </button>
  )
}

describe('usePrimeModelsFreeOnly', () => {
  beforeEach(() => localStorage.clear())

  it('keeps mounted consumers synchronized', () => {
    render(
      <>
        <Consumer id="picker" />
        <Consumer id="settings" />
      </>,
    )
    fireEvent.click(screen.getByTestId('settings'))
    expect(screen.getByTestId('picker')).toHaveTextContent('free')
    expect(screen.getByTestId('settings')).toHaveTextContent('free')
  })
})
