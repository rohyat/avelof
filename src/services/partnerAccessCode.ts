export const partnerStatusAccessCodePattern = /^[\p{L}\p{N}]{1,4}[0-9]{4}$/u

export function partnerStatusAccessCode(name: string, phone: string) {
  const prefix = (name.normalize('NFKD').toUpperCase().match(/[\p{L}\p{N}]/gu) ?? []).slice(0, 4).join('')
  const phoneSuffix = phone.replace(/\D/g, '').slice(-4)
  if (!prefix || phoneSuffix.length !== 4) throw new Error('A name and valid phone number are required for status access.')
  return `${prefix}${phoneSuffix}`
}
