import { callHost } from './callHost'

export type NativeVision = 'yes' | 'no' | 'unknown'

export async function nativeModelVision(target: string): Promise<NativeVision> {
  try {
    const value = await callHost<string>('native_model_vision', { target })
    if (value === 'yes' || value === 'no' || value === 'unknown') return value
    return 'unknown'
  } catch {
    return 'unknown'
  }
}
