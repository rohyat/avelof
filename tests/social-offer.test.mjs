import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { business } from '../src/config.ts'

const origin = process.env.AVELOF_HOTEL_TEST_URL || 'http://127.0.0.1:8792'

test('extra 3% offer shows plain text with direct Instagram and Facebook links and no popup', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage()
  await page.route('**/api/pricing', (route) => route.fulfill({ json: { discountPercent: 23, version: 1 } }))
  await page.route('**/api/hotels*', (route) => route.fulfill({ json: { hotels: [], total: 0, page: 1, pageSize: 25 } }))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  try {
    for (const width of [320, 390, 600, 768, 800, 820, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`${origin}/tour-packages`)
      const offer = page.locator('.offer-social')
      assert.match(await offer.textContent(), /Get extra 3% offFollow us on .*Instagram.*Facebook/)
      assert.doesNotMatch(await offer.textContent(), /4%/)
      assert.equal(await offer.locator('details, summary, button').count(), 0, 'Offer has no expandable popup')
      assert.equal(await offer.locator('.offer-social-title').evaluate((element) => element.closest('a, button')), null, 'Offer title is not clickable')
      assert.equal(await offer.locator('.offer-social-icon').count(), 2)
      const links = offer.getByRole('link')
      assert.equal(await links.count(), 2)
      for (const [name, url] of [['Instagram', business.instagram], ['Facebook', business.facebook]]) {
        const link = offer.getByRole('link', { name: new RegExp(name) })
        assert.equal(await link.getAttribute('href'), url)
        assert.equal(await link.getAttribute('target'), '_blank')
        assert.equal(await link.getAttribute('rel'), 'noopener noreferrer')
      }
      const carousel = await page.locator('.offer-carousel').boundingBox()
      const offerBox = await offer.boundingBox()
      const title = await offer.locator('.offer-social-title').boundingBox()
      if (width <= 800) {
        const dots = await page.locator('.offer-controls').boundingBox()
        assert.ok(offerBox.y >= dots.y + dots.height)
        assert.ok(Math.abs(title.x + title.width / 2 - width / 2) < 1, 'Extra offer is centred below the carousel')
      } else {
        assert.ok(title.x + title.width <= carousel.x, 'Desktop extra offer stays beside the carousel')
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    }
  } finally { await browser.close() }
})
