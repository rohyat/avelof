import { business } from '../config'
import type { BookingPayload, PreparedRequest } from '../types'

const requestTitles = {
  package: 'Tour Package Enquiry',
  car: 'Car Rental Enquiry',
  hotel: 'Hotel Enquiry',
  contact: 'Website Enquiry',
}

export function createWhatsAppUrl(message: string) {
  const phone = business.phone.replace(/\D/g, '')
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}

export function formatEnquiryDetails(fields: Record<string, string>) {
  return Object.entries(fields)
    .filter(([, value]) => value.trim())
    .map(([label, value]) => `${label.replaceAll(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())}: ${value}`)
    .join('\n')
}

export function prepareRequest(payload: BookingPayload, reference = `AV-${crypto.randomUUID().toUpperCase()}`): PreparedRequest {
  const subject = `${requestTitles[payload.kind]} | ${reference}`
  const message = [`Hello AVELOF,`, ``, `${requestTitles[payload.kind]}`, `Reference: ${reference}`, ``, formatEnquiryDetails(payload.fields), ``, `Please contact me to discuss availability and the next steps.`].join('\n')

  return {
    reference,
    subject,
    message,
    whatsappUrl: createWhatsAppUrl(message),
  }
}

export async function saveEnquiry(payload: BookingPayload, request: PreparedRequest, website = ''): Promise<PreparedRequest> {
  const response = await fetch('/api/enquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, reference: request.reference, website }),
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) {
    if (response.status === 429) throw new Error('Too many enquiries. Please try again later or contact us on WhatsApp.')
    if (response.status === 400 || response.status === 413) throw new Error('Please check your enquiry details and try again.')
    throw new Error('Your enquiry could not be saved. Please try again or contact us on WhatsApp.')
  }
  const result: unknown = await response.json()
  if (!result || typeof result !== 'object' || !('reference' in result) || typeof result.reference !== 'string' || !/^AVELOF_(DLX|PRM|CSTM|HTL|CAB|INQ)_[1-9]\d{4,}$/.test(result.reference) || !('requestReference' in result) || result.requestReference !== request.reference || !('saved' in result) || result.saved !== true) {
    throw new Error('We could not confirm your enquiry was saved. Please try again.')
  }
  return prepareRequest(payload, result.reference)
}

export function enquiryPath(request: PreparedRequest) {
  return `/my-enquiries#${new URLSearchParams({ reference: request.reference }).toString()}`
}