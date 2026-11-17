import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { createAdminSession } from '../_lib/enquiryAccess.ts'
import { onRequest } from './businesses.ts'
import { onRequest as onBusinessImage } from './business-images/[id].ts'
import { onRequest as onPartnerPhotos } from './partner-photos.ts'

const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q==', 'base64')

const itemFixtures = new Map()
function richItems(...names) {
  return names.map((name) => {
    if (!itemFixtures.has(name)) itemFixtures.set(name, { id: crypto.randomUUID(), name, description: `${name}, available to discover in person.` })
    return itemFixtures.get(name)
  })
}

class RegistrationDatabase {
  sqlite = new DatabaseSync(':memory:')
  failBatch = ''

  constructor() {
    this.sqlite.exec('PRAGMA foreign_keys = ON')
    const migrations = new URL('../../migrations/', import.meta.url)
    for (const migration of readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()) {
      this.sqlite.exec(readFileSync(new URL(migration, migrations), 'utf8'))
    }
  }

  get rows() {
    return new Map(this.sqlite.prepare('SELECT * FROM business_registrations').all().map((row) => [row.id, row]))
  }

  get photos() {
    return new Map(this.sqlite.prepare('SELECT photo_key, content FROM registration_photos').all().map((row) => [row.photo_key, row.content]))
  }

  async batch(statements) {
    this.sqlite.exec('BEGIN')
    try {
      if (this.failBatch === 'before') { this.failBatch = ''; throw new Error('D1 unavailable before transaction') }
      for (const statement of statements) await statement.run()
      if (this.failBatch === 'photo') { this.failBatch = ''; throw new Error('Photo transaction failure') }
      this.sqlite.exec('COMMIT')
    } catch (error) {
      this.sqlite.exec('ROLLBACK')
      throw error
    }
    if (this.failBatch === 'after') { this.failBatch = ''; throw new Error('Response lost after transaction committed') }
    return []
  }

  prepare(sql) {
    const sqlite = this.sqlite
    let values = []
    return {
      bind(...args) { values = args.map((value) => value instanceof ArrayBuffer ? new Uint8Array(value) : value); return this },
      async first() { return sqlite.prepare(sql).get(...values) ?? null },
      async all() { return { results: sqlite.prepare(sql).all(...values) } },
      async run() {
        const result = sqlite.prepare(sql).run(...values)
        return { meta: { changes: Number(result.changes) } }
      },
    }
  }
}

function envWithAdmin(DB) {
  return { DB, ENQUIRY_ACCESS_SECRET: 's'.repeat(40), ENQUIRY_ADMIN_CODE_HASH: 'a'.repeat(64) }
}

async function adminCookie(env) {
  return `avelof_admin_local=${await createAdminSession(env)}`
}

async function sendRegistration(env, { id, name, kind, location, photoCount = 1, auth, retainedPhotos, itemPhotos, ...overrides }, ip = '192.0.2.100') {
  const form = new FormData()
  if (auth) form.append('auth', JSON.stringify(auth))
  if (retainedPhotos !== undefined) form.append('retainedPhotos', JSON.stringify(retainedPhotos))
  form.append('details', JSON.stringify({
    id,
    name,
    kind,
    location,
    address: `Main market, ${location}`,
    description: `${name} welcomes visitors with local ${kind === 'restaurant' ? 'Kashmiri food' : 'handmade products'} and a friendly team.`,
    website: '',
    contactName: `Private ${name}`,
    contactPhone: '9876543210',
    contactEmail: 'owner@example.test',
    publicationConsent: true,
    websiteTrap: '',
    ...overrides,
  }))
  for (let index = 0; index < photoCount; index++) form.append('photo', new Blob([jpeg], { type: 'image/jpeg' }), `business-${index}.jpg`)
  for (const [itemId, photo] of itemPhotos ?? (overrides.items ?? []).filter((item) => typeof item !== 'string').map((item) => [item.id, jpeg])) form.append(`itemPhoto_${itemId}`, new Blob([photo], { type: 'image/jpeg' }), `${itemId}.jpg`)
  const request = new Request('http://localhost/api/businesses', {
    method: 'POST',
    headers: { Origin: 'http://localhost', 'CF-Connecting-IP': ip },
    body: form,
  })
  return onRequest({ request, env })
}

function jsonRequest(path, method, data, cookie) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { Origin: 'http://localhost', 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(data),
  })
}

