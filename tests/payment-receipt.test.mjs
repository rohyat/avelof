import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildPaymentReceiptPdf, paymentReceiptSchema, receiptBalance, paymentReceiptFilename, receiptTotalForPersons } from '../src/services/paymentReceipt.ts'
import { applyPackageDiscount, packagePriceForNights } from '../src/services/pricing.ts'
import { tourPackages } from '../src/data/catalog.ts'

const receipt = {
  guestName: 'Aisha Khan', guestPhone: '+91 9876543210', title: 'Kashmir holiday', receiptNumber: 'RCPT-2026-001',
  receiptDate: '2026-11-25', total: 30000.30, received: 10000.10,
  paymentMethod: 'UPI', transactionReference: 'UPI123456',
}
test('same saved discount applies to every available package without stacking or mutating base rates', () => {
  const before = JSON.stringify(tourPackages)
  for (const percent of [0, 23, 100, 12.51]) {
    for (const item of applyPackageDiscount(tourPackages, percent)) {
      const base = tourPackages.find(value => value.id === item.id)
      if (base.underDevelopment) { assert.deepEqual(item, base); continue }
      const regular = base.originalPrice ?? base.price
      assert.equal(item.originalPrice, regular)
      assert.equal(item.discountPercent, percent)
      assert.equal(item.price, Math.round(regular * (10000 - Math.round(percent * 100)) / 100) / 100)
      assert.equal(packagePriceForNights(item.price, 4, 8), item.price * 2)
    }
  }
  assert.equal(JSON.stringify(tourPackages), before)
  assert.equal(applyPackageDiscount(tourPackages, 23).find(item => item.id === 'deluxe').price, 10779.23)
})
test('receipt validates money, dates, guest details and overpayments', () => {
  assert.ok(paymentReceiptSchema.safeParse(receipt).success)
  for (const patch of [{ received: -1 }, { received: 30000.31 }, { received: 1.001 }, { total: Infinity }, { guestName: '' }, { guestPhone: '' }, { guestPhone: '123' }, { guestPhone: 'bad number' }, { receiptNumber: '' }, { receiptDate: '2026-02-30' }]) {
    assert.equal(paymentReceiptSchema.safeParse({ ...receipt, ...patch }).success, false)
  }
  assert.equal(receiptBalance(30000.30, 10000.10), 20000.20)
  assert.equal(receiptBalance(0.30, 0.10), 0.20)
  assert.equal(receiptBalance(30000.30, 30000.30), 0)
  assert.equal(paymentReceiptFilename('AVELOF-2026-1050'), 'AVELOF-2026-1050.pdf')
})
test('download is a single-page receipt containing exact totals and payment status', async () => {
  for (const [received, pending, status] of [[10000.10, '20,000.20', 'Partially paid'], [30000.30, '0.00', 'Paid in full'], [0, '30,000.30', 'No payment recorded']]) {
    const pdf = await buildPaymentReceiptPdf({ ...receipt, received })
    assert.equal(pdf.getNumberOfPages(), 1)
    const text = pdf.internal.pages[1].join('\n')
    for (const value of ['PAYMENT RECEIPT', 'AVELOF', 'info@avelof.in', receipt.guestName, receipt.guestPhone, receipt.receiptNumber, receipt.transactionReference, 'INR 30,000.30', `INR ${pending}`, status, 'not a booking confirmation']) assert.ok(text.includes(value), value)
    assert.ok(pdf.output('arraybuffer').byteLength > 1000)
  }
  await assert.rejects(buildPaymentReceiptPdf({ ...receipt, received: 40000 }))
})

test('per-person pricing calculates to the paisa and prints the price basis on page one', async () => {
  assert.equal(receiptTotalForPersons(15000.15, 2), 30000.30)
  assert.equal(receiptTotalForPersons(0.1, 3), 0.3)
  for (const [price, persons] of [[1.001, 2], [100, 0], [100, 1.5], [100, 101], [-1, 2]]) assert.throws(() => receiptTotalForPersons(price, persons))
  const input = { ...receipt, perPersonPricing: { pricePerPerson: 15000.15, persons: 2 } }
  assert.equal(paymentReceiptSchema.safeParse(input).success, true)
  assert.equal(paymentReceiptSchema.safeParse({ ...input, total: 31000 }).success, false)
  const pdf = await buildPaymentReceiptPdf(input)
  assert.equal(pdf.getNumberOfPages(), 1)
  assert.ok(pdf.internal.pages[1].join('\n').includes('INR 15,000.15 per person x 2 persons'))
})
