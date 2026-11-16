import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { discountedPrice } from '../src/services/pricingSchema.ts'

const origin = process.env.AVELOF_HOTEL_TEST_URL || 'http://localhost:8792'
const id = '00000000-0000-4000-8000-000000000001'

test('admin hotel/package discount persists across pages, updates enquiries and leaves cabs unchanged', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext({ viewport: { width: 390, height: 900 } })
  let settings = { discountPercent: 0, version: 0 }, failSave = false, failLoad = false, enquiry
  await context.route('**/api/pricing', (route) => {
    if (route.request().method() === 'GET') return route.fulfill(failLoad ? { status: 503, json: { error: 'Pricing is unavailable.' } } : { json: settings })
    const input = route.request().postDataJSON()
    if (failSave) return route.fulfill({ status: 503, json: { error: 'Could not confirm pricing settings. Reload before retrying.' } })
    if (input.version !== settings.version) return route.fulfill({ status: 409, json: { error: 'Pricing changed. Reload the current discount before saving again.' } })
    settings = { discountPercent: input.discountPercent, version: settings.version + 1 }
    return route.fulfill({ json: settings })
  })
  await context.route('**/api/enquiry-access*', (route) => route.fulfill({ json: { enquiries: [], total: 0, page: 1, pageSize: 25 } }))
  await context.route('**/api/push*', (route) => route.fulfill({ status: 503, json: { error: 'Push is not configured.' } }))
  await context.route('**/api/hotels*', (route) => route.fulfill({ json: {
    hotels: [{
      id, hotelId: 'AVELOF_HTL_10001GLM', name: 'Pricing Test Hotel', location: 'Gulmarg', category: 'Premium',
      description: 'Comfortable hotel rooms in the mountain valley.', price: discountedPrice(2900, settings.discountPercent),
      originalPrice: 2900, discountPercent: settings.discountPercent, gstPercent: 5,
      roomRates: [{ roomType: 'Standard', count: 2, price: discountedPrice(2900, settings.discountPercent), originalPrice: 2900 }],
      roomTypes: ['Standard (2 rooms)'], totalRooms: 2, mealPlan: 'Room only', taxDetails: 'All taxes included',
      heating: 'Hot & cold AC', amenities: ['Wi-Fi'], highlights: ['Mountain views'], breakfastPrice: 200, dinnerPrice: 300,
      checkIn: '14:00', checkOut: '11:00', photos: [`/api/hotel-images/${id}/0`],
    }], total: 1, page: 1, pageSize: 25,
  } }))
  await context.route('**/api/enquiries', (route) => {
    enquiry = route.request().postDataJSON()
    return route.fulfill({ status: 201, json: { saved: true, requestReference: enquiry.reference, reference: enquiry.kind === 'hotel' ? 'AVELOF_HTL_10001' : 'AVELOF_DLX_10001' } })
  })
  const page = await context.newPage()
  try {
    await page.goto(`${origin}/tour-packages`)
    const deluxe = page.locator('.catalog-card').filter({ has: page.getByRole('heading', { name: 'Deluxe', exact: true }) })
    const premium = page.locator('.catalog-card').filter({ has: page.getByRole('heading', { name: 'Premium', exact: true }) })
    await deluxe.waitFor()
    assert.ok((await deluxe.locator('.price').innerText()).includes('22,000'))
    assert.ok((await premium.locator('.price').innerText()).includes('36,000'))
    assert.equal(await deluxe.locator('s').count(), 0)
    await page.goto(`${origin}/car-rentals`)
    const cabBefore = await page.locator('.catalog-card').first().locator('.price').innerText()
    await page.goto(`${origin}/admin/panel`)
    const input = page.getByRole('spinbutton', { name: 'Hotel and package discount (%)' })
    await input.waitFor()
    assert.equal(await input.inputValue(), '0')
    failSave = true
    await input.fill('20')
    await page.getByRole('button', { name: 'Save hotel and package discount', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'Could not confirm pricing settings.' }).waitFor()
    assert.equal(settings.discountPercent, 0)
    assert.equal(await page.getByRole('status').filter({ hasText: 'Saved 20%' }).count(), 0)
    failSave = false
    await page.getByRole('button', { name: 'Save hotel and package discount', exact: true }).click()
    await page.getByRole('status').filter({ hasText: 'Saved 20% discount' }).waitFor()
    await page.reload()
    assert.equal(await input.inputValue(), '20')
    await page.goto(`${origin}/tour-packages`)
    await deluxe.waitFor()
    assert.ok((await deluxe.locator('.price').innerText()).includes('17,600'))
    assert.ok((await premium.locator('.price').innerText()).includes('28,800'))
    assert.equal(await deluxe.locator('.discount-label').innerText(), '20% off')
    assert.ok((await deluxe.locator('s').innerText()).includes('22,000'))
    assert.equal(await page.locator('.offer-banner .offer-tile').filter({ hasText: 'Deluxe package' }).locator('.discount-label').innerText(), '20% off')
    assert.ok((await page.locator('.offer-banner-heading').innerText()).includes('Cab offer: 30% off'))
    await page.goto(`${origin}/tour-packages/deluxe`)
    await page.getByRole('heading', { name: 'Deluxe', exact: true, level: 1 }).waitFor()
    assert.ok((await page.locator('.detail-aside').innerText()).includes('17,600'))
    await page.locator('.package-end-booking').getByRole('button', { name: 'Book Now', exact: true }).click()
    const form = page.locator('.enquiry-form')
    await form.getByText('Package rate: INR 17,600 per person.', { exact: true }).waitFor()
    await form.locator('[name=fullName]').fill('Pricing Test Guest')
    await form.locator('[name=phoneNumber]').fill('9876543210')
    await form.locator('[name=arrivalDate]').fill('2027-01-10')
    await form.locator('[name=departureDate]').fill('2027-01-12')
    await form.locator('[type=submit]').click()
    await page.getByRole('heading', { name: 'Thank you for submitting your details.' }).waitFor()
    assert.equal(enquiry.fields.packageRate, 'INR 17,600 per person')
    await page.goto(`${origin}/hotels`)
    const hotel = page.locator('.hotel-card')
    await hotel.waitFor()
    assert.equal(await hotel.locator('.hotel-rates strong').innerText(), 'INR 2,436')
    assert.equal(await hotel.locator('.discount-label').innerText(), '20% off')
    assert.equal(await hotel.locator('.hotel-price-comparison').count(), 0)
    await hotel.getByRole('button', { name: 'Book Now', exact: true }).click()
    await form.getByLabel('Breakfast', { exact: false }).check()
    assert.equal(await form.locator('.hotel-rates strong[role=status]').innerText(), 'INR 2,646')
    assert.equal(await form.locator('.hotel-gst-line').innerText(), 'GST (5%): INR 126')
    assert.ok((await form.locator('.hotel-meal-coverage').innerText()).includes('breakfast for 2 people per room per day'))
    await form.locator('[name=fullName]').fill('Hotel Pricing Guest')
    await form.locator('[name=phoneNumber]').fill('9876543210')
    await form.locator('[name=checkInDate]').fill('2027-01-10')
    await form.locator('[name=checkOutDate]').fill('2027-01-12')
    await form.locator('[type=submit]').click()
    await page.getByRole('heading', { name: 'Thank you for submitting your details.' }).waitFor()
    assert.ok(enquiry.fields.nightlyRate.includes('2,646'))
    assert.ok(enquiry.fields.hotelStayEstimate.includes('5,292'))
    assert.ok(enquiry.fields.hotelPriceBreakdown.includes('GST (5%): INR 126'))
    assert.ok(enquiry.fields.mealCoverage.includes('2 people per room per day'))
    await page.goto(`${origin}/car-rentals`)
    assert.equal(await page.locator('.catalog-card').first().locator('.price').innerText(), cabBefore)
    await page.goto(`${origin}/admin/panel`)
    await input.waitFor()
    settings = { discountPercent: 15, version: settings.version + 1 }
    await input.fill('10')
    await page.getByRole('button', { name: 'Save hotel and package discount', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'Pricing changed.' }).waitFor()
    assert.equal(settings.discountPercent, 15)
    await page.getByRole('button', { name: 'Reload current discount', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('[name=discountPercent]')?.value === '15')
    await input.fill('0')
    await page.getByRole('button', { name: 'Save hotel and package discount', exact: true }).click()
    await page.getByRole('status').filter({ hasText: 'Saved 0% discount' }).waitFor()
    await page.goto(`${origin}/tour-packages`)
    await deluxe.waitFor()
    assert.equal(await deluxe.locator('s').count(), 0)
    assert.ok((await deluxe.locator('.price').innerText()).includes('22,000'))
    failLoad = true
    await page.reload()
    await page.getByRole('alert').filter({ hasText: 'Pricing is unavailable.' }).waitFor()
    assert.equal(await page.locator('.catalog-card').count(), 0, 'No stale package prices after a pricing failure')
    failLoad = false
    await page.getByRole('button', { name: 'Retry loading prices', exact: true }).click()
    await deluxe.waitFor()
  } finally { await browser.close() }
})