test('all business types require complete items, privately preview photos and publish only after approval', async (context) => {
  const DB = new RegistrationDatabase()
  context.after(() => DB.sqlite.close())
  const env = envWithAdmin(DB)
  const cookie = await adminCookie(env)
  const image = (id, item, admin = false) => onBusinessImage({ request: new Request(`http://localhost/api/business-images/${id}?item=${item}`, { headers: admin ? { Cookie: cookie } : {} }), env, params: { id } })
  for (const [index, kind] of ['restaurant', 'shop', 'handicraft'].entries()) {
    const items = richItems(`${kind} item`, `${kind} second item`)
    const input = { id: crypto.randomUUID(), name: `${kind} business`, kind, location: 'Srinagar', items }
    const receipt = await (await sendRegistration(env, input, `192.0.2.${index + 1}`)).json()
    assert.equal(receipt.saved, true)
    assert.equal((await image(input.id, items[0].id)).status, 404)
    assert.equal((await image(input.id, items[0].id, true)).status, 200)
    const previewInput = { kind: 'business', id: input.id, version: 0, accessCode: receipt.accessCode, itemPhotos: true }
    assert.equal((await onPartnerPhotos({ request: jsonRequest('/api/partner-photos', 'POST', { ...previewInput, accessCode: 'NOPE3210' }), env })).status, 404)
    const previews = await (await onPartnerPhotos({ request: jsonRequest('/api/partner-photos', 'POST', previewInput), env })).json()
    assert.deepEqual(Object.keys(previews.itemPhotos).sort(), items.map((item) => item.id).sort())
    assert.ok(Object.values(previews.itemPhotos).every((photo) => photo === `data:image/jpeg;base64,${jpeg.toString('base64')}`))
    DB.sqlite.prepare("UPDATE business_registrations SET status = 'approved' WHERE id = ?").run(input.id)
    const response = await image(input.id, items[0].id)
    assert.equal(response.status, 200)
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), jpeg)
    const filtered = await (await onRequest({ request: new Request(`http://localhost/api/businesses?kind=${kind}`), env })).json()
    assert.equal(filtered.total, 1)
    assert.equal(filtered.businesses[0].kind, kind)
    assert.equal(filtered.businesses[0].contactPhone, undefined)
    const changed = { ...input, items: [{ ...items[1], description: 'Updated description' }], itemPhotos: [], photoCount: 0, auth: { accessCode: receipt.accessCode, version: 0 } }
    DB.failBatch = 'photo'
    assert.equal((await sendRegistration(env, changed, `192.0.2.${index + 10}`)).status, 503)
    assert.equal(DB.sqlite.prepare('SELECT count(*) AS total FROM business_item_photos WHERE business_id = ?').get(input.id).total, 2)
    DB.failBatch = 'after'
    assert.equal((await sendRegistration(env, changed, `192.0.2.${index + 10}`)).status, 200)
    assert.equal((await sendRegistration(env, changed, `192.0.2.${index + 10}`)).status, 200)
    assert.equal(DB.rows.get(input.id).version, 1)
    assert.deepEqual(DB.sqlite.prepare('SELECT item_id FROM business_item_photos WHERE business_id = ?').all(input.id).map((row) => row.item_id), [items[1].id])
    assert.equal((await image(input.id, items[1].id)).status, 404)
    const replacementPhoto = Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0xff, 0xfe, 0x00, 0x04, 0x41, 0x42]), jpeg.subarray(2)])
    const replacement = { ...changed, itemPhotos: [[items[1].id, replacementPhoto]], auth: { accessCode: receipt.accessCode, version: 1 } }
    DB.failBatch = 'photo'
    assert.equal((await sendRegistration(env, replacement, `192.0.2.${index + 10}`)).status, 503)
    assert.deepEqual(Buffer.from(DB.sqlite.prepare('SELECT content FROM business_item_photos WHERE business_id = ? AND item_id = ?').get(input.id, items[1].id).content), jpeg)
    assert.equal((await sendRegistration(env, replacement, `192.0.2.${index + 10}`)).status, 200)
    assert.equal((await sendRegistration(env, replacement, `192.0.2.${index + 10}`)).status, 200)
    assert.equal((await sendRegistration(env, { ...replacement, itemPhotos: [[items[1].id, jpeg]] }, `192.0.2.${index + 10}`)).status, 409)
    DB.sqlite.prepare("UPDATE business_registrations SET status = 'approved' WHERE id = ?").run(input.id)
    assert.deepEqual(Buffer.from(await (await image(input.id, items[1].id)).arrayBuffer()), replacementPhoto)
    assert.equal((await image(input.id, items[0].id)).status, 404)
    DB.sqlite.prepare("UPDATE business_registrations SET status = 'rejected' WHERE id = ?").run(input.id)
    assert.equal((await image(input.id, items[1].id)).status, 404)
    assert.equal((await onRequest({ request: jsonRequest('/api/businesses', 'DELETE', { id: input.id, version: 2 }, cookie), env })).status, 200)
    assert.equal(DB.sqlite.prepare('SELECT count(*) AS total FROM business_item_photos WHERE business_id = ?').get(input.id).total, 0)
  }
})

