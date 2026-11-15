import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium, devices, webkit } from 'playwright'

const origin = process.env.AVELOF_ACTIVITY_TEST_URL || 'http://localhost:8791'

async function checkLayout(page, root) {
  const inputs = root.locator('input[type="date"]')
  assert.ok(await inputs.count() > 0)
  for (const input of await inputs.all()) {
    const geometry = await input.evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      const label = element.closest('label').getBoundingClientRect()
      const icon = element.parentElement.querySelector('.date-input-icon')
      const iconBounds = icon.getBoundingClientRect()
      return {
        left: bounds.left, right: bounds.right, width: bounds.width, height: bounds.height,
        labelLeft: label.left, labelRight: label.right,
        iconLeft: iconBounds.left, iconRight: iconBounds.right, iconWidth: iconBounds.width,
        visible: getComputedStyle(icon).display !== 'none' && getComputedStyle(icon).visibility !== 'hidden',
        fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
      }
    })
    assert.ok(geometry.width > 0 && geometry.height >= 44)
    assert.ok(geometry.left >= geometry.labelLeft - 1 && geometry.right <= geometry.labelRight + 1, JSON.stringify(geometry))
    assert.ok(geometry.iconLeft >= geometry.left && geometry.iconRight <= geometry.right)
    assert.ok(geometry.visible && geometry.iconWidth === 20)
    assert.ok(geometry.fontSize >= 16)
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
}

for (const profile of ['iPhone 14', 'iPhone 14 Pro', 'Pixel 7', 'Desktop']) {
  test(`date fields stay contained with visible icons on ${profile}`, async () => {
    const apple = profile.startsWith('iPhone')
    const browser = await (apple ? webkit.launch() : chromium.launch({ channel: 'msedge' }))
    const context = await browser.newContext(profile === 'Desktop' ? { viewport: { width: 1280, height: 900 } } : devices[profile])
    const page = await context.newPage()
    const hotelId = '00000000-0000-4000-8000-000000000001'
    await page.route('**/api/hotels?*', (route) => route.fulfill({ json: {
      hotels: [{
        id: hotelId, hotelId: 'AVELOF_HTL_10001GLM', name: 'Calendar Test Hotel', location: 'Gulmarg', category: 'Premium',
        description: 'A registered hotel used to verify date layout.', price: 2180, mealPlan: 'Room only', taxDetails: 'Taxes included',
        heating: 'Room heaters', amenities: ['Wi-Fi'], highlights: ['Near the market'], roomTypes: ['Standard (2 rooms)'],
        roomRates: [{ roomType: 'Standard', count: 2, price: 2180 }], checkIn: '14:00', checkOut: '11:00', totalRooms: 2,
        photos: [`/api/hotel-images/${hotelId}/0`],
      }], total: 1, page: 1, pageSize: 25,
    } }))
    try {
      for (const path of ['/', '/tour-packages']) {
        await page.goto(`${origin}${path}`)
        const planner = page.locator('.trip-planner')
        await planner.locator('input[type="date"]').first().waitFor()
        await checkLayout(page, planner)
        assert.ok(await planner.getByLabel('End date', { exact: true }).isDisabled())
        await planner.getByLabel('Start date', { exact: true }).fill('2099-12-01')
        assert.equal(await planner.getByLabel('End date', { exact: true }).isDisabled(), false)
        await planner.getByLabel('End date', { exact: true }).fill('2099-12-05')
        assert.equal(await planner.getByLabel('Start date', { exact: true }).inputValue(), '2099-12-01')
        await checkLayout(page, planner)
      }
      await page.goto(`${origin}/local-trips`)
      const local = page.locator('.local-enquiry-form')
      await checkLayout(page, local)
      await local.getByLabel('Preferred date', { exact: true }).fill('2099-12-01')
      await local.getByLabel(/Stay overnight/).check()
      assert.ok(await local.getByText(/Check-out: 2099-12-02/).isVisible())
      await checkLayout(page, local)
      for (const path of ['/tour-packages', '/car-rentals/ertiga', `/hotels/${hotelId}`]) {
        await page.goto(`${origin}${path}`)
        await page.getByRole('button', { name: 'Book Now', exact: false }).first().click()
        const modal = page.locator('.booking-modal')
        await modal.locator('input[type="date"]').first().waitFor()
        await checkLayout(page, modal)
        const start = modal.getByLabel('Start date', { exact: true })
        const end = modal.getByLabel('End date', { exact: true })
        await start.fill('2099-12-01')
        await end.fill('2099-12-03')
        assert.equal(await start.inputValue(), '2099-12-01')
        assert.equal(await end.inputValue(), '2099-12-03')
        assert.equal(await end.evaluate((element) => element.validity.valid), true)
        const submittedFields = await modal.locator('form').evaluate((form) => Object.fromEntries(new FormData(form)))
        assert.ok(Object.values(submittedFields).includes('2099-12-01'))
        assert.ok(Object.values(submittedFields).includes('2099-12-03'))
        await checkLayout(page, modal)
      }
      if (profile !== 'Desktop') {
        await page.setViewportSize({ width: 320, height: 740 })
        await checkLayout(page, page.locator('.booking-modal'))
      }
    } finally { await context.close(); await browser.close() }
  })
}
