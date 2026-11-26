import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { amenitiesFor, highlightOptionsFor } from '../src/data/hotelRegistration.ts'
import { hotelSubmissionSchema, publicHotelSchema } from '../src/services/hotelSchema.ts'

const basics = ['Private attached bathroom', 'Shower', 'Towels', 'Toiletries']
const comforts = ['Bathtub', 'Hair dryer', 'Electric kettle', 'Tea/coffee maker', 'Tea & coffee supplies']
const id = '00000000-0000-4000-8000-000000000001'
const details = {
  id, name: 'Comfort Hotel', location: 'Srinagar', category: 'Premium',
  description: 'A comfortable hotel with private bathrooms and tea facilities.',
  price: 2000, roomTypes: ['Deluxe (2 rooms)'], roomRates: [{ roomType: 'Deluxe', count: 2, price: 2000 }],
  totalRooms: 2, mealPlan: 'Room only', heating: 'Room heaters', amenities: [...basics, ...comforts, 'On-site cafe'],
  highlights: ['Private attached bathrooms', 'In-room tea & coffee facilities', 'On-site cafe'],
  checkIn: '14:00', checkOut: '11:00',
}

test('bathroom and coffee options validate for registration and public listings without dropping historical amenities', () => {
  for (const type of ['Hotel', 'Houseboat']) {
    for (const amenity of comforts) assert.ok(amenitiesFor(type).includes(amenity))
    for (const amenity of basics) assert.ok(!amenitiesFor(type).includes(amenity))
    for (const highlight of details.highlights.slice(0, 2)) assert.ok(highlightOptionsFor(type).includes(highlight))
  }
  assert.ok(amenitiesFor('Hotel').includes('On-site cafe'))
  assert.ok(!amenitiesFor('Houseboat').includes('On-site cafe'))
  assert.ok(!amenitiesFor('Hotel').includes('Shikara pick-up & drop'))
  assert.ok(hotelSubmissionSchema.safeParse({ ...details, contactName: 'Owner', phone: '9876543210', publicationConsent: true }).success)
  assert.ok(publicHotelSchema.safeParse({ ...details, hotelId: 'AVELOF_HTL_10001SRG', photos: [`/api/hotel-images/${id}/0`] }).success)
})

test('new amenities are optional selectable icon choices and appear on the public hotel detail page', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  const origin = process.env.AVELOF_HOTEL_TEST_URL || 'http://127.0.0.1:8792'
  await page.route('**/api/pricing*', (route) => route.fulfill({ json: { discountPercent: 23, version: 1 } }))
  await page.route('**/api/hotels*', (route) => route.fulfill({ json: {
    hotels: [{ ...details, hotelId: 'AVELOF_HTL_10001SRG', photos: [`/api/hotel-images/${id}/0`] }],
    total: 1, page: 1, pageSize: 25,
  } }))
  await page.route('**/api/hotel-images/**', (route) => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"/>' }))
  try {
    for (const width of [320, 390, 820, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`${origin}/register-hotel`)
      const amenities = page.locator('.hotel-amenity-options')
      assert.match(await page.locator('.registration-extra-bed').innerText(), /Enter the charge without meals\./)
      for (const label of basics) assert.equal(await amenities.getByRole('checkbox', { name: label, exact: true }).count(), 0)
      assert.equal(await page.locator('.hotel-highlights').getByRole('checkbox', { name: 'Private attached bathrooms', exact: true }).count(), 1)
      for (const label of [...comforts, 'On-site cafe']) {
        const checkbox = amenities.getByRole('checkbox', { name: label, exact: true })
        assert.equal(await checkbox.isChecked(), false)
        await checkbox.check()
        assert.equal(await checkbox.isChecked(), true)
        assert.equal(await checkbox.locator('..').locator('svg').count(), 1)
      }
      await page.getByLabel('Houseboat', { exact: true }).check()
      assert.equal(await amenities.getByRole('checkbox', { name: 'On-site cafe', exact: true }).count(), 0)
      for (const label of basics) assert.equal(await amenities.getByRole('checkbox', { name: label, exact: true }).count(), 0)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      await page.goto(`${origin}/hotels/${id}`)
      const features = page.locator('.detail-section').filter({ has: page.getByRole('heading', { name: 'Make yourself at home.', exact: true }) }).locator('.hotel-detail-features')
      await features.waitFor()
      for (const label of [...basics, ...comforts, 'On-site cafe']) {
        const feature = features.locator('li').filter({ has: page.getByText(label, { exact: true }) })
        assert.equal(await feature.count(), 1)
        assert.equal(await feature.locator('svg').count(), 1)
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    }
  } finally { await browser.close() }
})
