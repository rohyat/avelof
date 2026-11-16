import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'

const origin = process.env.AVELOF_HOTEL_TEST_URL || 'http://127.0.0.1:8792'

test('holiday destinations sit above the hero in a centred responsive row with only Kashmir enabled', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage()
  await page.route('**/api/pricing', (route) => route.fulfill({ json: { discountPercent: 23, version: 1 } }))
  await page.route('**/api/hotels*', (route) => route.fulfill({ json: { hotels: [], total: 0, page: 1, pageSize: 25 } }))
  try {
    await page.goto(origin)
    const navigation = page.getByRole('navigation', { name: 'Holiday destinations' })
    await navigation.waitFor()
    assert.deepEqual(await navigation.locator('.home-destination-name').allTextContents(), ['Kashmir', 'Ladakh', 'Shimla', 'Manali'])
    assert.equal(await navigation.getByRole('link').count(), 1)
    const kashmir = navigation.getByRole('link', { name: 'Kashmir Explore places' })
    assert.equal(await kashmir.getAttribute('href'), '/destinations')
    for (const name of ['Ladakh', 'Shimla', 'Manali']) {
      assert.equal(await navigation.getByRole('button', { name: `${name} Coming soon` }).isDisabled(), true)
    }
    assert.equal(await navigation.locator('svg').count(), 4)
    for (const width of [320, 390, 600, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      const bounds = await navigation.locator('.home-destination-card').evaluateAll((cards) => cards.map((card) => {
        const { x, y, width, height } = card.getBoundingClientRect()
        return { x, y, width, height, fits: card.scrollWidth <= card.clientWidth }
      }))
      assert.ok(bounds.every((box) => box.y === bounds[0].y && box.fits), `All four cards fit one row at ${width}px`)
      assert.ok(Math.abs((bounds[0].x + bounds[3].x + bounds[3].width) / 2 - width / 2) < 1)
      const navBounds = await navigation.boundingBox()
      const heroBounds = await page.locator('.home-hero').boundingBox()
      assert.ok(navBounds.y + navBounds.height <= heroBounds.y, 'Destination row is above the Kashmir introduction')
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    }
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
    assert.equal(await navigation.locator('a').evaluate((element) => getComputedStyle(element).backgroundColor), 'rgb(24, 43, 40)')
    await kashmir.click()
    await page.getByRole('heading', { name: /Places to visit/ }).waitFor()
  } finally { await browser.close() }
})
