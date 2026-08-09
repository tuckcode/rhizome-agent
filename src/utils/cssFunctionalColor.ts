const RGB_NAMES = ['rgb', 'rgba']
const HSL_NAMES = ['hsl', 'hsla']

export function isCssFunctionalColor(value: string): boolean {
  return isRgbColor(value) || isHslColor(value)
}

function functionArguments(value: string, names: readonly string[]): string[] | null {
  const lower = value.toLowerCase()
  const name = names.find((candidate) => lower.startsWith(`${candidate}(`))
  if (!name || !value.endsWith(')')) return null
  return value.slice(name.length + 1, -1).split(',').map((part) => part.trim())
}

function isWholeNumber(value: string): boolean {
  return value.length > 0 && [...value].every((char) => char >= '0' && char <= '9')
}

function isBoundedNumber(value: string, min: number, max: number): boolean {
  if (!isWholeNumber(value)) return false
  const number = Number(value)
  return number >= min && number <= max
}

function isPercentage(value: string): boolean {
  return value.endsWith('%') && isBoundedNumber(value.slice(0, -1), 0, 100)
}

function isAlphaValue(value: string): boolean {
  const number = Number(value)
  return value.trim() === value && Number.isFinite(number) && number >= 0 && number <= 1
}

function isRgbColor(value: string): boolean {
  const args = functionArguments(value, RGB_NAMES)
  if (!args || (args.length !== 3 && args.length !== 4)) return false
  return args.slice(0, 3).every((part) => isBoundedNumber(part, 0, 255))
    && (args.length === 3 || isAlphaValue(args[3]))
}

function isHslColor(value: string): boolean {
  const args = functionArguments(value, HSL_NAMES)
  if (!args || (args.length !== 3 && args.length !== 4)) return false
  return isBoundedNumber(args[0], 0, 360)
    && isPercentage(args[1])
    && isPercentage(args[2])
    && (args.length === 3 || isAlphaValue(args[3]))
}
