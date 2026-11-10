import { z } from 'zod'
import { accessConfigured, adminCookie, allowAccessAttempt, correctAdminUsername, createAdminSession, equalHashes, hashText, isAdmin, phoneCandidates, privateReply, sameOrigin, validAdminHash, verifyAdminPassword } from '../_lib/enquiryAccess.ts'
import type { AccessEnv } from '../_lib/enquiryAccess.ts'
import { indianPhoneNumber } from '../../src/services/phoneNumbers.ts'
import { requestedBooking } from '../../src/services/bookingDetails.ts'
import { hotels, rentalCars, tourPackages } from '../../src/data/catalog.ts'
import type { BookingKind } from '../../src/types.ts'

const referencePattern = /^AVELOF_(DLX|PRM|CSTM|HTL|CAB|INQ)_[1-9]\d{4,}$/
const bookingStatus = z.enum(['received', 'booked', 'running', 'completed'])
const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('booking-summary'), reference: z.string().regex(referencePattern) }).strict(),
  z.object({ action: z.literal('booking-search'), identifier: z.string().trim().min(7).max(40) }).strict(),
  z.object({ action: z.literal('lookup'), reference: z.string().regex(referencePattern), accessCode: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  z.object({ action: z.literal('admin-login'), username: z.string().trim().min(7).max(25), code: z.string().min(1).max(256) }).strict(),
  z.object({ action: z.literal('admin-status'), reference: z.string().regex(referencePattern), status: bookingStatus, version: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) }).strict(),
  z.object({ action: z.literal('logout') }).strict(),
])
const listSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  status: z.union([z.literal(''), bookingStatus]).default(''),
  reference: z.string().max(40).regex(/^[A-Z0-9_]*$/).default(''),
}).strict()

interface EnquiryRow {
  public_reference: string
  kind: BookingKind
  booking_status: 'received' | 'booked' | 'running' | 'completed'
  booking_status_version: number
  booking_status_updated_at: string | null
  created_at: string
  fields_json: string
  access_code_hash?: string | null
}

const enquiryColumns = 'public_reference, kind, booking_status, booking_status_version, booking_status_updated_at, created_at, fields_json'

function maskedName(value: string) {
  return value.trim().split(/\s+/).map((part, partIndex) => {
    const letters = Array.from(part)
    if (letters.length <= 2) return `${letters[0] ?? '*'}*`
    const secondVisible = partIndex === 0 ? letters.length - 2 : letters.length - 1
    return letters.map((letter, index) => index === 0 || index === secondVisible ? letter : '*').join('')
  }).join(' ')
}

function maskedPhone(value: string) {
  const digits = indianPhoneNumber(value) || value.replace(/\D/g, '')
  return digits.length > 3 ? `${digits[0]}${'*'.repeat(digits.length - 3)}${digits.slice(-2)}` : '***'
}

function summary(row: EnquiryRow, maskContacts = false) {
  const fields: Record<string, string> = Object.fromEntries(Object.entries(JSON.parse(row.fields_json) as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
  if (maskContacts) {
    fields.fullName = maskedName(fields.fullName ?? '')
    fields.phoneNumber = maskedPhone(fields.phoneNumber ?? '')
  }
  return { reference: row.public_reference, kind: row.kind, status: row.booking_status, statusVersion: row.booking_status_version, statusUpdatedAt: row.booking_status_updated_at, createdAt: row.created_at, fields }
}

function publicSummary(row: EnquiryRow) {
  const fields: unknown = JSON.parse(row.fields_json)
  const source = fields && typeof fields === 'object' ? fields as Record<string, unknown> : {}
  const selected: Record<string, string> = {}
  if (typeof source.preferredStay === 'string' && hotels.some((hotel) => hotel.name === source.preferredStay)) selected.preferredStay = source.preferredStay
  if (typeof source.carRental === 'string' && rentalCars.some((car) => car.name === source.carRental)) selected.carRental = source.carRental
  if (typeof source.packagePreference === 'string' && (tourPackages.some((item) => item.name === source.packagePreference) || ['Custom package', 'Stay or car only'].includes(source.packagePreference))) selected.packagePreference = source.packagePreference
  if (row.kind === 'package' && (source.packagePreference === 'Custom package' || typeof source.placesToVisit === 'string' && source.placesToVisit.trim())) selected.packagePreference = 'Custom package'
  for (const key of ['checkInDate', 'checkOutDate', 'startDate', 'endDate', 'arrivalDate', 'departureDate']) {
    const value = z.iso.date().safeParse(source[key])
    if (value.success) selected[key] = value.data
  }
  return {
    reference: row.public_reference,
    kind: row.kind,
    status: row.booking_status,
    maskedName: maskedName(typeof source.fullName === 'string' ? source.fullName : ''),
    maskedPhone: maskedPhone(typeof source.phoneNumber === 'string' ? source.phoneNumber : ''),
    bookingDetails: requestedBooking(row.kind, selected),
  }
}

async function readBody(request: Request) {
  const reader = request.body?.getReader()
  if (!reader) return ''
  const decoder = new TextDecoder()
  let text = ''
  let bytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) return text + decoder.decode()
    bytes += value.byteLength
    if (bytes > 8192) {
      await reader.cancel()
      return null
    }
    text += decoder.decode(value, { stream: true })
  }
}

