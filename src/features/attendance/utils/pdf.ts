import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { AttendanceRecord } from '@/types'
import { formatDate, resolveValues } from './validation'

// ─── Colores Proclama ──────────────────────────────────────────────────────────
const GOLD   = [212, 175, 55]  as [number, number, number]
const DARK   = [15,  17,  26]  as [number, number, number]
const GRAY   = [100, 110, 130] as [number, number, number]
const LIGHT  = [240, 242, 248] as [number, number, number]
const WHITE  = [255, 255, 255] as [number, number, number]

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getTotal(r: AttendanceRecord): number {
  return resolveValues(r).reduce((a, b) => a + (b || 0), 0)
}

function calcStats(values: number[]) {
  const filtered = values.filter(v => v > 0)
  if (!filtered.length) return { avg: 0, max: 0, min: 0, sum: 0 }
  return {
    avg: Math.round(filtered.reduce((a, b) => a + b, 0) / filtered.length),
    max: Math.max(...filtered),
    min: Math.min(...filtered),
    sum: filtered.reduce((a, b) => a + b, 0),
  }
}

// ─── Gráfico de tendencia dibujado con jsPDF ───────────────────────────────────

function drawTrendChart(
  doc: jsPDF,
  records: AttendanceRecord[],
  x: number,
  y: number,
  w: number,
  h: number
) {
  const totals = records.map(getTotal)
  const maxVal = Math.max(...totals, 1)
  const minVal = 0
  const range  = maxVal - minVal || 1

  const padLeft  = 14
  const padRight = 8
  const padTop   = 8
  const padBot   = 18

  const chartX = x + padLeft
  const chartY = y + padTop
  const chartW = w - padLeft - padRight
  const chartH = h - padTop - padBot

  // Fondo del gráfico
  doc.setFillColor(...LIGHT)
  doc.roundedRect(x, y, w, h, 3, 3, 'F')

  // Líneas de cuadrícula horizontales
  const gridLines = 4
  doc.setDrawColor(210, 215, 225)
  doc.setLineWidth(0.2)
  for (let i = 0; i <= gridLines; i++) {
    const gy = chartY + chartH - (i / gridLines) * chartH
    doc.line(chartX, gy, chartX + chartW, gy)
    // Etiqueta del eje Y
    const label = Math.round(minVal + (i / gridLines) * range).toString()
    doc.setFontSize(6)
    doc.setTextColor(...GRAY)
    doc.text(label, chartX - 2, gy + 1, { align: 'right' })
  }

  if (totals.length < 2) {
    doc.setFontSize(8)
    doc.setTextColor(...GRAY)
    doc.text('No hay suficientes datos para el gráfico', x + w / 2, y + h / 2, { align: 'center' })
    return
  }

  // Área rellena bajo la línea
  const points = totals.map((v, i) => ({
    px: chartX + (i / (totals.length - 1)) * chartW,
    py: chartY + chartH - ((v - minVal) / range) * chartH,
  }))

  // Polígono de área
  doc.setFillColor(212, 175, 55, 0.15)
  const areaPath: number[] = []
  areaPath.push(points[0].px, chartY + chartH)
  points.forEach(p => areaPath.push(p.px, p.py))
  areaPath.push(points[points.length - 1].px, chartY + chartH)

  // jsPDF no tiene polygon nativo con fill, usamos lines + fill trick
  doc.setFillColor(212, 175, 55)
  doc.setGState(doc.GState({ opacity: 0.12 }))
  // Dibujamos como serie de rectángulos verticales (aproximación)
  for (let i = 0; i < points.length - 1; i++) {
    const x1 = points[i].px
    const x2 = points[i + 1].px
    const y1 = Math.min(points[i].py, points[i + 1].py)
    const yBot = chartY + chartH
    doc.rect(x1, y1, x2 - x1, yBot - y1, 'F')
  }
  doc.setGState(doc.GState({ opacity: 1 }))

  // Línea principal
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(1.2)
  for (let i = 0; i < points.length - 1; i++) {
    doc.line(points[i].px, points[i].py, points[i + 1].px, points[i + 1].py)
  }

  // Puntos en la línea
  doc.setFillColor(...GOLD)
  points.forEach(p => {
    doc.circle(p.px, p.py, 1.2, 'F')
  })

  // Etiquetas del eje X (fechas, cada N registros para no saturar)
  const step = Math.max(1, Math.floor(totals.length / 6))
  doc.setFontSize(5.5)
  doc.setTextColor(...GRAY)
  records.forEach((r, i) => {
    if (i % step === 0 || i === records.length - 1) {
      const p = points[i]
      const label = formatDate(r.date).slice(0, 5) // DD/MM
      doc.text(label, p.px, chartY + chartH + 5, { align: 'center' })
    }
  })

  // Valor máximo anotado
  const maxIdx = totals.indexOf(Math.max(...totals))
  const maxPt  = points[maxIdx]
  doc.setFontSize(6.5)
  doc.setTextColor(...GOLD)
  doc.text(totals[maxIdx].toString(), maxPt.px, maxPt.py - 3, { align: 'center' })
}

