import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'

const origin = process.env.AVELOF_HOTEL_TEST_URL || 'http://127.0.0.1:8792'
const firstId = '00000000-0000-4000-8000-000000000001'
const secondId = '00000000-0000-4000-8000-000000000002'
const property = (id, name, overrides = {}) => ({
  id, hotelId: id === firstId ? 'AVELOF_HTL_10001SRG' : 'AVELOF_HB_10002SRG', name,
  location: 'Srinagar', category: 'Premium', description: 'Comfortable property for a relaxing Kashmir holiday.',
  price: 2000, roomRates: [{ roomType: 'Family', count: 2, price: 2000 }],
  roomTypes: ['Family (2 rooms)'], totalRooms: 2, mealPlan: 'Room only', heating: 'Room heaters',
  amenities: ['Wi-Fi'], highlights: ['Near the market'], checkIn: '14:00', checkOut: '11:00',
  breakfastPrice: 200, dinnerPrice: 400, extraBedPrice: 800,
  photos: [`/api/hotel-images/${id}/0`, `/api/hotel-images/${id}/1`], ...overrides,
})
const hotels = [
  property(firstId, 'Alpine Hotel'),
  property(secondId, 'Lake Houseboat', { propertyType: 'Houseboat', category: 'Premium Houseboat', exactLocation: 'Dal Lake', price: 3000, roomRates: [{ roomType: 'Deluxe', count: 2, price: 3000 }] }),
]
async function setup(page, handler) {
  await page.route('**/api/pricing*', (route) => route.fulfill({ json: { discountPercent: 23, version: 1 } }))
  await page.route('**/api/hotel-images/**', (route) => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"/>' }))
  await page.route('**/api/hotels*', handler)
}

test('compare hotels and houseboats in a simple popup with alphabetical dropdowns, photos and booking', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  let pageTwo = false
  await setup(page, (route) => {
    const url = new URL(route.request().url())
    const second = url.searchParams.get('page') === '2'
    if (second) pageTwo = true
    const selected = url.searchParams.get('id')
    return route.fulfill({ json: { hotels: selected ? hotels.filter((hotel) => hotel.id === selected) : [hotels[second ? 1 : 0]], total: selected ? 1 : 26, page: second ? 2 : 1, pageSize: 25 } })
  })
  try {
    await page.goto(`${origin}/hotels`)
    const card = page.locator('.hotel-card').filter({ has: page.getByRole('heading', { name: 'Alpine Hotel', exact: true }) })
    await card.waitFor()
    assert.equal(await card.locator('.hotel-category-tag').innerText(), 'Premium - 3-star')
    assert.equal(await page.locator('.stay-type-tag').count(), 0)
    assert.equal(await page.locator('.hotel-card').filter({ has: page.getByRole('heading', { name: 'Lake Houseboat', exact: true }) }).locator('.hotel-category-tag').innerText(), 'Premium Houseboat')
    assert.ok(await card.locator('.hotel-category-tag').evaluate((element) => {
      const style = getComputedStyle(element)
      return parseFloat(style.fontSize) >= 12 && style.color === 'rgb(255, 255, 255)' && style.backgroundColor === 'rgb(27, 58, 45)'
    }))
    assert.equal(await page.locator('.filter-guidance').getByRole('button', { name: 'Compare', exact: true }).count(), 0)
    assert.equal(await card.getByRole('link', { name: /reviews/i }).count(), 0)
    assert.match(await card.locator('.hotel-card-rating').innerText(), /No ratings yet/)
    assert.equal(await card.locator('.hotel-season-note').count(), 0)
    assert.match(await card.locator('.hotel-compact-price').innerText(), /per room per night for 4 people/)
    assert.match(await card.locator('.hotel-compact-price').innerText(), /Room only · Meals optional/)
    for (const width of [320, 390, 820, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      const actions = card.locator('.hotel-card-actions')
      const explore = await actions.getByRole('link', { name: 'Explore Now', exact: true }).boundingBox()
      const book = await actions.getByRole('button', { name: 'Book Now', exact: true }).boundingBox()
      const compare = await actions.getByRole('button', { name: 'Compare', exact: true }).boundingBox()
      const ac = await card.locator('.hotel-ac-status').boundingBox()
      assert.ok(Math.abs(explore.y - book.y) < 1)
      assert.ok(explore.y >= ac.y + ac.height)
      assert.ok(compare.y >= book.y + book.height)
      assert.ok(Math.abs(compare.x - explore.x) < 1)
      assert.ok(Math.abs(compare.width - (book.x + book.width - explore.x)) < 1)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    }
    await card.getByRole('button', { name: 'Compare', exact: true }).click()
    await page.getByRole('combobox', { name: 'First hotel', exact: true }).waitFor()
    assert.equal(await page.getByRole('combobox', { name: 'First hotel', exact: true }).inputValue(), firstId)
    await page.keyboard.press('Escape')
    await page.getByRole('dialog', { name: 'Compare hotels', exact: true }).waitFor({ state: 'detached' })
    await page.getByRole('button', { name: 'Compare', exact: true }).first().click()
    assert.equal(new URL(page.url()).pathname, '/hotels')
    await page.getByRole('dialog', { name: 'Compare hotels', exact: true }).waitFor()
    await page.getByRole('heading', { name: 'Compare hotels', exact: true }).waitFor()
    const first = page.getByRole('combobox', { name: 'First hotel', exact: true })
    const second = page.getByRole('combobox', { name: 'Second hotel', exact: true })
    await first.locator(`option[value="${firstId}"]`).waitFor({ state: 'attached' })
    await first.selectOption('')
    assert.ok(pageTwo)
    assert.equal(await first.inputValue(), '')
    assert.equal(await second.inputValue(), '')
    assert.equal(await second.isDisabled(), true)
    const popup = page.getByRole('dialog', { name: 'Compare hotels', exact: true })
    assert.equal(await popup.locator('input[type="search"]').count(), 0)
    assert.equal(await popup.locator('input[type="date"]').count(), 0)
    assert.equal(await popup.locator('select').count(), 2)
    assert.deepEqual(await first.locator('option:not([value=""])').allTextContents(), ['Alpine Hotel — Srinagar', 'Lake Houseboat — Dal Lake, Srinagar'])
    await first.selectOption(firstId)
    await second.locator(`option[value="${firstId}"]`).waitFor({ state: 'detached' })
    await second.selectOption(secondId)
    await page.waitForFunction(([left, right]) => {
      const selects = [...document.querySelectorAll('.hotel-compare-selector select')]
      return selects[0]?.value === left && selects[1]?.value === right
    }, [firstId, secondId])
    assert.equal(await second.locator(`option[value="${firstId}"]`).count(), 0)
    assert.equal(await first.locator(`option[value="${secondId}"]`).count(), 0)
    assert.equal(await first.inputValue(), firstId, `First property retained: ${page.url()}`)
    assert.equal(await second.inputValue(), secondId, `Second property retained: ${page.url()}`)
    const photos = page.getByRole('region', { name: 'Photos', exact: true })
    await photos.getByRole('button', { name: 'Show Lake Houseboat photo 2', exact: true }).click()
    assert.ok((await photos.locator('.hotel-compare-main-photo').nth(1).getAttribute('src')).endsWith('/1'))
    const meals = page.getByRole('region', { name: 'Meals', exact: true })
    assert.match(await meals.innerText(), /Breakfast: ₹200/)
    assert.ok(!(await meals.innerText()).includes('Breakfast: ₹400'), 'Family-only hotel still shows base two-person meal charges')
    const prices = page.getByRole('region', { name: 'Starting room rate', exact: true })
    assert.match(await prices.innerText(), /₹2,000/)
    assert.match(await prices.innerText(), /₹3,000/)
    for (const width of [320, 390, 820, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      for (const theme of ['light', 'dark']) {
        await page.evaluate((value) => { document.documentElement.dataset.theme = value }, theme)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
        assert.equal(await popup.evaluate((element) => element.scrollWidth > element.clientWidth), false)
        if (theme === 'dark') assert.equal(await popup.evaluate((element) => getComputedStyle(element).backgroundColor), 'rgb(16, 27, 26)')
        const cells = page.getByRole('region', { name: 'Amenities', exact: true }).locator('.hotel-compare-cell')
        const left = await cells.first().boundingBox()
        const right = await cells.last().boundingBox()
        assert.ok(right.x >= left.x + left.width - 1)
      }
    }
    await page.getByRole('region', { name: 'Explore or enquire', exact: true }).getByRole('button', { name: 'Book Now', exact: true }).nth(1).click()
    const dialog = page.getByRole('dialog', { name: 'Send us your hotel enquiry.', exact: true })
    await dialog.locator('.selected-hotel-field strong').waitFor()
    assert.equal(await dialog.locator('.selected-hotel-field strong').innerText(), 'Lake Houseboat')
    await page.keyboard.press('Escape')
    for (const width of [320, 390, 820, 821, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`${origin}/hotels/${firstId}`)
      const actions = page.locator('.hotel-detail-actions')
      const book = actions.getByRole('button', { name: 'Book Now', exact: true })
      const compare = actions.getByRole('button', { name: 'Compare', exact: true })
      await compare.waitFor()
      const bookBox = await book.boundingBox()
      const compareBox = await compare.boundingBox()
      if (width <= 820) assert.ok(Math.abs(bookBox.y - compareBox.y) < 1)
      else assert.ok(compareBox.y >= bookBox.y + bookBox.height)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      await compare.click()
      await first.waitFor()
      assert.equal(await first.inputValue(), firstId)
      assert.equal(await second.inputValue(), '')
      assert.equal(new URL(page.url()).pathname, `/hotels/${firstId}`)
      await page.keyboard.press('Escape')
      await popup.waitFor({ state: 'detached' })
      assert.equal(await compare.evaluate((button) => button === document.activeElement), true)
    }
  } finally { await browser.close() }
})

test('hotel cards prioritize large photos with just two compact features and retain rates, room types and actions', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ reducedMotion: 'reduce', bypassCSP: true })
  const properties = [
    property(firstId, 'Hotel Spice and Restaurant', {
      exactLocation: 'Near Airport', latitude: 34.08, longitude: 74.79,
      amenities: ['Wi-Fi', 'Parking', 'Room service'],
      highlights: ['Mountain views', 'Garden or outdoor space'],
      originalPrice: 3300, discountPercent: 23,
      roomRates: ['Deluxe', 'Premium', 'Family', 'Suite'].map((roomType) => ({ roomType, count: 2, price: 2541, originalPrice: 3300 })),
    }),
    hotels[1],
  ]
  await setup(page, (route) => route.fulfill({ json: { hotels: properties, total: properties.length, page: 1, pageSize: 25 } }))
  try {
    await page.goto(`${origin}/hotels`)
    const card = page.locator('.hotel-card').filter({ has: page.getByRole('heading', { name: 'Hotel Spice and Restaurant', exact: true }) })
    await card.waitFor()
    for (const width of [320, 390, 640, 820, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      for (const theme of ['light', 'dark']) {
        await page.evaluate((value) => { document.documentElement.dataset.theme = value }, theme)
        const previousSpacing = await page.addStyleTag({ content: `
          .hotel-card .catalog-image { height: 56cqw; }
          .hotel-card .catalog-content { padding: 10px; }
          .hotel-card .hotel-card-rating { margin: 5px 0; }
          .hotel-card .hotel-card-highlights { margin: 0 0 5px; }
          .hotel-card-rooms { margin: 2px 0 5px; }
          .hotel-card-rooms li { padding: 3px 6px; }
          .hotel-card .catalog-bottom { gap: 8px; padding-top: 7px; }
          .hotel-card .hotel-rates-compact { gap: 3px 8px; }
          .hotel-card .hotel-card-actions { gap: 6px; }
        ` })
        const previousBounds = await card.boundingBox()
        const previousPhoto = await card.locator('.catalog-image').boundingBox()
        const previousContent = await card.locator('.catalog-content').boundingBox()
        await previousSpacing.evaluate((element) => element.remove())
        const bounds = await card.boundingBox()
        const content = await card.locator('.catalog-content').boundingBox()
        const reduction = 1 - bounds.height / previousBounds.height
        assert.ok(reduction >= 0.08 && reduction <= 0.20, `Overall height reduction at ${width}px: ${reduction}`)
        assert.ok(content.height <= previousContent.height * 0.92, `Content at ${width}px is at least 8% shorter: ${content.height} vs ${previousContent.height}`)
        const limit = bounds.width < 300 ? 1.9 : 1.7
        assert.ok(bounds.height / bounds.width <= limit, `Card at ${width}px: ${bounds.height} / ${bounds.width} exceeds ${limit}`)
        const photo = await card.locator('.catalog-image').boundingBox()
        assert.ok(Math.abs(photo.height / previousPhoto.height - 0.9) < 0.01, 'Photo height is trimmed by 10%')
        assert.equal(await card.getByRole('link', { name: 'View on Google Maps', exact: true }).count(), 1)
        assert.equal(await card.locator('.hotel-card-highlights li').count(), 2)
        assert.equal(await card.locator('.hotel-feature-chips').count(), 0)
        assert.ok((await card.getByRole('list', { name: 'Key features', exact: true }).boundingBox()).height <= 24, 'Only one compact feature row')
        assert.equal(await card.locator('.hotel-card-rooms li').count(), 4)
        for (const action of await card.locator('.hotel-card-actions .button').all()) {
          assert.ok((await action.boundingBox()).height >= 44)
        }
        assert.equal(await card.evaluate((element) => element.scrollWidth > element.clientWidth), false)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      }
    }
    await card.getByRole('link', { name: 'Explore Now', exact: true }).click()
    await page.getByRole('heading', { name: 'Make yourself at home.', exact: true }).waitFor()
    assert.ok(await page.locator('.hotel-detail-features').first().getByText('Wi-Fi', { exact: true }).isVisible())
  } finally { await browser.close() }
})

