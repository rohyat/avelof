import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'

const origin = process.env.AVELOF_HOTEL_TEST_URL || 'http://127.0.0.1:8792'
const hotel = {
  id: '00000000-0000-4000-8000-000000000001', hotelId: 'AVELOF_HTL_10001SRG',
  name: 'Alpine Hotel', location: 'Srinagar', category: 'Premium',
  description: 'Comfortable hotel for a Kashmir holiday.', price: 2000,
  roomRates: [{ roomType: 'Family', count: 2, price: 2000 }],
  roomTypes: ['Family (2 rooms)'], totalRooms: 2, mealPlan: 'Room only',
  heating: 'Room heaters', amenities: ['Wi-Fi'], highlights: ['Near the market'],
  checkIn: '14:00', checkOut: '11:00', breakfastPrice: 200, dinnerPrice: 400,
  photos: ['/api/hotel-images/00000000-0000-4000-8000-000000000001/0'],
}

test('hotel, vehicle and package cards match the compact hotel height without clipping actions', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  await page.route('**/api/pricing*', (route) => route.fulfill({ json: { discountPercent: 23, version: 1 } }))
  await page.route('**/api/hotels*', (route) => route.fulfill({ json: { hotels: [hotel], total: 1, page: 1, pageSize: 25 } }))
  try {
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      const heights = []
      for (const [path, selector] of [['/hotels', '.hotel-card'], ['/car-rentals', '.vehicle-card'], ['/tour-packages', '.package-card']]) {
        await page.goto(`${origin}${path}`)
        const cards = page.locator(selector)
        await cards.first().waitFor()
        const measurements = await cards.evaluateAll((elements) => elements.map((card) => {
          const box = card.getBoundingClientRect()
          const controls = [...card.querySelectorAll('.catalog-bottom button, .catalog-bottom a, .vehicle-seat-select select')]
          return {
            height: box.height,
            controlsFit: controls.every((control) => {
              const rect = control.getBoundingClientRect()
              return rect.width > 0 && rect.height >= 36 && rect.left >= box.left && rect.right <= box.right && rect.top >= box.top && rect.bottom <= box.bottom
            }),
          }
        }))
        assert.ok(measurements.length > 0)
        assert.ok(measurements.every(({ controlsFit }) => controlsFit), `${path} controls fit at ${width}px`)
        heights.push(...measurements.map(({ height }) => height))
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      }
      assert.ok(heights.every((height) => Math.abs(height - 464) < 1), `Card heights at ${width}px: ${heights.join(', ')}`)
    }
  } finally { await browser.close() }
})
