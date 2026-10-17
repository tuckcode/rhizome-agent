import { isTauri } from '../mock-tauri'

function getUserAgent(): string {
  if (typeof navigator === 'undefined') return ''
  return navigator.userAgent
}

export function isLinux(): boolean {
  const userAgent = getUserAgent()
  return userAgent.includes('Linux') && !userAgent.includes('Android')
}

export function isMac(): boolean {
  const userAgent = getUserAgent()
  if (userAgent.includes('Windows')) return false
  if (userAgent.includes('Mac OS X') || userAgent.includes('Macintosh')) return true
  if (userAgent.includes('Linux') || userAgent.includes('Android') || userAgent.includes('CrOS')) return false
  if (typeof navigator === 'undefined') return false
  if (/Mac/i.test(navigator.platform ?? '')) return true
  const uaPlatform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform
  return uaPlatform === 'macOS'
}

export function isWindows(): boolean {
  return getUserAgent().includes('Windows')
}

export function shouldUseCustomWindowChrome(): boolean {
  return isTauri() && (isLinux() || isWindows())
}
