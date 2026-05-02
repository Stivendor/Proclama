import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import type { AttendanceRecord } from '@/types'
import { todayISO, validateAttendance, parseField } from '../utils/validation'
import { dedupeAttendanceRecords } from '../utils/dedup'

export function useAttendance(userId: string) {
  const [selectedDate, setSelectedDate] = useState<string>(todayISO())
  const [error, setError] = useState('')

  const attendanceRecord = useLiveQuery(
    async () => {
      const rows = await db.attendance_records.where({ date: selectedDate, userId }).toArray()
      if (rows.length === 0) return undefined
      return rows.reduce((a, b) =>
        new Date(a.updatedAt) >= new Date(b.updatedAt) ? a : b
      )
    },
    [selectedDate, userId]
  )

  const allAttendanceRows = useLiveQuery(
    () => db.attendance_records.where('userId').equals(userId).toArray(),
    [userId]
  )

  const isLoading = attendanceRecord === undefined && allAttendanceRows === undefined

  const historyRecords = useMemo(
    () => dedupeAttendanceRecords(allAttendanceRows ?? []),
    [allAttendanceRows]
  )

  async function saveAttendance(values: string[], serviceName: string) {
    if (values.some(v => !validateAttendance(v))) {
      setError('Introduce solo números enteros positivos (o deja en blanco)')
      return false
    }
    setError('')
    
    const numValues = values.map(parseField)
    const now = new Date().toISOString()
    const existingAr = attendanceRecord
    
    const row: AttendanceRecord = {
      ...existingAr,
      userId,
      date: selectedDate,
      values: numValues,
      caballeros: numValues[0] || 0,
      damas: numValues[1] || 0,
      amigos: numValues[2] || 0,
      ninos: numValues[3] || 0,
      serviceName: serviceName.trim() || undefined,
      createdAt: existingAr?.createdAt ?? now,
      updatedAt: now,
    }
    
    await db.attendance_records.put(row)
    return true
  }

  async function deleteRecord(r: AttendanceRecord) {
    if (r.id) {
      await db.attendance_records.delete(r.id)
    } else {
      await db.attendance_records.where({ date: r.date, userId: r.userId }).delete()
    }
  }

  async function deleteHistory() {
    await db.attendance_records.where('userId').equals(userId).delete()
  }

  return {
    selectedDate,
    setSelectedDate,
    attendanceRecord,
    historyRecords,
    isLoading,
    error,
    setError,
    saveAttendance,
    deleteRecord,
    deleteHistory
  }
}
