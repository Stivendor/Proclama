import { useEffect } from 'react'
import { supabase } from '@/services/supabase'
import { db } from '@/db'

export function useAttendanceRealtime(userId: string, isPremium: boolean) {
  useEffect(() => {
    if (!userId || !isPremium) return

    const channel = supabase
      .channel(`attendance_records_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_records',
          filter: `user_id=eq.${userId}`
        },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const r = payload.new as any

            // Try to find existing local record by remoteId
            let local = await db.attendance_records
              .where('remoteId')
              .equals(r.id)
              .first()

            if (!local) {
              // Fallback: find by (userId, date, serviceName) — covers race where
              // sync hasn't set remoteId yet when Realtime fires
              local = await db.attendance_records
                .where({ userId: r.user_id, date: r.date })
                .filter(l => (l.serviceName || '') === (r.service_name || ''))
                .first()
            }

            const updateData = {
              userId: r.user_id,
              date: r.date,
              values: r.category_values || [],
              categoryNames: r.category_names || [],
              serviceName: r.service_name || undefined,
              time: r.service_time || undefined,
              createdAt: r.created_at,
              updatedAt: r.updated_at,
            }

            if (local?.id != null) {
              await db.attendance_records.update(local.id, {
                ...updateData,
                remoteId: r.id,
              })
            } else {
              await db.attendance_records.add({
                ...updateData,
                remoteId: r.id,
              })
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any)?.id as string | undefined
            if (!deletedId) return

            const local = await db.attendance_records
              .where('remoteId')
              .equals(deletedId)
              .first()

            if (local?.id != null) {
              await db.attendance_records.delete(local.id)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, isPremium])
}
