import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { tourPackages } from '../src/data/catalog.ts'
import { hotelsForPackageStay, packageWithHotelOptions } from '../src/services/packageHotels.ts'
import { tourPackagePdfData } from '../src/services/itineraryPdf.ts'

const origin = process.env.AVELOF_HOTEL_TEST_URL || 'http://127.0.0.1:8792'
const stay = { location: 'Srinagar', nights: 3, hotel: 'Stay at a Deluxe hotel' }
const hotel = (id, name, category, price, location = 'Srinagar', propertyType = 'Hotel', extra = {}) => ({
  id, registeredHotelId: `AVELOF_HTL_${id}`, name, category, price, location, propertyType, facilities: [], ...extra,
})

test('package options match category, destination, type and lowest price with stable ties', () => {
  const hotels = [
    hotel('4', 'Fourth', 'Deluxe', 4000), hotel('3', 'Third', 'Deluxe', 3000),
    hotel('2', 'Beta', 'Deluxe', 2000), hotel('1', 'Alpha', 'Deluxe', 2000),
    hotel('5', 'Premium Plus', 'Premium Plus', 1000), hotel('6', 'Premium', 'Premium', 900),
    hotel('7', 'Luxury', 'Luxury', 1500), hotel('8', 'Diamond', 'Diamond', 1300),
    hotel('9', 'Luxury boat', 'Luxury Houseboat', 1100, 'Srinagar', 'Houseboat'),
    hotel('10', 'Other place', 'Deluxe', 10, 'Pahalgam'),
    { ...hotel('11', 'Not registered', 'Deluxe', 1), registeredHotelId: undefined },
  ]
  assert.deepEqual(hotelsForPackageStay(hotels, 'deluxe', stay).map(({ name }) => name), ['Alpha', 'Beta', 'Third'])
  assert.deepEqual(hotelsForPackageStay(hotels, 'premium', stay).map(({ name }) => name), ['Premium', 'Premium Plus'])
  assert.deepEqual(hotelsForPackageStay(hotels, 'luxury', stay).map(({ name }) => name), ['Diamond', 'Luxury'])
  assert.deepEqual(hotelsForPackageStay(hotels, 'luxury', { ...stay, propertyType: 'Houseboat' }).map(({ name }) => name), ['Luxury boat'])
  assert.deepEqual(hotelsForPackageStay(hotels, 'deluxe', { ...stay, location: 'Gulmarg' }), [])
  const resolved = packageWithHotelOptions(tourPackages[0], hotels)
  assert.ok(tourPackagePdfData(resolved).overview.some((line) => /Alpha, Beta, Third.*subject to availability/.test(line)))
  assert.equal(tourPackages[0].stays[0].hotel, 'Stay at a Deluxe hotel')
})

test('package options rank by smoothed reviews, value and amenities, never showing more than three', () => {
  const amenities = Array.from({ length: 10 }, (_, index) => `Amenity ${index}`)
  const hotels = [
    hotel('a', 'Cheapest unrated', 'Deluxe', 1000),
    hotel('b', 'Well reviewed', 'Deluxe', 1500, 'Srinagar', 'Hotel', { hotelAverageRating: 4.8, hotelReviewCount: 20, facilities: amenities }),
    hotel('c', 'Poorly reviewed', 'Deluxe', 2000, 'Srinagar', 'Hotel', { hotelAverageRating: 2, hotelReviewCount: 10, facilities: amenities }),
    hotel('d', 'Expensive unrated', 'Deluxe', 3000, 'Srinagar', 'Hotel', { facilities: amenities }),
  ]
  assert.deepEqual(hotelsForPackageStay(hotels, 'deluxe', stay).map(({ name }) => name), ['Well reviewed', 'Cheapest unrated', 'Poorly reviewed'])
  const single = [
    hotel('e', 'One perfect review', 'Deluxe', 2000, 'Srinagar', 'Hotel', { hotelAverageRating: 5, hotelReviewCount: 1 }),
    hotel('f', 'Many strong reviews', 'Deluxe', 2000, 'Srinagar', 'Hotel', { hotelAverageRating: 4.6, hotelReviewCount: 40 }),
  ]
  assert.deepEqual(hotelsForPackageStay(single, 'deluxe', stay).map(({ name }) => name), ['Many strong reviews', 'One perfect review'])
})

test('every itinerary stay link points at an existing stay card for the right destination', () => {
  for (const item of tourPackages) {
    for (const stop of item.itinerary) {
      if (!stop.stayLink) continue
      assert.ok(stop.detail.includes(stop.stayLink.text), `${item.id} ${stop.day} contains its stay link text`)
      const target = item.stays[stop.stayLink.stayIndex]
      assert.ok(target, `${item.id} ${stop.day} links to an existing stay`)
      assert.match(`${stop.title} ${stop.detail}`, new RegExp(target.propertyType === 'Houseboat' ? 'houseboat' : target.location, 'i'))
    }
    assert.equal(item.itinerary.filter((stop) => stop.stayLink).length, item.itinerary.length - 1, `${item.id} links every overnight day`)
  }
})

