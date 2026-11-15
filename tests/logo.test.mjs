import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'

test('Chinar logo renders in header and footer with working browser and app icons', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage()
  try {
    await page.goto(process.env.AVELOF_ACTIVITY_TEST_URL || 'http://localhost:8791')
    assert.equal(await page.locator('.brand-logo').count(), 2)
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      for (const logo of await page.locator('.brand-logo').all()) {
        assert.ok(await logo.evaluate((image) => image.complete && image.naturalWidth === 512))
        const bounds = await logo.boundingBox()
        assert.ok(bounds.width >= 40 && bounds.height >= 40)
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    }
    for (const file of ['app-icon-192.png', 'app-icon-512.png', 'apple-touch-icon.png']) {
      const response = await page.request.get(`${new URL(page.url()).origin}/${file}`)
      assert.equal(response.status(), 200)
      assert.ok(response.headers()['content-type'].includes('image/png'))
    }
    await page.locator('.site-header .brand').click()
    assert.equal(new URL(page.url()).pathname, '/')
  } finally { await browser.close() }
})
