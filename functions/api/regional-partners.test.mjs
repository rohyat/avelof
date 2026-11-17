import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { onRequest as hotels } from './hotels.ts'
import { onRequest as drivers } from './drivers.ts'
import { onRequest as hotelUpdate } from './hotel-update.ts'
import { onRequest as hotelStatus } from './hotel-status.ts'
import { onRequest as enquiries } from './enquiries.ts'
import { onRequest as enquiryAccess } from './enquiry-access.ts'
import { createAdminSession } from '../_lib/enquiryAccess.ts'
import { hotelSubmissionSchema } from '../../src/services/hotelSchema.ts'
import { driverSubmissionSchema } from '../../src/services/driverSchema.ts'
import { listingRegion, regions } from '../../src/data/regions.ts'

const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAf/wAARCAABAAEDASIAAhEBAxEB/9oADAMBAAIRAxEAPwCwAB//2Q==', 'base64')
const origin = 'http://localhost:8791'
class Database {
  sqlite = new DatabaseSync(':memory:')
  constructor() {
    const migrations = new URL('../../migrations/', import.meta.url)
    for (const migration of readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()) this.sqlite.exec(readFileSync(new URL(migration, migrations), 'utf8'))
  }
  prepare(sql) {
    const db = this.sqlite
    let values = []
    return {
      bind(...args) { values = args.map((value) => value instanceof ArrayBuffer ? new Uint8Array(value) : value); return this },
      async first() { return db.prepare(sql).get(...values) ?? null },
      async all() { return { results: db.prepare(sql).all(...values) } },
      async run() { return { meta: { changes: Number(db.prepare(sql).run(...values).changes) } } },
    }
  }
}
const hotelData = (region, location) => ({
  id: crypto.randomUUID(), region, location, name: `${location} Sample Hotel`, contactName: 'Partner Test',
  phone: '9876543210', category: 'Premium', exactLocation: `Main ${location}`,
  description: 'A sample property used only for automated regional registration tests.',
  price: 2000, roomRates: [{ roomType: 'Standard', count: 2, price: 2000 }],
  roomTypes: ['Standard (2 rooms)'], totalRooms: 2, mealPlan: 'Room only', breakfastPrice: 300, dinnerPrice: 400,
  heating: 'Room heaters', hotColdAc: false, amenities: ['Parking'], highlights: ['Mountain views'],
  checkIn: '14:00', checkOut: '11:00', publicationConsent: true, website: '',
})
const driverData = (region, location) => ({
  id: crypto.randomUUID(), region, location, fullName: `${region} Test Driver`, phone: '9876543210',
  age: 30, licenceNumber: 'JK0123456789', vehicleNumber: 'JK01AB-1234',
  vehicleId: 'swift-dzire', seats: 4, publicationConsent: true, website: '',
})
async function send(handler, env, path, method = 'GET', body, cookie) {
  const headers = { Origin: origin, 'CF-Connecting-IP': '192.0.2.111', ...(cookie ? { Cookie: cookie } : {}) }
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json'
  const response = await handler({ request: new Request(`${origin}${path}`, { method, headers, ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}) }), env, waitUntil() {} })
  return { status: response.status, data: await response.json() }
}
function upload(details, auth) {
  const form = new FormData()
  form.append('details', JSON.stringify(details))
  if (auth) { form.append('auth', JSON.stringify(auth)); form.append('retainedPhotos', '[0]') }
  else form.append('photos', new Blob([jpeg], { type: 'image/jpeg' }), 'sample.jpg')
  return form
}

test('regional schemas accept known locations, reject mismatches and infer older records', () => {
  for (const [region, hotelLocation, district] of [['Kashmir', 'Srinagar', 'Srinagar'], ['Jammu', 'Katra', 'Jammu'], ['Ladakh', 'Leh', 'Leh']]) {
    assert.equal(hotelSubmissionSchema.safeParse(hotelData(region, hotelLocation)).success, true)
    assert.equal(driverSubmissionSchema.safeParse(driverData(region, district)).success, true)
    const legacy = hotelData(region, hotelLocation)
    delete legacy.region
    assert.equal(hotelSubmissionSchema.safeParse(legacy).success, true)
    assert.equal(listingRegion(legacy), region)
  }
  assert.equal(hotelSubmissionSchema.safeParse(hotelData('Ladakh', 'Srinagar')).success, false)
  assert.equal(driverSubmissionSchema.safeParse(driverData('Kashmir', 'Leh')).success, false)
})

