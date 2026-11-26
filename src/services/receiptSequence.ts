export const receiptSequenceKey = 'avelof:receipt-next-number:v1'
export function nextReceiptSequence(storage: Pick<Storage, 'getItem'>) {
  const raw = storage.getItem(receiptSequenceKey)
  if (raw === null) return 1050
  if (!/^\d+$/.test(raw)) throw new Error('The local receipt counter is invalid. Do not clear it if you need to preserve numbering.')
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 1050 || value >= Number.MAX_SAFE_INTEGER) throw new Error('The local receipt counter is invalid or exhausted.')
  return value
}
export function receiptNumberFor(year: number, sequence: number) {
  return `AVELOF-${year}-${sequence}`
}
export function advanceReceiptSequence(storage: Pick<Storage, 'getItem' | 'setItem'>, sequence: number) {
  if (nextReceiptSequence(storage) !== sequence) throw new Error('Receipt numbering changed in another tab. Generate again.')
  storage.setItem(receiptSequenceKey, String(sequence + 1))
}
