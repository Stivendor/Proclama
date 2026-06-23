import { db } from '@/db'
import { supabase } from '@/services/supabase'
import type { AttendanceRecord } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Obtiene los registros de asistencia pendientes de sincronizar.
 * Un registro es "pendiente" si no tiene `remoteId` (nunca sincronizado)
 * o si fue modificado localmente después del último sync.
 */
export async function getPendingRecords(userId: string): Promise<AttendanceRecord[]> {
  const all = await db.attendance_records
    .where('userId')
    .equals(userId)
    .toArray()
  return all.filter(r => !r.remoteId || (r.lastSyncedAt != null && r.updatedAt != null && r.lastSyncedAt < r.updatedAt))
}

/**
 * Retorna la cantidad de registros pendientes de sincronizar.
 */
export async function getPendingCount(userId: string): Promise<number> {
  const pending = await getPendingRecords(userId)
  return pending.length
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
  userId: string,
  specificRecord?: AttendanceRecord,
  signal?: AbortSignal
): Promise<{ synced: number; failed: number }> {
  const pending = specificRecord ? [specificRecord] : await getPendingRecords(userId)
  if (pending.length === 0) return { synced: 0, failed: 0 }

  let synced = 0
  let failed = 0

  for (const record of pending) {
    try {
      if (signal?.aborted) {
        failed = pending.length - synced
        break
      }

      const values = record.values ?? []
      const categoryNames = record.categoryNames ?? []

      const payload: any = {
        user_id: userId,
        date: record.date,
        service_name: record.serviceName || '',
        service_time: record.time || null,
        preacher: record.preacher || null,
        topic: record.topic || null,
        category_names: categoryNames,
        category_values: values,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      }
      
      const upsertOptions: { onConflict: string } = {
        onConflict: 'user_id,date,service_name'
      }

      if (record.remoteId) {
        payload.id = record.remoteId
        upsertOptions.onConflict = 'id'
      }

      let q = supabase
        .from('attendance_records')
        .upsert(payload, upsertOptions)
        .select('id')
      if (signal) q = q.abortSignal(signal)
      const { data, error } = await q.single()

      if (error) {
        console.warn('[AttendanceSync] Error upserting record:', error.message)
        failed++
        continue
      }

      // Marcar como sincronizado en Dexie
      if (data?.id && record.id != null) {
        await db.attendance_records.update(record.id, { 
          remoteId: data.id,
          lastSyncedAt: new Date().toISOString()
        })
        synced++

        // Si hay duplicados del mismo remoteId (por race con Realtime), limpiarlos
        const allWithSameRemote = await db.attendance_records
          .where('remoteId')
          .equals(data.id)
          .toArray()
        if (allWithSameRemote.length > 1) {
          const [first, ...rest] = allWithSameRemote
          for (const dup of rest) {
            if (dup.id != null && dup.id !== first.id) {
              await db.attendance_records.delete(dup.id)
            }
          }
        }
      }
    } catch (err) {
      console.warn('[AttendanceSync] Unexpected error:', err)
      failed++
    }
  }

  console.log(`[AttendanceSync] Sync complete: ${synced} synced, ${failed} failed`)
  return { synced, failed }
}

// ─── Pull (Supabase → Local) ──────────────────────────────────────────────────

/**
 * Descarga todos los registros de asistencia de Supabase para este usuario
 * y los merges en el IndexedDB local (Dexie).
 *
 * Estrategia de deduplicación:
 *  - Si ya existe un registro local con el mismo `remoteId`, se omite.
 *  - Si ya existe un registro local con el mismo (userId, date, serviceName)
 *    sin `remoteId`, se le asigna el remoteId remoto (lo vincula).
 *  - Si no existe, se inserta como nuevo.
 *
 * @returns `{ pulled, skipped }` conteos.
 */
export async function pullRemoteRecords(
  userId: string
): Promise<{ pulled: number; skipped: number }> {
  // 1. Fetch all remote records for this user
  const { data: remoteRows, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })

  if (error) {
    console.warn('[AttendanceSync] Pull failed:', error.message)
    return { pulled: 0, skipped: 0 }
  }

  if (!remoteRows || remoteRows.length === 0) {
    console.log('[AttendanceSync] No remote records to pull.')
    return { pulled: 0, skipped: 0 }
  }

  // 2. Load all local records for this user (for dedup)
  const localRecords = await db.attendance_records
    .where('userId')
    .equals(userId)
    .toArray()

  // Build lookup sets for fast dedup
  const localByRemoteId = new Set(
    localRecords.filter(r => r.remoteId).map(r => r.remoteId!)
  )
  const localByKey = new Map(
    localRecords.map(r => [`${r.date}|${r.serviceName || ''}`, r])
  )

  let pulled = 0
  let skipped = 0

  for (const row of remoteRows) {
    const remoteId = row.id as string
    const date = row.date as string
    const serviceName = (row.service_name as string) || ''

    // Already linked locally → skip
    if (localByRemoteId.has(remoteId)) {
      skipped++
      continue
    }

    // Local record with same key exists but no remoteId → link it
    const key = `${date}|${serviceName}`
    const existing = localByKey.get(key)
    if (existing && !existing.remoteId && existing.id != null) {
      await db.attendance_records.update(existing.id, { remoteId })
      skipped++
      continue
    }

    // No local match → insert new record
    const newRecord: AttendanceRecord = {
      userId,
      date,
      serviceName,
      time: (row.service_time as string) || undefined,
      preacher: (row.preacher as string) || undefined,
      topic: (row.topic as string) || undefined,
      categoryNames: (row.category_names as string[]) || [],
      values: (row.category_values as number[]) || [],
      remoteId,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    }

    await db.attendance_records.add(newRecord)
    pulled++
  }

  console.log(`[AttendanceSync] Pull complete: ${pulled} pulled, ${skipped} skipped (already local)`)
  return { pulled, skipped }
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

/**
 * Elimina un registro de Supabase.
 */
export async function deleteRemoteRecord(remoteId: string): Promise<boolean> {
  const { error } = await supabase
    .from('attendance_records')
    .delete()
    .eq('id', remoteId)

  if (error) {
    console.error('[AttendanceSync] Error deleting remote record:', error.message)
    return false
  }
  return true
}

/**
 * Elimina todos los registros de un usuario en Supabase.
 */
export async function deleteRemoteHistory(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('attendance_records')
    .delete()
    .eq('user_id', userId)

  if (error) {
    console.error('[AttendanceSync] Error deleting remote history:', error.message)
    return false
  }
  return true
}