test('item validation rejects missing/duplicate photos, incomplete text and forged photo identities; legacy items remain readable', async (context) => {
  const DB = new RegistrationDatabase()
  context.after(() => DB.sqlite.close())
  const env = envWithAdmin(DB)
  const item = richItems('Woven shawl')[0]
  let attempt = 20
  for (const change of [
    { items: ['Old text-only item'] },
    { items: [{ ...item, name: '' }] },
    { items: [{ ...item, description: '' }] },
    { items: [item, item] },
    { itemPhotos: [] },
    { itemPhotos: [[item.id, jpeg], [item.id, jpeg]] },
    { itemPhotos: [[crypto.randomUUID(), jpeg]] },
    { itemPhotos: [[item.id, Buffer.from('not a jpeg')]] },
    { items: Array.from({ length: 21 }, () => ({ ...item, id: crypto.randomUUID() })) },
  ]) {
    const response = await sendRegistration(env, { id: crypto.randomUUID(), name: 'Craft Studio', kind: 'handicraft', location: 'Srinagar', items: [item], ...change }, `192.0.2.${attempt++}`)
    assert.equal(response.status, 400, JSON.stringify(change))
    assert.equal(DB.rows.size, 0)
  }
  const id = crypto.randomUUID()
  const receipt = await (await sendRegistration(env, { id, name: 'Legacy Shop', kind: 'shop', location: 'Srinagar' })).json()
  DB.sqlite.prepare("UPDATE business_registrations SET details_json = json_set(details_json, '$.items', json(?)), status = 'approved' WHERE id = ?").run(JSON.stringify(['Legacy shawl']), id)
  const list = await (await onRequest({ request: new Request('http://localhost/api/businesses'), env })).json()
  assert.deepEqual(list.businesses[0].items, ['Legacy shawl'])
  const { photo, photos, ...details } = list.businesses[0]
  void photo; void photos
  const cookie = await adminCookie(env)
  assert.equal((await onRequest({ request: jsonRequest('/api/businesses', 'PATCH', { ...details, items: [item], status: 'approved', ownerNote: '', version: 0 }, cookie), env })).status, 400)
  assert.equal((await sendRegistration(env, { ...details, name: 'Legacy Shop', items: [item], photoCount: 0, auth: { accessCode: receipt.accessCode, version: 0 } })).status, 200)
  assert.equal(DB.sqlite.prepare('SELECT count(*) AS total FROM business_item_photos WHERE business_id = ?').get(id).total, 1)
})

test('business private photo previews, selective removal and additive uploads are transactional', async (context) => {
  const DB = new RegistrationDatabase()
  context.after(() => DB.sqlite.close())
  const env = envWithAdmin(DB)
  const input = { id: crypto.randomUUID(), name: 'Gallery Shop', kind: 'shop', location: 'Srinagar', photoCount: 3 }
  const receipt = await (await sendRegistration(env, input)).json()
  const oldKeys = JSON.parse(DB.rows.get(input.id).photo_keys_json)
  const preview = (overrides = {}) => onPartnerPhotos({ request: jsonRequest('/api/partner-photos', 'POST', { kind: 'business', id: input.id, accessCode: receipt.accessCode, version: 0, ...overrides }), env })
  assert.equal((await preview({ accessCode: 'WRNG0000' })).status, 404)
  const response = await preview()
  assert.equal(response.status, 200)
  assert.ok(response.headers.get('Cache-Control').includes('no-store'))
  assert.deepEqual((await response.json()).photos, Array(3).fill(`data:image/jpeg;base64,${jpeg.toString('base64')}`))
  let attempt = 110
  const update = (retainedPhotos, photoCount = 0, version = 0) => sendRegistration(env, { ...input, auth: { accessCode: receipt.accessCode, version }, retainedPhotos, photoCount }, `192.0.2.${attempt++}`)
  for (const indexes of [[], [1, 1], [3], [-1], null]) assert.equal((await update(indexes)).status, 400)
  assert.equal((await update([0, 1, 2], 3)).status, 400)
  DB.failBatch = 'photo'
  assert.equal((await update([2, 0], 1)).status, 503)
  assert.deepEqual(JSON.parse(DB.rows.get(input.id).photo_keys_json), oldKeys)
  assert.equal(DB.photos.size, 3)
  DB.failBatch = 'after'
  const saved = await (await update([2, 0], 1)).json()
  assert.equal(saved.saved, true, 'A lost response recovers the committed edit')
  const keys = JSON.parse(DB.rows.get(input.id).photo_keys_json)
  assert.deepEqual(keys.slice(0, 2), [oldKeys[2], oldKeys[0]])
  assert.ok(!DB.photos.has(oldKeys[1]))
  assert.equal(DB.photos.size, 3)
  for (const key of keys) assert.ok(DB.photos.has(key))
  assert.deepEqual(await (await update([2, 0], 1)).json(), saved)
  assert.equal((await preview()).status, 409)
  assert.equal((await update([1], 0, 1)).status, 200, 'Removal without uploads is saved')
  assert.deepEqual(JSON.parse(DB.rows.get(input.id).photo_keys_json), [oldKeys[0]])
  assert.equal(DB.photos.size, 1)
})

