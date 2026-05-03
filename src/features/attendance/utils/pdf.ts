import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { AttendanceRecord } from '@/types'
import { formatDate } from './validation'

/**
 * Exporta un historial de asistencia a un archivo CSV.
 */
export function exportAttendanceCSV(records: AttendanceRecord[], categories: string[]) {
  const headers = ['Fecha', 'Culto', ...categories, 'Total']
  const rows = records.map(r => [
    r.date,
    r.serviceName || '-',
    ...(r.values || []),
    (r.values || []).reduce((a, b) => a + b, 0)
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.setAttribute('download', `asistencia_proclama_${new Date().toISOString().split('T')[0]}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Exporta un reporte de asistencia a un archivo PDF con tabla.
 */
export function exportAttendancePDF(records: AttendanceRecord[], categories: string[]) {
  const doc = new jsPDF()
  
  doc.setFontSize(20)
  doc.text('Reporte de Asistencia - Proclama', 14, 22)
  
  doc.setFontSize(11)
  doc.setTextColor(100)
  doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 30)

  const tableHeaders = [['Fecha', 'Culto', ...categories, 'Total']]
  const tableRows = records.map(r => [
    formatDate(r.date),
    r.serviceName || '-',
    ...(r.values || []),
    (r.values || []).reduce((a, b) => a + (b || 0), 0)
  ])

  autoTable(doc, {
    head: tableHeaders,
    body: tableRows,
    startY: 40,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [212, 175, 55] }, // Color Oro Proclama
  })

  doc.save(`reporte_asistencia_${new Date().toISOString().split('T')[0]}.pdf`)
}
