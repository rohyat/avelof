import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'

const origin = process.env.AVELOF_NAVIGATION_TEST_URL || 'http://127.0.0.1:8792'
const sections = ['packages', 'bike-trips', 'car-rentals', 'hotels', 'drivers', 'places', 'contact', 'experiences', 'travel-guide', 'partners']
for (const width of [320, 390, 768, 820, 1024, 1440]) {
  test(`Separate Ladakh service pages at ${width}px in both themes`, async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true })
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
    await page.route('**/api/**', (route) => route.fulfill({ status: 503, json: { error: 'Offline destination test' } }))
    try {
      await page.goto(`${origin}/ladakh`)
      await page.getByRole('heading', { name: /Experience Ladakh/ }).waitFor()
      assert.equal(await page.getByRole('button', { name: 'Go back', exact: true }).count(), 0)
      assert.equal(await page.getByText('Beyond the familiar', { exact: true }).count(), 0)
      assert.match(await page.locator('.ladakh-season').innerText(), /Summer 2027 planning preview/)
      assert.equal(await page.locator('.offer-banner, #custom-trip').count(), 0)
      const shortcuts = page.getByRole('navigation', { name: 'Explore Ladakh' })
      assert.equal(await shortcuts.getByRole('link').count(), 11)
      for (const link of await shortcuts.getByRole('link').all()) {
        assert.match(await link.getAttribute('href'), /^\/ladakh\/[\w-]+$/)
        assert.equal(await link.locator('svg').count(), 1)
      }
      assert.equal(await page.locator('.ladakh-hero-art img').evaluate((image) => image.complete && image.naturalWidth > 0), true)
      assert.match(await page.locator('figcaption').innerText(), /not a location photograph/)
      await shortcuts.getByRole('link', { name: 'Bike Trips', exact: true }).click()
      await page.waitForURL(`${origin}/ladakh/bike-trips`)
      await page.locator('h1').filter({ hasText: /Bike/ }).waitFor()
      await page.getByRole('button', { name: 'Go back', exact: true }).click()
      await page.waitForURL(`${origin}/ladakh`)
      for (const theme of ['light', 'dark']) {
        await page.evaluate((value) => localStorage.setItem('avelof:theme', value), theme)
        for (const section of sections) {
          await page.goto(`${origin}/ladakh/${section}`)
          await page.locator('h1').waitFor()
          await page.waitForFunction((value) => document.documentElement.dataset.theme === value, theme)
          assert.equal(await page.locator('h1').count(), 1, `${section}: one page heading`)
          assert.equal(await page.locator('.offer-banner').count(), 0, `${section}: no Kashmir offer`)
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${theme}/${section}: no horizontal overflow`)
          assert.equal(await page.getByRole('button', { name: 'Go back', exact: true }).count(), 1)
          assert.equal(await page.locator('.home-call-panel').count(), 1, `${section}: compact call help`)
          for (const link of await page.locator('.main-nav a').all()) assert.match(await link.getAttribute('href'), /^\/ladakh\//)
        }
      }
      await page.goto(`${origin}/ladakh#packages`)
      await page.waitForURL(`${origin}/ladakh/packages`)
      const filter = page.getByRole('group', { name: 'Filter routes by starting point' })
      await filter.getByRole('button', { name: 'From Srinagar', exact: true }).click()
      assert.equal(await page.locator('.ladakh-route-card').count(), 1)
      await filter.getByRole('button', { name: 'From Leh', exact: true }).click()
      assert.equal(await page.locator('.ladakh-route-card').count(), 2)
      const outline = page.locator('.ladakh-outline').first()
      await outline.locator('summary').focus()
      await page.keyboard.press('Enter')
      assert.match(await outline.innerText(), /at least 48 hours/)
      const sizes = await filter.getByRole('button').evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height))
      assert.ok(sizes.every((height) => height >= 44))
      await page.goto(`${origin}/ladakh`)
      await page.getByRole('navigation', { name: 'Holiday destinations' }).getByRole('link', { name: 'Kashmir', exact: true }).click()
      await page.waitForURL(`${origin}/`)
      await page.getByRole('heading', { name: 'Experience Kashmir Beyond Expectations.' }).waitFor()
      assert.equal(await page.getByRole('navigation', { name: 'Explore AVELOF' }).getByRole('link', { name: 'Bike Trips', exact: true }).count(), 0)
    } finally { await browser.close() }
  })
}
