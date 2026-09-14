import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetFeedbackDiagnosticsForTest,
  buildSanitizedDiagnosticBundle,
  startFeedbackDiagnosticsCapture,
} from './feedbackDiagnostics'

describe('feedbackDiagnostics', () => {
  beforeEach(() => {
    __resetFeedbackDiagnosticsForTest()
  })

  it('sanitizes recent warnings and errors before building the bundle', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const stopCapture = startFeedbackDiagnosticsCapture()
    const sampleToken = ['ghp', 'A'.repeat(36)].join('_')

    console.error(`Load failed for /Users/luca/Laputa/private.md with token ${sampleToken}`)
    console.warn('Retrying from C:\\Users\\luca\\Notes\\vault.md')

    const bundle = buildSanitizedDiagnosticBundle({
      buildNumber: 'b281',
      releaseChannel: 'alpha',
    })

    expect(bundle).toContain('Rhizome sanitized diagnostics')
    expect(bundle).toContain('Build: b281')
    expect(bundle).toContain('Release channel: alpha')
    expect(bundle).toContain('[error] Load failed for [redacted-path] with token [redacted-token]')
    expect(bundle).toContain('[warn] Retrying from [redacted-path]')
    expect(bundle).not.toContain('/Users/luca/Laputa/private.md')
    expect(bundle).not.toContain(sampleToken)
    expect(bundle).not.toContain('C:\\Users\\luca\\Notes\\vault.md')

    stopCapture()
    errorSpy.mockRestore()
    warnSpy.mockRestore()
  })

  it('explains when no safe diagnostics were available', () => {
    const bundle = buildSanitizedDiagnosticBundle({
      buildNumber: undefined,
      releaseChannel: null,
    })

    expect(bundle).toContain('No safe recent diagnostics were available.')
  })

  it('redacts nested and non-string credential fields in the optional bundle', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const stopCapture = startFeedbackDiagnosticsCapture()
    const opaque = ['ASTRA_SYNTHETIC', 'Q'.repeat(28)].join('_')

    console.error({
      api_key: { nested: opaque },
      retryCount: 3,
    })
    console.error({
      apiKey: opaque,
      Authorization: `Bearer ${opaque}`,
      Cookie: opaque,
      password: opaque,
    })
    console.error({
      api_key: 99,
      token: [opaque],
      note: 'benign metadata',
      allowedModels: ['alpha', 'beta'],
    })
    console.error(`lookup https://service.invalid/?api_key=${opaque}`)

    const bundle = buildSanitizedDiagnosticBundle({
      buildNumber: 'b281',
      releaseChannel: 'alpha',
    })

    expect(bundle).toContain('Build: b281')
    expect(bundle).toContain('benign metadata')
    expect(bundle).toContain('retryCount')
    expect(bundle).toContain('allowedModels')
    expect(bundle).not.toContain(opaque)

    stopCapture()
    errorSpy.mockRestore()
  })
})
