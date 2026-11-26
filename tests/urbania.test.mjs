import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { rentalCars } from '../src/data/catalog.ts'
import { driverVehicleOptions } from '../src/data/driverRegistration.ts'
import { driverDetailsSchema } from '../src/services/driverSchema.ts'

const origin = process.env.AVELOF_HOTEL_TEST_URL || 'http://127.0.0.1:8792'

test('Urbania is a 16-passenger vehicle at ₹6,000 per day with the branded owner-supplied image', async () => {
  const urbania = rentalCars.find(({ id }) => id === 'urbania')
  assert.equal(urbania.name, 'Force Urbania')
  assert.equal(urbania.seats, 16)
  assert.equal(urbania.price, 6000)
  assert.equal(urbania.image, '/images/vehicles/urbania-owner-branded.png')
  assert.deepEqual(urbania.gallery, [urbania.image])
  assert.equal(urbania.photoCredit, undefined)
  const image = await readFile(new URL('../public/images/vehicles/urbania-owner-branded.png', import.meta.url))
  assert.deepEqual([...image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  assert.equal(driverVehicleOptions.find(({ id }) => id === 'urbania').label, urbania.name)
  assert.equal(driverDetailsSchema.safeParse({ fullName: 'Test Driver', vehicleId: 'urbania', location: 'Srinagar', seats: 16 }).success, true)
})

test('Urbania appears on rental cards, detail and enquiry selection on mobile and desktop', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage()
  await page.route('**/api/pricing', (route) => route.fulfill({ json: { discountPercent: 23, version: 1 } }))
  try {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`${origin}/car-rentals`)
      const card = page.locator('.vehicle-card').filter({ has: page.getByRole('heading', { name: 'Force Urbania', exact: true }) })
      assert.equal(await card.count(), 1)
      assert.equal(await card.locator('img').getAttribute('src'), '/images/vehicles/urbania-owner-branded.png')
      await card.scrollIntoViewIfNeeded()
      await page.waitForFunction(() => {
        const image = document.querySelector('img[src="/images/vehicles/urbania-owner-branded.png"]')
        return image?.complete && image.naturalWidth > 0
      })
      assert.equal(await card.locator('img').evaluate((image) => image.complete && image.naturalWidth > 0), true)
      assert.match(await card.locator('.price').innerText(), /₹6,000\s*\/ day from/)
      const cardLayout = await card.evaluate((element) => {
        const image = element.querySelector('.catalog-image').getBoundingClientRect()
        const copy = element.querySelector('.card-copy').getBoundingClientRect()
        const bottom = element.querySelector('.catalog-bottom').getBoundingClientRect()
        return { imageHeight: image.height, gapAfterDescription: bottom.top - copy.bottom }
      })
      assert.equal(cardLayout.imageHeight, 150)
      assert.ok(cardLayout.gapAfterDescription >= 0, `Urbania's price overlaps its description at ${width}px`)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      await card.getByRole('button', { name: /Book Now/ }).click()
      assert.equal(await page.getByLabel('Preferred vehicle').inputValue(), 'Force Urbania')
      assert.match(await page.getByLabel('Preferred vehicle').locator('option:checked').innerText(), /16 seats/)
      await page.goto(`${origin}/car-rentals/urbania`)
      assert.equal(await page.getByRole('heading', { name: 'Force Urbania', exact: true }).count(), 1)
      assert.equal(await page.locator('.vehicle-detail-photo img').getAttribute('src'), '/images/vehicles/urbania-owner-branded.png')
      assert.match(await page.locator('.detail-aside').innerText(), /₹6,000/)
      assert.match(await page.locator('.spec-grid').first().innerText(), /16 seats/)
    }
    await page.goto(`${origin}/car-rentals`)
    const traveller = page.locator('.vehicle-card').filter({ has: page.getByRole('heading', { name: 'Tempo Traveller', exact: true }) })
    await traveller.getByLabel('Seating capacity').selectOption('tempo-traveller-14')
    assert.match(await traveller.locator('.price').innerText(), /₹4,000/)
    await traveller.getByLabel('Seating capacity').selectOption('tempo-traveller-20')
    assert.match(await traveller.locator('.price').innerText(), /₹5,000/)
    await traveller.getByLabel('Seating capacity').selectOption('tempo-traveller-14')
    await traveller.getByRole('button', { name: 'Book Now' }).click()
    assert.equal(await page.getByLabel('Preferred vehicle').inputValue(), 'Tempo Traveller 14-seater')
    await page.goto(`${origin}/register-driver`)
    assert.equal(await page.locator('select[name="vehicleId"] option[value="urbania"]').innerText(), 'Force Urbania')
  } finally { await browser.close() }
})