test('large dropdowns preserve selections and popup size without search fields', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  const thirdId = '00000000-0000-4000-8000-000000000003'
  const fourthId = '00000000-0000-4000-8000-000000000004'
  const properties = [...hotels, property(thirdId, 'Cedar Hotel'), property(fourthId, 'Pahalgam Retreat', { location: 'Pahalgam' })]
  await setup(page, (route) => route.fulfill({ json: { hotels: properties, total: properties.length, page: 1, pageSize: 25 } }))
  try {
    for (const width of [320, 390, 820, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`${origin}/hotels`)
      await page.getByRole('button', { name: 'Compare', exact: true }).first().click()
      const popup = page.getByRole('dialog', { name: 'Compare hotels', exact: true })
      const first = popup.getByRole('combobox', { name: 'First hotel', exact: true })
      const second = popup.getByRole('combobox', { name: 'Second hotel', exact: true })
      await first.locator(`option[value="${firstId}"]`).waitFor({ state: 'attached' })
      await first.selectOption('')
      assert.equal(await popup.getByRole('searchbox').count(), 0)
      assert.equal(await second.isDisabled(), true)
      const originalBounds = await popup.boundingBox()
      assert.ok((await first.boundingBox()).height >= 54)
      assert.equal(await popup.locator('.hotel-selector-dropdown > svg').count(), 2)
      await first.focus()
      assert.equal(await first.evaluate((element) => element === document.activeElement), true)
      await first.selectOption(firstId)
      await second.locator(`option[value="${secondId}"]`).waitFor({ state: 'attached' })
      assert.deepEqual(await second.locator('option:not([value=""])').allTextContents(), ['Cedar Hotel — Srinagar', 'Lake Houseboat — Dal Lake, Srinagar'])
      await second.selectOption(secondId)
      await first.locator(`option[value="${secondId}"]`).waitFor({ state: 'detached' })
      assert.equal(await first.inputValue(), firstId)
      assert.equal(await second.inputValue(), secondId)
      const filteredBounds = await popup.boundingBox()
      for (const dimension of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(originalBounds[dimension] - filteredBounds[dimension]) < 1, `Popup ${dimension} stays stable at ${width}px`)
      assert.equal(await popup.evaluate((element) => element.scrollWidth > element.clientWidth), false)
      await first.locator(`option[value="${fourthId}"]`).waitFor({ state: 'attached' })
      await first.selectOption(fourthId)
      await popup.getByRole('status').filter({ hasText: 'No other properties in Pahalgam' }).waitFor()
      assert.equal(await second.inputValue(), '')
      assert.equal(await second.isDisabled(), true)
      const close = popup.getByRole('button', { name: 'Close hotel comparison' })
      await popup.evaluate((element) => { element.scrollTop = element.scrollHeight })
      const closeBounds = await close.boundingBox()
      const popupBounds = await popup.boundingBox()
      assert.ok(closeBounds.y >= popupBounds.y && closeBounds.y + closeBounds.height <= popupBounds.y + popupBounds.height, 'Close remains visible when scrolled')
      await close.click()
      await popup.waitFor({ state: 'detached' })
    }
  } finally { await browser.close() }
})

