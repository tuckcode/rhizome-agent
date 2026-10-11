import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

declare global {
  interface Window {
    __rhizomeUnbindBootMotion?: () => void
  }
}

function bootMotionScript(): string {
  const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8')
  const marker = 'function syncBootMotion'
  const markerAt = html.indexOf(marker)
  const start = html.lastIndexOf('(function () {', markerAt)
  const end = html.indexOf('})();', markerAt)
  if (start < 0 || end < 0) throw new Error('boot motion script was not found')
  return html.slice(start, end + '})();'.length)
}

function setDocumentHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => hidden,
  })
}

function motionState(): string {
  return document.documentElement.style.getPropertyValue('--boot-motion-state')
}

function motionFlag(): string | null {
  return document.documentElement.getAttribute('data-boot-motion')
}

function runBootMotion(hidden: boolean) {
  setDocumentHidden(hidden)
  new Function(bootMotionScript())()
}

describe('HTML boot motion', () => {
  afterEach(() => {
    window.__rhizomeUnbindBootMotion?.()
    document.documentElement.style.removeProperty('--boot-motion-state')
    document.documentElement.removeAttribute('data-boot-motion')
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    })
  })

  it('does not pause grow-in when the document is hidden at first paint', () => {
    runBootMotion(true)
    expect(motionState()).toBe('running')
    expect(motionFlag()).toBe('running')
  })

  it('resumes motion when visibility becomes visible', () => {
    let hidden = true
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hidden,
    })
    new Function(bootMotionScript())()
    hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
    expect(motionState()).toBe('running')
    expect(motionFlag()).toBe('running')
  })

  it('can pause after the page has been visible, then resumes again', () => {
    let hidden = false
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hidden,
    })
    new Function(bootMotionScript())()
    expect(motionState()).toBe('running')

    hidden = true
    document.dispatchEvent(new Event('visibilitychange'))
    expect(motionState()).toBe('paused')
    expect(motionFlag()).toBe('paused')

    hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
    expect(motionState()).toBe('running')
    expect(motionFlag()).toBe('running')
  })
})
