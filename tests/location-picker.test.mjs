import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { googleMapsLocationUrl, locationFields, mapCoordinates } from '../src/services/mapLocation.ts'

const origin = process.env.AVELOF_MAP_TEST_URL || 'http://localhost:8791'
const tile = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')

test('map links use exact finite coordinates and explicit clearing fields', () => {
  assert.deepEqual(mapCoordinates({ latitude: 0, longitude: 0 }), { latitude: 0, longitude: 0 })
  for (const value of [{ latitude: 91, longitude: 74 }, { latitude: 34 }, { latitude: null, longitude: null }, { latitude: NaN, longitude: 74 }]) assert.equal(mapCoordinates(value), undefined)
  assert.deepEqual(locationFields(undefined), { latitude: null, longitude: null })
  assert.equal(new URL(googleMapsLocationUrl({ latitude: 34.1234567, longitude: 74.7654321 })).searchParams.get('query'), '34.1234567,74.7654321')
})

test('hotel, restaurant and shop map picker supports touch, GPS, denial, keyboard coordinates and clearing under production CSP', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, geolocation: { latitude: 34.0837123, longitude: 74.7973456, accuracy: 8 }, permissions: ['geolocation'] })
  const page = await context.newPage()
  const tileRequests = []
  await page.route('https://tile.openstreetmap.org/**', (route) => { tileRequests.push(route.request()); return route.fulfill({ contentType: 'image/png', body: tile }) })
  await page.addInitScript(() => {
    globalThis.mapCspViolations = []
    document.addEventListener('securitypolicyviolation', (event) => {
      globalThis.mapCspViolations.push(`${event.violatedDirective}: ${event.blockedURI}`)
    })
  })
  try {
    for (const path of ['/register-hotel', '/register-business']) {
      await page.goto(`${origin}${path}`)
      const picker = page.locator('.location-picker')
      assert.equal(await picker.locator('.leaflet-container').count(), 0)
      const before = tileRequests.length
      await picker.getByRole('button', { name: 'Open map to choose a pin' }).click()
      await picker.locator('.leaflet-tile-loaded').first().waitFor()
      assert.ok(tileRequests.length > before)
      assert.equal(new URL(tileRequests.at(-1).headers().referer).origin, new URL(origin).origin)
      assert.equal(await picker.getByText('No exact pin saved yet.', { exact: true }).count(), 1)
      await picker.getByRole('button', { name: 'Use my current location', exact: true }).click()
      await picker.getByText(/Device-reported accuracy: approximately 8 metres/).waitFor()
      assert.equal(Number(await picker.getByLabel('Pin latitude', { exact: true }).inputValue()), 34.0837123)
      await picker.getByRole('button', { name: 'Confirm pin', exact: true }).click()
      let mapsLink = picker.getByRole('link', { name: 'Check on Google Maps' })
      assert.equal(new URL(await mapsLink.getAttribute('href')).searchParams.get('query'), '34.0837123,74.7973456')
      await picker.locator('.location-map').tap({ position: { x: 120, y: 170 } })
      assert.notEqual(Number(await picker.getByLabel('Pin longitude', { exact: true }).inputValue()), 74.7973456)
      assert.equal(new URL(await mapsLink.getAttribute('href')).searchParams.get('query'), '34.0837123,74.7973456', 'Map taps are previews until explicitly confirmed')
      await picker.getByLabel('Pin latitude', { exact: true }).fill('34.1111111')
      await picker.getByLabel('Pin longitude', { exact: true }).fill('74.2222222')
      await picker.getByRole('button', { name: 'Confirm pin', exact: true }).click()
      assert.equal(new URL(await mapsLink.getAttribute('href')).searchParams.get('query'), '34.1111111,74.2222222')
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${path} should fit at ${width}px`)
      }
      await picker.getByRole('button', { name: 'Close map', exact: true }).click()
      await picker.getByRole('button', { name: 'Open map to choose a pin' }).click()
      await picker.locator('.leaflet-tile-loaded').first().waitFor()
      assert.equal(await picker.getByLabel('Pin latitude', { exact: true }).inputValue(), '34.1111111')
      await picker.getByRole('button', { name: 'Remove saved pin' }).click()
      assert.equal(await mapsLink.count(), 0)
      await picker.getByRole('button', { name: 'Confirm pin', exact: true }).click()
      await picker.getByRole('alert').filter({ hasText: 'Enter both valid coordinates' }).waitFor()
      assert.deepEqual(await page.evaluate(() => globalThis.mapCspViolations), [])
      if (path === '/register-business') {
        await page.locator('[name=kind]').selectOption('shop')
        await picker.getByLabel('Pin latitude', { exact: true }).fill('34.5')
        await picker.getByLabel('Pin longitude', { exact: true }).fill('75.5')
        await picker.getByRole('button', { name: 'Confirm pin', exact: true }).click()
        assert.equal(new URL(await mapsLink.getAttribute('href')).searchParams.get('query'), '34.5,75.5')
      }
    }
    await context.clearPermissions()
    await page.evaluate(() => { navigator.geolocation.getCurrentPosition = (_success, error) => error({ code: 1 }) })
    await page.locator('.location-picker').getByRole('button', { name: 'Use my current location', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'Location permission was denied' }).waitFor()
    await page.route('https://tile.openstreetmap.org/**', (route) => route.abort())
    await page.goto(`${origin}/register-business`)
    await page.getByRole('button', { name: 'Open map to choose a pin' }).click()
    await page.getByRole('alert').filter({ hasText: 'Map tiles could not load' }).waitFor()
    await page.getByLabel('Pin latitude', { exact: true }).fill('34.1')
    await page.getByLabel('Pin longitude', { exact: true }).fill('74.9')
    await page.getByRole('button', { name: 'Confirm pin', exact: true }).click()
    assert.ok(await page.getByRole('link', { name: 'Check on Google Maps' }).isVisible())
  } finally { await browser.close() }
})
