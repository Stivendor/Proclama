import { beforeEach, describe, expect, it, vi } from 'vitest'

const maybeSingle = vi.fn()
const eq = vi.fn(() => ({ maybeSingle }))
const select = vi.fn(() => ({ eq }))
const from = vi.fn(() => ({ select }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from }),
  }))

describe('getAppUpdateConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps the public update configuration', async () => {
    maybeSingle.mockResolvedValueOnce({
      data: {
        min_supported_version: '2.0.0',
        latest_version: '2.1.0',
        force_update: true,
      },
      error: null,
    })

    const { getAppUpdateConfig } = await import('@/services/supabase')

    await expect(getAppUpdateConfig()).resolves.toEqual({
      minSupportedVersion: '2.0.0',
      latestVersion: '2.1.0',
      forceUpdate: true,
    })
  })

  it('returns null when the remote request fails', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: new Error('offline') })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const { getAppUpdateConfig } = await import('@/services/supabase')

    await expect(getAppUpdateConfig()).resolves.toBeNull()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
