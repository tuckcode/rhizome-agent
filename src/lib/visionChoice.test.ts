import { beforeEach, describe, expect, it } from 'vitest'
import { forgetVisionSendAnyway, rememberVisionSendAnyway, visionSendAnywayFor } from './visionChoice'

describe('vision send anyway', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('forgets a model that was allowed to receive images', () => {
    rememberVisionSendAnyway('ollama/llava')
    expect(visionSendAnywayFor('ollama/llava')).toBe(true)
    forgetVisionSendAnyway('ollama/llava')
    expect(visionSendAnywayFor('ollama/llava')).toBe(false)
  })
})
