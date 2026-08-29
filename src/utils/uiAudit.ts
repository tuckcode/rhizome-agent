/**
 * Structural UI checks that do not need an eye.
 *
 * Every defect this finds was found the slow way first — by the user pointing
 * at a screenshot, or by me measuring one element after a bug report. None of
 * them needed judgement; each is a property of the rendered page that a
 * function can read. So they should be read by a function.
 *
 * Pure and DOM-only on purpose: it runs in a browser page, a Playwright
 * `page.evaluate`, or a jsdom test. It reports; it never fixes and never
 * clicks.
 */

export type UiAuditRule =
  | 'inert-control'
  | 'duplicate-control'
  | 'tiny-target'
  | 'overlapping-controls'

export interface UiAuditFinding {
  rule: UiAuditRule
  /** What a person would call the thing, for reading the report. */
  label: string
  detail: string
  testId?: string
}

/**
 * Apple's minimum is 44px; this is a dense desktop app driven by a mouse, so
 * that floor would flag almost every control and the report would be noise
 * nobody reads — the same failure mode as a gate nobody runs.
 *
 * Two thresholds instead, because two different things are hard to hit:
 *
 * - **Icon-sized**: small in *both* directions. A 21x21 icon button is a real
 *   miss risk; a 71x21 pill is not, because it is 71px wide to aim at.
 * - **Thin**: under 12px in either direction, however long. The resize handle
 *   was 8x604 and took three attempts to grab even while aiming at exact
 *   coordinates.
 *
 * Worth knowing when reading the numbers: this app's root font size is
 * **14px, not 16**, so every Tailwind `rem` size renders at 87.5% of what its
 * class name suggests. `h-6` reads as 24px and is 21px. That is why the
 * session row actions failed this rule while looking correct in the source.
 */
const MIN_ICON_TARGET_PX = 24
const MIN_THIN_TARGET_PX = 12

const INTERACTIVE_SELECTOR = [
  'button',
  '[role="button"]',
  '[role="menuitem"]',
  '[role="checkbox"]',
  '[role="separator"]',
  'a[href]',
  'input',
  'select',
  'textarea',
].join(',')

export function auditUi(root: ParentNode = document): UiAuditFinding[] {
  const controls = [...root.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR)].filter(isVisible)
  return [
    ...inertControls(root),
    ...duplicateControls(controls),
    ...tinyTargets(controls),
    ...overlappingControls(controls),
  ]
}

/**
 * Something styled like a control that cannot be pressed.
 *
 * The `ctx · note` pill was exactly this: rounded, bordered, inert. So was
 * "Save as custom" for months. The rest of the app teaches that a pill is a
 * dropdown, so one that does nothing reads as a broken app.
 *
 * Detected by shape rather than by handler: React attaches listeners in ways
 * the DOM will not report, so asking "does this have onclick" finds nothing.
 * Asking "does this look pressable but is not focusable or a real control"
 * finds the real cases.
 */
function inertControls(root: ParentNode): UiAuditFinding[] {
  const suspects = [...root.querySelectorAll<HTMLElement>('span, div')].filter(isVisible)
  return suspects.flatMap((node) => {
    if (node.closest(INTERACTIVE_SELECTOR)) return []
    const style = getComputedStyle(node)
    const { width, height } = node.getBoundingClientRect()
    // Control-sized, not card-sized. A bordered rounded *panel* — the
    // onboarding card, a settings section — is not pretending to be
    // pressable; a 22px pill is. Without this the rule fires on every card in
    // the app and the report becomes noise nobody reads.
    const controlSized = height <= 40 && width <= 360
    const looksPressable =
      controlSized &&
      Number.parseFloat(style.borderTopWidth) > 0 &&
      cornerRadius(style) >= 8 &&
      node.textContent!.trim().length > 0 &&
      node.childElementCount <= 3
    if (!looksPressable) return []
    return [
      {
        rule: 'inert-control' as const,
        label: text(node),
        detail: 'Bordered and rounded like the app\'s pills, but not a control.',
        testId: node.dataset.testid,
      },
    ]
  })
}

/**
 * Two controls a user would read as the same thing.
 *
 * The vault appears as a composer pill and again in the status bar — same
 * job, different extra information, ten inches apart.
 */
