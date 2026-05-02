import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { AttendanceRecord } from '@/types'
import { formatDate, totalAttendance, resolveValues } from './validation'

export function exportAttendanceCSV(attendanceRecords: AttendanceRecord[], attendanceCategories: string[]) {
  if (attendanceRecords.length === 0) {
    alert('No hay datos de asistencia para exportar')
    return
  }

  // Calcular estadísticas
  const totals = attendanceRecords.map(r => totalAttendance({ values: resolveValues(r) }))
  const avgTotal = Math.round(totals.reduce((a, b) => a + b, 0) / totals.length)
  const maxTotal = totals.length > 0 ? Math.max(...totals) : 0
  const minTotal = totals.length > 0 ? Math.min(...totals) : 0

  // Calcular promedios por categoría
  const avgByCategory = attendanceCategories.map((_, idx) => {
    const values = attendanceRecords.map(r => resolveValues(r)[idx] ?? 0)
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
  })

  // Generar CSV
  const rows = [
    ['Reporte de Asistencia - Proclama'],
    ['Generado:', new Date().toLocaleString('es-ES')],
    [''],
    ['ESTADÍSTICAS GENERALES'],
    ['Total de registros:', attendanceRecords.length],
    ['Promedio total:', avgTotal],
    ['Máximo total:', maxTotal],
    ['Mínimo total:', minTotal],
    [''],
    ['PROMEDIOS POR CATEGORÍA'],
    ...attendanceCategories.map((cat, idx) => [cat + ':', avgByCategory[idx]]),
    [''],
    ['DETALLE DE ASISTENCIA'],
    ['Fecha', 'Nombre del Culto', ...attendanceCategories, 'Total'],
    ...attendanceRecords.map(r => {
      const recValues = resolveValues(r)
      const values = [...recValues]
      while (values.length < attendanceCategories.length) values.push(0)
      return [
        formatDate(r.date),
        r.serviceName || '-',
        ...values,
        totalAttendance({ values: recValues })
      ]
    })
  ]

  const csv = rows.map(row => row.join(',')).join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `reporte-asistencia-${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

/** Genera una imagen de gráfico usando Canvas para el PDF */
export function generateChartImage(data: number[], labels: string[]): string {
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 400
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const padding = 60
  const chartWidth = canvas.width - (padding * 2)
  const chartHeight = canvas.height - (padding * 2)
  const maxVal = Math.max(...data, 10) * 1.1

  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(padding, padding)
  ctx.lineTo(padding, canvas.height - padding)
  ctx.lineTo(canvas.width - padding, canvas.height - padding)
  ctx.stroke()

  const barSpacing = chartWidth / data.length
  const barWidth = barSpacing * 0.6

  data.forEach((val, i) => {
    const h = (val / maxVal) * chartHeight
    const x = padding + (i * barSpacing) + (barSpacing - barWidth) / 2
    const y = canvas.height - padding - h

    const grad = ctx.createLinearGradient(x, y, x, y + h)
    grad.addColorStop(0, '#3b82f6')
    grad.addColorStop(1, '#1d4ed8')
    ctx.fillStyle = grad
    ctx.fillRect(x, y, barWidth, h)

    ctx.fillStyle = '#1e293b'
    ctx.font = 'bold 14px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(String(val), x + barWidth / 2, y - 10)

    ctx.fillStyle = '#64748b'
    ctx.font = '12px sans-serif'
    ctx.save()
    ctx.translate(x + barWidth / 2, canvas.height - padding + 20)
    ctx.rotate(-Math.PI / 4)
    ctx.fillText(labels[i], 0, 0)
    ctx.restore()
  })

  return canvas.toDataURL('image/png')
}

export function exportAttendancePDF(attendanceRecords: AttendanceRecord[], attendanceCategories: string[]) {
  if (attendanceRecords.length === 0) return

  const doc = new jsPDF()
  const now = new Date()

  const totals = attendanceRecords.map(r => totalAttendance({ values: resolveValues(r) }))
  const avgTotal = Math.round(totals.reduce((a, b) => a + b, 0) / totals.length)
  const maxTotal = Math.max(...totals)
  const minTotal = Math.min(...totals)

  const firstDate = attendanceRecords[0].date
  const lastDate = attendanceRecords[attendanceRecords.length - 1].date

  const maxIdx = totals.indexOf(maxTotal)
  const maxNote = attendanceRecords[maxIdx]
  const maxLabel = maxNote.serviceName
    ? `${maxNote.serviceName} (${formatDate(maxNote.date)})`
    : formatDate(maxNote.date)

  const minIdx = totals.indexOf(minTotal)
  const minNote = attendanceRecords[minIdx]
  const minLabel = minNote.serviceName
    ? `${minNote.serviceName} (${formatDate(minNote.date)})`
    : formatDate(minNote.date)

  const categoryAvgs = attendanceCategories.map((_, catIdx) => {
    const vals = attendanceRecords.map(r => resolveValues(r)[catIdx] || 0)
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  })

  const half = Math.floor(totals.length / 2)
  let growthText = '-'
  if (totals.length >= 4) {
    const firstHalf = totals.slice(0, half)
    const secondHalf = totals.slice(half)
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
    if (avgFirst > 0) {
      const growth = ((avgSecond - avgFirst) / avgFirst) * 100
      growthText = `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`
    }
  }

  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const dayTotals: Record<number, { sum: number; count: number }> = {}
  attendanceRecords.forEach((r, i) => {
    const dayOfWeek = new Date(r.date + 'T12:00:00').getDay()
    if (!dayTotals[dayOfWeek]) dayTotals[dayOfWeek] = { sum: 0, count: 0 }
    dayTotals[dayOfWeek].sum += totals[i]
    dayTotals[dayOfWeek].count++
  })
  let bestDay = 'N/A'
  let bestDayAvg = 0
  Object.entries(dayTotals).forEach(([day, { sum, count }]) => {
    const avg = sum / count
    if (avg > bestDayAvg) {
      bestDayAvg = avg
      bestDay = dayNames[Number(day)]
    }
  })

  const grandTotal = totals.reduce((a, b) => a + b, 0)

  const serviceStats: Record<string, { count: number; totalAtt: number }> = {}
  attendanceRecords.forEach((r, i) => {
    const name = r.serviceName || 'Sin nombre'
    if (!serviceStats[name]) serviceStats[name] = { count: 0, totalAtt: 0 }
    serviceStats[name].count++
    serviceStats[name].totalAtt += totals[i]
  })

  doc.setFillColor(30, 41, 59)
  doc.rect(0, 0, 210, 45, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.text('REPORTE DE ASISTENCIA', 105, 18, { align: 'center' })
  doc.setFontSize(10)
  doc.text(`Período: ${formatDate(firstDate)} — ${formatDate(lastDate)}`, 105, 28, { align: 'center' })
  doc.setFontSize(9)
  doc.setTextColor(180, 180, 180)
  doc.text(`Generado: ${now.toLocaleString('es-ES')}`, 105, 36, { align: 'center' })

  doc.setTextColor(30, 41, 59)
  doc.setFontSize(14)
  doc.text('RESUMEN GENERAL', 14, 58)

  autoTable(doc, {
    startY: 63,
    head: [['Métrica', 'Valor']],
    body: [
      ['Total de Cultos Registrados', String(attendanceRecords.length)],
      ['Asistencia Total Acumulada', String(grandTotal)],
      ['Promedio de Asistencia por Culto', String(avgTotal)],
      ['Asistencia Máxima', `${maxTotal} — ${maxLabel}`],
      ['Asistencia Mínima', `${minTotal} — ${minLabel}`],
      ['Día con Mayor Asistencia', `${bestDay} (prom. ${Math.round(bestDayAvg)})`],
      ['Tendencia de Crecimiento', growthText],
    ],
    theme: 'striped',
    headStyles: { fillColor: [212, 175, 55] },
    columnStyles: { 0: { fontStyle: 'bold' } },
    styles: { fontSize: 10 },
  })

  const afterSummary = (doc as any).lastAutoTable.finalY + 12
  doc.text('PROMEDIO POR CATEGORÍA', 14, afterSummary)

  autoTable(doc, {
    startY: afterSummary + 5,
    head: [attendanceCategories],
    body: [categoryAvgs.map(String)],
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], halign: 'center' },
    bodyStyles: { halign: 'center', fontStyle: 'bold', fontSize: 12 },
  })

  const serviceNames = Object.keys(serviceStats)
  if (serviceNames.length > 1) {
    const afterCategory = (doc as any).lastAutoTable.finalY + 12
    doc.text('DESGLOSE POR TIPO DE CULTO', 14, afterCategory)

    const serviceBody = serviceNames
      .sort((a, b) => serviceStats[b].totalAtt - serviceStats[a].totalAtt)
      .map(name => [
        name,
        String(serviceStats[name].count),
        String(Math.round(serviceStats[name].totalAtt / serviceStats[name].count)),
        String(serviceStats[name].totalAtt),
      ])

    autoTable(doc, {
      startY: afterCategory + 5,
      head: [['Culto', 'Veces', 'Prom. Asistencia', 'Total Acumulado']],
      body: serviceBody,
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59] },
      styles: { fontSize: 10 },
    })
  }

  const lastN = attendanceRecords.slice(-12)
  const chartData = lastN.map(r => totalAttendance({ values: resolveValues(r) }))
  const chartLabels = lastN.map(r => r.date.slice(5).split('-').reverse().join('/'))
  const chartImg = generateChartImage(chartData, chartLabels)

  if (chartImg) {
    const chartY = (doc as any).lastAutoTable.finalY + 15
    if (chartY + 100 > 280) doc.addPage()
    const finalY = chartY + 100 > 280 ? 20 : chartY
    doc.text('TENDENCIA DE ASISTENCIA (Últimos cultos)', 14, finalY)
    doc.addImage(chartImg, 'PNG', 14, finalY + 5, 180, 80)
  }

  doc.addPage()
  doc.text('DETALLE COMPLETO DE ASISTENCIA', 14, 20)

  const tableBody = attendanceRecords.map(r => {
    const values = resolveValues(r)
    return [
      formatDate(r.date),
      r.serviceName || '-',
      ...values,
      totalAttendance({ values })
    ]
  })

  autoTable(doc, {
    startY: 25,
    head: [['Fecha', 'Culto', ...attendanceCategories, 'Total']],
    body: tableBody,
    headStyles: { fillColor: [30, 41, 59] },
    styles: { fontSize: 9 }
  })

  doc.save(`reporte-asistencia-${now.toISOString().split('T')[0]}.pdf`)
}
