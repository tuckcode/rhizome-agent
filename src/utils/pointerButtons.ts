export function isSecondaryPointerButton(button: number, buttons: number): boolean {
  return button === 2 || (buttons & 2) === 2
}
