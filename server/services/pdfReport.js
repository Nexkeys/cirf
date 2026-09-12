import PDFDocument from 'pdfkit'
import { formatDateTime } from '../lib/dates.js'
import { formatNaira } from '../lib/money.js'

// Renders a transparency report (from buildTransparencyReport) as an A4 PDF and streams
// it straight into the HTTP response. Generated on the server so every copy of the
// report is produced from the same stored data.

const MARGIN = 50
const PAGE_WIDTH = 595.28 // A4 in points
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const COLORS = { ink: '#111827', muted: '#6b7280', accent: '#065f46', line: '#d1d5db' }

const OUTCOME_TEXT = {
  refund: 'Over-collected: the surplus is refunded to contributors in proportion to what they paid.',
  balance_owed: 'Under-collected: the shortfall is shared across contributors in proportion to what they paid.',
  settled: 'Settled: the amount collected matched the actual cost exactly.',
}

export function streamTransparencyPdf(report, res) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: MARGIN,
    bufferPages: true, // lets us add "Page x of y" footers at the end
    info: { Title: `CIRF Transparency Report - ${report.campaign.title}`, Author: 'CIRF' },
  })

  const filename = `cirf-report-${report.campaign.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  doc.pipe(res)

  // Title block
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.accent).text('CIRF TRANSPARENCY REPORT')
  doc.moveDown(0.3).fontSize(20).fillColor(COLORS.ink).text(report.campaign.title)
  doc.moveDown(0.2).font('Helvetica').fontSize(10).fillColor(COLORS.muted)
    .text(`${report.estate.name}  ·  Generated ${formatDateTime(report.generatedAt)}`)
  if (report.anonymized) {
    doc.moveDown(0.2).text('Public version: contributor identities are hidden.')
  }

  const { summary, campaign } = report
  heading(doc, 'Summary')
  keyValues(doc, [
    ['Status', campaign.status],
    ['Category', campaign.category],
    ['Target amount', formatNaira(summary.targetAmount)],
    ['Levy', campaign.levyMethod === 'per_unit'
      ? `${formatNaira(campaign.levyPerUnit)} per unit`
      : `${formatNaira(campaign.levyPerHousehold)} per household`],
    ['Total collected (verified)', formatNaira(summary.totalCollected)],
    ['Contributors', String(summary.contributorCount)],
    ['Selected vendor', summary.selectedVendorName
      ? `${summary.selectedVendorName} (${formatNaira(summary.selectedQuoteAmount)})` : '-'],
    ['Actual cost', summary.actualCost == null ? '-' : formatNaira(summary.actualCost)],
    ['Variance', summary.variance == null ? '-' : formatNaira(summary.variance)],
  ])

  heading(doc, 'Timeline')
  table(doc, [
    { header: 'When', width: 130 },
    { header: 'What happened', width: CONTENT_WIDTH - 130 },
  ], report.timeline.map((event) => [
    formatDateTime(event.at),
    event.by ? `${event.message} (${event.by})` : event.message,
  ]))

  heading(doc, 'Verified contributions')
  table(doc, [
    { header: 'Verified', width: 120 },
    { header: 'Contributor', width: 175 },
    { header: 'Method', width: 100 },
    { header: 'Amount', width: CONTENT_WIDTH - 395, align: 'right' },
  ], report.contributions.map((c) => [
    formatDateTime(c.verifiedAt),
    c.unitNumber ? `${c.contributor} (${c.unitNumber})` : c.contributor,
    c.method.replace('_', ' '),
    formatNaira(c.amount),
  ]))

  heading(doc, 'Vendor quotes')
  table(doc, [
    { header: 'Vendor', width: 150 },
    { header: 'Quote', width: 100, align: 'right' },
    { header: 'Selected', width: 60 },
    { header: 'Reason / notes', width: CONTENT_WIDTH - 310 },
  ], report.quotes.map((q) => [
    q.vendorName,
    formatNaira(q.quotedAmount),
    q.selected ? 'Yes' : '',
    q.selectionReason ?? q.notes ?? '',
  ]))

  heading(doc, 'Reconciliation')
  if (!report.reconciliation) {
    note(doc, 'This campaign has not been reconciled yet.')
  } else {
    const r = report.reconciliation
    keyValues(doc, [
      ['Total collected', formatNaira(r.totalCollected)],
      ['Actual cost', formatNaira(r.actualCost)],
      ['Variance (collected - cost)', formatNaira(r.variance)],
      ['Reconciled', formatDateTime(r.generatedAt)],
    ])
    note(doc, OUTCOME_TEXT[r.outcome])
    table(doc, [
      { header: 'Contributor', width: 155 },
      { header: 'Paid', width: 85, align: 'right' },
      { header: 'Share', width: 55, align: 'right' },
      { header: 'Refund (+) / owed (-)', width: 110, align: 'right' },
      { header: 'Final share', width: CONTENT_WIDTH - 405, align: 'right' },
    ], r.perContributor.map((row) => [
      row.contributor,
      formatNaira(row.paid),
      `${row.sharePercent}%`,
      formatNaira(row.adjustment),
      formatNaira(row.finalShare),
    ]))
  }

  heading(doc, 'About this report')
  note(doc,
    'CIRF records and verifies contributions toward community repairs. It does not process payments. ' +
    'Every figure here comes from the campaign\'s stored audit trail, which cannot be edited after the fact.')

  addFooters(doc)
  doc.end()
}

function ensureSpace(doc, height) {
  if (doc.y + height > doc.page.height - MARGIN) doc.addPage()
}

function heading(doc, text) {
  ensureSpace(doc, 60)
  doc.moveDown(1).font('Helvetica-Bold').fontSize(13).fillColor(COLORS.accent).text(text, MARGIN)
  doc.moveDown(0.4)
}

function note(doc, text) {
  doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.muted).text(text, MARGIN, doc.y, { width: CONTENT_WIDTH })
  doc.moveDown(0.5)
}

function keyValues(doc, rows) {
  const keyWidth = 170
  const valueWidth = CONTENT_WIDTH - keyWidth - 10
  doc.fontSize(9.5)
  for (const [key, value] of rows) {
    doc.font('Helvetica')
    const height = Math.max(
      doc.heightOfString(key, { width: keyWidth }),
      doc.heightOfString(value, { width: valueWidth }),
    )
    ensureSpace(doc, height + 4)
    const y = doc.y
    doc.fillColor(COLORS.muted).text(key, MARGIN, y, { width: keyWidth })
    doc.font('Helvetica-Bold').fillColor(COLORS.ink).text(value, MARGIN + keyWidth + 10, y, { width: valueWidth })
    doc.y = y + height + 4
  }
}

// A simple ruled table that repeats its header row when it runs onto a new page.
function table(doc, columns, rows) {
  if (rows.length === 0) return note(doc, 'None recorded.')

  const drawRow = (cells, bold) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5)
    const height = 8 + Math.max(
      ...cells.map((cell, i) => doc.heightOfString(cell, { width: columns[i].width - 8 })),
    )
    const y = doc.y
    let x = MARGIN
    cells.forEach((cell, i) => {
      doc.fillColor(bold ? COLORS.accent : COLORS.ink)
        .text(cell, x + 4, y + 4, { width: columns[i].width - 8, align: columns[i].align ?? 'left' })
      x += columns[i].width
    })
    doc.moveTo(MARGIN, y + height).lineTo(MARGIN + CONTENT_WIDTH, y + height)
      .lineWidth(0.5).strokeColor(COLORS.line).stroke()
    doc.y = y + height
  }

  const header = columns.map((column) => column.header)
  ensureSpace(doc, 40)
  drawRow(header, true)

  for (const row of rows) {
    const cells = row.map(String)
    doc.font('Helvetica').fontSize(8.5)
    const height = 8 + Math.max(
      ...cells.map((cell, i) => doc.heightOfString(cell, { width: columns[i].width - 8 })),
    )
    if (doc.y + height > doc.page.height - MARGIN) {
      doc.addPage()
      drawRow(header, true)
    }
    drawRow(cells, false)
  }
  doc.x = MARGIN
}

function addFooters(doc) {
  const { start, count } = doc.bufferedPageRange()
  for (let i = start; i < start + count; i++) {
    doc.switchToPage(i)
    // Writing inside the bottom margin would otherwise make pdfkit start a new page.
    const bottomMargin = doc.page.margins.bottom
    doc.page.margins.bottom = 0
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text(
      `CIRF · Community Infrastructure Repair Fund Tracker · Page ${i + 1} of ${count}`,
      MARGIN,
      doc.page.height - 30,
      { width: CONTENT_WIDTH, align: 'center' },
    )
    doc.page.margins.bottom = bottomMargin
  }
}
