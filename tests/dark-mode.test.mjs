import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'

const origin = process.env.AVELOF_HOTEL_TEST_URL || 'http://127.0.0.1:8792'

test('dark mode persists across pages and reloads and can be turned off', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext()
  await context.addInitScript(() => { if (!localStorage.getItem('avelof:theme')) localStorage.setItem('avelof:theme', 'light') })
  const page = await context.newPage()
  await page.route('**/api/pricing', (route) => route.fulfill({ json: { discountPercent: 23, version: 1 } }))
  await page.route('**/api/hotels*', (route) => route.fulfill({ json: { hotels: [], total: 0, page: 1, pageSize: 25 } }))
  try {
    for (const width of [320, 390, 600, 768, 820, 821, 900, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(origin)
      const toggle = page.getByRole('switch', { name: 'Dark mode', exact: true })
      assert.equal(await toggle.getAttribute('aria-checked'), 'false')
      const geometry = await page.locator('.site-header').evaluate((header) => {
        const bounds = header.getBoundingClientRect()
        const brand = header.querySelector('.brand').getBoundingClientRect()
        const control = header.querySelector('.theme-toggle').getBoundingClientRect()
        const menu = header.querySelector('.menu-toggle')
        const nav = header.querySelector('.main-nav')
        const right = getComputedStyle(menu).display === 'none' ? nav.getBoundingClientRect() : menu.getBoundingClientRect()
        const thumb = header.querySelector('.theme-toggle-thumb').getBoundingClientRect()
        const track = header.querySelector('.theme-toggle-track').getBoundingClientRect()
        return { beside: control.left >= brand.right && Math.abs((control.top + control.bottom - brand.top - brand.bottom) / 2) <= 1, contained: control.top >= bounds.top && control.bottom <= bounds.bottom, overlap: control.right > right.left, overflow: document.documentElement.scrollWidth > innerWidth || right.right > bounds.right, height: bounds.height, thumbOffset: thumb.left - track.left, text: header.querySelector('.theme-toggle').textContent }
      })

      assert.equal(geometry.beside, true)
      assert.equal(geometry.contained, true)
      assert.equal(Boolean(geometry.overlap), false)
      assert.equal(geometry.overflow, false)
      assert.equal(geometry.height, width <= 560 ? 66 : width <= 820 ? 72 : 82)
      assert.equal(geometry.text, '')
      assert.equal(geometry.thumbOffset, 2)
      if (width <= 820) {
        await page.getByRole('button', { name: 'Open menu' }).click()
        assert.equal(await page.getByRole('navigation', { name: 'Main navigation' }).isVisible(), true)
        const aligned = await page.locator('.site-header').evaluate((header) => Math.abs(header.querySelector('.main-nav').getBoundingClientRect().top - header.getBoundingClientRect().bottom) <= 1)
        assert.equal(aligned, true)
        await page.getByRole('button', { name: 'Close menu' }).click()
      }
      await toggle.click()
      assert.equal(await toggle.getAttribute('aria-checked'), 'true')
      await page.waitForTimeout(250)
      assert.equal(await toggle.locator('.theme-toggle-thumb').evaluate((thumb) => Math.round(thumb.getBoundingClientRect().left - thumb.parentElement.getBoundingClientRect().left)), 16)
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark')
      assert.equal(await page.locator('.catalog-card').first().evaluate((element) => getComputedStyle(element).backgroundColor), 'rgb(28, 48, 44)')
      assert.equal(await page.locator('.site-footer').evaluate((element) => getComputedStyle(element).backgroundColor), 'rgb(16, 43, 37)')
      await page.goto(`${origin}/tour-packages/deluxe`)
      assert.equal(await toggle.getAttribute('aria-checked'), 'true')
      assert.equal(await page.locator('.include-grid li').first().evaluate((element) => getComputedStyle(element).color), 'rgb(197, 216, 209)')
      const booking = width <= 820 ? page.locator('.package-end-booking') : page.locator('.detail-aside')
      await booking.getByRole('button', { name: 'Book Now', exact: true }).click()
      assert.equal(await page.locator('.booking-modal').evaluate((element) => getComputedStyle(element).backgroundColor), 'rgb(28, 48, 44)')
      assert.equal(await page.locator('.booking-modal input:not([type="checkbox"]):not([type="radio"])').first().evaluate((element) => getComputedStyle(element).backgroundColor), 'rgb(16, 31, 28)')
      await page.reload()
      assert.equal(await toggle.getAttribute('aria-checked'), 'true')
      await toggle.click()
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'light')
      assert.equal(await page.evaluate(() => localStorage.getItem('avelof:theme')), 'light')
    }
    const secondPage = await context.newPage()
    await secondPage.goto(origin)
    await page.getByRole('switch', { name: 'Dark mode', exact: true }).click()
    await secondPage.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
    await secondPage.getByRole('switch', { name: 'Dark mode', exact: true }).click()
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light')
    await secondPage.close()
  } finally { await browser.close() }
})

test('new visitors start in dark mode and a saved light choice overrides the default', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext()
  await context.route('**/api/pricing', (route) => route.fulfill({ json: { discountPercent: 23, version: 1 } }))
  try {
    let page = await context.newPage()
    await page.goto(origin)
    const theme = () => page.locator('html').getAttribute('data-theme')
    assert.equal(await theme(), 'dark')
    assert.equal(await page.evaluate(() => localStorage.getItem('avelof:theme')), 'dark')
    await page.getByRole('switch', { name: 'Dark mode', exact: true }).click()
    assert.equal(await theme(), 'light')
    await page.close()
    page = await context.newPage()
    await page.goto(`${origin}/partners`)
    assert.equal(await theme(), 'light')
    await page.reload()
    assert.equal(await theme(), 'light')
    const other = await context.newPage()
    await other.goto(origin)
    await other.evaluate(() => localStorage.removeItem('avelof:theme'))
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
  } finally { await browser.close() }
})
