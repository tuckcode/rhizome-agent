interface FeedbackDialogOpener {
  element: HTMLElement | null
  reopenCommandPalette: boolean
}

const EMPTY_OPENER: FeedbackDialogOpener = {
  element: null,
  reopenCommandPalette: false,
}

let pendingOpener: FeedbackDialogOpener = EMPTY_OPENER

function isCommandPaletteInput(element: Element | null): boolean {
  return element instanceof Element
    && element.tagName === 'INPUT'
    && element.getAttribute('placeholder') === 'Type a command...'
}

export function rememberFeedbackDialogOpener(element: HTMLElement | null): void {
  pendingOpener = {
    element,
    reopenCommandPalette: isCommandPaletteInput(element),
  }
}

export function takeFeedbackDialogOpener(): FeedbackDialogOpener {
  const opener = pendingOpener
  pendingOpener = EMPTY_OPENER
  return opener
}
