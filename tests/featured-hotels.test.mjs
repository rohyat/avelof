import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { selectFeaturedHotels } from '../src/services/featuredHotels.ts'

const hotel = (id, location, category, price) => ({ id, location, category, price })

test('featured stays select the highest category per location and cheapest price within that category', () => {
  const hotels = [
    hotel('srinagar-cheap-premium', 'Srinagar', 'Premium', 1000),
    hotel('srinagar-luxury-expensive', 'Srinagar', 'Luxury', 6000),
    hotel('srinagar-luxury-value', 'Srinagar', 'Luxury', 4000),
    hotel('pahalgam-premium', 'Pahalgam', 'Premium', 2000),
    hotel('pahalgam-premium-plus-expensive', 'Pahalgam', 'Premium Plus', 3500),
    hotel('pahalgam-premium-plus-value', 'Pahalgam', 'Premium Plus', 3000),
    hotel('gulmarg-deluxe', 'Gulmarg', 'Deluxe', 900),
    hotel('sonamarg-premium', 'Sonamarg', 'Premium', 2500),
    hotel('yusmarg-premium', 'Yusmarg', 'Premium', 2600),
  ]
  const before = [...hotels]
  assert.deepEqual(selectFeaturedHotels(hotels).map(({ id }) => id), [
    'srinagar-luxury-value', 'pahalgam-premium-plus-value', 'sonamarg-premium',
  ])
  assert.deepEqual(hotels, before, 'Selection does not mutate directory order')
  assert.deepEqual(selectFeaturedHotels([...hotels].reverse()), selectFeaturedHotels(hotels), 'Visit shuffle/click order cannot override the selection')
})

test('featured stays never fall back below Premium and only fill available locations', () => {
  assert.deepEqual(selectFeaturedHotels([]), [])
  assert.deepEqual(selectFeaturedHotels([
    hotel('deluxe', 'Srinagar', 'Deluxe', 1),
    hotel('unknown', 'Pahalgam', 'Unknown', 1),
    hotel('boat', 'Srinagar', 'Deluxe Houseboat', 1),
  ]), [])
  const premium = hotel('premium', 'Srinagar', 'Premium', 2000)
  assert.deepEqual(selectFeaturedHotels([premium, hotel('other', ' srinagar ', 'Premium', 3000)]), [premium])
  assert.deepEqual(selectFeaturedHotels([
    hotel('b', 'Srinagar', 'Premium', 2000), hotel('a', 'Srinagar', 'Premium', 2000),
  ]).map(({ id }) => id), ['a'])
})

test('Premium and Luxury houseboats meet the same minimum category requirement', () => {
  assert.deepEqual(selectFeaturedHotels([
    hotel('premium-boat', 'Srinagar', 'Premium Houseboat', 1500),
    hotel('luxury-boat', 'Srinagar', 'Luxury Houseboat', 3500),
    hotel('premium-hotel', 'Pahalgam', 'Premium', 2000),
  ]).map(({ id }) => id), ['luxury-boat', 'premium-hotel'])
})

