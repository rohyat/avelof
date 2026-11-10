import { z } from 'zod'
import type { BookingStatus, BookingSummary, EnquirySummary } from '../types'

const bookingStatus = z.enum(['received', 'booked', 'running', 'completed'])
const enquiry = z.object({
  reference: z.string(), kind: z.enum(['package', 'hotel', 'car', 'contact']),
  status: bookingStatus, statusVersion: z.number().int().min(0), statusUpdatedAt: z.string().nullable(), createdAt: z.string(),
  fields: z.record(z.string(), z.string()),
})
const bookingDetails = z.object({
  type: z.string(), name: z.string(), startLabel: z.string(), endLabel: z.string(),
  startDate: z.iso.date().nullable(), endDate: z.iso.date().nullable(),
})
const booking = z.object({ reference: z.string(), kind: z.enum(['package', 'hotel', 'car', 'contact']), status: bookingStatus, maskedName: z.string(), maskedPhone: z.string(), bookingDetails })
const listing = z.object({ enquiries: z.array(enquiry), total: z.number().int().min(0), page: z.number().int().min(1), pageSize: z.literal(25) })

export class EnquiryAccessError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function requestAccess(query = '', body?: Record<string, string | number>, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(`/api/enquiry-access${query}`, {
    method: body ? 'POST' : 'GET', cache: 'no-store', credentials: 'same-origin',
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
  })
  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'Could not load enquiries. Please try again.'
    throw new EnquiryAccessError(message, response.status)
  }
  return data
}

export async function signInAdmin(username: string, code: string) {
  z.object({ signedIn: z.literal(true) }).parse(await requestAccess('', { action: 'admin-login', username, code }))
}

export async function signOutAdmin() {
  z.object({ signedOut: z.literal(true) }).parse(await requestAccess('', { action: 'logout' }))
}

export async function loadAdminEnquiries(filters: { page: number; status: string; reference: string }, signal?: AbortSignal) {
  return listing.parse(await requestAccess(`?${new URLSearchParams({ ...filters, page: String(filters.page) })}`, undefined, signal))
}

export async function lookupBookingSummaries(identifier: string, signal?: AbortSignal): Promise<BookingSummary[]> {
  return z.object({ bookings: z.array(booking) }).parse(await requestAccess('', { action: 'booking-search', identifier }, signal)).bookings
}

export async function updateBookingStatus(reference: string, status: BookingStatus, version: number): Promise<EnquirySummary> {
  return z.object({ enquiry }).parse(await requestAccess('', { action: 'admin-status', reference, status, version })).enquiry
}