import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { googleMapsLocationUrl, locationFields, mapCoordinates } from '../src/services/mapLocation.ts'

const origin = process.env.AVELOF_MAP_TEST_URL || 'http://localhost:8791'

test('existing map links use exact finite coordinates and explicit clearing fields', () => {
  assert.deepEqual(mapCoordinates({ latitude: 0, longitude: 0 }), { latitude: 0, longitude: 0 })
  for (const value of [{ latitude: 91, longitude: 74 }, { latitude: 34 }, { latitude: null, longitude: null }, { latitude: NaN, longitude: 74 }]) assert.equal(mapCoordinates(value), undefined)
  assert.deepEqual(locationFields(undefined), { latitude: null, longitude: null })
  assert.equal(new URL(googleMapsLocationUrl({ latitude: 34.1234567, longitude: 74.7654321 })).searchParams.get('query'), '34.1234567,74.7654321')
})

test('hotel and business registration no longer offer a map pin selector', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  try {
    for (const path of ['/register-hotel', '/register-business']) {
      await page.goto(`${origin}${path}`)
      assert.equal(await page.locator('.location-picker').count(), 0)
      assert.equal(await page.getByRole('button', { name: /map.*pin/i }).count(), 0)
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      }
    }
  } finally { await browser.close() }
})
