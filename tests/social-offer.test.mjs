import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { business } from '../src/config.ts'

const origin = process.env.AVELOF_HOTEL_TEST_URL || 'http://127.0.0.1:8792'

test('extra package offer opens both social links and requires manual verification without changing prices', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage()
  await page.route('**/api/pricing', (route) => route.fulfill({ json: { discountPercent: 23, version: 1 } }))
  await page.route('**/api/hotels*', (route) => route.fulfill({ json: { hotels: [], total: 0, page: 1, pageSize: 25 } }))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  try {
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`${origin}/tour-packages`)
      const offer = page.locator('.offer-social')
      const panel = offer.locator('.offer-social-panel')
      const prices = await page.locator('.catalog-card .price').allTextContents()
      assert.equal(await panel.isVisible(), false)
      const trigger = offer.locator('summary')
      assert.match(await trigger.textContent(), /Get extra 3% offFollow us on .*Instagram.*Facebook/)
      assert.equal(await trigger.locator('.offer-social-icon').count(), 2)
      assert.equal(await trigger.locator('.offer-social-follow').isVisible(), true)
      await trigger.focus()
      await page.keyboard.press('Enter')
      assert.equal(await panel.isVisible(), true)
      for (const [name, url] of [['Instagram', business.instagram], ['Facebook', business.facebook]]) {
        const link = panel.getByRole('link', { name: new RegExp(`Follow on ${name}`) })
        assert.equal(await link.getAttribute('href'), url)
        assert.equal(await link.getAttribute('target'), '_blank')
        assert.equal(await link.getAttribute('rel'), 'noopener noreferrer')
      }
      assert.match(await panel.textContent(), /Follow AVELOF on Instagram and Facebook/)
      assert.match(await panel.textContent(), /extra 3% off tour packages/)
      assert.doesNotMatch(await offer.textContent(), /4%/)
      assert.match(await panel.textContent(), /verify your eligibility/)
      assert.match(await panel.textContent(), /not applied automatically/)
      assert.deepEqual(await page.locator('.catalog-card .price').allTextContents(), prices)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      const box = await panel.boundingBox()
      assert.ok(box.x >= 0 && box.x + box.width <= width)
      await page.getByRole('switch', { name: 'Dark mode', exact: true }).click()
      assert.equal(await panel.evaluate((element) => getComputedStyle(element).backgroundColor), 'rgb(16, 45, 70)')
      await trigger.click()
      assert.equal(await panel.isVisible(), false)
    }
  } finally { await browser.close() }
})
