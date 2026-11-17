import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'

const origin = process.env.AVELOF_NAVIGATION_TEST_URL || 'http://127.0.0.1:8792'

for (const width of [320, 390, 600, 768, 820, 821, 900, 1024, 1440]) {
  test(`shared back button and home logos work at ${width}px`, async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true })
    const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: 'reduce' })
    await page.route('**/api/**', (route) => route.fulfill({ status: 503, json: { error: 'Offline navigation test' } }))
    try {
      await page.goto(`${origin}/about`)
      const back = page.getByRole('button', { name: 'Go back', exact: true })
      await back.waitFor({ state: 'visible' })
      const bounds = await back.boundingBox()
      assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.height >= 44)
      assert.equal(await back.textContent(), '')
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      const headerBounds = await page.locator('.site-header').boundingBox()
      assert.ok(bounds.y >= headerBounds.y + headerBounds.height, 'Back is below the header')
      assert.equal(await page.locator('.site-header .page-back-button').count(), 0)
      assert.equal(await page.locator('header .brand-logo').isVisible(), true)
      assert.equal(await page.locator('.page-back-row').count(), 0, 'No additional row below the header')
      const homeCrumb = await page.locator('.breadcrumb').getByRole('link', { name: 'Home', exact: true }).boundingBox()
      assert.ok(bounds.x + bounds.width <= homeCrumb.x, 'Back is beside Home')
      assert.ok(Math.abs(bounds.y + bounds.height / 2 - homeCrumb.y - homeCrumb.height / 2) < 1, 'Back and Home share the same line')
      const controls = await page.locator('.site-header').evaluate((header) => {
        const theme = header.querySelector('.theme-toggle').getBoundingClientRect()
        const menu = header.querySelector('.menu-toggle')
        const right = getComputedStyle(menu).display === 'none' ? header.querySelector('.main-nav').getBoundingClientRect() : menu.getBoundingClientRect()
        return { overlap: theme.right > right.left, right: right.right }
      })
      assert.equal(controls.overlap, false, 'Back and theme controls do not overlap navigation')
      assert.ok(controls.right <= width)
      const originalHeight = await page.locator('.about-welcome').evaluate((element) => element.getBoundingClientRect().height)
      await page.locator('.page-back-inline').evaluate((element) => { element.style.display = 'none' })
      assert.equal(await page.locator('.about-welcome').evaluate((element) => element.getBoundingClientRect().height), originalHeight, 'Inline Back adds no content height')
      await page.locator('.page-back-inline').evaluate((element) => { element.style.display = '' })

      // A direct visit has no in-app predecessor.
      await back.click()
      await page.waitForURL(`${origin}/`)
      await back.waitFor({ state: 'detached' })
      await page.waitForFunction(() => window.scrollY === 0)
      assert.equal(await back.count(), 0)

      await page.evaluate(() => window.scrollTo({ top: 700, behavior: 'instant' }))
      await page.waitForFunction(() => window.scrollY > 0)
      await page.locator('header').getByRole('link', { name: 'AVELOF home', exact: true }).click()
      await page.waitForFunction(() => window.scrollY === 0)

      await page.locator('footer').getByRole('link', { name: 'AVELOF home', exact: true }).click()
      await page.waitForFunction(() => window.scrollY === 0)

      await page.locator('footer').getByRole('link', { name: 'About & Contact', exact: true }).click()
      await page.waitForURL(`${origin}/about`)
      await page.waitForFunction(() => document.title.startsWith('About AVELOF'))
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => {
        window.scrollTo({ top: 450, behavior: 'instant' })
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      })))
      await page.waitForFunction(() => window.scrollY >= 400)
      await page.waitForFunction(() => {
        const saved = sessionStorage.getItem(`avelof:scroll:${history.state.key}`)
        return saved && JSON.parse(saved).y >= 400
      })
      // Activate the link without Playwright moving the viewport to the footer.
      await page.locator('footer').getByRole('link', { name: 'Hotels & stays', exact: true }).evaluate((link) => link.click())
      await page.waitForURL(`${origin}/hotels`)
      await page.waitForFunction(() => document.title.startsWith('Kashmir Hotels') && window.scrollY === 0)
      await back.click()
      await page.waitForURL(`${origin}/about`)
      await page.waitForFunction(() => document.title.startsWith('About AVELOF'))
      assert.ok(await page.evaluate(() => window.scrollY >= 400), JSON.stringify(await page.evaluate(() => ({
        scroll: window.scrollY,
        saved: sessionStorage.getItem(`avelof:scroll:${history.state.key}`),
      }))))
      await page.locator('header').getByRole('link', { name: 'AVELOF home', exact: true }).click()
      await page.waitForURL(`${origin}/`)
      await page.waitForFunction(() => window.scrollY === 0)

      const home = await browser.newPage({ viewport: { width, height: 844 } })
      await home.route('**/api/**', (route) => route.fulfill({ status: 503, json: { error: 'Offline navigation test' } }))
      await home.goto(`${origin}/`)
      assert.equal(await home.getByRole('button', { name: 'Go back', exact: true }).count(), 0)
      await page.goto(`${origin}/hotels`)
      const hotelLayout = await page.locator('.page-hero').evaluate((hero) => {
        const header = document.querySelector('.site-header').getBoundingClientRect()
        const before = hero.getBoundingClientRect()
        const back = hero.querySelector('.page-back-inline')
        back.style.display = 'none'
        const without = hero.getBoundingClientRect()
        back.style.display = ''
        return { gap: before.top - header.bottom, height: before.height, withoutHeight: without.height }
      })
      assert.equal(hotelLayout.gap, 0, 'Hotels has no additional gap after the header')
      assert.equal(hotelLayout.height, hotelLayout.withoutHeight, 'Back does not increase the Hotels intro height')
    } finally {
      await browser.close()
    }
  })
}

test('all non-home routes expose the shared back button', async () => {
      const browser = await chromium.launch({ channel: 'msedge', headless: true })
      const page = await browser.newPage()
      await page.route('**/api/**', (route) => route.fulfill({ status: 503, json: { error: 'Offline navigation test' } }))
      try {
        for (const path of [
          '/tour-packages', '/tour-packages/premium', '/car-rentals', '/car-rentals/unknown',
          '/drivers', '/drivers/unknown/reviews', '/hotels', '/hotels/unknown', '/hotels/unknown/reviews',
          '/register-hotel', '/hotel-status', '/partners', '/register-business', '/business-status',
          '/register-driver', '/driver-status', '/destinations', '/activities', '/local-trips',
          '/food-and-shopping', '/travel-guide', '/my-enquiries', '/admin/panel',
          '/admin/panel/reviews', '/admin/panel/hotels', '/admin/panel/drivers', '/admin/panel/businesses',
          '/reviews', '/about', '/page-not-found',
        ]) {
          await page.goto(`${origin}${path}`)
          assert.equal(await page.getByRole('button', { name: 'Go back', exact: true }).count(), 1, path)
        }
      } finally { await browser.close() }
})