test('business galleries enforce 1-5 photos, preserve items, protect pending images and delete all photo bytes', async (context) => {
  const DB = new RegistrationDatabase()
  context.after(() => DB.sqlite.close())
  const env = envWithAdmin(DB)
  const cookie = await adminCookie(env)
  for (const count of [0, 6]) {
    const response = await sendRegistration(env, { id: crypto.randomUUID(), name: `Invalid ${count}`, kind: 'shop', location: 'Srinagar', photoCount: count }, `192.0.2.${count + 1}`)
    assert.equal(response.status, 400)
    assert.equal(DB.rows.size, 0)
    assert.equal(DB.photos.size, 0)
  }
  const id = crypto.randomUUID()
  const input = { id, name: 'Valley Products', kind: 'shop', location: 'Srinagar', items: richItems('Saffron', 'Walnuts'), photoCount: 5 }
  const response = await sendRegistration(env, input)
  assert.equal(response.status, 201)
  assert.equal(DB.photos.size, 5)
  assert.equal((await sendRegistration(env, input)).status, 200, 'Unchanged gallery retry is idempotent')
  assert.equal(DB.photos.size, 5)
  for (let index = 0; index < 5; index++) {
    const request = new Request(`http://localhost/api/business-images/${id}?index=${index}`)
    assert.equal((await onBusinessImage({ request, env, params: { id } })).status, 404)
  }
  const list = await onRequest({ request: new Request('http://localhost/api/businesses?scope=admin', { headers: { Cookie: cookie } }), env })
  const { businesses: [record] } = await list.json()
  assert.deepEqual(record.items, input.items)
  assert.equal(record.photos.length, 5)
  const { contactName, contactPhone, contactEmail, photo, photos, createdAt, ...details } = record
  void contactName; void contactPhone; void contactEmail; void photo; void photos; void createdAt
  const approval = await onRequest({ request: jsonRequest('/api/businesses', 'PATCH', { ...details, status: 'approved' }, cookie), env })
  assert.equal(approval.status, 200)
  const publicList = await onRequest({ request: new Request('http://localhost/api/businesses'), env })
  const { businesses: [published] } = await publicList.json()
  assert.deepEqual(published.items, input.items)
  assert.equal(published.contactPhone, undefined)
  for (const url of published.photos) {
    const image = await onBusinessImage({ request: new Request(`http://localhost${url}`), env, params: { id } })
    assert.equal(image.status, 200)
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), jpeg)
  }
  for (const index of ['5', '-1', 'text']) assert.equal((await onBusinessImage({ request: new Request(`http://localhost/api/business-images/${id}?index=${index}`), env, params: { id } })).status, 404)
  const deletion = await onRequest({ request: jsonRequest('/api/businesses', 'DELETE', { id, version: 1 }, cookie), env })
  assert.equal(deletion.status, 200)
  assert.equal(DB.photos.size, 0)
})

