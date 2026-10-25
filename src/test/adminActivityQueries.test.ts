import { afterEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '@/services/supabase'
import { fetchUserActivity, fetchDauChart, fetchActiveToday } from '@/admin/services/adminQueries'

describe('admin activity queries', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetchUserActivity llama a la RPC y mapea a camelCase', async () => {
    const rpcMock = vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [
        { user_id: 'u1', email: 'a@b.c', full_name: 'Ana', active_days: 12, last_active: '2026-07-08' },
      ],
      error: null,
    } as any)

    const rows = await fetchUserActivity(30)

    expect(rpcMock).toHaveBeenCalledWith('admin_user_activity', { days_back: 30 })
    expect(rows).toEqual([
      { userId: 'u1', email: 'a@b.c', fullName: 'Ana', activeDays: 12, lastActive: '2026-07-08' },
    ])
  })

  it('fetchUserActivity excluye las cuentas propias del dueño', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [
        { user_id: 'u1', email: 'stivendor101@gmail.com', full_name: 'Yo', active_days: 30, last_active: '2026-08-03' },
        { user_id: 'u2', email: 'real@iglesia.com', full_name: 'Real', active_days: 3, last_active: '2026-08-03' },
      ],
      error: null,
    } as any)

    const rows = await fetchUserActivity(30)

    expect(rows.map(r => r.email)).toEqual(['real@iglesia.com'])
  })

  it('fetchDauChart llama a la RPC y mapea a {date, count}', async () => {
    const rpcMock = vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [{ day: '2026-07-08', count: 5 }],
      error: null,
    } as any)

    const rows = await fetchDauChart(30)

    expect(rpcMock).toHaveBeenCalledWith('admin_daily_active_users', { days_back: 30 })
    expect(rows).toEqual([{ date: '2026-07-08', count: 5 }])
  })

  it('fetchActiveToday llama a la RPC y mapea a camelCase', async () => {
    const rpcMock = vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [
        { user_id: 'u1', email: 'a@b.c', full_name: 'Ana' },
        { user_id: 'u2', email: 'b@c.d', full_name: null },
      ],
      error: null,
    } as any)

    const rows = await fetchActiveToday()

    expect(rpcMock).toHaveBeenCalledWith('admin_active_today')
    expect(rows).toEqual([
      { userId: 'u1', email: 'a@b.c', fullName: 'Ana' },
      { userId: 'u2', email: 'b@c.d', fullName: null },
    ])
  })

  it('fetchActiveToday excluye las cuentas propias del dueño', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [
        { user_id: 'u1', email: 'stivendor101@gmail.com', full_name: 'Yo' },
        { user_id: 'u2', email: 'real@iglesia.com', full_name: 'Real' },
      ],
      error: null,
    } as any)

    const rows = await fetchActiveToday()

    expect(rows.map(r => r.email)).toEqual(['real@iglesia.com'])
  })

  it('fetchActiveToday propaga el error de la RPC', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    } as any)

    await expect(fetchActiveToday()).rejects.toThrow()
  })
})
