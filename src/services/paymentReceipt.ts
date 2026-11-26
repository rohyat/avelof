import { z } from 'zod'
import { business } from '../config.ts'

const moneyAmount = z.number().min(0).max(1000000000).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001, 'Enter amounts with at most two decimal places.')
export const perPersonPricingSchema = z.object({
  pricePerPerson: moneyAmount,
  persons: z.number().int().min(1).max(100),
}).strict()
export function receiptTotalForPersons(pricePerPerson: number, persons: number) {
  const pricing = perPersonPricingSchema.parse({ pricePerPerson, persons })
  return Math.round(pricing.pricePerPerson * 100) * pricing.persons / 100
}
const receiptText = z.string().trim().min(1).max(80).regex(/^[\x20-\x7e]+$/, 'Use English letters so the receipt displays correctly.')
export const paymentReceiptSchema = z.object({
  guestName: receiptText.max(60),
  guestPhone: z.string().trim().min(1, 'Enter the guest phone number.').max(25).regex(/^\+?[\d ()-]+$/, 'Enter a valid guest phone number.').refine(value => {
    const digits = value.replace(/\D/g, '')
    return digits.length >= 7 && digits.length <= 15
  }, 'Enter a phone number with 7 to 15 digits.'),
  title: receiptText,
  receiptNumber: receiptText,
  receiptDate: z.iso.date(),
  total: moneyAmount,
  received: moneyAmount,
  perPersonPricing: perPersonPricingSchema.optional(),
  paymentMethod: z.enum(['Bank transfer', 'UPI', 'Cash', 'Card', 'Other']),
  transactionReference: z.string().trim().max(100).regex(/^[\x20-\x7e]*$/, 'Use English letters for the transaction reference.'),
  screenshot: z.string().max(8 * 1024 * 1024).regex(/^data:image\/jpeg;base64,[a-zA-Z0-9+/]+=*$/).optional(),
}).strict().refine(data => data.received <= data.total, { path: ['received'], message: 'Received payment cannot exceed the total payment.' })
  .refine(data => !data.perPersonPricing || data.total === receiptTotalForPersons(data.perPersonPricing.pricePerPerson, data.perPersonPricing.persons), { path: ['total'], message: 'Total payment must match the per-person price multiplied by the number of persons.' })
export type PaymentReceipt = z.infer<typeof paymentReceiptSchema>
export const receiptBalance = (total: number, received: number) => (Math.round(total * 100) - Math.round(received * 100)) / 100
export const paymentReceiptFilename = (receiptNumber: string) => `${receiptNumber.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80)}.pdf`