test('package detail and comparison load approved options across pages, link to hotels and recover from errors', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  const property = (number, name, category, price, location = 'Srinagar', propertyType = 'Hotel') => {
    const id = `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`
    return {
      id, hotelId: `AVELOF_${propertyType === 'Houseboat' ? 'HB' : 'HTL'}_${String(10000 + number)}SRG`, name, location, category, propertyType,
      description: 'Comfortable accommodation for a Kashmir trip.', price, mealPlan: 'Room only', heating: 'Room heaters',
      amenities: ['Wi-Fi'], highlights: ['Near the market'], roomTypes: ['Deluxe'], totalRooms: 2,
      checkIn: '14:00', checkOut: '11:00', photos: [`/api/hotel-images/${id}/0`],
    }
  }
  const properties = [
    ...Array.from({ length: 25 }, (_, index) => property(index + 1, `Gulmarg ${index + 1}`, 'Premium', 5000 + index, 'Gulmarg')),
    property(26, 'Deluxe Cheapest', 'Deluxe', 1000), property(27, 'Deluxe Second', 'Deluxe', 2000),
    property(28, 'Deluxe Third', 'Deluxe', 3000), property(29, 'Deluxe Fourth', 'Deluxe', 4000),
    property(30, 'Premium Plus Stay', 'Premium Plus', 1000), property(31, 'Luxury Valley', 'Luxury', 3000, 'Pahalgam'),
    property(32, 'Luxury Boat', 'Luxury Houseboat', 1000, 'Srinagar', 'Houseboat'),
  ]
  let fail = false
  await page.route('**/api/pricing*', (route) => route.fulfill({ json: { discountPercent: 23, version: 1 } }))
  await page.route('**/api/hotels*', (route) => {
    if (fail) return route.fulfill({ status: 503, json: { error: 'Hotel service unavailable' } })
    const params = new URL(route.request().url()).searchParams
    const selected = params.get('id')
    const number = Number(params.get('page') || 1)
    const entries = selected ? properties.filter((item) => item.id === selected) : properties
    return route.fulfill({ json: { hotels: entries.slice((number - 1) * 25, number * 25), total: entries.length, page: number, pageSize: 25 } })
  })
  try {
    await page.goto(`${origin}/tour-packages/deluxe`)
    const srinagar = page.locator('.package-stay-grid article').filter({ has: page.getByRole('heading', { name: 'Srinagar', exact: true }) })
    await srinagar.getByRole('link', { name: 'Deluxe Cheapest' }).waitFor()
    assert.deepEqual(await srinagar.locator('.package-stay-option-name').allTextContents(), ['Deluxe Cheapest', 'Deluxe Second', 'Deluxe Third'])
    assert.deepEqual(await srinagar.locator('.package-stay-option-category').allTextContents(), ['Deluxe', 'Deluxe', 'Deluxe'])
    assert.match(await srinagar.innerText(), /subject to availability and confirmation/i)
    assert.match(await page.locator('.package-stay-grid').innerText(), /Stay at a Deluxe hotel/)
    assert.equal(await srinagar.getByRole('link', { name: 'Deluxe Cheapest' }).getAttribute('href'), `/hotels/${properties[25].id}`)
    await srinagar.getByRole('link', { name: 'Deluxe Cheapest' }).click()
    await page.getByRole('heading', { name: 'Deluxe Cheapest', exact: true, level: 1 }).waitFor()
    await page.goto(`${origin}/tour-packages/luxury`)
    await page.getByRole('link', { name: 'Luxury Valley Luxury', exact: true }).waitFor()
    assert.equal(await page.locator('.package-stay-grid').getByRole('link', { name: 'Luxury Boat Luxury Houseboat', exact: true }).count(), 1)
    assert.match(await page.locator('.package-stay-grid').innerText(), /Stay at a luxury hotel/)
    await page.goto(`${origin}/tour-packages`)
    await page.locator('.package-comparison-intro button').click()
    const dialog = page.getByRole('dialog', { name: 'Compare Kashmir packages' })
    const overnight = dialog.locator('.comparison-feature').filter({ has: page.locator('summary', { hasText: /^Overnight stays$/ }) })
    await overnight.locator('summary').click()
    await overnight.getByRole('link', { name: 'Premium Plus Stay Premium Plus', exact: true }).waitFor()
    await overnight.getByRole('link', { name: 'Premium Plus Stay Premium Plus', exact: true }).click()
    await page.getByRole('heading', { name: 'Premium Plus Stay', exact: true, level: 1 }).waitFor()
    fail = true
    await page.goto(`${origin}/tour-packages/deluxe`)
    await page.locator('.package-journey').getByRole('alert').filter({ hasText: 'Hotel service unavailable' }).waitFor()
    fail = false
    await page.getByRole('button', { name: 'Retry loading hotels' }).click()
    await page.getByRole('link', { name: 'Deluxe Cheapest Deluxe', exact: true }).waitFor()
    await page.locator('.package-journey').evaluate(() => scrollTo(0, document.body.scrollHeight))
    await page.getByRole('link', { name: /^check in at a Deluxe package hotel – view Pahalgam stay options$/ }).click()
    await page.waitForFunction(() => document.activeElement?.id === 'package-stay-1')
    await page.waitForFunction(() => { const box = document.getElementById('package-stay-1').getBoundingClientRect(); return box.top >= 0 && box.bottom <= innerHeight })
    assert.equal(new URL(page.url()).hash, '')
    assert.match(await page.locator('#package-stay-1 h3').innerText(), /^Pahalgam$/)
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    }
  } finally { await browser.close() }
})
