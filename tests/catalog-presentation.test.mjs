import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { orderHotelsForVisit } from '../src/services/hotelOrdering.ts'
import { tourPackages } from '../src/data/catalog.ts'
import { kashmirPhotoGallery } from '../src/data/kashmirPhotoGallery.ts'
import { providedDestinationPhotos } from '../src/data/previewPhotos.ts'

const origin = process.env.AVELOF_HOTEL_TEST_URL || 'http://127.0.0.1:8792'

test('Premium and Luxury swap covers with matching gallery descriptions', () => {
  const premium = tourPackages.find(({ id }) => id === 'premium')
  const luxury = tourPackages.find(({ id }) => id === 'luxury')
  assert.equal(premium.image, providedDestinationPhotos.sonamarg)
  assert.equal(luxury.image, kashmirPhotoGallery.snowLodge.image)
  assert.equal(premium.badge, 'Most selling package')
  assert.equal(luxury.badge, undefined)
  for (const item of [premium, luxury]) assert.equal(item.gallery[0], item.image)
  assert.equal(premium.galleryAlts[0], kashmirPhotoGallery.snowyPeaks.alt)
  assert.equal(luxury.galleryAlts[0], kashmirPhotoGallery.snowLodge.alt)
})

test('hotel order is complete, stable for a visit and independent of newest-first input', () => {
  const hotels = Array.from({ length: 60 }, (_, index) => ({ id: `hotel-${index}` }))
  const first = orderHotelsForVisit(hotels, 'visit-one')
  assert.deepEqual(orderHotelsForVisit([...hotels].reverse(), 'visit-one'), first)
  assert.equal(new Set(first.map(({ id }) => id)).size, hotels.length)
  assert.notDeepEqual(first, hotels)
  assert.notDeepEqual(orderHotelsForVisit(hotels, 'visit-two'), first)
  const subset = hotels.slice(10, 30)
  assert.deepEqual(orderHotelsForVisit(subset, 'visit-one'), first.filter(({ id }) => subset.some((hotel) => hotel.id === id)))
  assert.deepEqual(hotels.map(({ id }) => id), Array.from({ length: 60 }, (_, index) => `hotel-${index}`))
})

test('public hotels shuffle across pagination and retain the visit order after navigation and reload', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage()
  const hotels = Array.from({ length: 28 }, (_, index) => {
    const id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
    return {
      id, hotelId: `AVELOF_HTL_${10001 + index}GLM`, name: `Visit Hotel ${index + 1}`,
      location: 'Gulmarg', category: 'Premium', description: 'Comfortable mountain hotel with local hospitality.',
      price: 4500, mealPlan: 'Room only', heating: 'Centralised heating', amenities: ['Wi-Fi'],
      highlights: ['Mountain views'], roomTypes: ['Standard (2 rooms)'], totalRooms: 2,
      checkIn: '14:00', checkOut: '11:00', photos: [`/api/hotel-images/${id}/0`],
    }
  })
  let reversed = false
  await page.route('**/api/pricing', (route) => route.fulfill({ json: { discountPercent: 23, version: 1 } }))
  await page.route('**/api/hotels*', (route) => {
    const number = Number(new URL(route.request().url()).searchParams.get('page') || 1)
    const ordered = reversed ? [...hotels].reverse() : hotels
    return route.fulfill({ json: { hotels: ordered.slice((number - 1) * 25, number * 25), total: hotels.length, page: number, pageSize: 25 } })
  })
  const titles = page.locator('.hotel-card .catalog-title h3')
  const waitForHotels = () => page.waitForFunction(() => document.querySelectorAll('.hotel-card').length === 28)
  try {
    await page.goto(`${origin}/hotels`)
    await waitForHotels()
    const seed = await page.evaluate(() => sessionStorage.getItem('avelof:hotel-order'))
    assert.ok(seed)
    const expected = orderHotelsForVisit(hotels, seed).map(({ name }) => name)
    assert.deepEqual(await titles.allTextContents(), expected)
    reversed = true
    await page.goto(`${origin}/tour-packages`)
    await page.goto(`${origin}/hotels`)
    await waitForHotels()
    assert.deepEqual(await titles.allTextContents(), expected)
    await page.reload()
    await waitForHotels()
    assert.deepEqual(await titles.allTextContents(), expected)
    assert.equal(await page.evaluate(() => sessionStorage.getItem('avelof:hotel-order')), seed)
    await page.setViewportSize({ width: 390, height: 844 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  } finally { await browser.close() }
})

test('package badges render on cards and detail pages and theme survives a returning browser visit', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const mockApis = async (context) => {
    await context.route('**/api/pricing', (route) => route.fulfill({ json: { discountPercent: 23, version: 1 } }))
    await context.route('**/api/hotels*', (route) => route.fulfill({ json: { hotels: [], total: 0, page: 1, pageSize: 25 } }))
  }
  try {
    const context = await browser.newContext()
    await mockApis(context)
    const page = await context.newPage()
    for (const path of ['/', '/tour-packages']) {
      await page.goto(`${origin}${path}`)
      const card = page.locator('.catalog-card').filter({ has: page.getByRole('heading', { name: 'Premium', exact: true }) })
      assert.equal(await card.getByText('Most selling package', { exact: true }).count(), 1)
      assert.equal(await card.locator('.catalog-image img').getAttribute('src'), providedDestinationPhotos.sonamarg)
    }
    await page.goto(`${origin}/tour-packages/premium`)
    assert.equal(await page.getByText('Most selling package', { exact: true }).count(), 1)
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark')
    let saved = await context.storageState()
    await context.close()
    for (const theme of ['dark', 'light']) {
      const returning = await browser.newContext({ storageState: saved })
      await mockApis(returning)
      const returnedPage = await returning.newPage()
      await returnedPage.goto(origin)
      assert.equal(await returnedPage.locator('html').getAttribute('data-theme'), theme)
      assert.equal(await returnedPage.evaluate(() => localStorage.getItem('avelof:theme')), theme)
      if (theme === 'dark') {
        await returnedPage.getByRole('switch', { name: 'Dark mode', exact: true }).click()
        saved = await returning.storageState()
      }
      await returning.close()
    }
  } finally { await browser.close() }
})