export async function buildPaymentReceiptPdf(input: PaymentReceipt) {
  const data = paymentReceiptSchema.parse(input)
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const money = (value: number) => `INR ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  pdf.setProperties({ title: `${business.name} payment receipt ${data.receiptNumber}`, author: business.name, subject: 'Owner-entered payment record; not a booking confirmation' })
  pdf.setFillColor(249, 248, 243); pdf.rect(0, 0, 210, 297, 'F')
  pdf.setFillColor(16, 49, 43); pdf.rect(0, 0, 210, 43, 'F')
  pdf.setFillColor(176, 128, 69); pdf.rect(0, 43, 210, 1.2, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(27)
  pdf.text(business.name, 16, 17)
  pdf.setFont('times', 'normal'); pdf.setFontSize(21)
  pdf.text('PAYMENT RECEIPT', 194, 18, { align: 'right' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.text(`${business.email} | ${business.phone}`, 16, 31)
  pdf.text('YOUR JOURNEY. CLEARLY ACCOUNTED FOR.', 194, 31, { align: 'right' })
  function fittedText(value: string, x: number, y: number, width: number, maxLines: number, size = 10) {
    let fontSize = size
    pdf.setFontSize(fontSize)
    let lines: string[] = pdf.splitTextToSize(value, width)
    while (lines.length > maxLines && fontSize > 6) {
      fontSize -= 0.25; pdf.setFontSize(fontSize)
      lines = pdf.splitTextToSize(value, width)
    }
    if (lines.length > maxLines) throw new Error('Receipt text is too long to fit on page one. Shorten the guest, package or reference details.')
    pdf.text(lines, x, y, { lineHeightFactor: 1.15 })
  }
  pdf.setTextColor(40, 54, 49); pdf.setFont('helvetica', 'bold')
  fittedText(data.receiptNumber, 16, 54, 128, 1, 11)
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10)
  pdf.text(data.receiptDate, 194, 54, { align: 'right' })
  pdf.setDrawColor(218, 221, 214); pdf.line(16, 60, 194, 60)
  pdf.setFillColor(255, 255, 255); pdf.roundedRect(12, 66, 113, 122, 3, 3, 'F')
  const details = [
    ['GUEST NAME', data.guestName],
    ['PHONE NUMBER', data.guestPhone],
    ['TRIP / PACKAGE', data.title],
    ['PRICE BASIS', data.perPersonPricing ? `${money(data.perPersonPricing.pricePerPerson)} per person x ${data.perPersonPricing.persons} persons` : 'Agreed total payment'],
    ['PAYMENT METHOD', data.paymentMethod],
    ['TRANSACTION REFERENCE', data.transactionReference || 'Not provided'],
  ]
  details.forEach(([label, value], index) => {
    const y = 74 + index * 20
    pdf.setTextColor(99, 112, 105); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5)
    pdf.text(label, 16, y)
    pdf.setTextColor(40, 54, 49)
    pdf.setFont('helvetica', 'bold')
    fittedText(value, 16, y + 6, 106, 2, 10)
    if (index < details.length - 1) { pdf.setDrawColor(238, 237, 231); pdf.line(16, y + 16, 120, y + 16) }
  })
  pdf.setFillColor(234, 241, 234); pdf.roundedRect(132, 68, 62, 119, 3, 3, 'F')
  pdf.setFillColor(24, 73, 61); pdf.roundedRect(132, 68, 62, 28, 3, 3, 'F')
  pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8)
  pdf.text('AMOUNT RECEIVED', 136, 77)
  pdf.setFont('helvetica', 'bold'); fittedText(money(data.received), 136, 88, 54, 1, 16)
  pdf.setTextColor(24, 73, 61); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9)
  if (data.screenshot) {
    pdf.text('Payment screenshot', 136, 105)
    const image = pdf.getImageProperties(data.screenshot)
    const scale = Math.min(54 / image.width, 66 / image.height)
    const width = image.width * scale; const height = image.height * scale
    pdf.addImage(data.screenshot, 'JPEG', 136 + (54 - width) / 2, 110 + (66 - height) / 2, width, height)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5)
    pdf.text('Owner-provided payment evidence', 136, 181)
  } else {
    pdf.text('Prepared by AVELOF', 136, 107)
    pdf.setFont('helvetica', 'normal')
    fittedText('Clear payment details for your journey.', 136, 121, 54, 3, 11)
    fittedText('No payment screenshot attached.', 136, 148, 54, 3, 9)
  }
  const pending = receiptBalance(data.total, data.received)
  const summaries: { label: string; amount: number; color: [number, number, number]; background: [number, number, number] }[] = [
    { label: 'Total payment', amount: data.total, color: [38, 73, 133], background: [234, 240, 250] },
    { label: 'Payment received', amount: data.received, color: [24, 100, 65], background: [232, 246, 237] },
    { label: 'Pending payment', amount: pending, color: [159, 66, 24], background: [255, 239, 222] },
  ]
  summaries.forEach((summary, index) => {
    const x = 16 + index * 61
    pdf.setFillColor(...summary.background)
    pdf.roundedRect(x, 198, 57, 29, 3, 3, 'F')
    pdf.setFillColor(...summary.color); pdf.roundedRect(x, 198, 57, 1.5, 0.5, 0.5, 'F')
    pdf.setTextColor(...summary.color)
    pdf.setFontSize(9); pdf.setFont('helvetica', 'normal')
    pdf.text(summary.label, x + 4, 207)
    pdf.setFont('helvetica', 'bold')
    const amount = money(summary.amount)
    fittedText(amount, x + 4, 220, 49, 1, 13)
  })
  pdf.setTextColor(24, 73, 61); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10)
  pdf.setDrawColor(218, 221, 214); pdf.line(16, 234, 194, 234)
  pdf.text(`Payment status: ${data.received === 0 ? 'No payment recorded' : pending === 0 ? 'Paid in full' : 'Partially paid'}`, 16, 241)
  pdf.setTextColor(99, 112, 105); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9)
  pdf.text(`Issued by ${business.name}`, 194, 241, { align: 'right' })
  pdf.setFontSize(8)
  pdf.text(pdf.splitTextToSize('Prepared from payment amounts entered by AVELOF. This document is not a booking confirmation or a tax invoice. Payment entries and screenshots are not independently verified by the website.', 178), 16, 257)
  pdf.setDrawColor(176, 128, 69); pdf.line(16, 275, 194, 275)
  pdf.setTextColor(24, 73, 61); pdf.text(`${business.website} | ${business.phone}`, 16, 282)
  pdf.text('AVELOF / PAYMENT RECEIPT / 01', 194, 282, { align: 'right' })
  return pdf
}