test('second hotel only includes the first hotel location and resets incompatible choices', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage()
  const thirdId = '00000000-0000-4000-8000-000000000003'
  const fourthId = '00000000-0000-4000-8000-000000000004'
  const properties = [...hotels,
    property(thirdId, 'Pahalgam Retreat', { location: 'Pahalgam' }),
    property(fourthId, 'Apple Stay', { location: 'Pahalgam' }),
  ]
  await setup(page, (route) => route.fulfill({ json: { hotels: properties, total: properties.length, page: 1, pageSize: 25 } }))
  try {
    await page.goto(`${origin}/hotels/compare?left=${thirdId}`)
    const first = page.getByRole('combobox', { name: 'First hotel', exact: true })
    const second = page.getByRole('combobox', { name: 'Second hotel', exact: true })
    await second.locator(`option[value="${fourthId}"]`).waitFor({ state: 'attached' })
    assert.deepEqual(await second.locator('option:not([value=""])').allTextContents(), ['Apple Stay — Pahalgam'])
    await second.selectOption(fourthId)
    await first.selectOption(firstId)
    await second.locator(`option[value="${secondId}"]`).waitFor({ state: 'attached' })
    assert.equal(await second.inputValue(), '')
    assert.deepEqual(await second.locator('option:not([value=""])').allTextContents(), ['Lake Houseboat — Dal Lake, Srinagar'])
    await first.selectOption('')
    await second.locator(`option[value="${secondId}"]`).waitFor({ state: 'detached' })
    assert.equal(await second.isDisabled(), true)
    await page.goto(`${origin}/hotels/compare?left=${thirdId}&right=${firstId}`)
    await first.waitFor()
    assert.equal(await second.inputValue(), '', 'Legacy cross-location selection is not compared')
    await page.goto(`${origin}/hotels/${thirdId}`)
    await page.locator('.hotel-detail-actions').getByRole('button', { name: 'Compare', exact: true }).click()
    await second.locator(`option[value="${fourthId}"]`).waitFor({ state: 'attached' })
    assert.equal(await first.inputValue(), thirdId)
    assert.deepEqual(await second.locator('option:not([value=""])').allTextContents(), ['Apple Stay — Pahalgam'])
  } finally { await browser.close() }
})