function duplicateControls(controls: HTMLElement[]): UiAuditFinding[] {
  const byLabel = new Map<string, HTMLElement[]>()
  for (const node of controls) {
    const label = accessibleName(node)
    if (label.length < 3) continue
    byLabel.set(label, [...(byLabel.get(label) ?? []), node])
  }
  return [...byLabel.entries()]
    .filter(([, nodes]) => nodes.length > 1)
    .map(([label, nodes]) => ({
      rule: 'duplicate-control' as const,
      label,
      detail: `${nodes.length} separate controls carry this label.`,
    }))
}

/** Too small to hit reliably with a trackpad. */
function tinyTargets(controls: HTMLElement[]): UiAuditFinding[] {
  return controls.flatMap((node) => {
    const { width, height } = node.getBoundingClientRect()
    const smallest = Math.min(width, height)
    if (smallest === 0) return []

    const iconSized = width < MIN_ICON_TARGET_PX && height < MIN_ICON_TARGET_PX
    const thin = smallest < MIN_THIN_TARGET_PX
    if (!iconSized && !thin) return []

    const reason = thin
      ? `thinner than ${MIN_THIN_TARGET_PX}px`
      : `smaller than ${MIN_ICON_TARGET_PX}px in both directions`
    return [
      {
        rule: 'tiny-target' as const,
        label: accessibleName(node) || text(node),
        detail: `${Math.round(width)}x${Math.round(height)}px — ${reason}.`,
        testId: node.dataset.testid,
      },
    ]
  })
}

/**
 * Two controls drawn on top of each other.
 *
 * The kind of thing that reads as a rendering fault and is usually a layout
 * bug — a label sitting over a list row, a pill over a transcript.
 */
function overlappingControls(controls: HTMLElement[]): UiAuditFinding[] {
  const findings: UiAuditFinding[] = []
  for (let i = 0; i < controls.length; i += 1) {
    for (let j = i + 1; j < controls.length; j += 1) {
      const a = controls[i]
      const b = controls[j]
      // Nesting is not overlap: a button inside a menu item is normal.
      if (a.contains(b) || b.contains(a)) continue
      const boxA = a.getBoundingClientRect()
      const boxB = b.getBoundingClientRect()
      const overlap = intersectionArea(boxA, boxB)
      if (overlap < 16) continue
      // A control sitting entirely inside another's box is the ordinary
      // row-action overlay: rename and archive drawn over the session row
      // they belong to. Deliberate, and flagging it buried the real finding
      // under 21 copies of one pattern. A *partial* overlap is the layout
      // collision worth reporting — a label clipping a row, a pill over a
      // transcript.
      const smaller = Math.min(boxA.width * boxA.height, boxB.width * boxB.height)
      if (overlap >= smaller - 1) continue
      findings.push({
        rule: 'overlapping-controls',
        label: `${accessibleName(a) || text(a)} / ${accessibleName(b) || text(b)}`,
        detail: `${Math.round(overlap)}px² of overlap between two separate controls.`,
      })
    }
  }
  return findings
}

/**
 * The corner radius, however it was authored.
 *
 * Real browsers resolve `border-radius` into the four longhands; jsdom
 * resolves the border shorthand but leaves the radius longhands empty. Reading
 * both means the same rule holds in a browser, in Playwright and in a unit
 * test, rather than passing in one and silently doing nothing in another.
 */
function cornerRadius(style: CSSStyleDeclaration): number {
  const longhand = Number.parseFloat(style.borderTopLeftRadius)
  if (Number.isFinite(longhand)) return longhand
  return Number.parseFloat(style.borderRadius) || 0
}

function intersectionArea(a: DOMRect, b: DOMRect): number {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left)
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
  return width > 0 && height > 0 ? width * height : 0
}

function isVisible(node: HTMLElement): boolean {
  const style = getComputedStyle(node)
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false
  const { width, height } = node.getBoundingClientRect()
  return width > 0 && height > 0
}

function accessibleName(node: HTMLElement): string {
  return (node.getAttribute('aria-label') ?? text(node)).trim()
}

function text(node: HTMLElement): string {
  return (node.textContent ?? '').replace(/\s+/gu, ' ').trim().slice(0, 60)
}
