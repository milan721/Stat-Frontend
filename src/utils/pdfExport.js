import { jsPDF } from 'jspdf'
// import autoTable from 'jspdf-autotable'

// Mirrors the header gradient used across the dashboard (HEADER_BG in Dashboard.jsx)
const HEADER_FROM = [55, 48, 163]   // #3730a3
const HEADER_TO   = [124, 58, 237]  // #7c3aed
const PAGE_BG     = [8, 10, 24]     // matches the app's body background (#080c1e)
const CHART_BG    = '#0b0e22'
const MARGIN = 12
const DPR = 3 // offscreen canvas render scale, for crisp PNGs in the PDF

function sanitizeFileNamePart(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function buildExportFileName(prefix, parts = []) {
  const cleanParts = [prefix, ...parts].map(sanitizeFileNamePart).filter(Boolean)
  return `${cleanParts.join('_') || 'export'}.pdf`
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i.exec(hex || '')
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [71, 85, 105]
}

function fillPageBg(doc) {
  doc.setFillColor(...PAGE_BG)
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), 'F')
}

function drawHeader(doc, title, subtitle) {
  const w = doc.internal.pageSize.getWidth()
  const titleLines = doc.splitTextToSize(title, w - MARGIN * 2 - 42)
  const bannerH = Math.max(27, 12 + titleLines.length * 5.4 + 2.5 + 6)

  const steps = 48
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    const r = Math.round(HEADER_FROM[0] + (HEADER_TO[0] - HEADER_FROM[0]) * t)
    const g = Math.round(HEADER_FROM[1] + (HEADER_TO[1] - HEADER_FROM[1]) * t)
    const b = Math.round(HEADER_FROM[2] + (HEADER_TO[2] - HEADER_FROM[2]) * t)
    doc.setFillColor(r, g, b)
    doc.rect((w / steps) * i, 0, w / steps + 0.6, bannerH, 'F')
  }
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(titleLines, MARGIN, 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(224, 219, 254)
  const subY = 12 + titleLines.length * 5.4 + 2.5
  doc.text(subtitle || '', MARGIN, subY)
  doc.setFontSize(7.5)
  doc.text(new Date().toLocaleString(), w - MARGIN, 12, { align: 'right' })
  // Clear gap below the banner so the first section never touches the gradient.
  return bannerH + 8
}

// One dark-themed, multi-section report — page background matches the app throughout.
export function newReport(title, subtitle) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  fillPageBg(doc)
  const y = drawHeader(doc, title, subtitle)
  return { doc, y }
}

export function ensureSpace(doc, y, needed) {
  const h = doc.internal.pageSize.getHeight()
  if (y + needed > h - 12) {
    doc.addPage()
    fillPageBg(doc)
    return 16
  }
  return y
}

// Draws a section heading. Pass `reserve` = the height (mm) of the content that will be
// drawn right after it, so the heading and its content page-break together as one unit
// instead of the heading being stranded alone at the bottom of a page.
export function sectionTitle(doc, y, text, reserve = 0) {
  const w = doc.internal.pageSize.getWidth()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  const wrapped = doc.splitTextToSize(text, w - MARGIN * 2)
  const lineH = 5.2
  const blockH = wrapped.length * lineH + 7
  y = ensureSpace(doc, y, blockH + reserve)
  doc.setTextColor(224, 219, 254)
  wrapped.forEach((line, i) => doc.text(line, MARGIN, y + i * lineH))
  const ruleY = y + wrapped.length * lineH - 1
  doc.setDrawColor(...HEADER_TO)
  doc.setLineWidth(0.4)
  doc.line(MARGIN, ruleY, w - MARGIN, ruleY)
  return ruleY + 6
}

export function subLabel(doc, y, text) {
  y = ensureSpace(doc, y, 6)
  doc.setTextColor(175, 175, 195)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.text(String(text), MARGIN, y)
  return y + 5
}

// ── Native KPI tiles — real jsPDF text (not a screenshot), font auto-shrinks to fit ──
export function kpiGridHeight(cards) {
  const cols = Math.min(cards.length, 4) || 1
  const rows = Math.ceil(cards.length / cols)
  return rows * (24 + 4) - 4
}

export function kpiGrid(doc, y, cards) {
  const cols = Math.min(cards.length, 4) || 1
  const w = doc.internal.pageSize.getWidth() - MARGIN * 2
  const gap = 4
  const cardW = (w - gap * (cols - 1)) / cols
  const cardH = 24
  const rows = Math.ceil(cards.length / cols)
  y = ensureSpace(doc, y, rows * (cardH + gap))
  cards.forEach((c, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = MARGIN + col * (cardW + gap)
    const cy = y + row * (cardH + gap)
    doc.setFillColor(...hexToRgb(c.color || '#6366f1'))
    doc.roundedRect(x, cy, cardW, cardH, 2.4, 2.4, 'F')

    const valueStr = String(c.value)
    let fs = 15
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(fs)
    while (doc.getTextWidth(valueStr) > cardW - 8 && fs > 8) {
      fs -= 1
      doc.setFontSize(fs)
    }
    doc.setTextColor(255, 255, 255)
    doc.text(valueStr, x + 4, cy + 11)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text(doc.splitTextToSize(String(c.label), cardW - 8)[0] || '', x + 4, cy + 17)

    if (c.sub) {
      doc.setFontSize(6.2)
      doc.text(doc.splitTextToSize(String(c.sub), cardW - 8)[0] || '', x + 4, cy + 21)
    }
  })
  return y + rows * (cardH + gap) + 2
}

