import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { tourPackages } from '../src/data/catalog.ts'
import { tourPackagePdfData } from '../src/services/itineraryPdf.ts'

const origin = process.env.AVELOF_HOTEL_TEST_URL || 'http://127.0.0.1:8792'

test('higher package tiers include every lower-tier service while retaining their own accommodation', () => {
  const [deluxe, premium, luxury] = tourPackages
  for (const [lower, higher] of [[deluxe, premium], [premium, luxury]]) {
    for (const service of lower.inclusions.slice(1)) {
      assert.ok(higher.inclusions.includes(service), `${higher.name} includes ${lower.name} service: ${service}`)
      assert.ok(!higher.exclusions.includes(service))
    }
    assert.ok(higher.inclusions.length > lower.inclusions.length)
  }
  for (const item of tourPackages) assert.ok(item.inclusions.includes('All toll taxes'))
  assert.equal(deluxe.duration, '4 nights · 5 days')
  assert.equal(premium.duration, '5 nights · 6 days')
  assert.equal(luxury.duration, '7 nights · 8 days')
})

test('package hotel standards and dedicated Luxury guide flow into PDFs', () => {
  assert.deepEqual(tourPackages.map((item) => item.hotelStandard), [
    '2-star hotels', '3-star and 3-star Premium hotels',
    '4-star and 5-star hotels, plus a final luxury houseboat night',
  ])
  for (const item of tourPackages) {
    const data = tourPackagePdfData(item)
    assert.ok(data.overview.includes(`Hotel category: ${item.hotelStandard}.`))
    assert.ok(data.overview.includes(`Tour guide: ${item.tourGuide}`))
  }
  assert.ok(tourPackages.find((item) => item.id === 'luxury').inclusions.includes('Dedicated tour guide throughout the trip, separate from the driver'))
})

test('comparison shows live catalog details, supports keyboard closure and links to any package from home and listing', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await page.route('**/api/pricing', (route) => route.fulfill({ json: { discountPercent: 23, version: 1 } }))
  await page.route('**/api/hotels*', (route) => route.fulfill({ json: { hotels: [], total: 0, page: 1, pageSize: 25 } }))
  try {
    for (const path of ['/', '/tour-packages']) {
      await page.goto(`${origin}${path}`)
      const buttons = page.getByRole('button', { name: 'Compare', exact: true })
      await buttons.first().waitFor()
      assert.equal(await buttons.count(), path === '/' ? 3 : 4)
      if (path === '/tour-packages') assert.equal(await page.locator('.package-comparison-intro').getByRole('button', { name: 'Compare', exact: true }).count(), 1)
      await buttons.first().click()
      const dialog = page.getByRole('dialog', { name: 'Compare Kashmir packages' })
      await dialog.waitFor()
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden')
      const rows = dialog.locator('tbody tr')
      assert.deepEqual(await rows.locator('th').allTextContents(), ['Days & nights', 'Price per person', 'Places', 'Hotel category', 'Overnight stays', 'Transport', 'Tour guide', 'Inclusions', 'Exclusions'])
      for (const [index, item] of tourPackages.entries()) {
        for (const entry of [...item.inclusions, ...item.exclusions, item.hotelStandard, item.tourGuide]) {
          assert.ok((await dialog.locator(`tbody td:nth-child(${index + 2})`).allTextContents()).some((text) => text.includes(entry)), `${item.name}: ${entry}`)
        }
      }
      const scroll = dialog.getByRole('region', { name: 'Package comparison table' })
      await scroll.focus()
      await page.keyboard.press('ArrowRight')
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
      assert.equal(await scroll.evaluate((element) => element.scrollWidth > element.clientWidth), false)
      await dialog.getByRole('button', { name: 'Close package comparison' }).click()
      assert.equal(await buttons.first().evaluate((element) => element === document.activeElement), true)
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden')
      await buttons.last().click()
      await page.getByRole('dialog', { name: 'Compare Kashmir packages' }).getByRole('link', { name: 'View itinerary', exact: true }).last().click()
      await page.getByRole('heading', { name: 'Luxury', exact: true, level: 1 }).waitFor()
      assert.equal(await page.getByRole('dialog', { name: 'Compare Kashmir packages' }).count(), 0)
    }
  } finally { await browser.close() }
})

test('mobile and small tablets compare all tiers by feature without sideways scrolling and keep close accessible', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage()
  await page.route('**/api/pricing', (route) => route.fulfill({ json: { discountPercent: 23, version: 1 } }))
  await page.route('**/api/hotels*', (route) => route.fulfill({ json: { hotels: [], total: 0, page: 1, pageSize: 25 } }))
  try {
    for (const width of [320, 390, 560, 768, 820, 860, 861, 1024, 1440]) {
      await page.setViewportSize({ width, height: 800 })
      await page.goto(`${origin}/tour-packages`)
      const compare = page.locator('.package-comparison-intro button')
      await compare.click()
      const dialog = page.getByRole('dialog', { name: 'Compare Kashmir packages' })
      assert.equal(await dialog.locator('.comparison-table-scroll').isVisible(), width > 860)
      assert.equal(await dialog.locator('.comparison-mobile').isVisible(), width <= 860)
      if (width <= 860) {
        const features = dialog.locator('.comparison-feature')
        assert.equal(await features.count(), 9)
        const inclusions = features.filter({ has: page.locator('summary', { hasText: /^Inclusions$/ }) })
        await inclusions.locator('summary').click()
        assert.deepEqual(await inclusions.locator('dt').allTextContents(), ['Deluxe', 'Premium', 'Luxury'])
        for (const [index, item] of tourPackages.entries()) {
          assert.deepEqual(await inclusions.locator('dd').nth(index).locator('li').allTextContents(), item.inclusions)
        }
        assert.equal(await dialog.evaluate((element) => element.scrollWidth > element.clientWidth), false)
        assert.equal(await dialog.locator('.comparison-mobile').evaluate((element) => element.scrollWidth > element.clientWidth), false)
        await dialog.evaluate((element) => { element.scrollTop = element.scrollHeight })
        const close = dialog.getByRole('button', { name: 'Close package comparison' })
        const bounds = await close.boundingBox()
        assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 800, `Close stays on screen at ${width}px`)
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      await page.keyboard.press('Escape')
      assert.equal(await compare.evaluate((element) => element === document.activeElement), true)
    }
    await page.setViewportSize({ width: 390, height: 800 })
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
    await page.locator('.package-comparison-intro button').click()
    const dialog = page.getByRole('dialog', { name: 'Compare Kashmir packages' })
    assert.equal(await dialog.evaluate((element) => getComputedStyle(element).backgroundColor), 'rgb(24, 43, 40)')
    await dialog.getByRole('link', { name: 'View Luxury itinerary', exact: true }).click()
    await page.getByRole('heading', { name: 'Luxury', level: 1, exact: true }).waitFor()
    assert.equal(await page.getByRole('dialog').count(), 0)
    assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden')
  } finally { await browser.close() }
})
