import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'

test('one extra bed adds half the base two-person price of each selected meal, including Family rooms', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage()
  try {
  await page.goto(process.env.AVELOF_HOTEL_TEST_URL || 'http://127.0.0.1:8792')
  const results = await page.evaluate(async () => {
  const { hotelExtraBedTotal, hotelNightlyPrice } = await import('/src/services/hotelService.ts')
  const hotel = {
    price: 2000, roomOnlyPrice: 2000, extraBedPrice: 800, breakfastPrice: 200, dinnerPrice: 400,
    roomRates: [{ roomType: 'Family', count: 1, price: 2000 }, { roomType: 'Deluxe', count: 1, price: 3000 }],
  }
  const results = []
  for (const [breakfast, dinner, extra] of [[false, false, 800], [true, false, 900], [false, true, 1000], [true, true, 1100]]) {
    results.push([hotelExtraBedTotal(hotel, breakfast, dinner), extra])
    for (const [roomType, rate, multiplier] of [['Deluxe', 3000, 1], ['Family', 2000, 2]]) {
      const meals = (breakfast ? 200 : 0) * multiplier + (dinner ? 400 : 0) * multiplier
      results.push([hotelNightlyPrice(hotel, breakfast, dinner, roomType, undefined, true), rate + meals + extra])
      results.push([hotelNightlyPrice(hotel, breakfast, dinner, roomType, '2026-12-06', true), Math.round(rate * 1.1) + meals + extra])
      results.push([hotelNightlyPrice(hotel, breakfast, dinner, roomType), rate + meals])
    }
  }
  results.push([hotelExtraBedTotal({ ...hotel, extraBedPrice: 0 }, true, true), 0])
  results.push([hotelNightlyPrice({ ...hotel, extraBedPrice: 0 }, true, true, 'Deluxe', undefined, true), 3600])
  results.push([hotelExtraBedTotal({ ...hotel, breakfastPrice: 201.01, dinnerPrice: 399.03 }, true, true), 1100.02])
  return results
  })
  for (const [actual, expected] of results) assert.equal(actual, expected)
  } finally { await browser.close() }
})
