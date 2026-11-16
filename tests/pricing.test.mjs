import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'

const origin = process.env.AVELOF_HOTEL_TEST_URL || 'http://localhost:8792'
const id = '00000000-0000-4000-8000-000000000001'

test('hotel/package prices show 30% off with rupee symbols, save discounted enquiries and preserve cab offers', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  let pricingRequests = 0, enquiry
  await page.route('**/api/pricing', (route) => {
    pricingRequests++
    return route.fulfill({ status: 503, json: { error: 'Retired pricing endpoint' } })
  })
  await page.route('**/api/hotels*', (route) => route.fulfill({ json: {
    hotels: [{
      id, hotelId: 'AVELOF_HTL_10001GLM', name: 'Pricing Test Hotel', location: 'Gulmarg', category: 'Premium',
      description: 'Comfortable hotel rooms in the mountain valley.', price: 2030, originalPrice: 2900,
      roomRates: [{ roomType: 'Standard', count: 6, price: 2030, originalPrice: 2900 }, { roomType: 'Family', count: 6, price: 4060, originalPrice: 5800 }],
      roomTypes: ['Standard (6 rooms)', 'Family (6 rooms)'], totalRooms: 12, mealPlan: 'Room only',
      taxDetails: 'All taxes included', gstPercent: 18,
      heating: 'Hot & cold AC', amenities: ['Wi-Fi'], highlights: ['Mountain views'], breakfastPrice: 200, dinnerPrice: 300,
      checkIn: '14:00', checkOut: '11:00', photos: [`/api/hotel-images/${id}/0`],
    }], total: 1, page: 1, pageSize: 25,
  } }))
  await page.route('**/api/enquiry-access*', (route) => route.fulfill({ json: { enquiries: [], total: 0, page: 1, pageSize: 25 } }))
  await page.route('**/api/push*', (route) => route.fulfill({ status: 503, json: { error: 'Push is not configured.' } }))
  await page.route('**/api/enquiries', (route) => {
    enquiry = route.request().postDataJSON()
    return route.fulfill({ status: 201, json: { saved: true, requestReference: enquiry.reference, reference: enquiry.kind === 'hotel' ? 'AVELOF_HTL_10001' : 'AVELOF_DLX_10001' } })
  })
  const form = page.locator('.enquiry-form')
  async function submitHotel() {
    await form.getByLabel('Name', { exact: true }).fill('Hotel Pricing Guest')
    await form.getByLabel('Phone number').fill('9876543210')
    await form.locator('[name=checkInDate]').fill('2027-01-10')
    await form.locator('[name=checkOutDate]').fill('2027-01-12')
    await form.locator('[type=submit]').click()
    await page.getByRole('heading', { name: 'Thank you for submitting your details.' }).waitFor()
  }
  try {
    await page.goto(`${origin}/tour-packages`)
    for (const [name, price, original] of [['Deluxe', '15,400', '22,000'], ['Premium', '25,200', '36,000']]) {
      const card = page.locator('.catalog-card').filter({ has: page.getByRole('heading', { name, exact: true }) })
      assert.ok((await card.locator('.price').innerText()).includes(price))
      assert.equal(await card.locator('s').innerText(), `₹${original}`)
      assert.equal(await card.locator('.discount-label').innerText(), '30% off')
      const tile = page.locator('.offer-tile').filter({ hasText: `${name} package` })
      assert.ok((await tile.innerText()).includes(price))
      assert.equal(await tile.locator('s').innerText(), `₹${original}`)
      assert.equal(await tile.locator('.discount-label').innerText(), '30% off')
    }
    await page.goto(`${origin}/tour-packages/deluxe`)
    assert.ok((await page.locator('.detail-aside').innerText()).includes('15,400'))
    assert.equal(await page.locator('.detail-aside s').innerText(), '₹22,000')
    await page.locator('.package-end-booking').getByRole('button', { name: 'Book Now', exact: true }).click()
    await form.getByText('Package rate: ₹15,400 per person.', { exact: true }).waitFor()
    await form.getByLabel('Name', { exact: true }).fill('Package Pricing Guest')
    await form.getByLabel('Phone number').fill('9876543210')
    await form.locator('[name=arrivalDate]').fill('2027-01-10')
    await form.locator('[name=departureDate]').fill('2027-01-12')
    await form.locator('[type=submit]').click()
    await page.getByRole('heading', { name: 'Thank you for submitting your details.' }).waitFor()
    assert.equal(enquiry.fields.packageRate, '₹15,400 per person')
    await page.goto(`${origin}/hotels`)
    const hotel = page.locator('.hotel-card')
    assert.equal(await hotel.locator('.hotel-rates strong').innerText(), '₹2,030')
    assert.equal(await hotel.locator('s').innerText(), '₹2,900')
    assert.equal(await hotel.locator('.discount-label').innerText(), '30% off')
    assert.ok(!/GST|tax|INR/i.test(await hotel.innerText()))
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      assert.equal(await hotel.locator('.hotel-rates').evaluate((element) => element.scrollWidth > element.clientWidth), false)
      const regular = await hotel.locator('s').boundingBox()
      const payable = await hotel.locator('.hotel-rates strong').boundingBox()
      assert.ok(regular.y + regular.height <= payable.y + 1, 'Regular price appears above the payable price')
    }
    await page.setViewportSize({ width: 390, height: 900 })
    await hotel.getByRole('button', { name: 'Book Now', exact: true }).click()
    const rates = form.locator('.hotel-rates')
    await rates.getByLabel('Breakfast', { exact: false }).check()
    await rates.getByLabel('Dinner', { exact: false }).check()
    assert.equal(await rates.locator('strong[role=status]').innerText(), '₹2,530')
    assert.equal(await rates.locator('s').innerText(), '₹2,900', 'Meals do not inflate the regular room rate')
    assert.equal(await rates.locator('.discount-label').innerText(), '30% off', 'Room discount stays separate from meal add-ons')
    assert.ok((await rates.locator('.hotel-meal-coverage').innerText()).includes('for 2 people per room'))
    await submitHotel()
    assert.ok(enquiry.fields.hotelStayEstimate.includes('5,060'))
    assert.ok(!/GST|tax|INR/i.test(JSON.stringify(enquiry.fields)))
    await page.goto(`${origin}/hotels/${id}`)
    assert.equal(await page.locator('.detail-aside .hotel-rates strong').innerText(), '₹2,030')
    await page.locator('.hotel-end-booking').getByRole('button', { name: 'Book Now', exact: true }).click()
    await rates.getByLabel('Room type', { exact: true }).selectOption('Family')
    await rates.getByLabel('Breakfast', { exact: false }).check()
    await rates.getByLabel('Dinner', { exact: false }).check()
    await form.getByLabel('Adults', { exact: true }).fill('8')
    assert.equal(await rates.locator('strong[role=status]').innerText(), '₹5,060')
    assert.equal(await rates.locator('s').innerText(), '₹5,800')
    assert.ok((await rates.locator('.hotel-meal-coverage').innerText()).includes('2 rooms cover 8 people'))
    await submitHotel()
    assert.ok(enquiry.fields.hotelStayEstimate.includes('20,240'))
    await page.goto(`${origin}/tour-packages`)
    const planner = page.locator('.trip-planner')
    await planner.getByLabel('Start date').fill('2027-01-10')
    await planner.getByLabel('End date').fill('2027-01-14')
    await planner.getByRole('button', { name: 'Next: places' }).click()
    await planner.getByRole('button', { name: 'Next: vehicle' }).click()
    await planner.getByRole('button', { name: 'Next: activities' }).click()
    await planner.getByRole('button', { name: 'Next: hotels' }).click()
    await planner.getByRole('button', { name: 'Stay in Gulmarg', exact: true }).click()
    const plannedHotel = planner.locator('.planner-hotel-card').filter({ hasText: 'Pricing Test Hotel' })
    await plannedHotel.locator('.planner-hotel-tile').click()
    assert.equal(await plannedHotel.locator('s').innerText(), '₹2,900')
    assert.equal(await plannedHotel.locator('.discount-label').innerText(), '30% off')
    await plannedHotel.getByLabel('Dinner', { exact: false }).check()
    assert.ok((await planner.locator('.planner-trip-estimate').innerText()).includes('Selected stays: ₹2,330'))
    assert.ok(!(await planner.innerText()).includes('INR'))
    await planner.getByRole('button', { name: 'Continue with this plan' }).click()
    await form.getByLabel('Name', { exact: true }).fill('Discounted Planner Guest')
    await form.getByLabel('Phone number').fill('9876543210')
    await form.getByRole('button', { name: 'Submit enquiry' }).click()
    await page.getByRole('heading', { name: 'Thank you for submitting your details.' }).waitFor()
    assert.ok(enquiry.fields.customDetails.includes('hotel rate: ₹2,330'))
    await page.goto(`${origin}/car-rentals`)
    assert.ok((await page.locator('.catalog-card').first().locator('.price').innerText()).includes('2,000'))
    assert.ok((await page.locator('.offer-tile-cabs').innerText()).includes('30% off'))
    await page.goto(`${origin}/admin/panel`)
    await page.getByRole('heading', { name: 'Enquiry dashboard', exact: true }).waitFor()
    assert.equal(await page.locator('[name=discountPercent]').count(), 0)
    await page.goto(`${origin}/admin/panel/hotels`)
    assert.equal(await page.locator('[name=gstPercent]').count(), 0)
    await page.goto(`${origin}/register-hotel`)
    assert.equal(await page.locator('[name=taxDetails], [name=gstPercent]').count(), 0)
    assert.equal(pricingRequests, 0)
  } finally { await browser.close() }
})
