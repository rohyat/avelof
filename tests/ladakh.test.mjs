import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'

const origin = process.env.AVELOF_NAVIGATION_TEST_URL || 'http://127.0.0.1:8792'

for (const width of [320, 390, 768, 820, 1024, 1440]) {
  test(`Ladakh destination and service links at ${width}px`, async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true })
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
    await page.route('**/api/**', (route) => route.fulfill({ status: 503, json: { error: 'Offline destination test' } }))
    try {
      await page.goto(origin)
      const destinations = page.getByRole('navigation', { name: 'Holiday destinations' })
      assert.equal(await destinations.getByRole('link', { name: 'Kashmir', exact: true }).getAttribute('aria-current'), 'page')
      await destinations.getByRole('link', { name: 'Ladakh', exact: true }).click()
      await page.waitForURL(`${origin}/ladakh`)
      await page.getByRole('heading', { name: /Experience Ladakh/ }).waitFor()
      const goBack = page.getByRole('button', { name: 'Go back', exact: true })
      await goBack.click()
      await page.waitForURL(`${origin}/`)
      await destinations.getByRole('link', { name: 'Ladakh', exact: true }).click()
      await page.waitForURL(`${origin}/ladakh`)
      await page.waitForFunction(() => document.title.startsWith('Ladakh'))
      assert.match(await page.title(), /Ladakh/)
      assert.equal(await destinations.getByRole('link', { name: 'Ladakh', exact: true }).getAttribute('aria-current'), 'page')
      assert.equal(await page.locator('.offer-banner').count(), 0)
      assert.equal(await page.locator('#custom-trip').count(), 0)
      assert.equal(await destinations.getByRole('button', { name: /Coming soon/ }).count(), 3)
      const shortcuts = page.getByRole('navigation', { name: 'Explore Ladakh' })
      assert.equal(await shortcuts.getByRole('link').count(), 9)
      for (const link of await shortcuts.getByRole('link').all()) {
        const href = await link.getAttribute('href')
        assert.equal(await page.locator(href).count(), 1, `${href} has a target`)
        assert.equal(await link.locator('svg').count(), 1)
      }
      await shortcuts.getByRole('link', { name: 'Bike Trips', exact: true }).click()
      await page.waitForURL(`${origin}/ladakh#bike-trips`)
      assert.equal(await page.locator('#bike-trips').isVisible(), true)
      await page.waitForFunction(() => {
        const top = document.getElementById('bike-trips').getBoundingClientRect().top
        return top >= 0 && top < 200
      })
      assert.match(await page.locator('#bike-trips').innerText(), /not open for booking yet/)
      assert.match(await page.locator('#plan').innerText(), /48 hours/)
      await page.goto(`${origin}/ladakh#packages`)
      const filter = page.getByRole('group', { name: 'Filter routes by starting point' })
      await filter.getByRole('button', { name: 'From Srinagar', exact: true }).click()
      assert.equal(await page.locator('.ladakh-route-card').count(), 1)
      assert.match(await page.locator('.ladakh-route-card').innerText(), /Kashmir to Ladakh Journey/)
      await filter.getByRole('button', { name: 'From Leh', exact: true }).click()
      assert.equal(await page.locator('.ladakh-route-card').count(), 2)
      await filter.getByRole('button', { name: 'All routes', exact: true }).click()
      assert.equal(await page.locator('.ladakh-route-card').count(), 3)
      const outline = page.locator('.ladakh-outline').first()
      await outline.locator('summary').focus()
      await page.keyboard.press('Enter')
      assert.equal(await outline.getAttribute('open'), '')
      assert.match(await outline.innerText(), /at least 48 hours/)
      const faq = page.locator('.ladakh-faq-list details').first()
      await faq.locator('summary').click()
      assert.equal(await faq.getAttribute('open'), '')
      assert.match(await faq.innerText(), /No payment or booking/)
      const callLink = page.locator('#contact').getByRole('link', { name: /Call AVELOF/ })
      assert.equal(await callLink.getAttribute('href'), 'tel:+919149418161')
      assert.equal(await page.locator('.ladakh-hero-art img').evaluate((image) => image.complete && image.naturalWidth > 0), true)
      assert.match(await page.locator('.ladakh-hero-art figcaption').innerText(), /not a location photograph/)
      for (const theme of ['light', 'dark']) {
        await page.evaluate((value) => localStorage.setItem('avelof:theme', value), theme)
        await page.reload()
        await page.waitForFunction((value) => document.documentElement.dataset.theme === value, theme)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${theme}: no horizontal overflow`)
        const sizes = await page.locator('.ladakh-route-filters button').evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height))
        assert.ok(sizes.every((height) => height >= 44), 'Route filters have touch-sized targets')
        const contrast = await page.locator('.ladakh-hero .button-dark').evaluate((button) => {
          const luminance = (color) => {
            const [r, g, b] = color.match(/\d+/g).slice(0, 3).map(Number).map((value) => {
              const s = value / 255
              return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
            })
            return 0.2126 * r + 0.7152 * g + 0.0722 * b
          }
          const style = getComputedStyle(button)
          const a = luminance(style.color)
          const b = luminance(style.backgroundColor)
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
        })
        assert.ok(contrast >= 4.5, `${theme}: call-to-action contrast is ${contrast}`)
      }
      await page.goto(`${origin}/ladakh`)
      assert.equal(await destinations.getByRole('link', { name: 'Ladakh', exact: true }).getAttribute('aria-current'), 'page')
      for (const link of await page.locator('.main-nav a').all()) {
        assert.match(await link.getAttribute('href'), /^\/ladakh#/)
      }
      await destinations.getByRole('link', { name: 'Kashmir', exact: true }).click()
      await page.waitForURL(`${origin}/`)
      await page.getByRole('heading', { name: 'Experience Kashmir Beyond Expectations.' }).waitFor()
      assert.equal(await page.getByRole('navigation', { name: 'Explore AVELOF' }).getByRole('link', { name: 'Bike Trips', exact: true }).count(), 0)
      assert.match(await page.locator('h1').innerText(), /Kashmir/)
    } finally {
      await browser.close()
    }
  })
}
