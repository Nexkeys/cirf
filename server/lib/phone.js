// Phone numbers are stored in international E.164 form (+2348012345678), so the usual
// ways of writing the same Nigerian number all match one account:
//   08012345678, 0801 234 5678, 2348012345678, +234 801 234 5678
// A number without a country code is treated as a Nigerian mobile number.
// Returns null when the input can't be a real phone number.
export function normalizePhone(input) {
  const compact = String(input ?? '').replace(/[\s().-]/g, '')

  if (/^0[789]\d{9}$/.test(compact)) return `+234${compact.slice(1)}`
  if (/^234[789]\d{9}$/.test(compact)) return `+${compact}`
  if (compact.startsWith('+234')) return /^\+234[789]\d{9}$/.test(compact) ? compact : null
  if (/^\+[1-9]\d{7,14}$/.test(compact)) return compact
  return null
}