// ── Offscreen canvas chart drawing — fully controlled, so no DOM/CSS clipping or
// misalignment quirks (no blur filters, no overflow:hidden, no forced re-layout). ──

function makeCanvas(wPx, hPx) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(wPx * DPR)
  canvas.height = Math.round(hPx * DPR)
  const ctx = canvas.getContext('2d')
  ctx.scale(DPR, DPR)
  ctx.fillStyle = CHART_BG
  ctx.fillRect(0, 0, wPx, hPx)
  return { canvas, ctx }
}

function roundRect(ctx, x, y, w, h, r) {
  if (w <= 0.01) return
  const rad = Math.max(0, Math.min(r, h / 2, w / 2))
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

function ellipsisText(ctx, text, x, y, maxWidth) {
  let t = String(text ?? '')
  if (ctx.measureText(t).width <= maxWidth) {
    ctx.fillText(t, x, y)
    return
  }
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1)
  ctx.fillText(`${t}…`, x, y)
}

// Horizontal bar chart, one row per item — mirrors the specialist/POC/account palette.
export function barChartCanvas(items, colorFn, opts = {}) {
  const width = opts.width || 900
  const barH = 22, gap = 8, topPad = 8, bottomPad = 8
  const list = items.length ? items : [{ name: 'No data', count: 0 }]
  const height = topPad + list.length * (barH + gap) - gap + bottomPad
  const { canvas, ctx } = makeCanvas(width, height)
  const max = Math.max(...list.map((i) => i.count), 1)
  const labelW = 200, valueW = 56
  const trackX = labelW
  const trackW = width - labelW - valueW - 20

  list.forEach((item, i) => {
    const y = topPad + i * (barH + gap)
    const midY = y + barH / 2
    const color = colorFn(item.name)

    ctx.beginPath()
    ctx.fillStyle = color
    ctx.arc(8, midY, 4, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.font = '600 15px Arial, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ellipsisText(ctx, item.name, 22, midY, labelW - 30)

    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    roundRect(ctx, trackX, midY - 6, trackW, 12, 6)
    ctx.fill()

    const barW = Math.max(6, (item.count / max) * trackW)
    const grad = ctx.createLinearGradient(trackX, 0, trackX + barW, 0)
    grad.addColorStop(0, color)
    grad.addColorStop(1, `${color}b0`)
    ctx.fillStyle = grad
    roundRect(ctx, trackX, midY - 6, barW, 12, 6)
    ctx.fill()

    ctx.fillStyle = 'white'
    ctx.font = '700 15px Arial, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(String(item.count), width - 8, midY)
  })
  return canvas
}

// Donut chart with an inline legend — colors come from the same palette fns as the app.
export function pieChartCanvas(items, colorFn, opts = {}) {
  const width = opts.width || 900
  const list = items.filter((i) => i.value > 0)
  const rowH = 22
  const height = Math.max(240, list.length * rowH + 24)
  const { canvas, ctx } = makeCanvas(width, height)
  if (!list.length) return canvas

  const total = list.reduce((s, i) => s + i.value, 0) || 1
  const cx = 130, cy = height / 2, rOuter = Math.min(100, height / 2 - 14), rInner = rOuter * 0.58
  let angle = -Math.PI / 2

  list.forEach((item) => {
    const slice = (item.value / total) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, rOuter, angle, angle + slice)
    ctx.closePath()
    ctx.fillStyle = colorFn(item.name)
    ctx.fill()
    angle += slice
  })
  ctx.globalCompositeOperation = 'destination-out'
  ctx.beginPath()
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalCompositeOperation = 'source-over'

  const legendX = cx + rOuter + 40
  let ly = Math.max(20, cy - (list.length * rowH) / 2 + rowH / 2)
  list.forEach((item) => {
    ctx.fillStyle = colorFn(item.name)
    roundRect(ctx, legendX, ly - 7, 14, 14, 3)
    ctx.fill()
    const pct = Math.round((item.value / total) * 100)
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.font = '600 14px Arial, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ellipsisText(ctx, `${item.name} (${pct}%)`, legendX + 20, ly, width - legendX - 30)
    ly += rowH
  })
  return canvas
}

