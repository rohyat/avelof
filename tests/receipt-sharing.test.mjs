import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { nextReceiptSequence, receiptNumberFor, advanceReceiptSequence, receiptSequenceKey } from '../src/services/receiptSequence.ts'
import { pdfFile, sharePdf } from '../src/services/pdfSharing.ts'
import { buildPaymentReceiptPdf } from '../src/services/paymentReceipt.ts'

test('local numbering starts at 1050, persists increments and rejects corrupt or conflicting counters', () => {
  const values = new Map()
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  assert.equal(nextReceiptSequence(storage), 1050)
  assert.equal(receiptNumberFor(2026, 1050), 'AVELOF-2026-1050')
  advanceReceiptSequence(storage, 1050)
  assert.equal(nextReceiptSequence(storage), 1051)
  assert.throws(() => advanceReceiptSequence(storage, 1050), /another tab/)
  for (const value of ['bad', '0', '1050.5', '9007199254740992']) {
    values.set(receiptSequenceKey, value)
    assert.throws(() => nextReceiptSequence(storage), /invalid/)
  }
})
test('file sharing uses the exact PDF filename, treats cancellation normally and surfaces unsupported/failing shares', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const file = pdfFile(new Blob(['%PDF-']), 'AVELOF-2026-1050.pdf')
  try {
    let request
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { canShare: () => true, share: async data => { request = data } } })
    assert.equal(await sharePdf(file), true)
    assert.equal(request.files[0].name, file.name)
    assert.equal(request.files[0].type, 'application/pdf')
    navigator.share = async () => { throw new DOMException('Cancelled', 'AbortError') }
    assert.equal(await sharePdf(file), false)
    navigator.share = async () => { throw new Error('Permission denied') }
    await assert.rejects(sharePdf(file), /Permission denied/)
    navigator.canShare = () => false
    await assert.rejects(sharePdf(file), /cannot share PDF files/)
    delete navigator.canShare
    navigator.share = async data => { request = data }
    assert.equal(await sharePdf(file), true, 'a browser with Share but no canShare can still attempt native sharing')
    delete navigator.share
    await assert.rejects(sharePdf(file), /VS Code integrated browser/)
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor)
    else delete globalThis.navigator
  }
})
test('payment screenshot is embedded beside details on page one with receipt reference', async () => {
  const bytes = await readFile('public\\images\\destinations\\kashmir-room-inspiration-01.jpg')
  const pdf = await buildPaymentReceiptPdf({
    guestName: 'Screenshot Test', guestPhone: '9876543210', title: 'Kashmir tour',
    receiptNumber: 'AVELOF-2026-1050', receiptDate: '2026-11-25', total: 20000,
    received: 10000, paymentMethod: 'UPI', transactionReference: 'REF123',
    screenshot: `data:image/jpeg;base64,${bytes.toString('base64')}`,
  })
  assert.equal(pdf.getNumberOfPages(), 1)
  assert.ok(pdf.internal.pages[1].join('\n').includes('Payment screenshot'))
  assert.ok(pdf.internal.pages[1].join('\n').includes('AMOUNT RECEIVED'))
  assert.ok(pdf.internal.pages[1].join('\n').includes('INR 10,000.00'))
  assert.ok(pdf.internal.pages[1].join('\n').includes('AVELOF-2026-1050'))
  assert.ok(pdf.internal.pages[1].join('\n').includes('/I0 Do'))
})

test('page-one screenshot and maximum-length details fit without overflowing payment cards', async () => {
    const { jsPDF } = await import('jspdf')
    const operations = []
    const record = function () {
      for (const method of ['addImage', 'text']) {
        const original = this[method]
        this[method] = function (...args) {
          operations.push({ method, args, size: this.getFontSize() })
          return original.apply(this, args)
        }
      }
    }
    const event = ['initialized', record]
    jsPDF.API.events.push(event)
    try {
      const bytes = await readFile('public\\images\\destinations\\kashmir-room-inspiration-01.jpg')
      const pdf = await buildPaymentReceiptPdf({
        guestName: 'W'.repeat(60), guestPhone: '+91 9876543210', title: 'W'.repeat(80),
        receiptNumber: 'AVELOF-2026-1050', receiptDate: '2026-11-25',
        total: 999999999.99, received: 10000.1, paymentMethod: 'UPI', transactionReference: 'W'.repeat(100),
        screenshot: `data:image/jpeg;base64,${bytes.toString('base64')}`,
      })
      assert.equal(pdf.getNumberOfPages(), 1)
      const image = operations.find(operation => operation.method === 'addImage')
      const [, , x, y, width, height] = image.args
      assert.ok(x >= 136 && x + width <= 190)
      assert.ok(y >= 110 && y + height <= 176)
      const props = pdf.getImageProperties(image.args[0])
      assert.ok(Math.abs(width / height - props.width / props.height) < 0.001, 'screenshot not cropped or stretched')
      for (const operation of operations.filter(operation => operation.method === 'text')) {
        const [text, , y] = operation.args
        const rows = [].concat(text).length
        assert.ok(y + (rows - 1) * operation.size * 0.3528 * 1.15 < 290, 'text fits page one')
      }
    } finally { jsPDF.API.events.splice(jsPDF.API.events.indexOf(event), 1) }
})
