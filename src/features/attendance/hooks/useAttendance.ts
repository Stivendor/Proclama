import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import type { AttendanceRecord } from '@/types'
import { validateAttendance, validateServiceName, parseField } from '../utils/validation'
import { dedupeAttendanceRecords } from '../utils/dedup'
import { usePlan } from '@/hooks/usePlan'
import { useAttendanceRealtime } from './useAttendanceRealtime'

export function useAttendance(userId: string) {
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedServiceName, setSelectedServiceName] = useState<string | undefined>(undefined)
  const [error, setError] = useState('')
  const [hasServiceNameError, setHasServiceNameError] = useState(false)
  const { isPremium } = usePlan()

  // Sincronización en tiempo real desde Supabase -> Dexie
  useAttendanceRealtime(userId, isPremium)

  const attendanceRecord = useLiveQuery(
    async () => {
      if (selectedServiceName !== undefined) {
        // Buscar el registro específico por nombre
        return db.attendance_records.where({ 
          date: selectedDate, 
          userId, 
          serviceName: selectedServiceName || undefined 
        }).first()
      }
      
      // Comportamiento por defecto: el más reciente del día
      const rows = await db.attendance_records.where({ date: selectedDate, userId }).toArray()
      if (rows.length === 0) return undefined
      return rows.reduce((a, b) =>
        new Date(a.updatedAt) >= new Date(b.updatedAt) ? a : b
      )
    },
    [selectedDate, userId, selectedServiceName]
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

  async function saveAttendance(values: string[], serviceName: string, time?: string, categoryNames?: string[], preacher?: string, topic?: string) {
    if (!selectedDate) {
      setError('Debes seleccionar una fecha válida')
      return false
    }
    if (!validateServiceName(serviceName)) {
      setError('Debes ingresar el nombre del culto')
      setHasServiceNameError(true)
      return false
    }
    if (values.some(v => !validateAttendance(v))) {
      setError('Introduce solo números enteros positivos (o deja en blanco)')
      return false
    }
    setError('')
    setHasServiceNameError(false)
    
    const numValues = values.map(parseField)
    const now = new Date().toISOString()
    // Solo reusar el registro cargado si el nombre del culto coincide; si no, crear uno nuevo
    const normalizedName = serviceName.trim() || undefined
    const existingAr = attendanceRecord?.serviceName === normalizedName ? attendanceRecord : undefined
    
    const row: AttendanceRecord = {
      ...existingAr,
      userId,
      date: selectedDate,
      values: numValues,
      categoryNames: categoryNames || existingAr?.categoryNames,
      serviceName: serviceName.trim() || undefined,
      time: time?.trim() || undefined,
      preacher: preacher?.trim() || undefined,
      topic: topic?.trim() || undefined,
      createdAt: existingAr?.createdAt ?? now,
      updatedAt: now,
    }
    
    await db.attendance_records.put(row)
    
    // Trigger background sync if premium
    if (isPremium) {
      import('@/services/attendanceSync').then(({ syncAttendanceRecords }) => {
        syncAttendanceRecords(userId, row).catch(console.warn)
      })
    }
    
    return true
  }

  async function deleteRecord(r: AttendanceRecord) {
    if (r.id) {
      await db.attendance_records.delete(r.id)
    } else {
      await db.attendance_records.where({ 
        date: r.date, 
        userId: r.userId,
        serviceName: r.serviceName || undefined
      }).delete()
    }
    
    // Remote sync deletion
    if (r.remoteId && isPremium) {
      import('@/services/attendanceSync').then(({ deleteRemoteRecord }) => {
        if (r.remoteId) deleteRemoteRecord(r.remoteId).catch(console.warn)
      })
    }
  }

  async function deleteHistory() {
    await db.attendance_records.where('userId').equals(userId).delete()
    
    // Remote sync deletion
    if (isPremium) {
      import('@/services/attendanceSync').then(({ deleteRemoteHistory }) => {
        deleteRemoteHistory(userId).catch(console.warn)
      })
    }
  }

  return {
    selectedDate,
    setSelectedDate: (date: string) => {
      setSelectedDate(date)
      setSelectedServiceName(undefined)
      setError('')
      setHasServiceNameError(false)
    },
    selectedServiceName,
    setSelectedServiceName,
    attendanceRecord,
    historyRecords,
    isLoading,
    error,
    setError,
    hasServiceNameError,
    saveAttendance,
    deleteRecord,
    deleteHistory
  }
}
