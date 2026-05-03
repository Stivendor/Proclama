import { useEffect } from 'react'
import { supabase } from '@/services/supabase'
import { db } from '@/db'
import type { AttendanceRecord } from '@/types'

export function useAttendanceRealtime(userId: string, isPremium: boolean) {
  useEffect(() => {
    // Solo suscribirse si el usuario tiene plan premium
    if (!userId || !isPremium) return

    const channel = supabase
      .channel(`attendance_records_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'attendance_records',
          filter: `user_id=eq.${userId}`
        },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const remoteRecord = payload.new as any
            
            // Adaptar el registro remoto al modelo local de Dexie (AttendanceRecord)
            const localRecord: AttendanceRecord = {
              id: remoteRecord.id,
              userId: remoteRecord.user_id,
              date: remoteRecord.date,
              // Supabase column is `category_values`, local Dexie is `values`
              values: remoteRecord.category_values || [],
              caballeros: remoteRecord.category_values?.[0] || 0,
              damas: remoteRecord.category_values?.[1] || 0,
              amigos: remoteRecord.category_values?.[2] || 0,
              ninos: remoteRecord.category_values?.[3] || 0,
              serviceName: remoteRecord.service_name || undefined,
              createdAt: remoteRecord.created_at,
              updatedAt: remoteRecord.updated_at,
            }
            
            // Actualizar Dexie
            await db.attendance_records.put(localRecord)
          } else if (payload.eventType === 'DELETE') {
            const deletedRecord = payload.old as any
            if (deletedRecord.id) {
              await db.attendance_records.delete(deletedRecord.id)
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