test('business registration, owner access, private moderation, filtered publishing, hiding and deletion', async (context) => {
  const DB = new RegistrationDatabase()
  context.after(() => DB.sqlite.close())
  const env = envWithAdmin(DB)
  const restaurantId = 'c0a80123-4567-489a-8abc-000000000001'
  const shopId = 'c0a80123-4567-489a-8abc-000000000002'

  const registration = await sendRegistration(env, { id: restaurantId, name: 'Saffron Table', kind: 'restaurant', location: 'Srinagar' })
  const receipt = await registration.json()
  assert.equal(registration.status, 201, JSON.stringify(receipt))
  assert.equal(receipt.status, 'pending')
  assert.equal(receipt.accessCode, 'SAFF3210')
  assert.equal('contactPhone' in receipt, false)
  assert.equal('contactEmail' in receipt, false)

  const pendingPublic = await onRequest({ request: new Request('http://localhost/api/businesses'), env })
  assert.deepEqual((await pendingPublic.json()).businesses, [])
  assert.equal(DB.photos.size, 1)
  const pendingPhoto = await onBusinessImage({ request: new Request(`http://localhost/api/business-images/${restaurantId}`), env, params: { id: restaurantId } })
  assert.equal(pendingPhoto.status, 404)

  const shopRegistration = await sendRegistration(env, { id: shopId, name: 'Valley Crafts', kind: 'shop', location: 'Gulmarg' })
  assert.equal(shopRegistration.status, 201)
  const cookie = await adminCookie(env)
  const adminList = await onRequest({ request: new Request('http://localhost/api/businesses?scope=admin&status=all', { headers: { Cookie: cookie } }), env })
  const adminData = await adminList.json()
  assert.equal(adminData.total, 2)
  assert.equal(adminData.businesses[0].contactPhone, '9876543210')
  assert.equal(adminData.businesses[0].contactEmail, 'owner@example.test')

  const approveRestaurant = await onRequest({
    request: jsonRequest('/api/businesses', 'PATCH', {
      id: restaurantId, version: 0, status: 'approved', ownerNote: 'Approved after review.',
      name: 'Saffron Table Kashmir', kind: 'restaurant', location: 'Srinagar',
      address: 'Lal Chowk, Srinagar',
      description: 'A locally owned restaurant serving Kashmiri specialities to visitors and residents.',
      website: '',
    }, cookie),
    env,
  })

  async function lookup(env, identifier, accessCode, ip = '192.0.2.200') {
    const request = jsonRequest('/api/businesses', 'POST', { identifier, accessCode })
    request.headers.set('CF-Connecting-IP', ip)
    return onRequest({ request, env })
  }

  await context.test('business owner lookup authenticates ID or phone, keeps contacts private and rejects ambiguous phone matches', async (context) => {
    const DB = new RegistrationDatabase()
    context.after(() => DB.sqlite.close())
    const env = envWithAdmin(DB)
    const details = { id: crypto.randomUUID(), name: 'Saffron Table', kind: 'restaurant', location: 'Srinagar', items: richItems('Kahwa') }
    await sendRegistration(env, details)
    assert.equal((await lookup(env, details.id, 'NOPE3210')).status, 404)
    assert.equal((await lookup(env, crypto.randomUUID(), 'SAFF3210')).status, 404)
    assert.equal((await lookup(env, 'not-an-id', 'SAFF3210')).status, 400)
    const response = await lookup(env, details.id.toUpperCase(), 'saff3210')
    assert.equal(response.status, 200)
    assert.match(response.headers.get('Cache-Control'), /no-store/)
    const { business } = await response.json()
    assert.equal(business.contactEmail, 'owner@example.test')
    assert.equal(business.contactPhone, '9876543210')
    assert.equal(business.version, 0)
    assert.equal(business.status, 'pending')
    assert.deepEqual(business.items, details.items)
    for (const key of ['photo', 'photos', 'accessCode', 'payload_hash', 'ownerNote']) assert.equal(key in business, false)
    assert.equal((await lookup(env, '+91 98765 43210', 'SAFF3210')).status, 200)
    await sendRegistration(env, { ...details, id: crypto.randomUUID(), name: 'Saffron Shop', kind: 'shop' })
    const ambiguous = await lookup(env, '9876543210', 'SAFF3210')
    assert.equal(ambiguous.status, 400)
    assert.match((await ambiguous.json()).error, /use your business ID/)
    assert.equal((await lookup(env, details.id, 'SAFF3210')).status, 200)
    const publicResponse = await onRequest({ request: new Request('http://localhost/api/businesses'), env })
    assert.deepEqual((await publicResponse.json()).businesses, [])
  })

  await context.test('owner edits keep or replace photos, change access codes, hide approved listings and reject stale edits', async (context) => {
    const DB = new RegistrationDatabase()
    context.after(() => DB.sqlite.close())
    const env = envWithAdmin(DB)
    const id = crypto.randomUUID()
    const original = { id, name: 'Saffron Table', kind: 'restaurant', location: 'Srinagar', photoCount: 5, latitude: 34.1, longitude: 74.2 }
    await sendRegistration(env, original)
    DB.sqlite.prepare("UPDATE business_registrations SET status = 'approved', owner_note = 'Private moderation note', version = 1 WHERE id = ?").run(id)
    const keys = [...DB.photos.keys()]
    const auth = { accessCode: 'SAFF3210', version: 1 }
    const edit = { ...original, name: 'Valley Table', contactPhone: '9123456789', items: richItems('Kahwa', 'Rice'), photoCount: 0, auth }
    assert.equal((await sendRegistration(env, { ...edit, auth: { ...auth, accessCode: 'NOPE3210' } }, '192.0.2.11')).status, 404)
    assert.equal((await sendRegistration(env, { ...edit, auth: { ...auth, version: 0 } }, '192.0.2.11')).status, 409)
    assert.equal((await sendRegistration(env, edit, '192.0.2.11')).status, 200)
    assert.deepEqual([...DB.photos.keys()], keys)
    assert.equal(DB.rows.get(id).status, 'pending')
    assert.equal(DB.rows.get(id).owner_note, '')
    assert.equal(DB.rows.get(id).version, 2)
    assert.equal(DB.rows.get(id).latitude, 34.1)
    assert.equal((await lookup(env, id, 'SAFF3210')).status, 404)
    const changed = await (await lookup(env, id, 'VALL6789')).json()
    assert.deepEqual(changed.business.items, edit.items)
    assert.equal((await (await sendRegistration(env, edit, '192.0.2.11')).json()).accessCode, 'VALL6789', 'Retry succeeds after credentials change')
    assert.equal(DB.rows.get(id).version, 2)
    assert.equal((await sendRegistration(env, { ...edit, name: 'Different edit', auth: { accessCode: 'VALL6789', version: 1 } }, '192.0.2.11')).status, 409)
    assert.equal((await (await onRequest({ request: new Request('http://localhost/api/businesses'), env })).json()).total, 0)
    assert.equal((await onBusinessImage({ request: new Request(`http://localhost/api/business-images/${id}`), env, params: { id } })).status, 404)
    const replacement = { ...edit, photoCount: 2, auth: { accessCode: 'VALL6789', version: 2 }, latitude: null, longitude: null }
    assert.equal((await sendRegistration(env, replacement, '192.0.2.12')).status, 200)
    assert.equal(DB.photos.size, 2)
    assert.ok(keys.every((key) => !DB.photos.has(key)))
    const replacedKeys = [...DB.photos.keys()]
    assert.equal((await sendRegistration(env, replacement, '192.0.2.12')).status, 200)
    assert.deepEqual([...DB.photos.keys()], replacedKeys)
    assert.equal(DB.rows.get(id).latitude, null)
    const cookie = await adminCookie(env)
    assert.equal((await onRequest({ request: jsonRequest('/api/businesses', 'DELETE', { id, version: 3 }, cookie), env })).status, 200)
    assert.equal(DB.photos.size, 0)
  })

  await context.test('owner photo updates roll back atomically and recover committed retries without duplicate bytes', async (context) => {
    for (const failure of ['before', 'photo', 'after']) {
      const DB = new RegistrationDatabase()
      context.after(() => DB.sqlite.close())
      const env = envWithAdmin(DB)
      const original = { id: crypto.randomUUID(), name: 'Retry Shop', kind: 'shop', location: 'Srinagar', photoCount: 3 }
      await sendRegistration(env, original)
      const oldKeys = [...DB.photos.keys()]
      const edit = { ...original, name: 'Changed Shop', photoCount: 2, auth: { accessCode: 'RETR3210', version: 0 } }
      DB.failBatch = failure
      const response = await sendRegistration(env, edit)
      assert.equal(response.status, failure === 'after' ? 200 : 503)
      assert.equal(DB.rows.get(original.id).version, failure === 'after' ? 1 : 0)
      if (failure !== 'after') assert.deepEqual([...DB.photos.keys()], oldKeys)
      assert.equal((await sendRegistration(env, edit)).status, 200)
      assert.equal(DB.photos.size, 2)
      assert.equal(DB.rows.get(original.id).version, 1)
      assert.ok(oldKeys.every((key) => !DB.photos.has(key)))
    }
  })

  await context.test('concurrent owner edits never add loser photo bytes or delete winner photos', async (context) => {
    for (const retainedPhotos of [undefined, [0]]) for (const identical of [true, false]) {
      const DB = new RegistrationDatabase()
      context.after(() => DB.sqlite.close())
      const env = envWithAdmin(DB)
      const original = { id: crypto.randomUUID(), name: 'Race Shop', kind: 'shop', location: 'Srinagar', photoCount: 3 }
      await sendRegistration(env, original)
      const edit = { ...original, items: richItems('Saffron'), photoCount: 2, retainedPhotos, auth: { accessCode: 'RACE3210', version: 0 } }
      const batch = DB.batch.bind(DB)
      DB.batch = async (statements) => {
        DB.batch = batch
        assert.equal((await sendRegistration(env, identical ? edit : { ...edit, items: richItems('Walnuts') }, '192.0.2.110')).status, 200)
        return batch(statements)
      }
      assert.equal((await sendRegistration(env, edit)).status, identical ? 200 : 409)
      assert.equal(DB.rows.get(original.id).version, 1)
      assert.equal(DB.photos.size, 2 + (retainedPhotos?.length ?? 0))
      assert.deepEqual([...DB.photos.keys()].sort(), JSON.parse(DB.rows.get(original.id).photo_keys_json).sort())
      assert.deepEqual(JSON.parse(DB.rows.get(original.id).details_json).items, identical ? edit.items : richItems('Walnuts'))
      assert.deepEqual(DB.sqlite.prepare('SELECT item_id FROM business_item_photos WHERE business_id = ?').all(original.id).map((row) => row.item_id), (identical ? edit.items : richItems('Walnuts')).map((item) => item.id))
    }
  })

  await context.test('private business access rejects cross-origin requests, limits guessing and validates owner submissions', async (context) => {
    const DB = new RegistrationDatabase()
    context.after(() => DB.sqlite.close())
    const env = envWithAdmin(DB)
    const original = { id: crypto.randomUUID(), name: 'Guarded Shop', kind: 'shop', location: 'Srinagar' }
    await sendRegistration(env, original)
    const crossOrigin = jsonRequest('/api/businesses', 'POST', { identifier: original.id, accessCode: 'GUAR3210' })
    crossOrigin.headers.set('Origin', 'https://other.example')
    assert.equal((await onRequest({ request: crossOrigin, env })).status, 403)
    const auth = { accessCode: 'GUAR3210', version: 0 }
    assert.equal((await sendRegistration(env, { ...original, auth, publicationConsent: false }, '192.0.2.41')).status, 400)
    assert.equal((await sendRegistration(env, { ...original, auth, photoCount: 6 }, '192.0.2.41')).status, 400)
    assert.equal((await sendRegistration(env, { ...original, auth: { ...auth, extra: 'invalid' } }, '192.0.2.41')).status, 400)
    assert.equal((await sendRegistration(env, { ...original, name: '!!!' }, '192.0.2.41')).status, 400)
    assert.equal((await sendRegistration(env, { ...original, id: crypto.randomUUID(), auth, photoCount: 0 }, '192.0.2.41')).status, 404)
    for (let attempt = 0; attempt < 10; attempt++) assert.equal((await lookup(env, original.id, 'NOPE3210', '192.0.2.42')).status, 404)
    assert.equal((await lookup(env, original.id, 'GUAR3210', '192.0.2.42')).status, 429)
    assert.equal((await sendRegistration(env, { ...original, auth, photoCount: 0 }, '192.0.2.42')).status, 429, 'Lookup and editing share brute-force budget')
    assert.equal(DB.rows.get(original.id).version, 0)
    assert.equal(DB.photos.size, 1)
  })
  assert.equal(approveRestaurant.status, 200)
  assert.equal((await approveRestaurant.json()).business.status, 'approved')
  const publishedPhoto = await onBusinessImage({ request: new Request(`http://localhost/api/business-images/${restaurantId}`), env, params: { id: restaurantId } })
  assert.equal(publishedPhoto.status, 200)
  const approveShop = await onRequest({
    request: jsonRequest('/api/businesses', 'PATCH', {
      id: shopId, version: 0, status: 'approved', ownerNote: '',
      name: 'Valley Crafts', kind: 'shop', location: 'Gulmarg',
      address: 'Main market, Gulmarg',
      description: 'A local shop with handmade products and locally sourced gifts for visitors.',
      website: '',
    }, cookie),
    env,
  })
  assert.equal(approveShop.status, 200)

  const filtered = await onRequest({ request: new Request('http://localhost/api/businesses?kind=shop&location=Gulmarg'), env })
  const filteredData = await filtered.json()
  assert.equal(filteredData.total, 1)
  assert.equal(filteredData.businesses[0].name, 'Valley Crafts')
  assert.equal('contactName' in filteredData.businesses[0], false)
  assert.equal('contactPhone' in filteredData.businesses[0], false)
  assert.equal('contactEmail' in filteredData.businesses[0], false)
  assert.equal('status' in filteredData.businesses[0], false)

  const hideRestaurant = await onRequest({
    request: jsonRequest('/api/businesses', 'PATCH', {
      id: restaurantId, version: 1, status: 'rejected', ownerNote: 'Hidden pending clarification.',
      name: 'Saffron Table Kashmir', kind: 'restaurant', location: 'Srinagar',
      address: 'Lal Chowk, Srinagar',
      description: 'A locally owned restaurant serving Kashmiri specialities to visitors and residents.',
      website: '',
    }, cookie),
    env,
  })
  assert.equal(hideRestaurant.status, 200)
  const hidden = await onRequest({ request: new Request('http://localhost/api/businesses?kind=restaurant&location=Srinagar'), env })
  assert.equal((await hidden.json()).total, 0)

  const deleteShop = await onRequest({
    request: jsonRequest('/api/businesses', 'DELETE', { id: shopId, version: 1 }, cookie),
    env,
  })
  assert.equal(deleteShop.status, 200)
  assert.equal((await deleteShop.json()).deleted, true)
  assert.equal(DB.rows.has(shopId), false)
  assert.equal(DB.photos.size, 1)
})