// Line/area trend chart.
export function lineChartCanvas(data, color, opts = {}) {
  const width = opts.width || 900
  const height = opts.height || 300
  const { canvas, ctx } = makeCanvas(width, height)

  if (!data.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.font = '13px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('No data for this period', width / 2, height / 2)
    return canvas
  }

  // Extra top padding reserves room for the value label drawn above each point.
  const padL = 42, padR = 16, padT = 34, padB = 30
  const plotW = width - padL - padR, plotH = height - padT - padB
  const max = Math.max(...data.map((d) => d.total), 1)

  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1
  ;[0, 0.5, 1].forEach((t) => {
    const y = padT + plotH * (1 - t)
    ctx.beginPath()
    ctx.moveTo(padL, y)
    ctx.lineTo(width - padR, y)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = '11px Arial, sans-serif'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(Math.round(max * t)), padL - 6, y)
  })

  // A single bucket can't form a line — draw it as one clear labeled point instead
  // of a degenerate zero-width shape (which is what made this look empty before).
  if (data.length === 1) {
    const d = data[0]
    const x = padL + plotW / 2
    const y = padT + plotH * (1 - d.total / max)
    ctx.beginPath()
    ctx.fillStyle = color
    ctx.arc(x, y, 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'white'
    ctx.font = '700 14px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(String(d.total), x, y - 10)
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.font = '10px Arial, sans-serif'
    ctx.textBaseline = 'top'
    ctx.fillText(d.period, x, height - padB + 6)
    return canvas
  }

  const stepX = plotW / (data.length - 1)
  const pointAt = (i, d) => [padL + stepX * i, padT + plotH * (1 - d.total / max)]

  ctx.beginPath()
  data.forEach((d, i) => {
    const [x, y] = pointAt(i, d)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.lineTo(padL + stepX * (data.length - 1), padT + plotH)
  ctx.lineTo(padL, padT + plotH)
  ctx.closePath()
  const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH)
  grad.addColorStop(0, `${color}59`)
  grad.addColorStop(1, `${color}00`)
  ctx.fillStyle = grad
  ctx.fill()

  ctx.beginPath()
  data.forEach((d, i) => {
    const [x, y] = pointAt(i, d)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.strokeStyle = color
  ctx.lineWidth = 2.5
  ctx.stroke()

  // Only label as many points as physically fit without the text overlapping —
  // labels need real horizontal room, unlike the dots which can sit close together.
  const minLabelGap = 46
  const maxLabels = Math.max(2, Math.floor(plotW / minLabelGap) + 1)
  const labelEvery = Math.max(1, Math.ceil((data.length - 1) / (maxLabels - 1)))

  data.forEach((d, i) => {
    const [x, y] = pointAt(i, d)
    ctx.beginPath()
    ctx.fillStyle = color
    ctx.arc(x, y, 3, 0, Math.PI * 2)
    ctx.fill()
    if (i % labelEvery === 0 || i === data.length - 1) {
      ctx.fillStyle = 'white'
      ctx.font = '700 11px Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(String(d.total), x, Math.max(12, y - 8))

      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      ctx.font = '10px Arial, sans-serif'
      ctx.textBaseline = 'top'
      ctx.fillText(d.period, x, height - padB + 6)
    }
  })
  return canvas
}

export function imageHeightMM(doc, canvas) {
  const pageW = doc.internal.pageSize.getWidth() - MARGIN * 2
  return pageW * (canvas.height / canvas.width)
}

export function addImageBlock(doc, y, canvas, opts = {}) {
  const pageW = doc.internal.pageSize.getWidth() - MARGIN * 2
  const imgH = imageHeightMM(doc, canvas)
  y = ensureSpace(doc, y, imgH)
  doc.addImage(canvas.toDataURL('image/png'), 'PNG', MARGIN, y, pageW, imgH)
  return y + imgH + (opts.gap ?? 6)
}

// A real data table — written, selectable stats (not an image). Long tables span
// multiple pages on their own via autoTable's pagination — willDrawPage repaints the
// dark background on each genuinely new page it adds, without touching the page the
// table started on (which may already have earlier report sections drawn above it).
// export function table(doc, y, head, body, opts = {}) {
//   y = ensureSpace(doc, y, opts.reserve ?? 20)
//   const startPage = doc.internal.getNumberOfPages()
//   autoTable(doc, {
//     startY: y,
//     head: [head],
//     body,
//     margin: { left: MARGIN, right: MARGIN, top: 14 },
//     styles: { fontSize: 8, cellPadding: 2, textColor: [222, 222, 235], lineColor: [45, 48, 78], lineWidth: 0.1 },
//     headStyles: { fillColor: HEADER_FROM, textColor: 255, fontStyle: 'bold' },
//     bodyStyles: { fillColor: [15, 18, 40] },
//     alternateRowStyles: { fillColor: [21, 24, 50] },
//     columnStyles: opts.columnStyles,
//     willDrawPage: () => {
//       if (doc.internal.getCurrentPageInfo().pageNumber > startPage) fillPageBg(doc)
//     },
//   })
//   return doc.lastAutoTable.finalY + 6
// }

// Height estimate used to reserve space for a table alongside its heading, so the
// heading and at least the header row + a couple of data rows stay together.
// export function tableReserve(nRows) {
//   return 14 + Math.min(nRows, 3) * 6
// }

export function downloadPdf(doc, fileName) {
  doc.save(fileName)
}
