/**
 * A4 report PDFs: residency letterhead top right, centred title and details, then headed sections
 * (stat tiles, tables and notes), with a footer and page numbers on every page.
 *
 * The PDF is written directly with the built-in Helvetica fonts, so no extra library is needed.
 */

import dayjs from 'dayjs'

export interface PdfLetterhead {
  name: string
  address?: string
  phone?: string
}

export interface PdfColumn {
  header: string
  /** Relative width; columns share the page width in proportion. */
  width: number
  align?: 'left' | 'right' | 'center'
}

export type PdfSection =
  | { type: 'stats'; heading: string; items: { label: string; value: string; hint?: string }[] }
  | {
      type: 'table'
      heading: string
      columns: PdfColumn[]
      rows: string[][]
      /** Optional header row above the column headers, e.g. "Owner" spanning four columns. */
      groups?: { label: string; span: number }[]
      footer?: string[]
      emptyText?: string
    }
  | { type: 'note'; heading?: string; text: string }

export interface PdfReport {
  filename: string
  title: string
  subtitle?: string
  letterhead: PdfLetterhead
  /** Key facts shown centred under the title, two per row. */
  details?: { label: string; value: string }[]
  sections: PdfSection[]
}

// ---------------------------------------------------------------------------------------------
// Page geometry (points) and colours, taken from the app's terracotta and sand palette.

const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 40
const CONTENT_W = PAGE_W - MARGIN * 2
const BOTTOM_LIMIT = PAGE_H - 54

type RGB = readonly [number, number, number]

function hex(value: string): RGB {
  const n = Number.parseInt(value.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

const COLOR = {
  ink: hex('#3F261E'),
  text: hex('#2E261F'),
  muted: hex('#6E5B47'),
  accent: hex('#764636'),
  accentSoft: hex('#F4E8E1'),
  zebra: hex('#FBF8F4'),
  border: hex('#E8DFD2'),
  white: hex('#FFFFFF'),
}

// ---------------------------------------------------------------------------------------------
// Text: standard Helvetica widths (1/1000 em) for ASCII 32–126, so text can be centred,
// right-aligned and wrapped accurately.

const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833,
  722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556,
  556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334,
  260, 334, 584,
]

const HELVETICA_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833,
  722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611,
  556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389,
  280, 389, 584,
]

/** Keeps text to what the WinAnsi-encoded standard fonts can draw; ₹ becomes "Rs. ". */
function clean(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/₹\s?/g, 'Rs. ')
    .replace(/[–—−]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/•/g, '·')
    .replace(/[  ]/g, ' ')
    .replace(/[^\x20-\x7E\xA1-\xFF]/g, '')
}

function charWidth(code: number, bold: boolean): number {
  if (code >= 32 && code <= 126) return (bold ? HELVETICA_BOLD : HELVETICA)[code - 32]
  if (code === 0xb7) return 278
  return bold ? 611 : 556
}

function textWidth(value: string, size: number, bold = false): number {
  let units = 0
  for (let index = 0; index < value.length; index += 1) units += charWidth(value.charCodeAt(index), bold)
  return (units * size) / 1000
}

/** Splits cleaned text into lines no wider than maxWidth, breaking long words when needed. */
function wrap(value: string, size: number, maxWidth: number, bold = false): string[] {
  const words = clean(value).split(' ').filter(Boolean)
  if (words.length === 0) return ['']
  const lines: string[] = []
  let current = ''
  const push = (word: string) => {
    // A single word wider than the column is cut into pieces that fit.
    let rest = word
    while (textWidth(rest, size, bold) > maxWidth && rest.length > 1) {
      let cut = rest.length - 1
      while (cut > 1 && textWidth(rest.slice(0, cut), size, bold) > maxWidth) cut -= 1
      lines.push(rest.slice(0, cut))
      rest = rest.slice(cut)
    }
    current = rest
  }
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (textWidth(candidate, size, bold) <= maxWidth) {
      current = candidate
    } else {
      if (current) lines.push(current)
      push(word)
    }
  }
  if (current) lines.push(current)
  return lines
}