// ─── CSV ───────────────────────────────────────────────────────────────────────

export function exportAttendanceCSV(records: AttendanceRecord[], categories: string[]) {
  const headers = ['Fecha', 'Culto', 'Predicador', 'Tema', ...categories, 'Total']
  const escape = (v: string) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
  const rows = records.map(r => {
    const vals = resolveValues(r)
    return [
      r.date,
      escape(r.serviceName || '-'),
      escape(r.preacher || '-'),
      escape(r.topic || '-'),
      ...vals,
      vals.reduce((a, b) => a + (b || 0), 0),
    ]
  })

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n')

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.setAttribute('download', `asistencia_proclama_${new Date().toISOString().split('T')[0]}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// ─── PDF ───────────────────────────────────────────────────────────────────────

export function exportAttendancePDF(records: AttendanceRecord[], categories: string[]) {
  if (!records.length) return

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 14

  // ── Encabezado ──────────────────────────────────────────────────────────────
  doc.setFillColor(...DARK)
  doc.rect(0, 0, pageW, 38, 'F')

  // Franja dorada decorativa
  doc.setFillColor(...GOLD)
  doc.rect(0, 36, pageW, 2, 'F')

  doc.setFontSize(20)
  doc.setTextColor(...GOLD)
  doc.setFont('helvetica', 'bold')
  doc.text('Proclama', margin, 16)

  doc.setFontSize(10)
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'normal')
  doc.text('Reporte de Asistencia', margin, 24)

  // Fecha de generación (derecha)
  doc.setFontSize(8)
  doc.setTextColor(180, 185, 200)
  const genDate = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
  doc.text(`Generado: ${genDate}`, pageW - margin, 24, { align: 'right' })

  // Rango de fechas
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))
  const rangeText = `${formatDate(sorted[0].date)} — ${formatDate(sorted[sorted.length - 1].date)}`
  doc.setFontSize(8)
  doc.setTextColor(180, 185, 200)
  doc.text(rangeText, pageW - margin, 31, { align: 'right' })

  let curY = 46

  // ── Tarjetas de estadísticas globales ───────────────────────────────────────
  const totals = records.map(getTotal)
  const globalStats = calcStats(totals)

  const cards = [
    { label: 'Total registros', value: records.length.toString() },
    { label: 'Promedio por culto', value: globalStats.avg.toString() },
    { label: 'Máximo registrado', value: globalStats.max.toString() },
    { label: 'Mínimo registrado', value: globalStats.min.toString() },
    { label: 'Total acumulado', value: globalStats.sum.toLocaleString('es') },
  ]

  const cardW = (pageW - margin * 2 - 4 * 3) / cards.length
  cards.forEach((card, i) => {
    const cx = margin + i * (cardW + 3)
    doc.setFillColor(...LIGHT)
    doc.roundedRect(cx, curY, cardW, 18, 2, 2, 'F')
    doc.setFillColor(...GOLD)
    doc.roundedRect(cx, curY, cardW, 3, 1, 1, 'F')

    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...DARK)
    doc.text(card.value, cx + cardW / 2, curY + 11, { align: 'center' })

    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
    doc.text(card.label, cx + cardW / 2, curY + 16, { align: 'center' })
  })

  curY += 26

  // ── Gráfico de tendencia ────────────────────────────────────────────────────
  const chartH = 52
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text('Tendencia de asistencia total', margin, curY)
  curY += 4

  drawTrendChart(doc, sorted, margin, curY, pageW - margin * 2, chartH)
  curY += chartH + 10

  // ── Estadísticas por categoría ──────────────────────────────────────────────
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text('Estadísticas por categoría', margin, curY)
  curY += 4

  const catTableHead = [['Categoría', 'Promedio', 'Máximo', 'Mínimo', 'Total acumulado']]
  const catTableRows = categories.map((cat, idx) => {
    const vals = records.map(r => resolveValues(r)[idx] || 0)
    const s = calcStats(vals)
    return [cat, s.avg, s.max, s.min, s.sum.toLocaleString('es')]
  })

  autoTable(doc, {
    head: catTableHead,
    body: catTableRows,
    startY: curY,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8.5, cellPadding: 3 },
    headStyles: { fillColor: GOLD, textColor: DARK, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'right' },
    },
  })

  curY = (doc as any).lastAutoTable.finalY + 10

  // ── Asistencia por predicador ───────────────────────────────────────────────
  const byPreacher = new Map<string, number[]>()
  sorted.forEach(r => {
    const key = (r.preacher && r.preacher.trim()) || 'Sin asignar'
    const arr = byPreacher.get(key) ?? []
    arr.push(getTotal(r))
    byPreacher.set(key, arr)
  })
  const preacherRows = [...byPreacher.entries()]
    .map(([name, totals]) => ({ name, cultos: totals.length, ...calcStats(totals) }))
    .sort((a, b) => b.sum - a.sum)
    .map(p => [p.name, p.cultos, p.avg, p.max, p.sum.toLocaleString('es')])

  if (curY > pageH - 50) { doc.addPage(); curY = 20 }

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text('Asistencia por predicador', margin, curY)
  curY += 4

  autoTable(doc, {
    head: [['Predicador', 'Cultos', 'Promedio', 'Máximo', 'Total acumulado']],
    body: preacherRows,
    startY: curY,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8.5, cellPadding: 3 },
    headStyles: { fillColor: GOLD, textColor: DARK, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'right' },
    },
  })

  curY = (doc as any).lastAutoTable.finalY + 10

  // ── Tabla de registros ──────────────────────────────────────────────────────
  // Si no cabe en la página actual, nueva página
  if (curY > pageH - 60) {
    doc.addPage()
    curY = 20
  }

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text('Detalle de registros', margin, curY)
  curY += 4

  const tableHead = [['Fecha', 'Culto', 'Predicador', ...categories, 'Total']]
  const tableRows = sorted.map(r => {
    const vals = resolveValues(r)
    return [
      formatDate(r.date),
      r.serviceName || '—',
      r.preacher || '—',
      ...vals.map(v => v || 0),
      vals.reduce((a, b) => a + (b || 0), 0),
    ]
  })

  autoTable(doc, {
    head: tableHead,
    body: tableRows,
    startY: curY,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: DARK, textColor: GOLD, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 'auto' },
    },
    didDrawPage: (data) => {
      // Pie de página en cada página
      const pageNum = doc.getNumberOfPages()
      doc.setFontSize(7)
      doc.setTextColor(...GRAY)
      doc.text(
        `Proclama · Reporte de Asistencia · Página ${pageNum}`,
        pageW / 2,
        pageH - 8,
        { align: 'center' }
      )
    },
  })

  doc.save(`reporte_asistencia_${new Date().toISOString().split('T')[0]}.pdf`)
}
