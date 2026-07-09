import { afterEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '@/services/supabase'
import { fetchUserActivity, fetchDauChart } from '@/admin/services/adminQueries'

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

  it('fetchDauChart llama a la RPC y mapea a {date, count}', async () => {
    const rpcMock = vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [{ day: '2026-07-08', count: 5 }],
      error: null,
    } as any)

    const rows = await fetchDauChart(30)

    expect(rpcMock).toHaveBeenCalledWith('admin_daily_active_users', { days_back: 30 })
    expect(rows).toEqual([{ date: '2026-07-08', count: 5 }])
  })
})
