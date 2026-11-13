import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { validHotelJpeg } from '../functions/_lib/hotelRegistration.ts'
import { hotelPhotoLimit } from '../src/data/hotelRegistration.ts'

const origin = process.env.AVELOF_HOTEL_TEST_URL || 'http://localhost:8792'
const id = '00000000-0000-4000-8000-000000000001'
const hotelId = `AVELOF_HTL_${id.replaceAll('-', '').toUpperCase()}`
const accessCode = 'VALL3210'
const hotel = {
  id, hotelId, name: 'Valley Partner Hotel', contactName: 'Private Partner', phone: '9876543210',
  location: 'Gulmarg', category: 'Premium', description: 'A mountain hotel with comfortable rooms and local hospitality.',
  price: 4500, submittedPrice: 5000, mealPlan: 'Breakfast included', taxDetails: 'Taxes included',
  heating: 'Centralised heating', amenities: ['Wi-Fi', 'Parking'], highlights: ['Mountain views', 'Near the market'],
  roomTypes: ['Standard (2 rooms)', 'Deluxe (3 rooms)', 'Family (4 rooms)', 'Suite (3 rooms)'], checkIn: '14:00', checkOut: '11:00', totalRooms: 12,
  photos: [`/api/hotel-images/${id}/0`], status: 'pending', version: 0, ownerNote: 'Thank you for registering.',
  createdAt: '2026-11-13T10:00:00Z', updatedAt: '2026-11-13T10:00:00Z',
}
const list = (hotels) => ({ hotels, total: hotels.length, page: 1, pageSize: 25 })
const publicHotel = () => {
  const { contactName, phone, submittedPrice, status, version, ownerNote, createdAt, updatedAt, ...publicDetails } = hotel
  void contactName; void phone; void submittedPrice; void status; void version; void ownerNote; void createdAt; void updatedAt
  return publicDetails
}
async function makePhoto(page) {
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 2000; canvas.height = 1400
    const context = canvas.getContext('2d')
    const gradient = context.createLinearGradient(0, 0, 2000, 1400)
    gradient.addColorStop(0, '#305746'); gradient.addColorStop(1, '#e6cb92')
    context.fillStyle = gradient; context.fillRect(0, 0, 2000, 1400)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  return { name: 'hotel.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') }
}
async function fillRegistration(page) {
  await page.getByLabel('Hotel name', { exact: true }).fill(hotel.name)
  await page.getByLabel("Contact person's name (private)").fill(hotel.contactName)
  await page.getByLabel('Phone number (private)').fill(hotel.phone)
  await page.getByLabel('Location').selectOption(hotel.location)
  await page.getByLabel('AVELOF category').selectOption(hotel.category)
  for (const roomType of ['Standard', 'Deluxe', 'Premium', 'Family', 'Suite']) {
    const input = page.getByLabel(`${roomType} rooms`, { exact: true })
    assert.equal(await input.inputValue(), '1')
  }
  await page.getByRole('button', { name: 'Increase Standard rooms', exact: true }).click()
  assert.equal(await page.getByLabel('Standard rooms', { exact: true }).inputValue(), '2')
  for (const [roomType, count] of [['Standard', 2], ['Deluxe', 3], ['Premium', 0], ['Family', 4], ['Suite', 3]]) {
    await page.getByLabel(`${roomType} rooms`, { exact: true }).fill(String(count))
  }
  assert.equal(await page.locator('.hotel-amenity-options').getByLabel('Family rooms', { exact: true }).count(), 0)
  assert.equal(await page.getByLabel('Room-only price (INR)', { exact: true }).inputValue(), '2000')
  await page.getByLabel('Room-only price (INR)', { exact: true }).fill(String(hotel.submittedPrice))
  assert.equal(await page.getByLabel('Breakfast add-on (INR)', { exact: true }).inputValue(), '500')
  await page.getByRole('button', { name: 'Increase Breakfast add-on (INR)', exact: true }).click()
  await page.getByRole('button', { name: 'Decrease Dinner add-on (INR)', exact: true }).click()
  await page.getByLabel('Room-only price (INR)', { exact: true }).pressSequentially('abc')
  assert.equal(await page.getByLabel('Room-only price (INR)', { exact: true }).inputValue(), String(hotel.submittedPrice))
  await page.getByLabel('Heating system').selectOption(hotel.heating)
  await page.getByLabel('Wi-Fi', { exact: true }).check()
  await page.getByLabel('Mountain views', { exact: true }).check()
  await page.getByLabel('Near the market', { exact: true }).check()
  await page.locator('[name="publicationConsent"]').check()
}