test('hotel and driver registrations persist region, isolate approved lists, preserve private access and re-review edits', async () => {
  const DB = new Database()
  const env = { DB, ENQUIRY_ACCESS_SECRET: 's'.repeat(40), ENQUIRY_ADMIN_CODE_HASH: 'a'.repeat(64) }
  const cookie = `avelof_admin_local=${await createAdminSession(env)}`
  const savedHotels = []
  const savedDrivers = []
  for (const [index, region] of regions.entries()) {
    const hotel = hotelData(region, region === 'Kashmir' ? 'Srinagar' : region === 'Jammu' ? 'Katra' : 'Leh')
    hotel.phone = `98765432${10 + index}`
    const result = await send(hotels, env, '/api/hotels', 'POST', upload(hotel))
    assert.equal(result.status, 201, JSON.stringify(result.data))
    savedHotels.push({ hotel, receipt: result.data })
    const before = await send(hotels, env, `/api/hotels?region=${region}`)
    assert.equal(before.data.total, 0)
    const approval = await send(hotels, env, '/api/hotels', 'PATCH', { id: hotel.id, version: 0, status: 'approved', price: 2000, ownerNote: '', roomRates: hotel.roomRates }, cookie)
    assert.equal(approval.status, 200, JSON.stringify(approval.data))
    assert.equal(approval.data.hotel.region, region)

    const driver = driverData(region, region === 'Kashmir' ? 'Srinagar' : region === 'Jammu' ? 'Jammu' : 'Leh')
    driver.phone = `98765433${10 + index}`
    const registered = await send(drivers, env, '/api/drivers', 'POST', upload(driver))
    assert.equal(registered.status, 201, JSON.stringify(registered.data))
    savedDrivers.push({ driver, receipt: registered.data })
    const driverApproval = await send(drivers, env, '/api/drivers', 'PATCH', { id: driver.id, version: 0, status: 'approved', ownerNote: '', vehicleNumber: driver.vehicleNumber }, cookie)
    assert.equal(driverApproval.status, 200, JSON.stringify(driverApproval.data))
    const driverLookup = await send(drivers, env, '/api/drivers', 'POST', { identifier: registered.data.driverId, accessCode: registered.data.accessCode })
    assert.equal(driverLookup.data.driver.region, region)
  }
  for (const region of regions) {
    for (const [handler, resource] of [[hotels, 'hotels'], [drivers, 'drivers']]) {
      const listing = await send(handler, env, `/api/${resource}?region=${region}`)
      assert.equal(listing.status, 200, JSON.stringify(listing.data))
      assert.equal(listing.data.total, 1)
      assert.equal(listing.data[resource][0].region, region)
      assert.equal('phone' in listing.data[resource][0], false)
      assert.equal('contactName' in listing.data[resource][0], false)
      assert.equal('licenceNumber' in listing.data[resource][0], false)
    }
  }
  assert.equal((await send(hotels, env, '/api/hotels?scope=admin', 'GET', undefined, cookie)).data.total, 3)
  assert.equal((await send(hotels, env, '/api/hotels?region=Invalid')).status, 400)
  const { hotel, receipt } = savedHotels.find(({ hotel }) => hotel.region === 'Ladakh')
  const lookup = await send(hotelStatus, env, '/api/hotel-status', 'POST', { identifier: receipt.hotelId, accessCode: receipt.accessCode })
  assert.equal(lookup.data.hotel.region, 'Ladakh')
  const updated = { ...hotel, region: 'Jammu', location: 'Katra', exactLocation: 'Main Katra' }
  assert.equal((await send(hotelUpdate, env, '/api/hotel-update', 'POST', upload(updated, { accessCode: receipt.accessCode, version: 1 }))).status, 200)
  assert.equal((await send(hotels, env, '/api/hotels?region=Ladakh')).data.total, 0)
  assert.equal((await send(hotels, env, '/api/hotels?region=Jammu')).data.total, 1, 'Edited hotel stays hidden pending approval')
  assert.equal((await send(hotels, env, '/api/hotels', 'PATCH', { id: hotel.id, version: 2, status: 'approved', price: 2000, ownerNote: '', roomRates: hotel.roomRates }, cookie)).status, 200)
  assert.equal((await send(hotels, env, '/api/hotels?region=Jammu')).data.total, 2)
  DB.sqlite.prepare("UPDATE hotel_registrations SET details_json = json_remove(details_json, '$.region')").run()
  assert.equal((await send(hotels, env, '/api/hotels?region=Jammu')).data.total, 2, 'Older location-only records are classified correctly')
  const driverRecord = savedDrivers.find(({ driver }) => driver.region === 'Ladakh')
  const { id: driverUuid, ...driverEdit } = { ...driverRecord.driver, region: 'Jammu', location: 'Jammu' }
  assert.equal((await send(drivers, env, '/api/drivers', 'POST', upload(driverEdit, { identifier: driverRecord.receipt.driverId, accessCode: driverRecord.receipt.accessCode, version: 1 }))).status, 200)
  assert.equal((await send(drivers, env, '/api/drivers?region=Ladakh')).data.total, 0)
  assert.equal((await send(drivers, env, '/api/drivers?region=Jammu')).data.total, 1)
  assert.equal((await send(drivers, env, '/api/drivers', 'PATCH', { id: driverUuid, version: 2, status: 'approved', ownerNote: '', vehicleNumber: driverEdit.vehicleNumber }, cookie)).status, 200)
  assert.equal((await send(drivers, env, '/api/drivers?region=Jammu')).data.total, 2)

  for (const [handler, resource, referenceColumn] of [[hotels, 'hotels', 'hotel_id'], [drivers, 'drivers', 'driver_id']]) {
    const table = resource === 'hotels' ? 'hotel_registrations' : 'driver_registrations'
    const template = DB.sqlite.prepare(`SELECT * FROM ${table} LIMIT 1`).get()
    const details = { ...JSON.parse(template.details_json), location: 'Leh' }
    delete details.region
    for (let index = 0; index < 30; index++) {
      const row = { ...template, id: crypto.randomUUID(), [referenceColumn]: resource === 'hotels' ? `AVELOF_HTL_${10100 + index}LEH` : `AVELOF-DRV-${10100 + index}`, phone: `987654${1000 + index}`, details_json: JSON.stringify(details) }
      DB.sqlite.prepare(`INSERT INTO ${table} (${Object.keys(row).join(', ')}) VALUES (${Object.keys(row).map(() => '?').join(', ')})`).run(...Object.values(row))
    }
    const first = await send(handler, env, `/api/${resource}?region=Ladakh`)
    const second = await send(handler, env, `/api/${resource}?region=Ladakh&page=2`)
    assert.equal(first.data.total, 30)
    assert.equal(first.data[resource].length, 25)
    assert.equal(second.data.total, 30)
    assert.equal(second.data[resource].length, 5)
    assert.equal(new Set([...first.data[resource], ...second.data[resource]].map(({ id }) => id)).size, 30)
    assert.ok([...first.data[resource], ...second.data[resource]].every((record) => listingRegion(record) === 'Ladakh'))
  }
  DB.sqlite.close()
})

