export function indianPhoneNumber(value: string) {
  if (!/^[+0-9\s()-]+$/.test(value.trim())) return ''
  const digits = value.replace(/\D/g, '')
  const national = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits
  return /^\d{10}$/.test(national) ? national : ''
}