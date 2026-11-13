import { readFileSync, readdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import assert from 'node:assert/strict'
import { pbkdf2Sync } from 'node:crypto'
import { createECDH, randomBytes } from 'node:crypto'
import { business } from '../../src/config.ts'
import { test } from 'node:test'
import { onRequest } from './enquiries.ts'
import { onRequest as onAccessRequest } from './enquiry-access.ts'
import { onRequest as onReviewRequest } from './reviews.ts'
import { onRequest as onPushRequest } from './push.ts'
import { queueOwnerPush } from '../_lib/pushNotifications.ts'
import { adminCookie, correctAdminUsername, createAdminSession, customerAccessCode, hashText, isAdmin, phoneCandidates, verifyAdminPassword } from '../_lib/enquiryAccess.ts'
import { indianPhoneNumber } from '../../src/services/phoneNumbers.ts'
import { requestedBooking } from '../../src/services/bookingDetails.ts'
import { buildOwnerReviewImport } from '../../scripts/import-owner-reviews.mjs'
import { ownerGuestReviewMonths, ownerProvidedGuestReviews } from '../../src/data/catalog.ts'

function database() {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  const migrations = new URL('../../migrations/', import.meta.url)
  for (const migration of readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(new URL(migration, migrations), 'utf8'))
  }
  return {
    sqlite,
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() { return sqlite.prepare(sql).get(...values) ?? null },
            async run() { const result = sqlite.prepare(sql).run(...values); return { meta: { changes: Number(result.changes) } } },
            async all() { return { results: sqlite.prepare(sql).all(...values) } },
          }
        },
      }
    },
  }
}

function payload(kind = 'package') {
  return {
    reference: `AV-${crypto.randomUUID().toUpperCase()}`,
    kind,
    fields: {
      fullName: 'Test Guest', phoneNumber: '+91 9876543210', adults: '2', children: '0',
      ...(kind === 'hotel' ? { preferredStay: 'Test Hotel', checkInDate: '2027-01-10', checkOutDate: '2027-01-12' }
        : kind === 'car' ? { carRental: 'Test Cab', startDate: '2027-01-10', endDate: '2027-01-10' }
          : { packagePreference: 'Custom package', ...(kind === 'package' ? { arrivalDate: '2027-01-10', departureDate: '2027-01-12' } : {}) }),
    },
  }
}