export const onRequest: PagesFunction<AccessEnv> = async ({ request, env }) => {
  const url = new URL(request.url)
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') return privateReply({ error: 'HTTPS required.' }, 403)
  if (!['GET', 'POST'].includes(request.method)) return privateReply({ error: 'Method not allowed.' }, 405, { Allow: 'GET, POST' })
  if (request.headers.get('Sec-Fetch-Site') === 'cross-site' || (request.method === 'POST' && !sameOrigin(request))) return privateReply({ error: 'Origin not allowed.' }, 403)
  if (!env.DB || !accessConfigured(env)) return privateReply({ error: 'Enquiry access is not available. Please contact AVELOF.' }, 503)
  try {
    if (request.method === 'GET') {
      if (!await isAdmin(request, env)) return privateReply({ error: 'Please sign in.' }, 401)
      const parsed = listSchema.safeParse(Object.fromEntries(url.searchParams))
      if (!parsed.success) return privateReply({ error: 'Invalid enquiry filter.' }, 400)
      const { page, status, reference } = parsed.data
      const where = "WHERE (? = '' OR booking_status = ?) AND (? = '' OR public_reference = ?)"
      const total = await env.DB.prepare(`SELECT count(*) AS total FROM enquiries ${where}`).bind(status, status, reference, reference).first<{ total: number }>()
      const result = await env.DB.prepare(`SELECT ${enquiryColumns} FROM enquiries ${where} ORDER BY created_at DESC, public_reference DESC LIMIT 25 OFFSET ?`).bind(status, status, reference, reference, (page - 1) * 25).all<EnquiryRow>()
      return privateReply({ enquiries: result.results.map((row) => summary(row)), total: total?.total ?? 0, page, pageSize: 25 })
    }
    if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return privateReply({ error: 'JSON required.' }, 415)
    if (Number(request.headers.get('Content-Length')) > 8192) return privateReply({ error: 'Request too large.' }, 413)
    const body = await readBody(request)
    if (body === null) return privateReply({ error: 'Request too large.' }, 413)
    let input: unknown
    try { input = JSON.parse(body) } catch { return privateReply({ error: 'Invalid request.' }, 400) }
    const parsed = actionSchema.safeParse(input)
    if (!parsed.success) return privateReply({ error: 'Check the submitted details and try again.' }, 400)
    const action = parsed.data
    if (action.action === 'logout') return privateReply({ signedOut: true }, 200, { 'Set-Cookie': adminCookie(request, '', true) })
    if (action.action === 'admin-status') {
      if (!await isAdmin(request, env)) return privateReply({ error: 'Please sign in.' }, 401)
      const updated = await env.DB.prepare(`UPDATE enquiries SET booking_status = ?, booking_status_version = booking_status_version + 1, booking_status_updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE public_reference = ? AND booking_status_version = ? RETURNING ${enquiryColumns}`)
        .bind(action.status, action.reference, action.version).first<EnquiryRow>()
      if (!updated) return privateReply({ error: 'This enquiry changed or is no longer available. Refresh before updating it.' }, 409)
      return privateReply({ enquiry: summary(updated) })
    }
    const scope = action.action === 'booking-search' ? referencePattern.test(action.identifier.toUpperCase()) ? 'booking-summary' : 'phone-summary' : action.action
    if (!await allowAccessAttempt(request, env.DB, scope, scope === 'booking-summary' ? 60 : 10)) return privateReply({ error: 'Too many attempts. Please try again in ten minutes.' }, 429, { 'Retry-After': '600' })
    if (action.action === 'admin-login') {
      if (!validAdminHash(env.ENQUIRY_ADMIN_CODE_HASH ?? '')) return privateReply({ error: 'Admin sign-in is unavailable.' }, 503)
      const passwordMatches = await verifyAdminPassword(action.code, env.ENQUIRY_ADMIN_CODE_HASH!)
      if (!correctAdminUsername(action.username) || !passwordMatches) return privateReply({ error: 'Invalid admin credentials.' }, 401)
      return privateReply({ signedIn: true }, 200, { 'Set-Cookie': adminCookie(request, await createAdminSession(env)) })
    }
    if (action.action === 'booking-search') {
      const reference = action.identifier.toUpperCase()
      if (referencePattern.test(reference)) {
        const row = await env.DB.prepare(`SELECT ${enquiryColumns} FROM enquiries WHERE public_reference = ?`).bind(reference).first<EnquiryRow>()
        if (!row) return privateReply({ error: 'No matching booking requests.' }, 404)
        return privateReply({ bookings: [publicSummary(row)] })
      }
      const candidates = phoneCandidates(action.identifier)
      if (!candidates.length) return privateReply({ error: 'Enter a valid booking ID or phone number.' }, 400)
      const result = await env.DB.prepare(`SELECT ${enquiryColumns} FROM enquiries WHERE phone_lookup IN (?, ?) ORDER BY created_at DESC, public_reference DESC LIMIT 25`).bind(candidates[0], candidates[1]).all<EnquiryRow>()
      if (!result.results.length) return privateReply({ error: 'No matching booking requests.' }, 404)
      return privateReply({ bookings: result.results.map(publicSummary) })
    }
    const row = await env.DB.prepare(`SELECT ${enquiryColumns}, access_code_hash FROM enquiries WHERE public_reference = ?`).bind(action.reference).first<EnquiryRow>()
    if (action.action === 'booking-summary') {
      if (!row) return privateReply({ error: 'No matching enquiry. Check your booking ID.' }, 404)
      return privateReply({ booking: publicSummary(row) })
    }
    const suppliedHash = await hashText(action.accessCode)
    if (!row?.access_code_hash || !equalHashes(suppliedHash, row.access_code_hash)) return privateReply({ error: 'No matching enquiry. Check the ID and private code.' }, 404)
    return privateReply({ enquiry: summary(row, true) })
  } catch {
    return privateReply({ error: 'Enquiries are temporarily unavailable. Please try again.' }, 503)
  }
}