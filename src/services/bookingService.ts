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

export function enquiryWhatsAppUrl(selectedItem?: string) {
  const interest = selectedItem ? `about ${selectedItem}` : 'about planning a trip to Kashmir'
  return createWhatsAppUrl(`Hello AVELOF, I’d like to enquire ${interest}. Please share more details.`)
}

export function prepareRequest(payload: BookingPayload): PreparedRequest {
  const reference = `AV-${new Date().toISOString().slice(2, 10).replaceAll('-', '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
  const subject = `${requestTitles[payload.kind]} | ${reference}`
  const fields = Object.entries(payload.fields)
    .filter(([, value]) => value.trim())
    .map(([label, value]) => `${label.replaceAll(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())}: ${value}`)
  const message = [`Hello AVELOF,`, ``, `${requestTitles[payload.kind]}`, `Reference: ${reference}`, ``, ...fields, ``, `Please contact me to discuss availability and the next steps.`].join('\n')

  return {
    reference,
    subject,
    message,
    whatsappUrl: createWhatsAppUrl(message),
  }
}