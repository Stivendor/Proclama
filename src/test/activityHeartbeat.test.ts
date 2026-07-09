import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// localStorage del entorno de test no es funcional: stub ANTES del import
vi.hoisted(() => {
  const mem: Record<string, string> = {}
  ;(globalThis as any).localStorage = {
    getItem: (k: string) => mem[k] ?? null,
    setItem: (k: string, v: string) => { mem[k] = v },
    removeItem: (k: string) => { delete mem[k] },
    clear: () => { for (const k of Object.keys(mem)) delete mem[k] },
  }
})

import { recordDailyActivity, supabase } from '@/services/supabase'

const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD local

describe('recordDailyActivity', () => {
  let upsertMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } as any },
      error: null,
    } as any)
    upsertMock = vi.fn().mockResolvedValue({ error: null })
    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'user_activity') return { upsert: upsertMock } as any
      return {} as any
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('inserta el heartbeat con user_id y día local', async () => {
    await recordDailyActivity()
    expect(upsertMock).toHaveBeenCalledWith(
      { user_id: 'user-123', day: today },
      { onConflict: 'user_id,day', ignoreDuplicates: true },
    )
    expect(localStorage.getItem('proclama_activity_ping')).toBe(`user-123:${today}`)
  })

  it('no escribe si ya hay heartbeat de hoy en localStorage', async () => {
    localStorage.setItem('proclama_activity_ping', `user-123:${today}`)
    await recordDailyActivity()
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('sí escribe si el stamp guardado es de otro día', async () => {
    localStorage.setItem('proclama_activity_ping', 'user-123:2020-01-01')
    await recordDailyActivity()
    expect(upsertMock).toHaveBeenCalledTimes(1)
  })

  it('no escribe sin sesión', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: null },
      error: null,
    } as any)
    await recordDailyActivity()
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('no guarda el stamp si el upsert falla', async () => {
    upsertMock.mockResolvedValue({ error: { message: 'boom' } })
    await recordDailyActivity()
    expect(localStorage.getItem('proclama_activity_ping')).toBeNull()
  })
})