test('comparison reports loading, API failures, empty lists and unavailable selections with retry', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage()
  let state = 'error'
  let release
  const gate = new Promise((resolve) => { release = resolve })
  await setup(page, async (route) => {
    if (state === 'loading') await gate
    if (state === 'error') return route.fulfill({ status: 503, json: { error: 'Hotels temporarily unavailable' } })
    return route.fulfill({ json: { hotels: state === 'empty' ? [] : hotels.slice(0, 1), total: state === 'empty' ? 0 : 1, page: 1, pageSize: 25 } })
  })
  const comparison = page.locator('.hotel-comparison-page')
  try {
    await page.goto(`${origin}/hotels/compare?left=missing`)
    await comparison.getByRole('alert').filter({ hasText: 'Hotels temporarily unavailable' }).waitFor()
    state = 'empty'
    await page.getByRole('button', { name: 'Retry loading hotels', exact: true }).click()
    await page.getByRole('heading', { name: 'No approved properties to compare yet' }).waitFor()
    state = 'loading'
    const loadingRequest = page.waitForRequest('**/api/hotels*')
    await page.reload()
    await loadingRequest
    await page.getByRole('status').filter({ hasText: 'Loading hotels to compare' }).waitFor()
    state = 'loaded'
    release?.()
    await page.getByRole('alert').filter({ hasText: 'A selected property is no longer available' }).waitFor()
    await page.getByRole('status').filter({ hasText: 'Only one property' }).waitFor()
    await page.getByRole('combobox', { name: 'First hotel', exact: true }).selectOption(firstId)
    await comparison.getByRole('alert').waitFor({ state: 'detached' })
    assert.equal(await comparison.getByRole('alert').count(), 0)
    await page.goto(`${origin}/hotels/compare?left=${firstId}&right=${firstId}`)
    await page.getByRole('combobox', { name: 'Second hotel', exact: true }).waitFor()
    assert.equal(await page.getByRole('combobox', { name: 'Second hotel', exact: true }).inputValue(), '')
  } finally { release?.(); await browser.close() }
})

