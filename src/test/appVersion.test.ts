import { describe, expect, it } from 'vitest'
import { compareVersions, isVersionSupported } from '@/constants/appVersion'

describe('app version comparison', () => {
  it('orders valid semantic versions', () => {
    expect(compareVersions('1.2.0', '1.3.0')).toBe(-1)
    expect(compareVersions('1.3.0', '1.3.0')).toBe(0)
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1)
  })

  it('rejects malformed versions without blocking the app', () => {
    expect(compareVersions('1.2', '1.3.0')).toBeNull()
    expect(isVersionSupported('1.2.0', 'bad')).toBe(true)
    expect(isVersionSupported('bad', '2.0.0')).toBe(true)
  })

  it('reports whether the local version meets the minimum', () => {
    expect(isVersionSupported('1.4.0', '1.3.0')).toBe(true)
    expect(isVersionSupported('1.2.9', '1.3.0')).toBe(false)
  })
})
