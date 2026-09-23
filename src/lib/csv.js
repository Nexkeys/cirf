// Downloads rows as a CSV file that Excel and Google Sheets open directly.
// `header` is the first line; each row is an array of cells in the same order.
export function saveCsv(filename, header, rows) {
  const csv = [header, ...rows].map((line) => line.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: filename })
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
