import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'

const origin = process.env.AVELOF_HOTEL_TEST_URL || 'http://127.0.0.1:8792'

test('all registration photo previews support removal, required-photo checks and same-file reselection', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  await page.route('**/api/pricing*', (route) => route.fulfill({ json: { discountPercent: 23, version: 1 } }))
  try {
    await page.goto(`${origin}/register-hotel`)
    const bytes = await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = 100; canvas.height = 100
      return canvas.toDataURL('image/png').split(',')[1]
    })
    const file = { name: 'selected.png', mimeType: 'image/png', buffer: Buffer.from(bytes, 'base64') }
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      for (const kind of ['hotel', 'houseboat', 'driver', 'business']) {
        await page.goto(`${origin}/${kind === 'houseboat' ? 'register-hotel' : `register-${kind}`}`)
        if (kind === 'houseboat') await page.getByLabel('Houseboat', { exact: true }).check()
        const input = page.locator(kind === 'driver' ? 'input[name=portrait]' : 'input[name=photos]')
        const grid = page.locator('.hotel-photo-grid').first()
        const maximum = kind === 'driver' ? 1 : 3
        await input.setInputFiles(Array.from({ length: maximum }, (_, index) => ({ ...file, name: `selected-${index}.png` })))
        await grid.locator('img').nth(maximum - 1).waitFor()
        assert.equal(await grid.getByRole('button').count(), maximum)
        const removedImage = await grid.locator('img').nth(maximum === 1 ? 0 : 1).getAttribute('src')
        await grid.getByRole('button').nth(maximum === 1 ? 0 : 1).click()
        assert.equal(await grid.locator('img').count(), maximum - 1)
        assert.ok(!(await grid.locator('img').evaluateAll((images) => images.map((image) => image.src))).includes(removedImage))
        assert.equal(await input.inputValue(), '')
        assert.equal(await input.evaluate((element) => element.required), maximum === 1)
        while (await grid.getByRole('button').count()) await grid.getByRole('button').first().click()
        assert.equal(await input.evaluate((element) => element.validity.valueMissing), true)
        assert.equal(await page.getByRole('heading', { name: /saved|received/i }).count(), 0, 'Removing a photo never submits the form')
        await input.setInputFiles(file)
        await grid.locator('img').waitFor()
        assert.equal(await input.evaluate((element) => element.required), false)
        assert.equal(await grid.getByRole('button').count(), 1)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      }
      await page.getByRole('button', { name: 'Add another item' }).click()
      const item = page.locator('.business-item-editor')
      const input = item.getByLabel('Item 1 photo', { exact: true })
      await input.setInputFiles(file)
      await item.locator('img').waitFor()
      await item.getByRole('button', { name: 'Remove item 1 photo', exact: true }).click()
      assert.equal(await item.locator('img').count(), 0)
      assert.equal(await input.inputValue(), '')
      assert.equal(await input.evaluate((element) => element.validity.valueMissing), true)
      assert.equal(await page.getByRole('button', { name: 'Submit for approval', exact: true }).isDisabled(), true)
      await input.setInputFiles(file)
      await item.locator('img').waitFor()
      assert.equal(await item.getByRole('button', { name: 'Remove item 1 photo', exact: true }).count(), 1)
    }
  } finally { await browser.close() }
})
