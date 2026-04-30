import { db } from '@/db'
import { supabase } from '@/services/supabase'
import type { AttendanceRecord } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Obtiene los registros de asistencia pendientes de sincronizar.
 * Un registro es "pendiente" si no tiene `remoteId` asignado.
 */
export async function getPendingRecords(userId: string): Promise<AttendanceRecord[]> {
  const all = await db.attendance_records
    .where('userId')
    .equals(userId)
    .toArray()
  return all.filter(r => !r.remoteId)
}

/**
 * Retorna la cantidad de registros pendientes de sincronizar.
 */
export async function getPendingCount(userId: string): Promise<number> {
  const all = await db.attendance_records
    .where('userId')
    .equals(userId)
    .toArray()
  return all.filter(r => !r.remoteId).length
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

/**
 * Sincroniza todos los registros pendientes con Supabase.
 * Realiza upsert por (user_id, date, service_name) para evitar duplicados.
 * Al éxito, marca cada registro local con el `remoteId` devuelto.
 *
 * @returns `{ synced, failed }` con los conteos de resultados.
 */
export async function syncAttendanceRecords(
  userId: string
): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingRecords(userId)
  if (pending.length === 0) return { synced: 0, failed: 0 }

  let synced = 0
  let failed = 0

  for (const record of pending) {
    try {
      // Construir payload para Supabase
      // Resolver valores: preferir el array `values`, fallback a campos legacy
      const values = record.values?.length
        ? record.values
        : [
            record.caballeros ?? 0,
            record.damas ?? 0,
            record.amigos ?? 0,
            record.ninos ?? 0,
          ]

      // Resolver categoryNames: si no hay, usar un fallback genérico legacy
      const categoryNames = record.categoryNames?.length
        ? record.categoryNames
        : ['Caballeros', 'Damas', 'Amigos', 'Niños'].slice(0, values.length)

      const payload = {
        user_id: userId,
        date: record.date,
        service_name: record.serviceName || '',
        category_names: categoryNames,
        category_values: values,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      }

      const { data, error } = await supabase
        .from('attendance_records')
        .upsert(payload, {
          onConflict: 'user_id,date,service_name',
        })
        .select('id')
        .single()

      if (error) {
        console.warn('[AttendanceSync] Error upserting record:', error.message)
        failed++
        continue
      }

      // Marcar como sincronizado en Dexie
      if (data?.id && record.id != null) {
        await db.attendance_records.update(record.id, { remoteId: data.id })
        synced++
      }
    } catch (err) {
      console.warn('[AttendanceSync] Unexpected error:', err)
      failed++
    }
  }

  console.log(`[AttendanceSync] Sync complete: ${synced} synced, ${failed} failed`)
  return { synced, failed }
}

// ─── Guest → User migration ──────────────────────────────────────────────────

/**
 * Migra todos los registros de asistencia del usuario "guest"
 * al userId real tras iniciar sesión.
 * Limpia el `remoteId` para que queden pendientes de sincronización.
 *
 * @returns Cantidad de registros migrados.
 */
export async function migrateGuestRecords(realUserId: string): Promise<number> {
  const guestRecords = await db.attendance_records
    .where('userId')
    .equals('guest')
    .toArray()

  if (guestRecords.length === 0) return 0

  let migrated = 0
  for (const record of guestRecords) {
    if (record.id == null) continue
    await db.attendance_records.update(record.id, {
      userId: realUserId,
      remoteId: undefined, // marcar como pendiente
    })
    migrated++
  }

  // También migrar church_notes (avisos)
  const guestNotes = await db.church_notes
    .where('userId')
    .equals('guest')
    .toArray()

  for (const note of guestNotes) {
    if (note.id == null) continue
    await db.church_notes.update(note.id, { userId: realUserId })
  }

  console.log(`[AttendanceSync] Migrated ${migrated} guest attendance records + ${guestNotes.length} notes to user ${realUserId}`)
  return migrated
}

