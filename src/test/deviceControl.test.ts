import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerDevice, supabase } from '@/services/supabase'

describe('registerDevice', () => {
  beforeEach(() => {
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
        },
      },
      error: null,
    } as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('incluye user_id en el upsert para cumplir con RLS', async () => {
    const selectMock = vi.fn().mockReturnThis()
    const orderMock = vi.fn().mockResolvedValue({ data: [], error: null })
    const upsertMock = vi.fn().mockResolvedValue({ error: null })

    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'user_devices') {
        return {
          upsert: upsertMock,
          select: selectMock,
          order: orderMock,
        } as any
      }

      return {} as any
    })

    await registerDevice('device-abc', 'PC Windows')

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-123',
        device_id: 'device-abc',
        device_name: 'PC Windows',
      }),
      { onConflict: 'user_id,device_id' },
    )
  })

  it('no intenta registrar dispositivos si no hay usuario autenticado', async () => {
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: null },
      error: null,
    } as any)

    const fromSpy = vi.spyOn(supabase, 'from')

    const result = await registerDevice('device-abc', 'PC Windows')

    expect(result).toEqual([])
    expect(fromSpy).not.toHaveBeenCalled()
  })
})
