// Quick checks so people see mistakes before a request is sent. The API checks
// everything again, so these only need to be friendly, not watertight.

export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

// Digits with the usual separators, optionally starting with +. The API does the strict
// check and stores the number in +234 form.
export const isPhone = (value) => /^\+?[\d\s().-]{7,20}$/.test(value.trim())

export const MIN_PASSWORD_LENGTH = 8