test('business registration moderation and deletion require the existing admin session', async (context) => {
  const DB = new RegistrationDatabase()
  context.after(() => DB.sqlite.close())
  const env = envWithAdmin(DB)
  const response = await onRequest({
    request: jsonRequest('/api/businesses', 'PATCH', {
      id: 'c0a80123-4567-489a-8abc-000000000001', version: 0, status: 'approved', ownerNote: '',
      name: 'Example Shop', kind: 'shop', location: 'Srinagar', address: 'Market',
      description: 'A local business listing with enough detail to describe its products to visitors.', website: '',
    }),
    env,
  })
  assert.equal(response.status, 401)
})

test('business submissions retry safely before, during and after a D1 transaction failure', async (context) => {
  for (const failure of ['before', 'photo', 'after']) {
    const DB = new RegistrationDatabase()
    context.after(() => DB.sqlite.close())
    const env = envWithAdmin(DB)
    const details = { id: 'c0a80123-4567-489a-8abc-000000000003', name: 'Retry Shop', kind: 'shop', location: 'Srinagar' }
    DB.failBatch = failure
    const first = await sendRegistration(env, details)
    assert.equal(first.status, failure === 'after' ? 200 : 503)
    assert.equal(DB.rows.size, failure === 'after' ? 1 : 0)
    assert.equal(DB.photos.size, failure === 'after' ? 1 : 0)
    const retry = await sendRegistration(env, details)
    assert.equal(retry.status, failure === 'after' ? 200 : 201)
    assert.equal(DB.rows.size, 1)
    assert.equal(DB.photos.size, 1)
    const repeated = await sendRegistration(env, details)
    assert.equal(repeated.status, 200)
    assert.equal(DB.photos.size, 1)
  }
})