test('regional enquiries persist in D1 and retries return the same saved receipt', async () => {
  const DB = new Database()
  for (const [kind, preference] of [['package', 'Ladakh Essentials'], ['car', 'Ladakh cab or transfer'], ['contact', 'General Ladakh travel enquiry'], ['hotel', 'Test Leh Hotel (AVELOF_HTL_10022LEH)']]) {
    const payload = {
      reference: `AV-${crypto.randomUUID().toUpperCase()}`, kind, website: '',
      fields: { region: 'Ladakh', fullName: 'Regional Guest', phoneNumber: '9876543210', adults: '2', children: '0', packagePreference: preference, customDetails: 'Private requirements must not appear in public lookup.',
        ...(kind === 'package' ? { arrivalDate: '2027-07-10', departureDate: '2027-07-17' } : {}),
        ...(kind === 'car' ? { carRental: preference, startDate: '2027-07-10', endDate: '2027-07-17' } : {}),
        ...(kind === 'hotel' ? { preferredStay: preference, checkInDate: '2027-07-10', checkOutDate: '2027-07-17' } : {}),
      },
    }
    const result = await send(enquiries, { DB }, '/api/enquiries', 'POST', payload)
    assert.equal(result.status, 201, JSON.stringify(result.data))
    assert.equal(result.data.saved, true)
    const stored = JSON.parse(DB.sqlite.prepare('SELECT fields_json FROM enquiries WHERE reference = ?').get(payload.reference).fields_json)
    assert.equal(stored.region, 'Ladakh')
    assert.equal(stored.packagePreference, preference)
    const retry = await send(enquiries, { DB }, '/api/enquiries', 'POST', payload)
    assert.equal(retry.status, 200)
    assert.equal(retry.data.reference, result.data.reference)
    const lookup = await send(enquiryAccess, { DB, ENQUIRY_ACCESS_SECRET: 's'.repeat(40) }, '/api/enquiry-access', 'POST', { action: 'booking-summary', reference: result.data.reference })
    assert.equal(lookup.status, 200, JSON.stringify(lookup.data))
    if (kind !== 'hotel') assert.equal(lookup.data.booking.bookingDetails.name, preference)
    assert.equal(JSON.stringify(lookup.data).includes('Private requirements'), false)
  }
  DB.sqlite.close()
})