test('hotel registration, private lookup and moderation integrate with public stays', async (context) => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    await context.test('registration preserves higher resolution for five photos and confirms only successful persistence', async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
      let saved
      let fail = true
      await page.route('**/api/hotels*', async (route) => {
        if (route.request().method() !== 'POST') return route.fulfill({ json: list([]) })
        const form = await new Response(route.request().postDataBuffer(), { headers: { 'Content-Type': route.request().headers()['content-type'] } }).formData()
        saved = JSON.parse(form.get('details'))
        const photos = form.getAll('photos')
        assert.equal(photos.length, 5)
        for (const photo of photos) {
          assert.equal(photo.type, 'image/jpeg')
          assert.ok(photo.size <= hotelPhotoLimit)
          const bytes = new Uint8Array(await photo.arrayBuffer())
          assert.equal(validHotelJpeg(bytes), true)
          const buffer = Buffer.from(bytes)
          const frame = buffer.indexOf(Buffer.from([0xff, 0xc0]))
          assert.ok(frame > 0)
          assert.equal(buffer.readUInt16BE(frame + 5), 1344)
          assert.equal(buffer.readUInt16BE(frame + 7), 1920)
        }
        return route.fulfill({ status: fail ? 503 : 201, json: fail ? { error: 'Photo storage is unavailable.' } : { saved: true, id: saved.id, hotelId: `AVELOF_HTL_${saved.id.replaceAll('-', '').toUpperCase()}`, status: 'pending', accessCode } })
      })
      try {
        await page.goto(`${origin}/register-hotel`)
        await fillRegistration(page)
        const photo = await makePhoto(page)
        await page.getByLabel('Hotel photos (1-5 required)').setInputFiles(Array.from({ length: 5 }, (_, index) => ({ ...photo, name: `hotel-${index}.png` })))
        await page.locator('.hotel-photo-grid img').nth(4).waitFor()
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
        await page.getByRole('button', { name: 'Submit hotel for approval' }).click()
        await page.getByRole('alert').filter({ hasText: 'Photo storage is unavailable.' }).waitFor()
        assert.equal(await page.getByRole('heading', { name: 'Your hotel registration has been saved.' }).count(), 0)
        const originalId = saved.id
        fail = false
        await page.getByRole('button', { name: 'Submit hotel for approval' }).click()
        await page.getByRole('heading', { name: 'Your hotel registration has been saved.' }).waitFor()
        assert.equal(saved.id, originalId)
        assert.equal(saved.phone, hotel.phone)
        assert.equal(saved.category, 'Premium')
        assert.equal(saved.heating, 'Centralised heating')
        assert.equal(saved.mealPlan, 'Room only')
        assert.equal(saved.breakfastPrice, 550)
        assert.equal(saved.dinnerPrice, 450)
        assert.equal(saved.totalRooms, hotel.totalRooms)
        assert.deepEqual(saved.roomTypes, hotel.roomTypes)
        assert.equal(saved.description, 'Premium accommodation in Gulmarg.')
        assert.deepEqual(saved.highlights, hotel.highlights)
        assert.ok((await page.locator('.hotel-receipt').innerText()).includes(accessCode))
        assert.ok((await page.locator('.review-ready').innerText()).includes('Awaiting approval'))
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      } finally { await page.close() }
    })
    await context.test('invalid photo counts report an error and prevent submission', async () => {
      const page = await browser.newPage()
      try {
        await page.goto(`${origin}/register-hotel`)
        const photo = await makePhoto(page)
        await page.getByLabel('Hotel photos (1-5 required)').setInputFiles(Array.from({ length: 6 }, (_, index) => ({ ...photo, name: `hotel-${index}.png` })))
        await page.getByRole('alert').filter({ hasText: 'between one and five' }).waitFor()
        assert.equal(await page.getByRole('button', { name: 'Submit hotel for approval' }).isEnabled(), false)
        await page.getByLabel('Hotel photos (1-5 required)').setInputFiles(photo)
        await page.locator('.hotel-photo-grid img').waitFor()
        assert.equal(await page.getByRole('button', { name: 'Submit hotel for approval' }).isEnabled(), true)
      } finally { await page.close() }
    })
    await context.test('status lookup sends the code in the body and excludes private hotel details', async () => {
      const page = await browser.newPage()
      let requested
      await page.route('**/api/hotel-status', (route) => {
        requested = route.request()
        const { photos, contactName, phone, submittedPrice, version, ownerNote, createdAt, updatedAt, ...statusHotel } = hotel
        void photos; void contactName; void phone; void submittedPrice; void version; void ownerNote; void createdAt; void updatedAt
        return route.fulfill({ json: { hotel: { ...statusHotel, status: 'rejected' } } })
      })
      try {
        await page.goto(`${origin}/hotel-status`)
        await page.getByLabel('Hotel ID or phone number').fill(hotel.phone)
        await page.getByLabel('Status access code').fill(accessCode)
        await page.getByRole('button', { name: 'Check status' }).click()
        await page.getByRole('region', { name: 'Hotel submission status' }).waitFor()
        assert.deepEqual(requested.postDataJSON(), { identifier: hotel.phone, accessCode })
        assert.equal(requested.url().includes(accessCode), false)
        assert.equal(page.url().includes(accessCode), false)
        assert.equal((await page.locator('.hotel-owner-status').innerText()).includes(hotel.phone), false)
        assert.equal((await page.locator('.hotel-owner-status').innerText()).includes(hotel.contactName), false)
      } finally { await page.close() }
    })
    await context.test('owner can review photos, edit the price and approve a hotel', async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
      let update, deletion
      let current = hotel
      await page.route('**/api/hotels*', (route) => {
        if (route.request().method() === 'DELETE') {
          deletion = route.request().postDataJSON()
          current = null
          return route.fulfill({ json: { deleted: true, id } })
        }
        if (route.request().method() === 'PATCH') {
          update = route.request().postDataJSON()
          current = { ...hotel, ...update, version: 1 }
          return route.fulfill({ json: { hotel: current } })
        }
        return route.fulfill({ json: list(current ? [current] : []) })
      })
      await page.route('**/api/push*', (route) => route.fulfill({ status: 503, json: { error: 'Push is not configured.' } }))
      try {
        await page.goto(`${origin}/admin/panel/hotels`)
        await page.getByRole('heading', { name: hotel.name }).waitFor()
        assert.equal(await page.locator('.hotel-photo-grid img').count(), 1)
        await page.getByLabel('Reviewed price (INR)', { exact: true }).fill('3900.25')
        await page.getByLabel('Listing status').selectOption('approved')
        await page.getByLabel('Note to hotel owner').fill('Approved at the agreed rate.')
        await page.getByRole('button', { name: 'Save price and status' }).click()
        await page.getByRole('status').filter({ hasText: 'Hotel price and status saved.' }).waitFor()
        assert.deepEqual(update, { id, version: 0, status: 'approved', price: 3900.25, ownerNote: 'Approved at the agreed rate.' })
        page.once('dialog', (dialog) => dialog.accept())
        await page.getByRole('button', { name: 'Delete hotel registration' }).click()
        await page.getByRole('status').filter({ hasText: 'Hotel registration permanently deleted.' }).waitFor()
        assert.deepEqual(deletion, { id, version: 1 })
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      } finally { await page.close() }
    })
    await context.test('approved hotels appear with highlights, real photos and the correct booking rate', async () => {
      const page = await browser.newPage()
      const photos = [0, 1, 2].map((index) => `/api/hotel-images/${id}/${index}`)
      await page.route('**/api/hotels*', (route) => route.fulfill({ json: list([{ ...publicHotel(), photos }]) }))
      try {
        await page.goto(`${origin}/hotels`)
        const card = page.locator('.catalog-card').filter({ hasText: hotel.name })
        await card.waitFor()
        const cardPhotos = card.getByRole('region', { name: `${hotel.name} hotel photos` })
        assert.equal(await cardPhotos.getAttribute('data-photo-count'), '3')
        await page.waitForFunction(({ hotelIdValue, hotelName }) => document.querySelector(`[aria-label="${hotelName} hotel photos"] img`)?.getAttribute('src') === `/api/hotel-images/${hotelIdValue}/1`, { hotelIdValue: id, hotelName: hotel.name })
        assert.ok((await card.innerText()).includes('Mountain views'))
        assert.ok((await card.innerText()).includes('Hotel-provided photo'))
        assert.equal((await card.innerText()).includes(hotel.phone), false)
        assert.equal((await card.innerText()).includes('Before offer'), false)
        await card.getByRole('link', { name: hotel.name, exact: true }).click()
        await page.getByRole('heading', { name: hotel.name, exact: true }).waitFor()
        assert.equal(await page.getByRole('region', { name: `${hotel.name} hotel photos` }).getAttribute('data-photo-count'), '3')
        assert.ok((await page.locator('.detail-aside').innerText()).includes('Breakfast included'))
        await page.locator('.detail-heading').getByRole('button', { name: 'Book Now' }).click()
        await page.locator('.selected-hotel-field').waitFor()
        assert.equal(await page.locator('[name="preferredStay"]').inputValue(), `${hotel.name} (${hotelId})`)
        assert.ok((await page.locator('.enquiry-form .hotel-rates').innerText()).includes('4,500'))
        assert.ok((await page.locator('.enquiry-form .hotel-rates').innerText()).includes('Taxes included'))
      } finally { await page.close() }
    })
  } finally { await browser.close() }
})