test('duplicate business identities and conflicting request IDs never create extra photos', async (context) => {
  const DB = new RegistrationDatabase()
  context.after(() => DB.sqlite.close())
  const env = envWithAdmin(DB)
  const details = { id: 'c0a80123-4567-489a-8abc-000000000004', name: 'One Shop', kind: 'shop', location: 'Srinagar' }
  assert.equal((await sendRegistration(env, details)).status, 201)
  assert.equal((await sendRegistration(env, { ...details, name: 'Another Shop' })).status, 409)
  assert.equal((await sendRegistration(env, { ...details, id: 'c0a80123-4567-489a-8abc-000000000005' })).status, 409)
  assert.equal(DB.rows.size, 1)
  assert.equal(DB.photos.size, 1)
})

test('stale business moderation and deletion cannot overwrite a newer status', async (context) => {
  const DB = new RegistrationDatabase()
  context.after(() => DB.sqlite.close())
  const env = envWithAdmin(DB)
  const details = { id: 'c0a80123-4567-489a-8abc-000000000006', name: 'Versioned Shop', kind: 'shop', location: 'Srinagar' }
  await sendRegistration(env, details)
  const cookie = await adminCookie(env)
  const edit = {
    ...details, address: 'Main market, Srinagar', website: '',
    description: 'A locally owned shop with handmade gifts and crafts for visitors.',
    status: 'approved', ownerNote: '', version: 0,
  }
  assert.equal((await onRequest({ request: jsonRequest('/api/businesses', 'PATCH', edit, cookie), env })).status, 200)
  assert.equal((await onRequest({ request: jsonRequest('/api/businesses', 'PATCH', { ...edit, status: 'rejected' }, cookie), env })).status, 409)
  assert.equal((await onRequest({ request: jsonRequest('/api/businesses', 'DELETE', { id: details.id, version: 0 }, cookie), env })).status, 409)
  assert.equal(DB.rows.get(details.id).status, 'approved')
  assert.equal(DB.photos.size, 1)
})