/** Shortens text with "..." so it fits on one line. */
function fit(value: string, size: number, maxWidth: number, bold = false): string {
  const text = clean(value)
  if (textWidth(text, size, bold) <= maxWidth) return text
  let end = text.length
  while (end > 0 && textWidth(`${text.slice(0, end)}...`, size, bold) > maxWidth) end -= 1
  return `${text.slice(0, end)}...`
}

function escapePdf(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

const num = (value: number) => (Math.round(value * 100) / 100).toString()
const rgb = (color: RGB) => color.map((part) => num(part)).join(' ')

// ---------------------------------------------------------------------------------------------
// Drawing. Coordinates are measured from the top-left of the page; y is converted for PDF.

interface TextStyle {
  size?: number
  bold?: boolean
  color?: RGB
  align?: 'left' | 'right' | 'center'
}

class PageWriter {
  readonly pages: string[][] = []
  private ops: string[] = []
  y = MARGIN
  private readonly report: PdfReport

  constructor(report: PdfReport) {
    this.report = report
    this.newPage()
  }

  newPage() {
    this.ops = []
    this.pages.push(this.ops)
    this.y = MARGIN
    this.rect(0, 0, PAGE_W, 5, COLOR.accent)
    if (this.pages.length > 1) this.runningHeader()
  }

  /** Starts a new page when the next block would run into the footer. */
  ensure(height: number): boolean {
    if (this.y + height <= BOTTOM_LIMIT) return false
    this.newPage()
    return true
  }

  rect(x: number, y: number, width: number, height: number, fill?: RGB, stroke?: RGB, lineWidth = 0.6) {
    const box = `${num(x)} ${num(PAGE_H - y - height)} ${num(width)} ${num(height)} re`
    if (fill && stroke) this.ops.push(`${rgb(fill)} rg ${rgb(stroke)} RG ${lineWidth} w ${box} B`)
    else if (fill) this.ops.push(`${rgb(fill)} rg ${box} f`)
    else if (stroke) this.ops.push(`${rgb(stroke)} RG ${lineWidth} w ${box} S`)
  }

  line(x1: number, y1: number, x2: number, y2: number, color: RGB = COLOR.border, lineWidth = 0.6) {
    this.ops.push(`${rgb(color)} RG ${lineWidth} w ${num(x1)} ${num(PAGE_H - y1)} m ${num(x2)} ${num(PAGE_H - y2)} l S`)
  }

  /** Draws one line of text with its baseline at y. */
  text(value: string, x: number, y: number, style: TextStyle = {}) {
    const size = style.size ?? 9
    const bold = style.bold ?? false
    const content = clean(value)
    if (!content) return
    const width = textWidth(content, size, bold)
    const left = style.align === 'right' ? x - width : style.align === 'center' ? x - width / 2 : x
    this.ops.push(
      `${rgb(style.color ?? COLOR.text)} rg BT /${bold ? 'F2' : 'F1'} ${size} Tf ${num(left)} ${num(PAGE_H - y)} Td (${escapePdf(content)}) Tj ET`,
    )
  }

  // --- Page furniture ---------------------------------------------------------------------

  private runningHeader() {
    const { title, subtitle, letterhead } = this.report
    const left = subtitle ? `${title} · ${subtitle}` : title
    this.text(fit(left, 9, CONTENT_W / 2), MARGIN, MARGIN + 4, { size: 9, bold: true, color: COLOR.ink })
    this.text(fit(letterhead.name, 9, CONTENT_W / 2 - 10), PAGE_W - MARGIN, MARGIN + 4, {
      size: 9,
      color: COLOR.muted,
      align: 'right',
    })
    this.line(MARGIN, MARGIN + 12, PAGE_W - MARGIN, MARGIN + 12, COLOR.border, 0.8)
    this.y = MARGIN + 24
  }

  /** First-page letterhead: brand mark on the left, residency details on the right. */
  letterhead() {
    const { letterhead } = this.report
    const top = MARGIN + 2
    const right = PAGE_W - MARGIN

    // Left: monogram and document label.
    const initials =
      clean(letterhead.name)
        .split(' ')
        .filter((word) => /^[A-Za-z0-9]/.test(word))
        .slice(0, 2)
        .map((word) => word[0].toUpperCase())
        .join('') || 'FM'
    this.rect(MARGIN, top, 38, 38, COLOR.accent)
    this.text(initials, MARGIN + 19, top + 24, { size: 14, bold: true, color: COLOR.white, align: 'center' })
    this.text('Flat Maintenance', MARGIN + 48, top + 15, { size: 11, bold: true, color: COLOR.ink })
    this.text('Residents account statement', MARGIN + 48, top + 28, { size: 8.5, color: COLOR.muted })

    // Right: residency name, address and contact.
    const blockWidth = 250
    let y = top + 13
    for (const line of wrap(letterhead.name, 13, blockWidth, true).slice(0, 2)) {
      this.text(line, right, y, { size: 13, bold: true, color: COLOR.ink, align: 'right' })
      y += 15
    }
    if (letterhead.address) {
      for (const line of wrap(letterhead.address, 8.5, blockWidth).slice(0, 3)) {
        this.text(line, right, y, { size: 8.5, color: COLOR.muted, align: 'right' })
        y += 11
      }
    }
    if (letterhead.phone) {
      this.text(`Phone: ${letterhead.phone}`, right, y, { size: 8.5, color: COLOR.muted, align: 'right' })
      y += 11
    }

    const bottom = Math.max(top + 38, y - 4) + 12
    this.line(MARGIN, bottom, right, bottom, COLOR.accent, 1.2)
    this.y = bottom
  }

  /** Centred report title, subtitle and details box. */
  titleBlock() {
    const { title, subtitle, details } = this.report
    const center = PAGE_W / 2
    this.y += 30
    this.text(title, center, this.y, { size: 17, bold: true, color: COLOR.ink, align: 'center' })
    if (subtitle) {
      this.y += 16
      this.text(subtitle, center, this.y, { size: 10.5, color: COLOR.muted, align: 'center' })
    }
    this.y += 14

    if (!details || details.length === 0) return
    const rowHeight = 18
    const rows = Math.ceil(details.length / 2)
    const boxTop = this.y + 4
    const half = CONTENT_W / 2
    this.rect(MARGIN, boxTop, CONTENT_W, rows * rowHeight + 10, COLOR.accentSoft, COLOR.border)
    details.forEach((detail, index) => {
      const column = index % 2
      const row = Math.floor(index / 2)
      const x = MARGIN + 14 + column * half
      const baseline = boxTop + 5 + row * rowHeight + 12
      const label = `${detail.label}:`
      this.text(label, x, baseline, { size: 8.5, color: COLOR.muted })
      const valueX = x + Math.max(78, textWidth(clean(label), 8.5) + 8)
      this.text(fit(detail.value, 9, half - (valueX - x) - 20, true), valueX, baseline, { size: 9, bold: true, color: COLOR.ink })
    })
    if (details.length > 2) this.line(MARGIN + half, boxTop + 6, MARGIN + half, boxTop + rows * rowHeight + 4, COLOR.border)
    this.y = boxTop + rows * rowHeight + 10
  }

  // --- Sections ---------------------------------------------------------------------------

  heading(label: string, keepWith: number) {
    this.ensure(34 + keepWith)
    this.y += 24
    this.text(label, MARGIN, this.y, { size: 11.5, bold: true, color: COLOR.ink })
    this.rect(MARGIN, this.y + 5, 30, 2, COLOR.accent)
    this.y += 14
  }

  stats(items: { label: string; value: string; hint?: string }[]) {
    const columns = items.length === 4 ? 4 : 3
    const gap = 10
    const width = (CONTENT_W - gap * (columns - 1)) / columns
    const height = items.some((item) => item.hint) ? 54 : 44
    for (let start = 0; start < items.length; start += columns) {
      if (start > 0) this.y += gap
      this.ensure(height)
      items.slice(start, start + columns).forEach((item, index) => {
        const x = MARGIN + index * (width + gap)
        this.rect(x, this.y, width, height, COLOR.zebra, COLOR.border)
        this.rect(x, this.y, 3, height, COLOR.accent)
        this.text(fit(item.label.toUpperCase(), 7.5, width - 20, true), x + 12, this.y + 15, {
          size: 7.5,
          bold: true,
          color: COLOR.muted,
        })
        this.text(fit(item.value, 13, width - 20, true), x + 12, this.y + 33, { size: 13, bold: true, color: COLOR.ink })
        if (item.hint) this.text(fit(item.hint, 7.5, width - 20), x + 12, this.y + 46, { size: 7.5, color: COLOR.muted })
      })
      this.y += height
    }
  }

  table(section: Extract<PdfSection, { type: 'table' }>) {
    const { columns, rows, groups, footer, emptyText } = section
    const size = columns.length > 8 ? 7.5 : 8.5
    const pad = 5
    const lineHeight = size * 1.3
    const total = columns.reduce((sum, column) => sum + column.width, 0)
    const widths = columns.map((column) => (column.width / total) * CONTENT_W)
    const lefts = widths.map((_, index) => MARGIN + widths.slice(0, index).reduce((sum, width) => sum + width, 0))

    const cellX = (index: number) => {
      const align = columns[index].align ?? 'left'
      if (align === 'right') return lefts[index] + widths[index] - pad
      if (align === 'center') return lefts[index] + widths[index] / 2
      return lefts[index] + pad
    }

    const headerLines = columns.map((column, index) => wrap(column.header, size, widths[index] - pad * 2, true))
    const headerHeight = Math.max(...headerLines.map((lines) => lines.length)) * lineHeight + pad * 2
    const groupHeight = groups ? size + pad * 2 + 2 : 0

    const drawHeader = () => {
      if (groups) {
        let index = 0
        for (const group of groups) {
          const x = lefts[index]
          const width = widths.slice(index, index + group.span).reduce((sum, value) => sum + value, 0)
          this.rect(x, this.y, width, groupHeight, group.label ? COLOR.accentSoft : undefined)
          if (group.label) {
            this.text(fit(group.label, size, width - pad * 2, true), x + width / 2, this.y + pad + size + 0.5, {
              size,
              bold: true,
              color: COLOR.accent,
              align: 'center',
            })
          }
          index += group.span
        }
        this.y += groupHeight
      }
      this.rect(MARGIN, this.y, CONTENT_W, headerHeight, COLOR.accent)
      headerLines.forEach((lines, index) => {
        lines.forEach((line, lineIndex) => {
          this.text(line, cellX(index), this.y + pad + size * 0.85 + lineIndex * lineHeight, {
            size,
            bold: true,
            color: COLOR.white,
            align: columns[index].align,
          })
        })
      })
      this.y += headerHeight
    }

    const firstRowHeight = rows.length > 0 ? lineHeight + pad * 2 : 26
    this.ensure(groupHeight + headerHeight + firstRowHeight)
    drawHeader()

    if (rows.length === 0) {
      this.rect(MARGIN, this.y, CONTENT_W, 26, COLOR.zebra)
      this.text(emptyText ?? 'Nothing to show', PAGE_W / 2, this.y + 16, { size, color: COLOR.muted, align: 'center' })
      this.y += 26
      this.line(MARGIN, this.y, PAGE_W - MARGIN, this.y)
      return
    }

    const drawRow = (cells: string[], options: { fill?: RGB; bold?: boolean; rule?: RGB }) => {
      const lines = columns.map((_, index) => wrap(cells[index] ?? '', size, widths[index] - pad * 2, options.bold))
      const height = Math.max(...lines.map((cell) => cell.length)) * lineHeight + pad * 2
      if (this.ensure(height)) drawHeader()
      if (options.fill) this.rect(MARGIN, this.y, CONTENT_W, height, options.fill)
      lines.forEach((cellLines, index) => {
        cellLines.forEach((line, lineIndex) => {
          this.text(line, cellX(index), this.y + pad + size * 0.85 + lineIndex * lineHeight, {
            size,
            bold: options.bold,
            color: options.bold ? COLOR.ink : COLOR.text,
            align: columns[index].align,
          })
        })
      })
      this.y += height
      this.line(MARGIN, this.y, PAGE_W - MARGIN, this.y, options.rule ?? COLOR.border, options.rule ? 1 : 0.5)
    }

    rows.forEach((cells, index) => drawRow(cells, { fill: index % 2 === 1 ? COLOR.zebra : undefined }))
    if (footer) drawRow(footer, { fill: COLOR.accentSoft, bold: true, rule: COLOR.accent })
  }

  note(text: string) {
    const lines = wrap(text, 8.5, CONTENT_W - 28)
    const height = lines.length * 11.5 + 14
    this.ensure(height)
    this.rect(MARGIN, this.y, CONTENT_W, height, COLOR.accentSoft)
    this.rect(MARGIN, this.y, 3, height, COLOR.accent)
    lines.forEach((line, index) => {
      this.text(line, MARGIN + 14, this.y + 15 + index * 11.5, { size: 8.5, color: COLOR.muted })
    })
    this.y += height
  }

  /** Footer on every page, once the page count is known. */
  footers() {
    const generated = `Generated on ${dayjs().format('DD-MM-YYYY HH:mm')}`
    const left = `${this.report.letterhead.name} · ${this.report.title}`
    this.pages.forEach((ops, index) => {
      this.ops = ops
      const y = PAGE_H - 34
      this.line(MARGIN, y, PAGE_W - MARGIN, y, COLOR.border, 0.8)
      this.text(fit(left, 7.5, CONTENT_W / 2 - 60), MARGIN, y + 13, { size: 7.5, color: COLOR.muted })
      this.text(generated, PAGE_W / 2 + 40, y + 13, { size: 7.5, color: COLOR.muted, align: 'center' })
      this.text(`Page ${index + 1} of ${this.pages.length}`, PAGE_W - MARGIN, y + 13, {
        size: 7.5,
        color: COLOR.muted,
        align: 'right',
      })
    })
  }
}

// ---------------------------------------------------------------------------------------------
// PDF file assembly.

function assemble(pages: string[][]): Uint8Array {
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, index) => `${5 + index * 2} 0 R`).join(' ')}] >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ]
  pages.forEach((ops, index) => {
    const stream = ops.join('\n')
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${6 + index * 2} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>`,
    )
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
  })

  // Every character is a single byte (Latin-1), so string length equals byte length.
  let body = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((object, index) => {
    offsets.push(body.length)
    body += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = body.length
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) body += `${String(offset).padStart(10, '0')} 00000 n \n`
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`

  const bytes = new Uint8Array(body.length)
  for (let index = 0; index < body.length; index += 1) bytes[index] = body.charCodeAt(index) & 0xff
  return bytes
}

export function buildReportPdf(report: PdfReport): Uint8Array {
  const writer = new PageWriter(report)
  writer.letterhead()
  writer.titleBlock()
  for (const section of report.sections) {
    if (section.type === 'stats') {
      writer.heading(section.heading, 54)
      writer.stats(section.items)
    } else if (section.type === 'table') {
      writer.heading(section.heading, 50)
      writer.table(section)
    } else {
      if (section.heading) writer.heading(section.heading, 30)
      else writer.y += 16
      writer.note(section.text)
    }
  }
  writer.footers()
  return assemble(writer.pages)
}

/** The report as a PDF file, e.g. to attach when sharing. */
export function reportPdfFile(report: PdfReport): File {
  const bytes = buildReportPdf(report)
  return new File([bytes.buffer as ArrayBuffer], report.filename, { type: 'application/pdf' })
}

/** Builds the report and downloads it as an A4 PDF. */
export function downloadReportPdf(report: PdfReport) {
  const bytes = buildReportPdf(report)
  const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.download = report.filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
