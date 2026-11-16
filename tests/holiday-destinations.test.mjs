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
    assert.deepEqual(await navigation.locator('.home-destination-name').allTextContents(), ['Kashmir', 'Ladakh', 'Shimla', 'Manali', 'Spiti Valley'])
    assert.equal(await navigation.getByRole('link').count(), 0)
    const kashmir = navigation.getByRole('button', { name: 'Kashmir', exact: true })
    assert.equal(await kashmir.getAttribute('aria-pressed'), 'true')
    assert.equal(await navigation.getByText('Explore places').count(), 0)
    for (const name of ['Ladakh', 'Shimla', 'Manali', 'Spiti Valley']) {
      assert.equal(await navigation.getByRole('button', { name: `${name} Coming soon` }).isDisabled(), true)
    }
    assert.equal(await navigation.locator('svg').count(), 5)
    const ladakhIcon = navigation.getByRole('button', { name: 'Ladakh Coming soon' }).locator('svg')
    const spitiIcon = navigation.getByRole('button', { name: 'Spiti Valley Coming soon' }).locator('svg')
    assert.equal(await ladakhIcon.evaluate((icon) => icon.classList.contains('lucide-mountain-snow')), true)
    assert.equal(await spitiIcon.evaluate((icon) => icon.classList.contains('lucide-landmark')), true)
    assert.notEqual(await spitiIcon.innerHTML(), await ladakhIcon.innerHTML())
    for (const width of [320, 390, 600, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      const bounds = await navigation.locator('.home-destination-card').evaluateAll((cards) => cards.map((card) => {
        const { x, y, width, height } = card.getBoundingClientRect()
        return { x, y, width, height, fits: card.scrollWidth <= card.clientWidth && card.scrollHeight <= card.clientHeight }
      }))
      assert.ok(bounds.every((box) => box.y === bounds[0].y && box.fits), `All five cards fit one row at ${width}px`)
      assert.ok(Math.abs((bounds[0].x + bounds[4].x + bounds[4].width) / 2 - width / 2) < 1)
      if (width > 600) assert.ok(bounds.every((box) => Math.abs(box.width - box.height) < 1 && box.width <= 113), 'Desktop tiles are compact squares')
      else assert.ok(bounds.every((box) => Math.abs(box.width - box.height) < 1 && box.width <= 80), 'Mobile tiles are smaller squares')
      const navBounds = await navigation.boundingBox()
      const heroBounds = await page.locator('.home-hero').boundingBox()
      assert.ok(navBounds.y + navBounds.height <= heroBounds.y, 'Destination row is above the Kashmir introduction')
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    }
    for (const [theme, background, color] of [['light', 'rgb(24, 89, 78)', 'rgb(255, 255, 255)'], ['dark', 'rgb(164, 217, 201)', 'rgb(18, 62, 57)']]) {
      await page.evaluate((theme) => { document.documentElement.dataset.theme = theme }, theme)
      const style = await kashmir.evaluate((element) => ({ background: getComputedStyle(element).backgroundColor, color: getComputedStyle(element).color }))
      assert.equal(style.background, background)
      assert.equal(style.color, color)
      assert.notEqual(await navigation.locator('button:disabled').first().evaluate((element) => getComputedStyle(element).backgroundColor), background)
      const url = page.url()
      await kashmir.click()
      assert.equal(page.url(), url)
      assert.equal(await kashmir.getAttribute('aria-pressed'), 'true')
      await page.getByRole('heading', { name: 'Experience Kashmir Beyond Expectations.' }).waitFor()
    }
  } finally { await browser.close() }
})
