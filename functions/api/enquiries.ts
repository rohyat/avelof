import { enquirySchema } from '../../src/services/enquirySchema.ts'
import { accessConfigured, customerAccessCode, hashText } from '../_lib/enquiryAccess.ts'
import { queueOwnerPush } from '../_lib/pushNotifications.ts'
import type { AccessEnv } from '../_lib/enquiryAccess.ts'

type Env = AccessEnv

const maxBodyBytes = 65536
const responseHeaders = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
}

function reply(body: Record<string, unknown>, status: number, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { ...responseHeaders, ...headers } })
}

async function readBody(request: Request) {
  const reader = request.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBodyBytes) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}

async function digest(value: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function savedReply(database: D1Database, reference: string, payloadHash: string, prefix: string, status: number, env: Env, waitUntil?: (promise: Promise<unknown>) => void, notify = false) {
  await database.prepare('INSERT INTO enquiry_reference_numbers (request_reference) SELECT ? WHERE NOT EXISTS (SELECT 1 FROM enquiry_reference_numbers WHERE request_reference = ?)')
    .bind(reference, reference).run()
  await database.prepare("UPDATE enquiries SET public_reference = 'AVELOF_' || ? || '_' || (SELECT number + 10000 FROM enquiry_reference_numbers WHERE request_reference = ?) WHERE reference = ? AND public_reference IS NULL")
    .bind(prefix, reference, reference).run()
  const saved = await database.prepare('SELECT payload_hash, public_reference FROM enquiries WHERE reference = ?').bind(reference).first<{ payload_hash: string; public_reference: string }>()
  if (saved?.payload_hash !== payloadHash || !saved.public_reference) return reply({ error: 'Enquiry could not be saved with this reference.' }, 409)
  let accessCode: string | undefined
  if (accessConfigured(env)) {
    const candidate = await customerAccessCode(env.ENQUIRY_ACCESS_SECRET!, reference)
    const accessHash = await hashText(candidate)
    await database.prepare('UPDATE enquiries SET access_code_hash = ? WHERE reference = ? AND access_code_hash IS NULL').bind(accessHash, reference).run()
    const access = await database.prepare('SELECT access_code_hash FROM enquiries WHERE reference = ?').bind(reference).first<{ access_code_hash: string }>()
    if (access?.access_code_hash === accessHash) accessCode = candidate
  }
  if (notify && waitUntil) queueOwnerPush(env, waitUntil, {
    title: 'New booking enquiry',
    body: `1 new booking · ${saved.public_reference}`,
    url: '/admin/panel',
    tag: `booking-${saved.public_reference}`,
  })
  return reply({ saved: true, reference: saved.public_reference, requestReference: reference, ...(accessCode ? { accessCode } : {}) }, status)
}

export const onRequest: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  if (request.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405, { Allow: 'POST' })
  if (request.headers.get('Origin') !== new URL(request.url).origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
    return reply({ error: 'Origin not allowed.' }, 403)
  }
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return reply({ error: 'JSON required.' }, 415)
  }
  if (Number(request.headers.get('Content-Length')) > maxBodyBytes) return reply({ error: 'Enquiry too large.' }, 413)
  try {
    const body = await readBody(request)
    if (body === null) return reply({ error: 'Enquiry too large.' }, 413)
    let input: unknown
    try {
      input = JSON.parse(body)
    } catch {
      return reply({ error: 'Invalid JSON.' }, 400)
    }
    const parsed = enquirySchema.safeParse(input)
    if (!parsed.success || parsed.data.website) return reply({ error: 'Invalid enquiry details.' }, 400)
    if (!env.DB) return reply({ error: 'Enquiry storage is unavailable.' }, 503)
    const { reference, kind, fields } = parsed.data
    const fieldsJson = JSON.stringify(Object.fromEntries(Object.entries(fields).sort(([first], [second]) => first.localeCompare(second))))
    const payloadHash = await digest(`${kind}\n${fieldsJson}`)
    const prefix = kind === 'hotel' ? 'HTL' : kind === 'car' ? 'CAB' : kind === 'contact' ? 'INQ' : fields.packagePreference === 'Deluxe' ? 'DLX' : fields.packagePreference === 'Premium' ? 'PRM' : 'CSTM'
    const existing = await env.DB.prepare('SELECT payload_hash FROM enquiries WHERE reference = ?').bind(reference).first<{ payload_hash: string }>()
    if (existing) {
      return existing.payload_hash === payloadHash
        ? await savedReply(env.DB, reference, payloadHash, prefix, 200, env)
        : reply({ error: 'Reference already used. Please start a new enquiry.' }, 409)
    }
    const bucket = Math.floor(Date.now() / 600000)
    const clientHash = await digest(`${bucket}:${request.headers.get('CF-Connecting-IP') ?? 'local'}`)
    await env.DB.prepare('DELETE FROM enquiry_rate_limits WHERE bucket < ?').bind(bucket - 1).run()
    const attempts = await env.DB.prepare('INSERT INTO enquiry_rate_limits (bucket, client_hash, attempts) VALUES (?, ?, 1) ON CONFLICT (bucket, client_hash) DO UPDATE SET attempts = attempts + 1 RETURNING attempts').bind(bucket, clientHash).first<{ attempts: number }>()
    if (!attempts || attempts.attempts > 5) return reply({ error: 'Too many enquiries.' }, 429, { 'Retry-After': '600' })
    const details = fields.customDetails ?? ''
    const inserted = await env.DB.prepare('INSERT INTO enquiries (reference, kind, full_name, phone_number, adults, children, details, fields_json, payload_hash, phone_lookup) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (reference) DO NOTHING')
      .bind(reference, kind, fields.fullName, fields.phoneNumber, Number(fields.adults), Number(fields.children), details, fieldsJson, payloadHash, fields.phoneNumber.replace(/\D/g, '')).run()
    const saved = await env.DB.prepare('SELECT payload_hash FROM enquiries WHERE reference = ?').bind(reference).first<{ payload_hash: string }>()
    if (saved?.payload_hash !== payloadHash) return reply({ error: 'Enquiry could not be saved with this reference.' }, 409)
    return await savedReply(env.DB, reference, payloadHash, prefix, 201, env, waitUntil, Number(inserted.meta?.changes ?? 0) > 0)
  } catch {
    return reply({ error: 'Enquiry storage is temporarily unavailable.' }, 503)
  }
}