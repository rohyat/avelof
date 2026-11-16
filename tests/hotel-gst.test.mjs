import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'

const origin = process.env.AVELOF_HOTEL_TEST_URL || 'http://localhost:8792'
const id = '00000000-0000-4000-8000-000000000001'
const hotel = {
  id, hotelId: 'AVELOF_HTL_10001GLM', name: 'GST Test Hotel', location: 'Gulmarg', category: 'Premium',
  description: 'Comfortable hotel rooms in the mountain valley.', price: 2320, originalPrice: 2900, discountPercent: 20,
  roomRates: [{ roomType: 'Standard', count: 6, price: 2320, originalPrice: 2900 }, { roomType: 'Family', count: 6, price: 4640, originalPrice: 5800 }],
  roomTypes: ['Standard (6 rooms)', 'Family (6 rooms)'], totalRooms: 12, mealPlan: 'Room only', taxDetails: 'Rates exclude GST',
  heating: 'Hot & cold AC', amenities: ['Wi-Fi'], highlights: ['Mountain views'], breakfastPrice: 200, dinnerPrice: 300,
  checkIn: '14:00', checkOut: '11:00', photos: [`/api/hotel-images/${id}/0`],
}

test('hotel GST totals, pending enquiries and meal coverage stay explicit for two/four people and multiple rooms', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  let gstPercent = null, enquiry
  await page.route('**/api/pricing', (route) => route.fulfill({ json: { discountPercent: 20, version: 1 } }))
  await page.route('**/api/hotels*', (route) => route.fulfill({ json: { hotels: [{ ...hotel, gstPercent }], total: 1, page: 1, pageSize: 25 } }))
  await page.route('**/api/enquiries', (route) => {
    enquiry = route.request().postDataJSON()
    return route.fulfill({ status: 201, json: { saved: true, requestReference: enquiry.reference, reference: enquiry.kind === 'hotel' ? 'AVELOF_HTL_10001' : 'AVELOF_CSTM_10001' } })
  })
  const form = page.locator('.enquiry-form')
  const rates = form.locator('.hotel-rates')
  async function openHotel() {
    await page.goto(`${origin}/hotels`)
    const card = page.locator('.hotel-card')
    await card.waitFor()
    await card.getByRole('button', { name: 'Book Now', exact: true }).click()
    await rates.waitFor()
  }
  async function submitHotel() {
    await form.getByLabel('Name', { exact: true }).fill('GST Test Guest')
    await form.getByLabel('Phone number').fill('9876543210')
    await form.locator('[name=checkInDate]').fill('2027-01-10')
    await form.locator('[name=checkOutDate]').fill('2027-01-12')
    await form.locator('[type=submit]').click()
    await page.getByRole('heading', { name: 'Thank you for submitting your details.' }).waitFor()
  }
  try {
    await openHotel()
    assert.ok((await rates.innerText()).includes('Final price pending GST confirmation'))
    assert.equal(await rates.locator('.hotel-gst-line').count(), 0)
    await rates.getByLabel('Breakfast', { exact: false }).check()
    await rates.getByLabel('Dinner', { exact: false }).check()
    assert.ok((await rates.locator('.hotel-meal-coverage').innerText()).includes('breakfast and dinner for 2 people per room per day'))
    assert.equal(await rates.locator('strong[role=status]').innerText(), 'INR 2,820')
    assert.ok((await rates.innerText()).includes('Subtotal before GST'))
    await submitHotel()
    assert.ok(enquiry.fields.hotelStayEstimate.startsWith('Subtotal before GST: INR 5,640'))
    assert.ok(enquiry.fields.hotelStayEstimate.includes('final price pending GST confirmation'))
    assert.ok(enquiry.fields.hotelPriceBreakdown.includes('final price pending GST confirmation'))
    assert.ok(!enquiry.fields.hotelPriceBreakdown.includes('total including GST'))
    gstPercent = 18
    await openHotel()
    assert.equal(await rates.locator('strong[role=status]').innerText(), 'INR 2,737.6')
    await rates.getByLabel('Breakfast', { exact: false }).check()
    await rates.getByLabel('Dinner', { exact: false }).check()
    assert.equal(await rates.locator('.hotel-gst-line').innerText(), 'GST (18%): INR 507.6')
    assert.equal(await rates.locator('strong[role=status]').innerText(), 'INR 3,327.6')
    await rates.getByLabel('Room type', { exact: true }).selectOption('Family')
    assert.equal(await rates.locator('strong[role=status]').innerText(), 'INR 6,655.2')
    assert.ok((await rates.getByLabel('Breakfast', { exact: false }).locator('..').innerText()).includes('for 4 people per room'))
    assert.ok((await rates.getByLabel('Dinner', { exact: false }).locator('..').innerText()).includes('+INR 600 before GST'))
    await form.getByLabel('Adults', { exact: true }).fill('8')
    await page.waitForFunction(() => document.querySelector('.hotel-meal-coverage')?.textContent.includes('2 rooms cover 8 people'))
    assert.ok((await rates.locator('.hotel-rooms-total').innerText()).includes('13,310.4'))
    await submitHotel()
    assert.ok(enquiry.fields.hotelStayEstimate.includes('26,620.8'))
    assert.ok(enquiry.fields.hotelPriceBreakdown.includes('GST (18%): INR 1,015.2'))
    assert.ok(enquiry.fields.mealCoverage.includes('2 rooms cover 8 people'))
    gstPercent = 0
    await openHotel()
    assert.equal(await rates.locator('.hotel-gst-line').innerText(), 'GST (0%): INR 0')
    assert.equal(await rates.locator('strong[role=status]').innerText(), 'INR 2,320')
    assert.ok(!(await rates.innerText()).includes('pending GST'))
    gstPercent = 5.25
    await openHotel()
    await rates.getByLabel('Breakfast', { exact: false }).check()
    assert.equal(await rates.locator('.hotel-gst-line').innerText(), 'GST (5.25%): INR 132.3')
    assert.equal(await rates.locator('strong[role=status]').innerText(), 'INR 2,652.3')
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      assert.equal(await rates.evaluate((element) => element.scrollWidth > element.clientWidth), false)
    }
    gstPercent = null
    await page.goto(`${origin}/tour-packages`)
    const planner = page.locator('.trip-planner')
    await planner.getByLabel('Start date').fill('2027-01-10')
    await planner.getByLabel('End date').fill('2027-01-14')
    await planner.getByRole('button', { name: 'Next: places' }).click()
    await planner.getByRole('button', { name: 'Next: vehicle' }).click()
    await planner.getByRole('button', { name: 'Next: activities' }).click()
    await planner.getByRole('button', { name: 'Next: hotels' }).click()
    await planner.getByRole('button', { name: 'Stay in Gulmarg', exact: true }).click()
    const plannedHotel = planner.locator('.planner-hotel-card').filter({ hasText: hotel.name })
    await plannedHotel.locator('.planner-hotel-tile').click()
    await plannedHotel.getByLabel('Breakfast', { exact: false }).check()
    assert.ok((await planner.locator('.planner-trip-estimate').innerText()).includes('final price pending GST confirmation'))
    await planner.getByRole('button', { name: 'Continue with this plan' }).click()
    await form.getByLabel('Name', { exact: true }).fill('GST Planner Guest')
    await form.getByLabel('Phone number').fill('9876543210')
    await form.locator('[type=submit]').click()
    await page.getByRole('heading', { name: 'Thank you for submitting your details.' }).waitFor()
    assert.ok(enquiry.fields.customDetails.includes('final price pending GST confirmation'))
    assert.ok(enquiry.fields.customDetails.includes('meals cover 2 people per room per day'))
  } finally { await browser.close() }
})
