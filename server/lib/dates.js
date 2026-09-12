// "12 Sept 2026, 21:27" in Nigerian time, for PDFs and messages.
export function formatDateTime(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Lagos',
  })
}