async function send(DB, body, options = {}) {
  const request = new Request('https://avelof.test/api/enquiries', {
    method: 'POST', headers: { Origin: 'https://avelof.test', 'Content-Type': 'application/json', ...options.headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  return onRequest({ request, env: { DB, ENQUIRY_ACCESS_SECRET: 'test-secret-with-more-than-thirty-two-characters', ...options.env }, ...(options.waitUntil ? { waitUntil: options.waitUntil } : {}) })
}

test('all enquiry types save with unique references and preserve custom itinerary text', async () => {
  const DB = database()
  try {
    for (const kind of ['hotel', 'car', 'package', 'contact']) {
      const body = payload(kind)
      body.fields.customDetails = 'Day 1: Srinagar\nDay 2: Gulmarg; vegetarian meals'
      const response = await send(DB, body)
      assert.equal(response.status, 201)
      const saved = await response.json()
      assert.equal(saved.saved, true)
      assert.equal(saved.requestReference, body.reference)
      assert.match(saved.reference, /^AVELOF_(HTL|CAB|CSTM|INQ)_1000[1-4]$/)
      const row = DB.sqlite.prepare('SELECT * FROM enquiries WHERE reference = ?').get(body.reference)
      assert.equal(row.public_reference, saved.reference)
      assert.equal(row.details, body.fields.customDetails)
      assert.deepEqual(JSON.parse(row.fields_json), body.fields)
      assert.equal(row.status, 'new')
    }
  } finally { DB.sqlite.close() }
})

test('retry is idempotent; reusing a reference with changed data is rejected', async () => {
  const DB = database()
  try {
    const body = payload()
    const first = await send(DB, body)
    assert.equal(first.status, 201)
    const receipt = await first.json()
    const retry = await send(DB, body)
    assert.equal(retry.status, 200)
    assert.deepEqual(await retry.json(), receipt)
    assert.equal(DB.sqlite.prepare('SELECT count(*) AS total FROM enquiries').get().total, 1)
    body.fields.fullName = 'Different Guest'
    assert.equal((await send(DB, body)).status, 409)
  } finally { DB.sqlite.close() }
})

test('invalid inputs never insert an enquiry', async () => {
  const DB = database()
  try {
    const changes = [
      { adults: '0' }, { children: '101' }, { fullName: '' }, { phoneNumber: '-------' },
      { phoneNumber: '987654321' }, { phoneNumber: '+449876543210' },
      { departureDate: '2027-01-09' }, { arrivalDate: '2027-02-30' },
      { customDetails: 'x'.repeat(20001) }, { unexpectedField: 'not allowed' },
    ]
    for (const change of changes) {
      const body = payload()
      Object.assign(body.fields, change)
      assert.equal((await send(DB, body)).status, 400)
    }
    assert.equal((await send(DB, { ...payload(), website: 'spam' })).status, 400)
    assert.equal((await send(DB, '{')).status, 400)
    assert.equal(DB.sqlite.prepare('SELECT count(*) AS total FROM enquiries').get().total, 0)
  } finally { DB.sqlite.close() }
})

test('endpoint enforces origin, content type, size, method, and missing storage', async () => {
  assert.equal((await send(undefined, payload(), { headers: { Origin: 'https://other.test' } })).status, 403)
  assert.equal((await send(undefined, payload(), { headers: { 'Content-Type': 'text/plain' } })).status, 415)
  assert.equal((await send(undefined, 'x'.repeat(65537))).status, 413)
  assert.equal((await send(undefined, payload())).status, 503)
  const response = await onRequest({ request: new Request('https://avelof.test/api/enquiries'), env: {} })
  assert.equal(response.status, 405)
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
})

test('rate limiting blocks the sixth new enquiry, but allows a safe retry', async () => {
  const DB = database()
  try {
    const first = payload()
    assert.equal((await send(DB, first)).status, 201)
    for (let attempt = 1; attempt < 5; attempt++) assert.equal((await send(DB, payload())).status, 201)
    const blocked = await send(DB, payload())
    assert.equal(blocked.status, 429)
    assert.equal(blocked.headers.get('Retry-After'), '600')
    assert.equal((await send(DB, first)).status, 200)
    assert.equal(DB.sqlite.prepare('SELECT count(*) AS total FROM enquiries').get().total, 5)
  } finally { DB.sqlite.close() }
})

test('storage failures never return a saved confirmation', async () => {
  const DB = { prepare() { throw new Error('Database offline') } }
  const response = await send(DB, payload())
  assert.equal(response.status, 503)
  assert.equal((await response.json()).saved, undefined)
})

test('Deluxe, Premium and custom references share a sequence without consuming numbers on retry', async () => {
  const DB = database()
  try {
    const deluxe = payload()
    deluxe.fields.packagePreference = 'Deluxe'
    assert.equal((await (await send(DB, deluxe)).json()).reference, 'AVELOF_DLX_10001')
    assert.equal((await (await send(DB, deluxe)).json()).reference, 'AVELOF_DLX_10001')
    const premium = payload()
    premium.fields.packagePreference = 'Premium'
    assert.equal((await (await send(DB, premium)).json()).reference, 'AVELOF_PRM_10002')
    assert.equal((await (await send(DB, payload())).json()).reference, 'AVELOF_CSTM_10003')
  } finally { DB.sqlite.close() }
})

test('short reference migration preserves existing enquiries and assigns their IDs in order', () => {
  const sqlite = new DatabaseSync(':memory:')
  try {
    sqlite.exec(readFileSync(new URL('../../migrations/0001_enquiries.sql', import.meta.url), 'utf8'))
    const body = payload()
    body.fields.packagePreference = 'Deluxe'
    sqlite.prepare('INSERT INTO enquiries (reference, kind, full_name, phone_number, adults, children, details, fields_json, payload_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(body.reference, body.kind, body.fields.fullName, body.fields.phoneNumber, 2, 0, 'Existing customer details', JSON.stringify(body.fields), 'existing-hash')
    sqlite.exec(readFileSync(new URL('../../migrations/0002_short_enquiry_references.sql', import.meta.url), 'utf8'))
    const row = sqlite.prepare('SELECT * FROM enquiries').get()
    assert.equal(row.reference, body.reference)
    assert.equal(row.public_reference, 'AVELOF_DLX_10001')
    assert.equal(row.details, 'Existing customer details')
    assert.deepEqual(JSON.parse(row.fields_json), body.fields)
  } finally { sqlite.close() }
})

test('reference allocation failures can be retried without losing the saved enquiry', async () => {
  const DB = database()
  try {
    const body = payload()
    const prepare = DB.prepare
    DB.prepare = (sql) => {
      if (sql.includes('INSERT INTO enquiry_reference_numbers')) throw new Error('Temporary allocation failure')
      return prepare(sql)
    }
    assert.equal((await send(DB, body)).status, 503)
    assert.equal((await send(DB, body)).status, 503)
    DB.prepare = prepare
    const retry = await send(DB, body)
    assert.equal(retry.status, 200)
    assert.equal((await retry.json()).reference, 'AVELOF_CSTM_10001')
    assert.equal(DB.sqlite.prepare('SELECT count(*) AS total FROM enquiries').get().total, 1)
  } finally { DB.sqlite.close() }
})

test('deleting an enquiry removes its numbering link without reusing its number', async () => {
  const DB = database()
  try {
    const body = payload()
    assert.equal((await (await send(DB, body)).json()).reference, 'AVELOF_CSTM_10001')
    DB.sqlite.prepare('DELETE FROM enquiries WHERE reference = ?').run(body.reference)
    assert.equal(DB.sqlite.prepare('SELECT count(*) AS total FROM enquiry_reference_numbers').get().total, 0)
    assert.equal((await (await send(DB, payload())).json()).reference, 'AVELOF_CSTM_10002')
  } finally { DB.sqlite.close() }
})

test('private customer codes are stable per enquiry but cannot be used for other enquiries', async () => {
  const secret = 'test-secret-with-more-than-thirty-two-characters'
  const first = await customerAccessCode(secret, 'first')
  assert.match(first, /^[a-f0-9]{64}$/)
  assert.equal(first, await customerAccessCode(secret, 'first'))
  assert.notEqual(first, await customerAccessCode(secret, 'second'))
  assert.notEqual(first, await customerAccessCode('another-secret', 'first'))
})

test('admin cookies require valid signatures, expire, and stop working after secret rotation', async () => {
  const env = { ENQUIRY_ACCESS_SECRET: 'test-secret-with-more-than-thirty-two-characters', ENQUIRY_ADMIN_CODE_HASH: await hashText('123456789012345678901234567890123456789012345678') }
  const token = await createAdminSession(env)
  const request = new Request('https://avelof.test', { headers: { Cookie: `__Host-avelof_admin=${token}` } })
  assert.equal(await isAdmin(request, env), true)
  assert.equal(await isAdmin(new Request('https://avelof.test'), env), false)
  assert.equal(await isAdmin(new Request('https://avelof.test', { headers: { Cookie: `__Host-avelof_admin=${token}tampered` } }), env), false)
  assert.equal(await isAdmin(request, { ...env, ENQUIRY_ADMIN_CODE_HASH: '0'.repeat(64) }), false)
  const expired = token.replace(token.split('.')[1], '1')
  assert.equal(await isAdmin(new Request('https://avelof.test', { headers: { Cookie: `__Host-avelof_admin=${expired}` } }), env), false)
  const cookie = adminCookie(request, token)
  assert.match(cookie, /HttpOnly; SameSite=Strict; Path=\/; Max-Age=1800; Secure/)
  assert.doesNotMatch(cookie, /Domain=/)
})

async function access(DB, body, options = {}) {
  const input = body && typeof body === 'object' && body.action === 'admin-login' ? { username: business.phone, ...body } : body
  const request = new Request(`https://avelof.test/api/enquiry-access${options.query ?? ''}`, {
    method: body ? 'POST' : 'GET',
    headers: { Origin: 'https://avelof.test', 'Content-Type': 'application/json', ...options.headers },
    ...(input ? { body: typeof input === 'string' ? input : JSON.stringify(input) } : {}),
  })
  return onAccessRequest({ request, env: { DB, ENQUIRY_ACCESS_SECRET: 'test-secret-with-more-than-thirty-two-characters', ENQUIRY_ADMIN_CODE_HASH: await hashText('123456789012345678901234567890123456789012345678') } })
}

async function pushRequest(DB, method, body, options = {}) {
  const request = new Request('https://avelof.test/api/push', {
    method,
    headers: { Origin: 'https://avelof.test', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...options.headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  return onPushRequest({ request, env: {
    DB,
    ENQUIRY_ACCESS_SECRET: 'test-secret-with-more-than-thirty-two-characters',
    ENQUIRY_ADMIN_CODE_HASH: await hashText('123456789012345678901234567890123456789012345678'),
    ENQUIRY_VAPID_PUBLIC_KEY: 'test-public-key',
    ENQUIRY_VAPID_PRIVATE_KEY: 'test-private-key',
    ENQUIRY_VAPID_SUBJECT: 'mailto:info@avelof.in',
  } })
}

test('customers need the correct private code and receive only their own enquiry', async () => {
  const DB = database()
  try {
    const first = await (await send(DB, payload())).json()
    const second = await (await send(DB, payload())).json()
    assert.match(first.accessCode, /^[a-f0-9]{64}$/)
    assert.equal(DB.sqlite.prepare('SELECT access_code_hash FROM enquiries WHERE public_reference = ?').get(first.reference).access_code_hash, await hashText(first.accessCode))
    const success = await access(DB, { action: 'lookup', reference: first.reference, accessCode: first.accessCode })
    assert.equal(success.status, 200)
    const body = await success.json()
    assert.equal(body.enquiry.reference, first.reference)
    assert.equal(body.enquiry.fields.fullName, 'T*s* G***t')
    assert.equal(body.enquiry.fields.phoneNumber, '9*******10')
    assert.equal(body.enquiry.access_code_hash, undefined)
    assert.equal(body.enquiry.payload_hash, undefined)
    assert.equal(body.enquiry.requestReference, undefined)
    assert.equal((await access(DB, { action: 'lookup', reference: second.reference, accessCode: first.accessCode })).status, 404)
    assert.equal((await access(DB, { action: 'lookup', reference: first.reference, accessCode: '0'.repeat(64) })).status, 404)
    assert.equal((await access(DB, { action: 'lookup', reference: first.reference })).status, 400)
    assert.match(success.headers.get('Cache-Control'), /no-store/)
  } finally { DB.sqlite.close() }
})

test('admin list requires a signed cookie; login, filters, logout and no secret leakage work', async () => {
  const DB = database()
  try {
    const saved = await (await send(DB, payload())).json()
    assert.equal((await access(DB)).status, 401)
    assert.equal((await access(DB, { action: 'admin-login', code: '0'.repeat(48) })).status, 401)
    const login = await access(DB, { action: 'admin-login', code: '123456789012345678901234567890123456789012345678' })
    assert.equal(login.status, 200)
    const Cookie = login.headers.get('Set-Cookie').split(';')[0]
    assert.match(login.headers.get('Set-Cookie'), /HttpOnly; SameSite=Strict; Path=\/; Max-Age=1800; Secure/)
    const listing = await access(DB, undefined, { headers: { Cookie } })
    assert.equal(listing.status, 200)
    const body = await listing.json()
    assert.equal(body.total, 1)
    assert.equal(body.enquiries[0].reference, saved.reference)
    assert.equal(body.enquiries[0].accessCode, undefined)
    const filtered = await access(DB, undefined, { headers: { Cookie }, query: '?status=completed' })
    assert.equal((await filtered.json()).total, 0)
    assert.equal((await access(DB, undefined, { headers: { Cookie }, query: '?page=-1' })).status, 400)
    const logout = await access(DB, { action: 'logout' }, { headers: { Cookie } })
    assert.match(logout.headers.get('Set-Cookie'), /Max-Age=0/)
    assert.equal((await access(DB, undefined, { headers: { Cookie: `${Cookie}x` } })).status, 401)
  } finally { DB.sqlite.close() }
})

test('access API blocks cross-origin requests, oversized input and brute-force attempts', async () => {
  const DB = database()
  try {
    const login = { action: 'admin-login', code: '0'.repeat(48) }
    assert.equal((await access(DB, login, { headers: { Origin: 'https://evil.test' } })).status, 403)
    assert.equal((await access(DB, 'x'.repeat(8193))).status, 413)
    for (let attempt = 0; attempt < 10; attempt++) assert.equal((await access(DB, login)).status, 401)
    assert.equal((await access(DB, login)).status, 429)
  } finally { DB.sqlite.close() }
})

test('legacy enquiries remain private and visible only to an authenticated admin', async () => {
  const DB = database()
  try {
    const body = payload()
    const response = await send(DB, body)
    const saved = await response.json()
    DB.sqlite.prepare('UPDATE enquiries SET access_code_hash = NULL WHERE reference = ?').run(body.reference)
    assert.equal((await access(DB, { action: 'lookup', reference: saved.reference, accessCode: saved.accessCode })).status, 404)
  } finally { DB.sqlite.close() }
})

test('ID-only summary exposes only selected booking details and masked contacts, never free text', async () => {
  const DB = database()
  try {
    const input = payload()
    Object.assign(input.fields, { fullName: 'Robert Smith', customDetails: 'Robert Smith, private address and passport', placesToVisit: 'Private itinerary', selectedDestinations: 'Private place' })
    const saved = await (await send(DB, input)).json()
    const response = await access(DB, { action: 'booking-summary', reference: saved.reference })
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.deepEqual(body.booking, { reference: saved.reference, kind: 'package', status: 'received', maskedName: 'R***r* S***h', maskedPhone: '9*******10', bookingDetails: { type: 'Customized package', name: 'Customized package', startLabel: 'Start date', endLabel: 'End date', startDate: '2027-01-10', endDate: '2027-01-12' } })
    const output = JSON.stringify(body)
    for (const hidden of ['Robert Smith', '+91 9876543210', 'private address', 'Private itinerary', 'Private place', saved.accessCode, input.reference]) assert.equal(output.includes(hidden), false)
    assert.equal((await access(DB, { action: 'booking-summary', reference: 'AVELOF_DLX_99999' })).status, 404)
    assert.equal((await access(DB, { action: 'booking-summary', reference: saved.reference }, { headers: { Origin: 'https://other.test' } })).status, 403)
    assert.match(response.headers.get('Cache-Control'), /no-store/)
  } finally { DB.sqlite.close() }
})

test('admin status changes persist and are visible to customers; unsigned and stale writes fail', async () => {
  const DB = database()
  try {
    const saved = await (await send(DB, payload())).json()
    const change = { action: 'admin-status', reference: saved.reference, status: 'booked', version: 0 }
    assert.equal((await access(DB, change)).status, 401)
    const login = await access(DB, { action: 'admin-login', code: '123456789012345678901234567890123456789012345678' })
    const Cookie = login.headers.get('Set-Cookie').split(';')[0]
    for (const [version, status] of ['booked', 'running', 'completed'].entries()) {
      const updated = await access(DB, { ...change, version, status }, { headers: { Cookie } })
      assert.equal(updated.status, 200)
      const body = await updated.json()
      assert.equal(body.enquiry.status, status)
      assert.equal(body.enquiry.statusVersion, version + 1)
      assert.ok(body.enquiry.statusUpdatedAt)
      assert.equal(body.enquiry.fields.fullName, 'Test Guest')
      const customer = await (await access(DB, { action: 'booking-summary', reference: saved.reference })).json()
      assert.equal(customer.booking.status, status)
    }
    assert.equal((await access(DB, change, { headers: { Cookie } })).status, 409)
    assert.equal((await access(DB, { ...change, version: 3, status: 'unknown' }, { headers: { Cookie } })).status, 400)
    const filtered = await access(DB, undefined, { headers: { Cookie }, query: '?status=completed' })
    assert.equal((await filtered.json()).total, 1)
    assert.equal(DB.sqlite.prepare('SELECT status, booking_status FROM enquiries').get().status, 'new')
    assert.equal(DB.sqlite.prepare('SELECT booking_status FROM enquiries').get().booking_status, 'completed')
  } finally { DB.sqlite.close() }
})

test('only the current admin session can permanently delete an enquiry and its reference allocation', async () => {
  const DB = database()
  try {
    const saved = await (await send(DB, payload())).json()
    const deletion = { action: 'admin-delete', reference: saved.reference, version: 0 }
    assert.equal(DB.sqlite.prepare('SELECT count(*) AS total FROM enquiry_reference_numbers').get().total, 1)
    assert.equal((await access(DB, deletion)).status, 401)
    const login = await access(DB, { action: 'admin-login', code: '123456789012345678901234567890123456789012345678' })
    const Cookie = login.headers.get('Set-Cookie').split(';')[0]
    assert.equal((await access(DB, deletion, { headers: { Cookie, Origin: 'https://other.test' } })).status, 403)
    assert.equal((await access(DB, { ...deletion, version: 1 }, { headers: { Cookie } })).status, 409)
    assert.equal(DB.sqlite.prepare('SELECT count(*) AS total FROM enquiries').get().total, 1)
    const response = await access(DB, deletion, { headers: { Cookie } })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { deleted: true, reference: saved.reference })
    assert.equal(DB.sqlite.prepare('SELECT count(*) AS total FROM enquiries').get().total, 0)
    assert.equal(DB.sqlite.prepare('SELECT count(*) AS total FROM enquiry_reference_numbers').get().total, 0)
    assert.equal((await access(DB, { action: 'booking-summary', reference: saved.reference })).status, 404)
    assert.equal((await access(DB, deletion, { headers: { Cookie } })).status, 409)
  } finally { DB.sqlite.close() }
})

test('push subscriptions are private to the owner and can be enabled or removed per device', async () => {
  const DB = database()
  try {
    assert.equal((await pushRequest(DB, 'GET')).status, 401)
    const login = await access(DB, { action: 'admin-login', code: '123456789012345678901234567890123456789012345678' })
    const Cookie = login.headers.get('Set-Cookie').split(';')[0]
    const endpoint = 'https://push.example.test/device/one'
    const subscription = { endpoint, expirationTime: null, keys: { p256dh: 'p'.repeat(65), auth: 'a'.repeat(22) } }
    const initial = await pushRequest(DB, 'GET', undefined, { headers: { Cookie } })
    assert.deepEqual(await initial.json(), { available: true, publicKey: 'test-public-key', subscriptionCount: 0 })
    assert.equal((await pushRequest(DB, 'POST', { action: 'subscribe', subscription })).status, 401)
    assert.equal((await pushRequest(DB, 'POST', { action: 'subscribe', subscription }, { headers: { Cookie, Origin: 'https://evil.test' } })).status, 403)
    assert.deepEqual(await (await pushRequest(DB, 'POST', { action: 'subscribe', subscription }, { headers: { Cookie } })).json(), { enabled: true, subscriptionCount: 1 })
    assert.deepEqual(await (await pushRequest(DB, 'POST', { action: 'subscribe', subscription: { ...subscription, keys: { ...subscription.keys, p256dh: 'q'.repeat(65) } } }, { headers: { Cookie } })).json(), { enabled: true, subscriptionCount: 1 })
    assert.equal(DB.sqlite.prepare('SELECT p256dh FROM push_subscriptions WHERE endpoint = ?').get(endpoint).p256dh, 'q'.repeat(65))
    assert.deepEqual(await (await pushRequest(DB, 'DELETE', { action: 'unsubscribe', endpoint }, { headers: { Cookie } })).json(), { enabled: false, subscriptionCount: 0 })
    assert.equal(DB.sqlite.prepare('SELECT count(*) AS total FROM push_subscriptions').get().total, 0)
  } finally { DB.sqlite.close() }
})

test('new bookings and reviews queue one owner push only after a new insert', async () => {
  const DB = database()
  const vapid = { ENQUIRY_VAPID_PUBLIC_KEY: 'test-public-key', ENQUIRY_VAPID_PRIVATE_KEY: 'test-private-key', ENQUIRY_VAPID_SUBJECT: 'mailto:info@avelof.in' }
  const tasks = []
  const waitUntil = (task) => tasks.push(task)
  try {
    const booking = payload()
    assert.equal((await send(DB, booking, { env: vapid, waitUntil })).status, 201)
    assert.equal(tasks.length, 1)
    await Promise.all(tasks.splice(0))
    assert.equal((await send(DB, booking, { env: vapid, waitUntil })).status, 200)
    assert.equal(tasks.length, 0)

    const review = reviewPayload()
    assert.equal((await reviewRequest(DB, 'POST', review, { env: vapid, waitUntil })).status, 201)
    assert.equal(tasks.length, 1)
    await Promise.all(tasks.splice(0))
    assert.equal((await reviewRequest(DB, 'POST', review, { env: vapid, waitUntil })).status, 200)
    assert.equal(tasks.length, 0)
  } finally { DB.sqlite.close() }
})

test('owner push delivery encrypts the generic alert and removes expired subscriptions', async () => {
    const DB = database()
    const vapidKey = createECDH('prime256v1')
    const subscriptionKey = createECDH('prime256v1')
    vapidKey.generateKeys()
    subscriptionKey.generateKeys()
    const endpoint = 'https://push.example.test/device/expired'
    DB.sqlite.prepare('INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES (?, ?, ?)')
      .run(endpoint, subscriptionKey.getPublicKey(undefined, 'uncompressed').toString('base64url'), randomBytes(16).toString('base64url'))
    const env = {
      DB,
      ENQUIRY_VAPID_PUBLIC_KEY: vapidKey.getPublicKey(undefined, 'uncompressed').toString('base64url'),
      ENQUIRY_VAPID_PRIVATE_KEY: vapidKey.getPrivateKey().toString('base64url'),
      ENQUIRY_VAPID_SUBJECT: 'mailto:info@avelof.in',
    }
    const originalFetch = globalThis.fetch
    let pushRequest
    globalThis.fetch = async (input, init) => {
      pushRequest = { endpoint: String(input), headers: new Headers(init.headers), body: init.body }
      return new Response(null, { status: 410 })
    }
    try {
      const tasks = []
      queueOwnerPush(env, (task) => tasks.push(task), { title: 'New booking enquiry', body: '1 new booking · AVELOF_DLX_10001', url: '/admin/panel', tag: 'booking-test' })
      await Promise.all(tasks)
      assert.equal(pushRequest.endpoint, endpoint)
      assert.match(pushRequest.headers.get('authorization'), /^vapid t=/)
      assert.equal(pushRequest.headers.get('content-encoding'), 'aes128gcm')
      assert.ok(pushRequest.body.byteLength > 0)
      assert.equal(DB.sqlite.prepare('SELECT count(*) AS total FROM push_subscriptions').get().total, 0)
    } finally {
      globalThis.fetch = originalFetch
      DB.sqlite.close()
    }
  })

  test('masked status lookup has a separate bounded rate limit', async () => {
  const DB = database()
  try {
    const saved = await (await send(DB, payload())).json()
    for (let attempt = 0; attempt < 60; attempt++) assert.equal((await access(DB, { action: 'booking-summary', reference: saved.reference })).status, 200)
    assert.equal((await access(DB, { action: 'booking-summary', reference: saved.reference })).status, 429)
    assert.equal((await access(DB, { action: 'lookup', reference: saved.reference, accessCode: saved.accessCode })).status, 200)
  } finally { DB.sqlite.close() }
})

test('phone-only search returns related masked summaries, never submitted private details', async () => {
  const DB = database()
  try {
    const saved = []
    for (const kind of ['package', 'hotel', 'car']) {
      const input = payload(kind)
      input.fields.customDetails = 'Private address and travel details'
      saved.push(await (await send(DB, input)).json())
    }
    const response = await access(DB, { action: 'booking-search', identifier: '98765 43210' })
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.equal(data.bookings.length, 3)
    assert.deepEqual(new Set(data.bookings.map((item) => item.reference)), new Set(saved.map((item) => item.reference)))
    for (const identifier of ['9876543210', '919876543210', '+91 9876543210']) {
      const variant = await access(DB, { action: 'booking-search', identifier })
      assert.equal(variant.status, 200)
      assert.deepEqual(new Set((await variant.json()).bookings.map((item) => item.reference)), new Set(saved.map((item) => item.reference)))
    }
    for (const item of data.bookings) assert.deepEqual(Object.keys(item).sort(), ['bookingDetails', 'kind', 'maskedName', 'maskedPhone', 'reference', 'status'])
    const output = JSON.stringify(data)
    for (const privateValue of ['Test Guest', '9876543210', 'Private address', saved[0].accessCode]) assert.equal(output.includes(privateValue), false)
    const exact = await access(DB, { action: 'booking-search', identifier: saved[0].reference.toLowerCase() })
    assert.equal((await exact.json()).bookings.length, 1)
    assert.equal((await access(DB, { action: 'booking-search', identifier: '9999999999' })).status, 404)
    assert.equal((await access(DB, { action: 'booking-search', identifier: "bad' OR 1=1" })).status, 400)
  } finally { DB.sqlite.close() }
})

test('admin username is required and salted password hashes verify without changing legacy code support', async () => {
  const DB = database()
  try {
    const code = '123456789012345678901234567890123456789012345678'
    assert.equal((await access(DB, JSON.stringify({ action: 'admin-login', code }))).status, 400)
    assert.equal((await access(DB, { action: 'admin-login', username: '+91 9000000000', code })).status, 401)
    assert.equal((await access(DB, { action: 'admin-login', username: business.phone, code })).status, 200)
    const password = 'Test-only long passphrase 47!'
    const salt = '0123456789abcdef0123456789abcdef'
    const hash = pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 32, 'sha256').toString('hex')
    const encoded = `pbkdf2_sha256$100000$${salt}$${hash}`
    assert.equal(await verifyAdminPassword(password, encoded), true)
    assert.equal(await verifyAdminPassword('Wrong test-only passphrase', encoded), false)
    const env = { ENQUIRY_ACCESS_SECRET: 'test-secret-with-more-than-thirty-two-characters', ENQUIRY_ADMIN_CODE_HASH: encoded }
    const login = await onAccessRequest({ request: new Request('https://avelof.test/api/enquiry-access', {
      method: 'POST', headers: { Origin: 'https://avelof.test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'admin-login', username: business.phone, code: password }),
    }), env: { ...env, DB } })
    assert.equal(login.status, 200)
    assert.match(login.headers.get('Set-Cookie'), /HttpOnly/)
    const token = await createAdminSession(env)
    assert.equal(await isAdmin(new Request('https://avelof.test', { headers: { Cookie: `__Host-avelof_admin=${token}` } }), env), true)
  } finally { DB.sqlite.close() }
})

test('phone lookup migration indexes existing formatted numbers without changing original details', () => {
  const sqlite = new DatabaseSync(':memory:')
  try {
    const migrations = new URL('../../migrations/', import.meta.url)
    for (const migration of readdirSync(migrations).filter((name) => name.endsWith('.sql') && name < '0005').sort()) sqlite.exec(readFileSync(new URL(migration, migrations), 'utf8'))
    const body = payload()
    const originalPhone = '+91 (98765) 43210'
    sqlite.prepare('INSERT INTO enquiries (reference, kind, full_name, phone_number, adults, children, fields_json, payload_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(body.reference, body.kind, body.fields.fullName, originalPhone, 2, 0, JSON.stringify(body.fields), 'test-only-hash')
    sqlite.exec(readFileSync(new URL('0005_phone_lookup.sql', migrations), 'utf8'))
    const row = sqlite.prepare('SELECT phone_number, phone_lookup, fields_json FROM enquiries').get()
    assert.equal(row.phone_lookup, '919876543210')
    assert.equal(row.phone_number, originalPhone)
    assert.deepEqual(JSON.parse(row.fields_json), body.fields)
  } finally { sqlite.close() }
})

test('Indian numbers use ten national digits and accept optional 91 prefixes for lookup and admin usernames', () => {
  for (const value of ['9876543210', '919876543210', '+919876543210', '+91 (98765) 43210']) {
    assert.equal(indianPhoneNumber(value), '9876543210')
    assert.deepEqual(phoneCandidates(value), ['9876543210', '919876543210'])
  }
  for (const value of ['987654321', '98765432101', '+449876543210', 'phone9876543210']) {
    assert.equal(indianPhoneNumber(value), '')
    assert.deepEqual(phoneCandidates(value), [])
  }
  const username = indianPhoneNumber(business.phone)
  assert.match(username, /^\d{10}$/)
  for (const value of [username, `91${username}`, `+91${username}`]) assert.equal(correctAdminUsername(value), true)
})

test('all four booking types preserve every submitted detail in D1 and the authenticated admin response', async () => {
  const DB = database()
  try {
    const login = await access(DB, { action: 'admin-login', code: '123456789012345678901234567890123456789012345678' })
    assert.equal(login.status, 200)
    const Cookie = login.headers.get('Set-Cookie').split(';')[0]
    const cases = [
      { kind: 'hotel', type: 'Hotel booking', name: 'Hotel Royal Imsar', fields: { preferredStay: 'Hotel Royal Imsar', checkInDate: '2027-01-10', checkOutDate: '2027-01-12', breakfast: 'Included', dinner: 'Not included', nightlyRate: 'INR 3500 per couple', stayDuration: '3 days, 2 nights' } },
      { kind: 'car', type: 'Cab booking', name: 'Toyota Innova', fields: { carRental: 'Toyota Innova', startDate: '2027-01-10', endDate: '2027-01-12', rentalDays: '3' } },
      { kind: 'package', type: 'Package booking', name: 'Premium', fields: { packagePreference: 'Premium', arrivalDate: '2027-01-10', departureDate: '2027-01-12', tripDays: '3', tripNights: '2', travelGroup: 'Family', carRental: 'Toyota Innova' } },
      { kind: 'package', type: 'Customized package', name: 'Customized package', fields: { packagePreference: 'Custom package', arrivalDate: '2027-01-10', departureDate: '2027-01-12', tripDays: '3', tripNights: '2', placesToVisit: 'Day 1: Srinagar\nDay 2: Gulmarg', selectedDestinations: 'Srinagar, Gulmarg', vehicleDailyRate: 'INR 2000', vehicleRentalEstimate: 'INR 6000', planningNote: 'Please confirm seasonal access.' } },
    ]
    for (const entry of cases) {
      const input = payload(entry.kind)
      Object.assign(input.fields, entry.fields, { adults: '3', children: '1', customDetails: 'Airport pickup; vegetarian meals; please call before confirming.' })
      const response = await send(DB, input)
      assert.equal(response.status, 201)
      const receipt = await response.json()
      const row = DB.sqlite.prepare('SELECT fields_json, details FROM enquiries WHERE public_reference = ?').get(receipt.reference)
      assert.deepEqual(JSON.parse(row.fields_json), input.fields)
      assert.equal(row.details, input.fields.customDetails)
      const listing = await access(DB, undefined, { headers: { Cookie } })
      assert.equal(listing.status, 200)
      const saved = (await listing.json()).enquiries.find((enquiry) => enquiry.reference === receipt.reference)
      assert.deepEqual(saved.fields, input.fields)
      const requested = requestedBooking(saved.kind, saved.fields)
      assert.equal(requested.type, entry.type)
      assert.equal(requested.name, entry.name)
      assert.equal(requested.startDate, '2027-01-10')
      assert.equal(requested.endDate, '2027-01-12')
      const publicResponse = await access(DB, { action: 'booking-summary', reference: receipt.reference })
      const customer = await publicResponse.json()
      assert.deepEqual(customer.booking.bookingDetails, requested)
      const publicText = JSON.stringify(customer)
      for (const hidden of ['vegetarian meals', 'Airport pickup', 'Please confirm seasonal access.', 'Day 1: Srinagar', input.fields.fullName, input.fields.phoneNumber]) assert.equal(publicText.includes(hidden), false)
    }
    assert.equal((await access(DB)).status, 401)
  } finally { DB.sqlite.close() }
})

test('legacy admin summaries show missing selections and dates explicitly without inventing details', () => {
  const requested = requestedBooking('hotel', {})
  assert.equal(requested.name, 'Hotel selection pending')
  assert.equal(requested.startDate, null)
  assert.equal(requested.endDate, null)
})

test('public selections cannot echo arbitrary contact information or notes through a catalog-name field', async () => {
  const DB = database()
  try {
    const input = payload('hotel')
    input.fields.preferredStay = 'Call Test Guest at 9876543210; private address'
    const saved = await (await send(DB, input)).json()
    const response = await access(DB, { action: 'booking-summary', reference: saved.reference })
    const data = await response.json()
    assert.equal(data.booking.bookingDetails.name, 'Hotel selection pending')
    assert.equal(data.booking.bookingDetails.startDate, input.fields.checkInDate)
    assert.equal(data.booking.bookingDetails.endDate, input.fields.checkOutDate)
    assert.equal(JSON.stringify(data).includes(input.fields.preferredStay), false)
  } finally { DB.sqlite.close() }
})

function reviewPayload() {
  return { id: crypto.randomUUID(), reviewerName: 'Test Guest', bookingId: '', experience: 'General experience', rating: 4, title: 'Thoughtful travel', reviewText: 'A carefully arranged trip with helpful local support.', publicationConsent: true, website: '' }
}

async function reviewRequest(DB, method, body, options = {}) {
  return onReviewRequest({ request: new Request(`https://avelof.test/api/reviews${options.query ?? ''}`, {
    method, headers: { Origin: 'https://avelof.test', 'Content-Type': 'application/json', ...options.headers },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  }), env: {
    DB,
    ENQUIRY_ACCESS_SECRET: 'test-secret-with-more-than-thirty-two-characters',
    ENQUIRY_ADMIN_CODE_HASH: await hashText('123456789012345678901234567890123456789012345678'),
    ...options.env,
  }, ...(options.waitUntil ? { waitUntil: options.waitUntil } : {}) })
}

test('anyone can publish a consented review without booking confirmation; retries do not duplicate it', async () => {
  const DB = database()
  try {
    const input = reviewPayload()
    const response = await reviewRequest(DB, 'POST', input)
    assert.equal(response.status, 201)
    assert.deepEqual(await response.json(), { saved: true, id: input.id, status: 'published' })
    assert.equal((await reviewRequest(DB, 'POST', input)).status, 200)
    assert.equal(DB.sqlite.prepare('SELECT count(*) AS total FROM reviews').get().total, 1)
    const row = DB.sqlite.prepare('SELECT status, published_at FROM reviews WHERE id = ?').get(input.id)
    assert.equal(row.status, 'published')
    assert.ok(row.published_at)
    assert.equal((await reviewRequest(DB, 'POST', { ...input, rating: 3 })).status, 409)
    const listing = await reviewRequest(DB, 'GET')
    const data = await listing.json()
    assert.equal(data.reviews.length, 1)
    assert.equal(data.reviews[0].reviewText, input.reviewText)
    assert.equal(data.reviews[0].bookingId, '')
    assert.equal(data.total, 1)
    assert.equal(data.averageRating, 4)
    assert.equal((await reviewRequest(DB, 'GET', undefined, { query: '?scope=admin' })).status, 401)
    assert.equal((await reviewRequest(DB, 'PATCH', { id: input.id, status: 'published', version: 0 })).status, 401)
    assert.equal((await reviewRequest(DB, 'DELETE', { id: input.id, version: 0 })).status, 401)
  } finally { DB.sqlite.close() }
})

test('owner can hide and restore a review with its full public booking ID without marking it verified', async () => {
  const DB = database()
  try {
    const input = { ...reviewPayload(), bookingId: 'AVELOF_PRM_12345', rating: 1 }
    await reviewRequest(DB, 'POST', input)
    const login = await access(DB, { action: 'admin-login', code: '123456789012345678901234567890123456789012345678' })
    const Cookie = login.headers.get('Set-Cookie').split(';')[0]
    const admin = await reviewRequest(DB, 'GET', undefined, { query: '?scope=admin&status=all', headers: { Cookie } })
    const listingAdmin = await admin.json()
    assert.equal(listingAdmin.reviews[0].status, 'published')
    assert.equal(listingAdmin.reviews[0].bookingId, input.bookingId)
    assert.equal(listingAdmin.reviews[0].reviewText, input.reviewText)
    const listing = await (await reviewRequest(DB, 'GET')).json()
    assert.equal(listing.total, 1)
    assert.equal(listing.averageRating, 1)
    assert.equal(listing.reviews[0].reviewText, input.reviewText)
    assert.equal(listing.reviews[0].bookingId, input.bookingId)
    assert.equal(listing.reviews[0].payload_hash, undefined)
    assert.equal(listing.reviews[0].verified, undefined)
    assert.equal((await reviewRequest(DB, 'PATCH', { id: input.id, status: 'rejected', version: 0 }, { headers: { Cookie } })).status, 200)
    assert.equal((await reviewRequest(DB, 'PATCH', { id: input.id, status: 'pending', version: 0 }, { headers: { Cookie } })).status, 409)
    assert.equal((await (await reviewRequest(DB, 'GET')).json()).total, 0)
    assert.equal((await reviewRequest(DB, 'PATCH', { id: input.id, status: 'published', version: 1 }, { headers: { Cookie } })).status, 200)
    assert.equal((await (await reviewRequest(DB, 'GET')).json()).total, 1)
  } finally { DB.sqlite.close() }
})

test('only the current admin session can permanently delete a review', async () => {
  const DB = database()
  try {
    const input = reviewPayload()
    assert.equal((await reviewRequest(DB, 'POST', input)).status, 201)
    const deletion = { id: input.id, version: 0 }
    assert.equal((await reviewRequest(DB, 'DELETE', deletion)).status, 401)
    const login = await access(DB, { action: 'admin-login', code: '123456789012345678901234567890123456789012345678' })
    const Cookie = login.headers.get('Set-Cookie').split(';')[0]
    assert.equal((await reviewRequest(DB, 'DELETE', deletion, { headers: { Cookie, Origin: 'https://other.test' } })).status, 403)
    assert.equal((await reviewRequest(DB, 'DELETE', { ...deletion, version: 1 }, { headers: { Cookie } })).status, 409)
    assert.equal(DB.sqlite.prepare('SELECT count(*) AS total FROM reviews').get().total, 1)
    const response = await reviewRequest(DB, 'DELETE', deletion, { headers: { Cookie } })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { deleted: true, id: input.id })
    assert.equal(DB.sqlite.prepare('SELECT count(*) AS total FROM reviews').get().total, 0)
    assert.equal((await reviewRequest(DB, 'GET')).status, 200)
    assert.equal((await (await reviewRequest(DB, 'GET')).json()).total, 0)
  } finally { DB.sqlite.close() }
})

test('review validation, consent, spam limits, origin and size checks reject unsafe submissions', async () => {
  const DB = database()
  try {
    for (const change of [{ reviewerName: '' }, { rating: 0 }, { rating: 6 }, { reviewText: 'Too short' }, { publicationConsent: false }, { website: 'bot' }, { status: 'published' }, { submissionSource: 'owner_provided' }, { unexpected: 'field' }]) {
      assert.equal((await reviewRequest(DB, 'POST', { ...reviewPayload(), ...change })).status, 400)
    }
    assert.equal((await reviewRequest(DB, 'POST', reviewPayload(), { headers: { Origin: 'https://evil.test' } })).status, 403)
    assert.equal((await reviewRequest(DB, 'POST', 'x'.repeat(12289))).status, 413)
    for (let count = 0; count < 3; count++) assert.equal((await reviewRequest(DB, 'POST', reviewPayload())).status, 201)
    assert.equal((await reviewRequest(DB, 'POST', reviewPayload())).status, 429)
    assert.equal((await reviewRequest(DB, 'GET', undefined, { query: '?page=-1' })).status, 400)
  } finally { DB.sqlite.close() }
})

test('review database failures never return a saved confirmation', async () => {
  const DB = { prepare() { throw new Error('Storage unavailable') } }
  const response = await reviewRequest(DB, 'POST', reviewPayload())
  assert.equal(response.status, 503)
  assert.equal((await response.json()).saved, undefined)
})

test('owner-approved reviews import into D1 unchanged, remain private where needed, and do not duplicate or override moderation', async () => {
  const DB = database()
  try {
    const imported = buildOwnerReviewImport()
    assert.equal(imported.count, 10)
    assert.equal(new Set(imported.ids).size, 10)
    DB.sqlite.exec(imported.sql)
    DB.sqlite.exec(imported.sql)
    assert.equal(DB.sqlite.prepare('SELECT count(*) AS total FROM reviews').get().total, 10)
    for (const [index, original] of ownerProvidedGuestReviews.entries()) {
      const saved = DB.sqlite.prepare('SELECT * FROM reviews WHERE id = ?').get(imported.ids[index])
      assert.equal(saved.reviewer_name, original.name)
      assert.equal(saved.booking_id, original.bookingId)
      assert.equal(saved.experience, original.packageName)
      assert.equal(saved.rating, original.rating)
      assert.equal(saved.title, original.reviewTitle)
      assert.equal(saved.review_text, original.reviewText)
      assert.equal(saved.review_month, ownerGuestReviewMonths[original.id])
      assert.equal(saved.submission_source, 'owner_provided')
      assert.equal(saved.status, 'published')
      assert.ok(saved.published_at)
    }
    const feed = await reviewRequest(DB, 'GET')
    const data = await feed.json()
    assert.equal(data.total, 10)
    assert.equal(data.reviews.length, 10)
    assert.equal(data.averageRating, 5)
    assert.deepEqual(data.reviews.map((review) => review.reviewMonth), ['2025-12', '2025-12', '2025-06', '2025-06', '2025-03', '2025-03', '2025-03', '2025-03', '2025-01', '2025-01'])
    for (const review of data.reviews) {
      assert.equal(review.bookingId, ownerProvidedGuestReviews.find((original) => original.name === review.reviewerName).bookingId)
      assert.equal(review.payload_hash, undefined)
      assert.equal(review.verified, undefined)
      assert.equal(review.source_key, undefined)
    }
    DB.sqlite.prepare("UPDATE reviews SET status = 'rejected', version = 1, published_at = NULL WHERE id = ?").run(imported.ids[0])
    DB.sqlite.exec(imported.sql)
    const hidden = DB.sqlite.prepare('SELECT status, version FROM reviews WHERE id = ?').get(imported.ids[0])
    assert.equal(hidden.status, 'rejected')
    assert.equal(hidden.version, 1)
    assert.equal((await (await reviewRequest(DB, 'GET')).json()).total, 9)
  } finally { DB.sqlite.close() }
})

test('deleting an owner review leaves a tombstone so a later import cannot restore it', () => {
  const DB = database()
  try {
    const imported = buildOwnerReviewImport()
    DB.sqlite.exec(imported.sql)
    DB.sqlite.prepare('DELETE FROM reviews WHERE id = ?').run(imported.ids[0])
    assert.equal(DB.sqlite.prepare('SELECT count(*) AS total FROM reviews WHERE id = ?').get(imported.ids[0]).total, 0)
    assert.equal(DB.sqlite.prepare('SELECT count(*) AS total FROM deleted_owner_review_sources WHERE source_key = ?').get('owner:guest-rating-1').total, 1)
    DB.sqlite.exec(imported.sql)
    assert.equal(DB.sqlite.prepare('SELECT count(*) AS total FROM reviews WHERE id = ?').get(imported.ids[0]).total, 0)
    assert.equal(DB.sqlite.prepare('SELECT count(*) AS total FROM reviews').get().total, 9)
  } finally { DB.sqlite.close() }
})

test('review-month migration corrects existing owner reviews without rewriting publication or moderation history', () => {
  const sqlite = new DatabaseSync(':memory:')
  try {
    const migrations = new URL('../../migrations/', import.meta.url)
    for (const migration of readdirSync(migrations).filter((name) => name.endsWith('.sql') && name < '0008').sort()) sqlite.exec(readFileSync(new URL(migration, migrations), 'utf8'))
    const imported = buildOwnerReviewImport()
    for (const [index, review] of ownerProvidedGuestReviews.entries()) {
      sqlite.prepare("INSERT INTO reviews (id, reviewer_name, booking_id, experience, rating, title, review_text, publication_consent, payload_hash, submission_source, source_key, status, version, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'existing-hash', 'owner_provided', ?, ?, 2, ?)")
        .run(imported.ids[index], review.name, review.bookingId, review.packageName, review.rating, review.reviewTitle, review.reviewText, `owner:${review.id}`, index === 0 ? 'rejected' : 'published', index === 0 ? null : '2026-10-01T10:00:00.000Z')
    }
    sqlite.exec(readFileSync(new URL('0008_review_months.sql', migrations), 'utf8'))
    const groups = sqlite.prepare('SELECT review_month, count(*) AS total FROM reviews GROUP BY review_month ORDER BY review_month').all().map((row) => [row.review_month, row.total])
    assert.deepEqual(groups, [['2025-01', 2], ['2025-03', 4], ['2025-06', 2], ['2025-12', 2]])
    for (const [index, review] of ownerProvidedGuestReviews.entries()) {
      const row = sqlite.prepare('SELECT * FROM reviews WHERE id = ?').get(imported.ids[index])
      assert.equal(row.review_month, ownerGuestReviewMonths[review.id])
      assert.equal(row.review_text, review.reviewText)
      assert.equal(row.status, index === 0 ? 'rejected' : 'published')
      assert.equal(row.published_at, index === 0 ? null : '2026-10-01T10:00:00.000Z')
      assert.equal(row.version, 3)
    }
  } finally { sqlite.close() }
})