test('regional directories and detail pages keep comparison selections within their region', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage()
  await setup(page, (route) => {
    const region = new URL(route.request().url()).searchParams.get('region')
    const location = region === 'Ladakh' ? 'Leh' : 'Jammu'
    return route.fulfill({ json: { hotels: [property(firstId, `${region} Hotel`, { region, location })], total: 1, page: 1, pageSize: 25 } })
  })
  try {
    for (const region of ['ladakh', 'jammu']) {
      await page.goto(`${origin}/${region}/hotels`)
      await page.locator('.hotel-card').waitFor()
      assert.equal(await page.getByRole('button', { name: 'Compare', exact: true }).count(), 1)
      await page.getByRole('button', { name: 'Compare', exact: true }).first().click()
      await page.getByRole('heading', { name: 'Compare hotels', exact: true }).waitFor()
      assert.equal(new URL(page.url()).pathname, `/${region}/hotels`)
      await page.goto(`${origin}/${region}/hotels/${firstId}`)
      await page.locator('.hotel-detail-actions').getByRole('button', { name: 'Compare', exact: true }).click()
      await page.getByRole('combobox', { name: 'First hotel', exact: true }).waitFor()
      assert.equal(await page.getByRole('combobox', { name: 'First hotel', exact: true }).inputValue(), firstId)
      assert.equal(await page.getByRole('combobox', { name: 'Second hotel', exact: true }).isDisabled(), true)
      await page.getByRole('status').filter({ hasText: /No other properties in .* are currently available to compare/ }).waitFor()
      assert.equal(new URL(page.url()).pathname, `/${region}/hotels/${firstId}`)
    }
  } finally { await browser.close() }
})