test('Stays offers load every public page, show three location winners and keep prices/photos/links in sync', async () => {
  const origin = process.env.AVELOF_HOTEL_TEST_URL || 'http://127.0.0.1:8792'
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  const listing = (index, location, category, price) => {
    const id = `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
    return {
      id, hotelId: `AVELOF_HTL_${10000 + index}SRG`, name: `Stay ${index}`, location, category,
      description: 'A registered stay with comfortable rooms for travellers.', price,
      originalPrice: price * 2, discountPercent: 50, roomTypes: ['Standard (6 rooms)'],
      roomRates: [{ roomType: 'Standard', count: 6, price, originalPrice: price * 2 }],
      totalRooms: 6, mealPlan: 'Room only', heating: 'Centralised heating', amenities: ['Wi-Fi'],
      highlights: ['Near the market'], checkIn: '14:00', checkOut: '11:00',
      photos: [`/api/hotel-images/${id}/0`],
    }
  }
  const hotels = [
    listing(1, 'Srinagar', 'Premium', 500),
    listing(2, 'Srinagar', 'Luxury', 6000),
    listing(3, 'Pahalgam', 'Premium Plus', 4000),
    listing(4, 'Sonamarg', 'Premium', 2000),
    ...Array.from({ length: 21 }, (_, index) => listing(index + 5, 'Gulmarg', 'Deluxe', 100)),
    listing(26, 'Srinagar', 'Luxury', 3000),
    listing(27, 'Pahalgam', 'Premium Plus', 2500),
  ]
  const requestedPages = []
  let state = 'available'
  await page.addInitScript((id) => localStorage.setItem('avelof:hotel-clicks', JSON.stringify([id])), hotels[1].id)
  await page.route('**/api/pricing', (route) => route.fulfill({ json: { discountPercent: 23, version: 1 } }))
  await page.route('**/api/hotels*', (route) => {
    const url = new URL(route.request().url())
    assert.equal(url.searchParams.has('id'), false, 'Offers no longer request a hardcoded hotel')
    assert.equal(url.searchParams.get('region'), 'Kashmir')
    const currentPage = Number(url.searchParams.get('page'))
    requestedPages.push(currentPage)
    if (state === 'error') return route.fulfill({ status: 503, json: { error: 'Stays unavailable. Please retry.' } })
    const available = state === 'empty' ? hotels.filter((hotel) => hotel.category === 'Deluxe') : hotels
    return route.fulfill({ json: { hotels: available.slice((currentPage - 1) * 25, currentPage * 25), total: available.length, page: currentPage, pageSize: 25 } })
  })
  await page.route('**/api/hotel-images/**', (route) => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"/>',
  }))
  try {
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(origin)
      const slides = page.locator('.offer-tile').filter({ has: page.locator('.offer-tile-copy > strong', { hasText: /^Hotels/ }) })
      await slides.getByText('Stay 26 · Luxury - 5-star', { exact: true }).waitFor()
      assert.equal(await slides.count(), 3)
      for (const [index, stay] of [hotels[25], hotels[26], hotels[3]].entries()) {
        const slide = slides.nth(index)
        assert.equal(await slide.locator('.offer-payable b').innerText(), `₹${stay.price.toLocaleString('en-IN')}`)
        assert.equal(await slide.locator('s').innerText(), `₹${stay.originalPrice.toLocaleString('en-IN')}`)
        assert.equal(await slide.locator('img').getAttribute('src'), stay.photos[0])
        assert.equal(await slide.getByRole('link').getAttribute('href'), `/hotels/${stay.id}`)
        const button = page.getByRole('button', { name: `Show Hotels · ${stay.location} offer`, exact: true })
        await button.click()
        await page.waitForFunction((title) => [...document.querySelectorAll('.offer-dot')].some((dot) => dot.title === title && dot.getAttribute('aria-current') === 'true'), `Hotels · ${stay.location}`)
        assert.equal(await slide.getByRole('link').getAttribute('tabindex'), '0')
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      assert.equal(await page.locator('.offer-tile-cabs').count(), 1)
    }
    assert.ok(requestedPages.includes(2), 'Lower-priced winners on later pages are considered')
    state = 'error'
    await page.reload()
    const banner = page.locator('.offer-banner')
    await banner.getByRole('alert').filter({ hasText: 'Stays unavailable. Please retry.' }).waitFor()
    state = 'available'
    await banner.getByRole('button', { name: 'Retry hotel offer' }).click()
    await banner.getByText('Stay 26 · Luxury - 5-star', { exact: true }).waitFor()
    state = 'empty'
    await page.reload()
    await banner.getByRole('status').filter({ hasText: 'No approved Premium-or-higher stays are currently listed.' }).waitFor()
    assert.equal(await banner.getByText(/Stay \d/).count(), 0)
    assert.equal(await banner.getByRole('link', { name: 'Explore Hotels', exact: true }).getAttribute('href'), '/hotels')
  } finally { await browser.close() }
})
