import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'

const origin = process.env.AVELOF_HOTEL_TEST_URL || 'http://127.0.0.1:8792'

test('dark mode persists across pages and reloads and can be turned off', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.route('**/api/pricing', (route) => route.fulfill({ json: { discountPercent: 23, version: 1 } }))
  await page.route('**/api/hotels*', (route) => route.fulfill({ json: { hotels: [], total: 0, page: 1, pageSize: 25 } }))
  try {
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(origin)
      const toggle = page.getByRole('button', { name: 'Dark mode', exact: true })
      assert.equal(await toggle.getAttribute('aria-pressed'), 'false')
      const geometry = await page.locator('.site-header').evaluate((header) => {
        const bounds = header.getBoundingClientRect()
        const brand = header.querySelector('.brand').getBoundingClientRect()
        const control = header.querySelector('.theme-toggle').getBoundingClientRect()
        const menu = header.querySelector('.menu-toggle')
        const menuBounds = getComputedStyle(menu).display === 'none' ? null : menu.getBoundingClientRect()
        return { below: control.top >= brand.bottom - 1, contained: control.bottom <= bounds.bottom, overlap: menuBounds && control.right > menuBounds.left, overflow: document.documentElement.scrollWidth > innerWidth }
      })
      assert.equal(geometry.below, true)
      assert.equal(geometry.contained, true)
      assert.equal(Boolean(geometry.overlap), false)
      assert.equal(geometry.overflow, false)
      await toggle.click()
      assert.equal(await toggle.getAttribute('aria-pressed'), 'true')
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark')
      assert.equal(await page.locator('.catalog-card').first().evaluate((element) => getComputedStyle(element).backgroundColor), 'rgb(28, 48, 44)')
      assert.equal(await page.locator('.site-footer').evaluate((element) => getComputedStyle(element).backgroundColor), 'rgb(16, 43, 37)')
      await page.goto(`${origin}/tour-packages/deluxe`)
      assert.equal(await toggle.getAttribute('aria-pressed'), 'true')
      assert.equal(await page.locator('.include-grid li').first().evaluate((element) => getComputedStyle(element).color), 'rgb(197, 216, 209)')
      const booking = width <= 820 ? page.locator('.package-end-booking') : page.locator('.detail-aside')
      await booking.getByRole('button', { name: 'Book Now', exact: true }).click()
      assert.equal(await page.locator('.booking-modal').evaluate((element) => getComputedStyle(element).backgroundColor), 'rgb(28, 48, 44)')
      assert.equal(await page.locator('.booking-modal input:not([type="checkbox"]):not([type="radio"])').first().evaluate((element) => getComputedStyle(element).backgroundColor), 'rgb(16, 31, 28)')
      await page.reload()
      assert.equal(await toggle.getAttribute('aria-pressed'), 'true')
      await toggle.click()
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'light')
      assert.equal(await page.evaluate(() => localStorage.getItem('avelof:theme')), 'light')
    }
    const secondPage = await context.newPage()
    await secondPage.goto(origin)
    await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
    await secondPage.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
    await secondPage.getByRole('button', { name: 'Dark mode', exact: true }).click()
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light')
    await secondPage.close()
  } finally { await browser.close() }
})
