import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { tourPackages } from '../src/data/catalog.ts'
import { tourPackagePdfData } from '../src/services/itineraryPdf.ts'

const origin = process.env.AVELOF_HOTEL_TEST_URL || 'http://127.0.0.1:8792'

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
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  await page.route('**/api/pricing', (route) => route.fulfill({ json: { discountPercent: 23, version: 1 } }))
  await page.route('**/api/hotels*', (route) => route.fulfill({ json: { hotels: [], total: 0, page: 1, pageSize: 25 } }))
  try {
    for (const path of ['/', '/tour-packages']) {
      await page.goto(`${origin}${path}`)
      const buttons = page.getByRole('button', { name: 'Compare', exact: true })
      await buttons.first().waitFor()
      assert.equal(await buttons.count(), 3)
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
      assert.equal(await scroll.evaluate((element) => element.scrollWidth > element.clientWidth), true)
      await dialog.getByRole('button', { name: 'Close package comparison' }).click()
      assert.equal(await buttons.first().evaluate((element) => element === document.activeElement), true)
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden')
      await buttons.last().click()
      await page.getByRole('dialog', { name: 'Compare Kashmir packages' }).getByRole('link', { name: 'View itinerary' }).last().click()
      await page.getByRole('heading', { name: 'Luxury', exact: true, level: 1 }).waitFor()
      assert.equal(await page.getByRole('dialog', { name: 'Compare Kashmir packages' }).count(), 0)
    }
  } finally { await browser.close() }
})
