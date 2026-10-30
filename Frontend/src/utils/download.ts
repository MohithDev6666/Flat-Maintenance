function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function pdfSafe(value: string): string {
  return value
    .replace(/₹/g, 'Rs. ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, ' ')
}

export function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`
  const body = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n')
  triggerDownload(filename, new Blob([`\uFEFF${body}`], { type: 'text/csv;charset=utf-8' }))
}

export function downloadPdf(filename: string, lines: string[]) {
  const text = lines.slice(0, 48).map(pdfSafe)
  const commands = ['BT', '/F1 11 Tf', '40 800 Td', '14 TL']
  text.forEach((line, index) => {
    commands.push(index === 0 ? `(${line}) Tj` : `T* (${line}) Tj`)
  })
  commands.push('ET')
  const stream = commands.join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let body = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(body.length)
    body += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = body.length
  body += `xref\n0 ${objects.length + 1}\n`
  body += '0000000000 65535 f \n'
  offsets.slice(1).forEach((offset) => {
    body += `${String(offset).padStart(10, '0')} 00000 n \n`
  })
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  triggerDownload(filename, new Blob([body], { type: 'application/pdf' }))
}

export function openWhatsApp(text: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
}