test('publication consent is required and public business website cannot embed private credentials', async (context) => {
  const DB = new RegistrationDatabase()
  context.after(() => DB.sqlite.close())
  const env = envWithAdmin(DB)
  const details = { id: 'c0a80123-4567-489a-8abc-000000000007', name: 'Consent Shop', kind: 'shop', location: 'Srinagar' }
  assert.equal((await sendRegistration(env, { ...details, publicationConsent: false })).status, 400)
  assert.equal((await sendRegistration(env, { ...details, website: 'https://owner:password@example.com' })).status, 400)
  assert.equal(DB.rows.size, 0)
  assert.equal(DB.photos.size, 0)
})

test('business map coordinates are validated, privately preserved, published and explicitly cleared', async (context) => {
  const DB = new RegistrationDatabase()
  context.after(() => DB.sqlite.close())
  const env = envWithAdmin(DB)
  const base = { id: crypto.randomUUID(), name: 'Pinned Restaurant', kind: 'restaurant', location: 'Srinagar' }
  const invalidPins = [
    { latitude: 0 }, { longitude: 0 }, { latitude: null, longitude: 0 },
    { latitude: -91, longitude: 0 }, { latitude: 0, longitude: 181 }, { latitude: '34', longitude: 74 },
  ]
  for (const [index, pin] of invalidPins.entries()) {
    assert.equal((await sendRegistration(env, { ...base, ...pin }, `192.0.2.${index + 1}`)).status, 400)
  }
  const input = { ...base, latitude: 34.123456, longitude: 74.123456 }
  assert.equal((await sendRegistration(env, input)).status, 201)
  assert.equal((await sendRegistration(env, input)).status, 200)
  assert.equal(DB.rows.get(base.id).latitude, input.latitude)
  assert.equal(DB.rows.get(base.id).longitude, input.longitude)
  assert.equal((await (await onRequest({ request: new Request('http://localhost/api/businesses'), env })).json()).total, 0)
  const cookie = await adminCookie(env)
  const admin = (await (await onRequest({ request: new Request('http://localhost/api/businesses?scope=admin', { headers: { Cookie: cookie } }), env })).json()).businesses[0]
  assert.equal(admin.latitude, input.latitude)
  assert.equal(admin.longitude, input.longitude)
  const edit = {
    ...base, address: 'Main market, Srinagar', website: '',
    description: 'A locally owned restaurant serving food for visitors and residents.',
    status: 'approved', ownerNote: '', version: 0,
  }
  const patch = (data) => onRequest({ request: jsonRequest('/api/businesses', 'PATCH', data, cookie), env })
  assert.equal((await patch({ ...edit, latitude: 1 })).status, 400)
  assert.equal((await patch(edit)).status, 200)
  let published = (await (await onRequest({ request: new Request('http://localhost/api/businesses?kind=restaurant&location=Srinagar'), env })).json()).businesses[0]
  assert.equal(published.latitude, input.latitude)
  assert.equal(published.longitude, input.longitude)
  assert.equal(published.contactName, undefined)
  assert.equal(published.contactPhone, undefined)
  assert.equal(published.contactEmail, undefined)
  assert.equal((await patch({ ...edit, version: 1, latitude: 0, longitude: -180 })).status, 200)
  published = (await (await onRequest({ request: new Request('http://localhost/api/businesses'), env })).json()).businesses[0]
  assert.equal(published.latitude, 0)
  assert.equal(published.longitude, -180)
  assert.equal((await patch({ ...edit, version: 2, latitude: null, longitude: null })).status, 200)
  published = (await (await onRequest({ request: new Request('http://localhost/api/businesses'), env })).json()).businesses[0]
  assert.equal(published.latitude, undefined)
  assert.equal(published.longitude, undefined)
  const shop = { id: crypto.randomUUID(), name: 'Pinned Shop', kind: 'shop', location: 'Gulmarg', latitude: -90, longitude: 180 }
  assert.equal((await sendRegistration(env, shop, '192.0.2.111')).status, 201)
  assert.equal(DB.rows.get(shop.id).latitude, -90)
  assert.equal(DB.rows.get(shop.id).longitude, 180)
  assert.throws(() => DB.sqlite.prepare('UPDATE business_registrations SET longitude = 1 WHERE id = ?').run(base.id))
  assert.throws(() => DB.sqlite.prepare('UPDATE business_registrations SET latitude = 0, longitude = 181 WHERE id = ?').run(base.id))
})
