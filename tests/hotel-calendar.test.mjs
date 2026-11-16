import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { featuredOfferHotelId as id } from '../src/data/offers.ts'

const origin = process.env.AVELOF_HOTEL_TEST_URL || 'http://localhost:8792'
const hotel = {
  id, hotelId: 'AVELOF_HTL_10003SRG', name: 'Hotel Crown Prince', location: 'Srinagar', category: 'Premium',
  description: 'Comfortable hotel rooms in the heart of Srinagar.', price: 2310, originalPrice: 3000, discountPercent: 23,
  roomRates: [{ roomType: 'Deluxe', count: 6, price: 2310, originalPrice: 3000 }, { roomType: 'Family', count: 3, price: 4620, originalPrice: 6000 }],
  roomTypes: ['Deluxe (6 rooms)', 'Family (3 rooms)'], totalRooms: 9, mealPlan: 'Room only', heating: 'Centralised heating', hotColdAc: true,
  amenities: ['Wi-Fi'], highlights: ['Near the market'], checkIn: '14:00', checkOut: '11:00',
  breakfastPrice: 200, dinnerPrice: 300, photos: [`/api/hotel-images/${id}/0`],
}

test('priced hotel calendars and mixed-season enquiries use nightly room rates without increasing meals', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  let enquiry
  await page.route('**/api/pricing', (route) => route.fulfill({ json: { discountPercent: 23, version: 1 } }))
  await page.route('**/api/hotels*', (route) => route.fulfill({ json: { hotels: [hotel], total: 1, page: 1, pageSize: 25 } }))
  await page.route('**/api/enquiries', (route) => {
    enquiry = route.request().postDataJSON()
    return route.fulfill({ status: 201, json: { saved: true, requestReference: enquiry.reference, reference: enquiry.kind === 'hotel' ? 'AVELOF_HTL_10001' : 'AVELOF_CSTM_10001' } })
  })
  await page.route('**/api/hotel-images/**', (route) => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"/>' }))
  try {
    await page.goto(`${origin}/hotels`)
    await page.locator('.hotel-card').getByRole('button', { name: 'Book Now', exact: true }).click()
    const form = page.locator('.enquiry-form')
    const rates = form.locator('.hotel-rates')
    await form.getByLabel('Start date', { exact: true }).fill('2026-12-05')
    await form.getByLabel('End date', { exact: true }).fill('2026-12-07')
    await form.getByRole('button', { name: 'Open start date price calendar' }).click()
    const calendar = form.getByRole('dialog', { name: 'December 2026', exact: true })
    await calendar.waitFor()
    assert.equal(await calendar.getByRole('button', { name: '5 December 2026, ₹2,310 per room for this night', exact: true }).locator('small').innerText(), '₹2,310')
    assert.equal(await calendar.getByRole('button', { name: '6 December 2026, ₹2,541 per room for this night', exact: true }).locator('small').innerText(), '₹2,541')
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      assert.equal(await calendar.evaluate((element) => element.scrollWidth > element.clientWidth), false)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    }
    await page.setViewportSize({ width: 390, height: 900 })
    await calendar.getByRole('button', { name: '5 December 2026, ₹2,310 per room for this night', exact: true }).press('ArrowRight')
    assert.ok((await page.locator(':focus').getAttribute('aria-label')).includes('6 December 2026'))
    await page.locator(':focus').press('Enter')
    assert.equal(await form.getByLabel('Start date', { exact: true }).inputValue(), '2026-12-06')
    assert.equal(await rates.locator('strong[role=status]').innerText(), '₹2,541')
    await form.getByLabel('Start date', { exact: true }).fill('2026-12-05')
    await form.getByRole('button', { name: 'View check-out calendar prices' }).click()
    assert.equal(await calendar.getByRole('button', { name: '5 December 2026, ₹2,310 per room for this night', exact: true }).isDisabled(), true)
    assert.ok((await calendar.innerText()).includes('check-out date is not charged'))
    await calendar.getByRole('button', { name: '6 December 2026, ₹2,541 per room for this night', exact: true }).click()
    assert.equal(await form.getByLabel('End date', { exact: true }).inputValue(), '2026-12-06')
    assert.ok((await form.locator('.hotel-stay-estimate').innerText()).includes('₹2,310'))
    await rates.getByLabel('Breakfast', { exact: false }).check()
    await rates.getByLabel('Dinner', { exact: false }).check()
    assert.ok((await form.locator('.hotel-stay-estimate').innerText()).includes('₹2,810'))
    await form.getByLabel('End date', { exact: true }).fill('2026-12-07')
    assert.ok((await form.locator('.hotel-stay-estimate').innerText()).includes('₹5,851'))
    assert.ok((await form.locator('.hotel-price-breakdown').innerText()).includes('₹2,810 to ₹3,041'))
    await form.getByRole('button', { name: 'View check-in calendar prices' }).click()
    await calendar.getByRole('button', { name: 'Next month' }).click()
    const january = form.getByRole('dialog', { name: 'January 2027', exact: true })
    assert.equal(await january.getByRole('button', { name: '1 January 2027, ₹2,541 per room for this night', exact: true }).locator('small').innerText(), '₹2,541')
    await january.getByRole('button', { name: 'Previous month' }).click()
    await calendar.press('Escape')
    assert.equal(await form.getByRole('dialog').count(), 0)
    assert.equal(await form.count(), 1, 'Escape closes the calendar, not the enquiry')
    await rates.getByLabel('Room type', { exact: true }).selectOption('Family')
    await form.getByLabel('Adults', { exact: true }).fill('8')
    await form.getByRole('button', { name: 'View check-in calendar prices' }).click()
    assert.equal(await calendar.getByRole('button', { name: '6 December 2026, ₹5,082 per room for this night', exact: true }).locator('small').innerText(), '₹5,082')
    await calendar.getByRole('button', { name: 'Close price calendar' }).click()
    assert.ok((await form.locator('.hotel-stay-estimate').innerText()).includes('₹23,404'))
    await form.getByLabel('Name', { exact: true }).fill('Seasonal Calendar Guest')
    await form.getByLabel('Phone number').fill('9876543210')
    await form.getByRole('button', { name: 'Submit enquiry', exact: true }).click()
    await page.getByRole('heading', { name: 'Thank you for submitting your details.' }).waitFor()
    assert.ok(enquiry.fields.hotelStayEstimate.includes('₹23,404'))
    assert.ok(enquiry.fields.nightlyRate.includes('₹5,620 to ₹6,082'))
    assert.ok(enquiry.fields.hotelPriceBreakdown.includes('1 night × ₹4,620'))
    assert.ok(enquiry.fields.hotelPriceBreakdown.includes('1 night × ₹5,082'))
    assert.ok(enquiry.fields.hotelPriceBreakdown.includes('meals ₹1,000 per room/night'))
    assert.equal(enquiry.fields.roomCount, '2')
    assert.equal(enquiry.fields.priceInclusions, 'All taxes and charges included')

    await page.goto(`${origin}/tour-packages`)
    const planner = page.locator('.trip-planner')
    await planner.getByLabel('Start date', { exact: true }).fill('2026-12-05')
    await planner.getByLabel('End date', { exact: true }).fill('2026-12-09')
    await planner.getByRole('button', { name: 'Next: places' }).click()
    await planner.getByRole('button', { name: 'Next: vehicle' }).click()
    await planner.getByRole('button', { name: 'Next: activities' }).click()
    await planner.getByRole('button', { name: 'Next: hotels' }).click()
    for (const [index, price] of [[0, '₹2,310'], [1, '₹2,541']]) {
      const card = planner.locator('.day-plan').nth(index).locator('.planner-hotel-card').filter({ hasText: 'Hotel Crown Prince' })
      await card.locator('.planner-hotel-tile').click()
      assert.equal(await card.locator('.hotel-rates strong[role=status]').innerText(), price)
    }
    assert.ok((await planner.locator('.planner-trip-estimate').innerText()).includes('Selected stays: ₹4,851'))
    await planner.getByRole('button', { name: 'Continue with this plan' }).click()
    await form.getByLabel('Name', { exact: true }).fill('Seasonal Planner Guest')
    await form.getByLabel('Phone number').fill('9876543210')
    await form.getByRole('button', { name: 'Submit enquiry', exact: true }).click()
    await page.getByRole('heading', { name: 'Thank you for submitting your details.' }).waitFor()
    assert.ok(enquiry.fields.placesToVisit.includes('hotel rate: ₹2,310'))
    assert.ok(enquiry.fields.placesToVisit.includes('hotel rate: ₹2,541'))
    assert.ok(enquiry.fields.planningNote.includes('selected stays: ₹4,851'))
  } finally { await browser.close() }
})
