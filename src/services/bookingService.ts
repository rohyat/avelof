import { business } from '../config'
import type { BookingPayload, PreparedRequest } from '../types'

const requestTitles = {
  package: 'Tour Package Booking Request',
  car: 'Car Rental Booking Request',
  hotel: 'Hotel Reservation Request',
  contact: 'Website Enquiry',
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
    emailUrl: `mailto:${business.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`,
  }
}