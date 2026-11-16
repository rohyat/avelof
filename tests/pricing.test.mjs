import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { discountedHotelPackagePrice, discountedHotelRoomPrice } from '../src/services/pricing.ts'
import { featuredOfferHotelId } from '../src/data/offers.ts'

const origin = process.env.AVELOF_HOTEL_TEST_URL || 'http://localhost:8792'
const id = featuredOfferHotelId

test('Deluxe and Premium headings offer white buttons to switch packages on desktop and mobile', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage()
  await page.route('**/api/pricing', (route) => route.fulfill({ json: { discountPercent: 23, version: 1 } }))
  await page.route('**/api/hotels*', (route) => route.fulfill({ json: { hotels: [], total: 0, page: 1, pageSize: 25 } }))
  try {
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`${origin}/tour-packages/deluxe`)
      const premium = page.getByRole('link', { name: 'View Premium package', exact: true })
      await premium.waitFor()
      assert.equal(await premium.getAttribute('href'), '/tour-packages/premium')
      await page.mouse.move(0, 0)
      assert.equal(await premium.evaluate((element) => getComputedStyle(element).backgroundColor), 'rgb(255, 255, 255)')
      assert.equal(await page.locator('.detail-title-row').evaluate((element) => element.scrollWidth > element.clientWidth), false)
      await premium.click()
      await page.getByRole('heading', { name: 'Premium', exact: true }).waitFor()
      const deluxe = page.getByRole('link', { name: 'View Deluxe package', exact: true })
      assert.equal(await deluxe.getAttribute('href'), '/tour-packages/deluxe')
      assert.equal(await page.locator('.detail-title-row').evaluate((element) => element.scrollWidth > element.clientWidth), false)
      await deluxe.click()
      await page.getByRole('heading', { name: 'Deluxe', exact: true }).waitFor()
    }
  } finally { await browser.close() }
})

test('package date selection adds 10% for arrivals after 5 December and saves the seasonal rate', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  let enquiry
  await page.route('**/api/pricing', (route) => route.fulfill({ json: { discountPercent: 23, version: 1 } }))
  await page.route('**/api/hotels*', (route) => route.fulfill({ json: { hotels: [], total: 0, page: 1, pageSize: 25 } }))
  await page.route('**/api/enquiries', (route) => {
    enquiry = route.request().postDataJSON()
    return route.fulfill({ status: 201, json: { saved: true, requestReference: enquiry.reference, reference: enquiry.kind === 'car' ? 'AVELOF_CAB_10001' : 'AVELOF_PRM_10001' } })
  })
  try {
    await page.goto(`${origin}/tour-packages/deluxe`)
    assert.ok((await page.locator('.detail-aside').innerText()).includes('16,940'))
    await page.locator('.package-end-booking').getByRole('button', { name: 'Book Now', exact: true }).click()
    const form = page.locator('.enquiry-form')
    const estimate = form.locator('.package-stay-estimate')
    await form.getByRole('dialog').waitFor()
    assert.equal(await form.getByLabel('End date', { exact: true }).count(), 0)
    const arrivalWindow = form.getByRole('checkbox', { name: 'Will you be arriving between 6:00 PM and 7:00 AM?' })
    assert.equal(await arrivalWindow.isChecked(), false)
    await form.getByRole('dialog').press('Escape')
    assert.equal(await form.count(), 1)
    await form.getByLabel('Start date', { exact: true }).fill('2026-12-05')
    assert.ok((await form.locator('.package-end-date').innerText()).includes('9 December 2026'))
    assert.ok((await estimate.innerText()).includes('₹16,940'))
    await form.getByLabel('Start date', { exact: true }).fill('2026-12-06')
    assert.ok((await estimate.innerText()).includes('₹18,634'))
    assert.ok((await estimate.innerText()).includes('Includes 10% seasonal increase'))
    await form.locator('[name=packagePreference]').selectOption('Premium')
    assert.ok((await form.locator('.package-end-date').innerText()).includes('11 December 2026'))
    assert.ok((await estimate.innerText()).includes('₹30,492'))
    await form.getByLabel('Start date', { exact: true }).fill('2026-12-05')
    assert.ok((await estimate.innerText()).includes('₹27,720'))
    assert.equal((await estimate.innerText()).includes('Includes 10% seasonal increase'), false)
    await form.getByLabel('Start date', { exact: true }).fill('2026-12-06')
    await arrivalWindow.check()
    await form.getByLabel('Name', { exact: true }).fill('Seasonal Package Guest')
    await form.getByLabel('Phone number').fill('9876543210')
    await form.getByRole('button', { name: 'Submit enquiry', exact: true }).click()
    await page.getByRole('heading', { name: 'Thank you for submitting your details.' }).waitFor()
    assert.equal(enquiry.fields.packageRate, '₹30,492 per person for 5 nights; based on ₹27,720 for 5 nights; includes 10% seasonal increase for arrival from 6 December 2026')
    assert.equal(enquiry.fields.priceInclusions, 'All taxes and charges included')
    assert.equal(enquiry.fields.arrivalDate, '2026-12-06')
    assert.equal(enquiry.fields.departureDate, '2026-12-11')
    assert.equal(enquiry.fields.arrivalBetween6PmAnd7Am, 'Yes')
    await page.goto(`${origin}/car-rentals`)
    await page.getByRole('button', { name: 'Book Now', exact: true }).first().click()
    assert.equal(await arrivalWindow.isChecked(), false)
    await form.getByLabel('Start date', { exact: true }).fill('2026-12-06')
    await form.getByLabel('End date', { exact: true }).fill('2026-12-07')
    await form.getByLabel('Name', { exact: true }).fill('Car Arrival Guest')
    await form.getByLabel('Phone number').fill('9876543210')
    await form.getByRole('button', { name: 'Submit enquiry', exact: true }).click()
    await page.getByRole('heading', { name: 'Thank you for submitting your details.' }).waitFor()
    assert.equal(enquiry.fields.arrivalBetween6PmAnd7Am, 'No')
    assert.equal(enquiry.fields.rentalDays, '2')
  } finally { await browser.close() }
})

test('winter offers show both discounts with bounded snowfall on desktop/mobile and respect reduced motion', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage()
  let hotelState = 'available'
  await page.route('**/api/pricing', (route) => route.fulfill({ json: { discountPercent: 23, version: 1 } }))
  await page.route('**/api/hotels*', (route) => route.fulfill(hotelState === 'error'
    ? { status: 503, json: { error: 'Hotel offer could not be loaded.' } }
    : { json: { hotels: hotelState === 'missing' ? [] : [{
      id, hotelId: 'AVELOF_HTL_10003SRG', name: 'Hotel Crown Prince', location: 'Srinagar', category: 'Deluxe',
      description: 'Comfortable hotel rooms in the heart of Srinagar.', price: 2310, originalPrice: 3000, discountPercent: 23,
      roomTypes: ['Standard (6 rooms)'], totalRooms: 6, mealPlan: 'Room only', heating: 'Centralised heating',
      amenities: ['Wi-Fi'], highlights: ['Near the market'], checkIn: '14:00', checkOut: '11:00',
      photos: [`/api/hotel-images/${id}/0`],
    }], total: hotelState === 'missing' ? 0 : 1, page: 1, pageSize: 25 } }))
  await page.route('**/api/hotel-images/**', (route) => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="84" height="68"><rect width="84" height="68" fill="#376f8c"/></svg>' }))
  try {
    await page.goto(origin)
    const banner = page.getByRole('region', { name: 'Travel offers', exact: true })
    await banner.getByText('Winter offers are live', { exact: true }).waitFor()
    assert.ok((await banner.innerText()).includes('Flat 23% off on packages & hotels · 30% off on cabs'))
    const hotelSlide = banner.getByRole('group', { name: '3 of 4: Hotels', exact: true })
    await hotelSlide.getByText('Hotel Crown Prince · Srinagar', { exact: true }).waitFor()
    assert.equal(await banner.getByRole('link', { name: 'Explore Hotels', exact: true }).getAttribute('href'), `/hotels/${id}`)
    assert.ok((await hotelSlide.innerText()).includes('₹2,310'))
    assert.equal(await hotelSlide.locator('s').innerText(), '₹3,000')
    assert.equal(await hotelSlide.locator('.discount-label').innerText(), '23% off')
    assert.equal(await hotelSlide.locator('img').getAttribute('src'), `/api/hotel-images/${id}/0`)
    await page.waitForFunction(() => document.querySelector('.offer-tile:nth-child(3) img')?.naturalWidth > 0)
    assert.equal(await banner.locator('.offer-snow > span').count(), 36)
    const snow = banner.locator('.offer-snow')
    assert.equal(await snow.locator('span > svg.lucide-snowflake').count(), 36)
    assert.equal(await snow.locator('span').evaluateAll((flakes) => flakes.every((flake) => {
      const style = getComputedStyle(flake)
      const duration = parseFloat(style.animationDuration)
      const size = parseFloat(style.width)
      return duration >= 4 && duration <= 7 && size >= 6 && size <= 12 && style.backgroundColor === 'rgba(0, 0, 0, 0)'
    })), true)
    assert.equal(await snow.getAttribute('aria-hidden'), 'true')
    assert.equal(await snow.evaluate((element) => getComputedStyle(element).pointerEvents), 'none')
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      assert.equal(await banner.evaluate((element) => element.scrollWidth > element.clientWidth), false)
      assert.equal(await snow.evaluate((element) => {
        const banner = element.closest('.offer-banner').getBoundingClientRect()
        const bounds = element.getBoundingClientRect()
        return bounds.top >= banner.top && bounds.bottom <= banner.bottom
      }), true)
      const flake = snow.locator('span').first()
      assert.equal(await flake.evaluate((element) => getComputedStyle(element).animationName), 'offer-snowfall')
      const positions = await flake.evaluate(async (element) => {
        const [animation] = element.getAnimations()
        await animation.ready
        animation.pause()
        animation.currentTime = 100
        const before = getComputedStyle(element).transform
        animation.currentTime = 1000
        const after = getComputedStyle(element).transform
        animation.play()
        return { before, after }
      })
      assert.notEqual(positions.after, positions.before)
    }
    await page.emulateMedia({ reducedMotion: 'reduce' })
    assert.equal(await snow.isVisible(), false)
    await banner.getByRole('button', { name: 'Show Hotels offer', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.offer-dot[title=Hotels]')?.getAttribute('aria-current') === 'true')
    await banner.getByRole('link', { name: 'Explore Hotels', exact: true }).click()
    await page.waitForURL(`**/hotels/${id}`)
    await banner.getByRole('button', { name: 'Show Cabs offer', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.offer-dot[title=Cabs]')?.getAttribute('aria-current') === 'true')
    assert.ok((await banner.locator('.offer-tile-cabs').innerText()).includes('30% off'))
    hotelState = 'error'
    await page.reload()
    await hotelSlide.getByRole('alert').filter({ hasText: 'Hotel offer could not be loaded.' }).waitFor()
    assert.equal(await hotelSlide.locator('s, .offer-payable b').count(), 0)
    hotelState = 'available'
    await hotelSlide.getByRole('button', { name: 'Retry hotel offer' }).click()
    await hotelSlide.getByText('Hotel Crown Prince · Srinagar', { exact: true }).waitFor()
    hotelState = 'missing'
    await page.reload()
    await hotelSlide.getByRole('alert').filter({ hasText: 'Crown Prince is not currently listed.' }).waitFor()
    assert.equal(await hotelSlide.getByRole('link').getAttribute('href'), '/hotels')
    assert.equal(await hotelSlide.locator('s, .offer-payable b').count(), 0)
  } finally { await browser.close() }
})

test('admin discount saves across reloads, propagates to packages/hotels and handles failed or conflicting saves', async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true })
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
    let settings = { discountPercent: 23, version: 1 }, failSave = false, failLoad = false, enquiry
    await page.route('**/api/pricing', (route) => {
      if (route.request().method() === 'GET') return route.fulfill(failLoad ? { status: 503, json: { error: 'Pricing is unavailable.' } } : { json: settings })
      if (failSave) return route.fulfill({ status: 503, json: { error: 'Could not confirm pricing settings. Reload before retrying.' } })
      const data = route.request().postDataJSON()
      if (data.version !== settings.version) return route.fulfill({ status: 409, json: { error: 'Pricing changed. Reload the current discount before saving again.' } })
      settings = { discountPercent: data.discountPercent, version: settings.version + 1 }
      return route.fulfill({ json: settings })
    })
    await page.route('**/api/enquiry-access*', (route) => route.fulfill({ json: { enquiries: [], total: 0, page: 1, pageSize: 25 } }))
    await page.route('**/api/push*', (route) => route.fulfill({ status: 503, json: { error: 'Push is not configured.' } }))
    await page.route('**/api/hotels*', (route) => route.fulfill({ json: {
      hotels: [{
        id, hotelId: 'AVELOF_HTL_10001GLM', name: 'Dynamic Discount Hotel', location: 'Gulmarg', category: 'Premium',
        description: 'Comfortable hotel rooms in the mountain valley.', price: discountedHotelRoomPrice(3000, settings.discountPercent),
        originalPrice: 3000, discountPercent: settings.discountPercent,
        roomRates: [{ roomType: 'Standard', count: 6, price: discountedHotelRoomPrice(3000, settings.discountPercent), originalPrice: 3000 }],
        roomTypes: ['Standard (6 rooms)'], totalRooms: 6, mealPlan: 'Room only', heating: 'Centralised heating', hotColdAc: true,
        amenities: ['Wi-Fi'], highlights: ['Mountain views'], breakfastPrice: 200, dinnerPrice: 300,
        checkIn: '14:00', checkOut: '11:00', photos: [`/api/hotel-images/${id}/0`],
      }], total: 1, page: 1, pageSize: 25,
    } }))
    await page.route('**/api/enquiries', (route) => {
      enquiry = route.request().postDataJSON()
      return route.fulfill({ status: 201, json: { saved: true, requestReference: enquiry.reference, reference: 'AVELOF_DLX_10001' } })
    })
    const discount = page.getByRole('spinbutton', { name: 'Hotel and package discount (%)' })
    const save = page.getByRole('button', { name: 'Save hotel and package discount', exact: true })
    try {
      await page.goto(`${origin}/admin/panel`)
      assert.equal(await discount.inputValue(), '23')
      failSave = true
      await discount.fill('20')
      await save.click()
      await page.getByRole('alert').filter({ hasText: 'Could not confirm pricing settings.' }).waitFor()
      assert.equal(settings.discountPercent, 23)
      failSave = false
      await save.click()
      await page.getByRole('status').filter({ hasText: 'Saved 20% discount' }).waitFor()
      await page.reload()
      assert.equal(await discount.inputValue(), '20')
      await page.goto(`${origin}/tour-packages`)
      const deluxe = page.locator('.catalog-card').filter({ has: page.getByRole('heading', { name: 'Deluxe', exact: true }) })
      assert.ok((await deluxe.locator('.price').innerText()).includes('17,600'))
      assert.equal(await deluxe.locator('.discount-label').innerText(), '20% off')
      assert.ok((await page.locator('.offer-heading-subtitle').first().innerText()).includes('Flat 20% off on packages & hotels'))
      assert.equal(await page.getByRole('group', { name: '3 of 4: Hotels', exact: true }).locator('.discount-label').innerText(), '20% off')
      assert.equal(await page.locator('.offer-tile').filter({ hasText: 'Premium package' }).locator('.discount-label').innerText(), '20% off')
      await page.goto(`${origin}/tour-packages/deluxe`)
      assert.ok((await page.locator('.detail-aside').innerText()).includes('17,600'))
      await page.locator('.package-end-booking').getByRole('button', { name: 'Book Now', exact: true }).click()
      const form = page.locator('.enquiry-form')
      await form.getByLabel('Name', { exact: true }).fill('Discount Test Guest')
      await form.getByLabel('Phone number').fill('9876543210')
      await form.locator('[name=arrivalDate]').fill('2026-11-20')
      assert.ok((await form.locator('.package-stay-estimate').innerText()).includes('₹17,600'))
      await form.locator('[type=submit]').click()
      assert.deepEqual(await form.locator(':invalid').evaluateAll((elements) => elements.map((element) => ({ name: element.getAttribute('name'), message: element.validationMessage }))), [])
      await page.getByRole('heading', { name: 'Thank you for submitting your details.' }).waitFor()
      assert.ok(enquiry.fields.packageRate.includes('₹17,600'))
      assert.equal(enquiry.fields.arrivalBetween6PmAnd7Am, 'No')
      await page.goto(`${origin}/hotels`)
      assert.equal(await page.locator('.hotel-rates strong').innerText(), '₹2,400')
      assert.equal(await page.locator('.hotel-rates .discount-label').innerText(), '20% off')
      await page.locator('.hotel-card').getByRole('button', { name: 'Book Now', exact: true }).click()
      await page.locator('.enquiry-form').getByLabel('Check-in date', { exact: true }).fill('2026-12-05')
      await page.getByRole('button', { name: 'View check-in calendar prices' }).click()
      const calendar = page.getByRole('dialog', { name: 'December 2026', exact: true })
      assert.equal(await calendar.getByRole('button', { name: '6 December 2026, ₹2,640 per room for this night', exact: true }).locator('small').innerText(), '₹2,640')
      await page.goto(`${origin}/admin/panel`)
      await discount.waitFor()
      settings = { discountPercent: 10, version: settings.version + 1 }
      await discount.fill('15')
      await save.click()
      await page.getByRole('alert').filter({ hasText: 'Pricing changed.' }).waitFor()
      await page.getByRole('button', { name: 'Reload current discount', exact: true }).click()
      await page.waitForFunction(() => document.querySelector('[name=discountPercent]')?.value === '10')
      for (const percent of [0, 100, 12.5]) {
        await discount.fill(String(percent))
        await save.click()
        await page.getByRole('status').filter({ hasText: `Saved ${percent}% discount` }).waitFor()
        await page.goto(`${origin}/tour-packages`)
        assert.ok((await deluxe.locator('.price').innerText()).includes(discountedHotelPackagePrice(22000, percent).toLocaleString('en-IN')))
        assert.equal(await deluxe.locator('.discount-label').count(), percent === 0 ? 0 : 1)
        assert.equal(await page.locator('.offer-tile').filter({ hasText: 'Deluxe package' }).locator('s').count(), percent === 0 ? 0 : 1)
        await page.goto(`${origin}/admin/panel`)
        await discount.waitFor()
      }
      failLoad = true
      await page.goto(`${origin}/tour-packages/deluxe`)
      await page.getByRole('alert').filter({ hasText: 'Pricing is unavailable.' }).first().waitFor()
      assert.equal(await page.locator('.detail-aside').count(), 0)
      failLoad = false
      await page.getByRole('button', { name: 'Retry loading prices' }).first().click()
      await page.locator('.detail-aside').waitFor()
      await page.goto(`${origin}/car-rentals`)
      assert.ok((await page.locator('.offer-tile-cabs').innerText()).includes('30% off'))
    } finally { await browser.close() }
  })

test('23% inclusive hotel/package prices update with dates and persist totals while preserving cab offers', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  let pricingRequests = 0, enquiry
  let acAvailable = true
  await page.route('**/api/pricing', (route) => {
    pricingRequests++
    return route.fulfill({ json: { discountPercent: 23, version: 1 } })
  })
  await page.route('**/api/hotels*', (route) => route.fulfill({ json: {
    hotels: [{
      id, hotelId: 'AVELOF_HTL_10001GLM', name: 'Pricing Test Hotel', location: 'Gulmarg', category: 'Premium',
      description: 'Comfortable hotel rooms in the mountain valley.', price: 2233, originalPrice: 2900,
      roomRates: [{ roomType: 'Standard', count: 6, price: 2233, originalPrice: 2900 }, { roomType: 'Family', count: 6, price: 4466, originalPrice: 5800 }],
      roomTypes: ['Standard (6 rooms)', 'Family (6 rooms)'], totalRooms: 12, mealPlan: 'Room only',
      taxDetails: 'All taxes included', gstPercent: 18,
      heating: 'Centralised heating', hotColdAc: acAvailable, amenities: ['Wi-Fi'], highlights: ['Mountain views'], breakfastPrice: 200, dinnerPrice: 300,
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
    await form.locator('[name=checkInDate]').fill('2026-11-20')
    await form.locator('[name=checkOutDate]').fill('2026-11-22')
    await form.locator('[type=submit]').click()
    await page.getByRole('heading', { name: 'Thank you for submitting your details.' }).waitFor()
  }
  try {
    await page.goto(`${origin}/tour-packages`)
    assert.ok((await page.locator('.offer-banner-heading').innerText()).includes('All taxes and charges included'))
    for (const [name, price, original] of [['Deluxe', '16,940', '22,000'], ['Premium', '27,720', '36,000']]) {
      const card = page.locator('.catalog-card').filter({ has: page.getByRole('heading', { name, exact: true }) })
      assert.ok((await card.locator('.price').innerText()).includes(price))
      assert.equal(await card.locator('s').innerText(), `₹${original}`)
      assert.equal(await card.locator('.discount-label').innerText(), '23% off')
      assert.ok((await card.innerText()).includes('All taxes and charges included'))
      const tile = page.locator('.offer-tile').filter({ hasText: `${name} package` })
      assert.ok((await tile.innerText()).includes(price))
      assert.equal(await tile.locator('s').innerText(), `₹${original}`)
      assert.equal(await tile.locator('.discount-label').innerText(), '23% off')
    }
    await page.goto(`${origin}/tour-packages/deluxe`)
    assert.ok((await page.locator('.detail-aside').innerText()).includes('16,940'))
    assert.equal(await page.locator('.detail-aside s').innerText(), '₹22,000')
    await page.locator('.package-end-booking').getByRole('button', { name: 'Book Now', exact: true }).click()
    await form.getByText('Package rate: ₹16,940 per person for 4 nights.', { exact: true }).waitFor()
    assert.ok((await form.innerText()).includes('All taxes and charges included'))
    await form.getByLabel('Name', { exact: true }).fill('Package Pricing Guest')
    await form.getByLabel('Phone number').fill('9876543210')
    await form.locator('[name=arrivalDate]').fill('2026-11-20')
    const packageEstimate = form.locator('.package-stay-estimate')
    assert.ok((await packageEstimate.innerText()).includes('₹16,940 per person for 4 nights.'))
    await form.getByLabel('Package preference').selectOption('Premium')
    assert.ok((await packageEstimate.innerText()).includes('₹27,720 per person for 5 nights.'))
    await form.getByLabel('Package preference').selectOption('Deluxe')
    await form.locator('[name=arrivalDate]').fill('')
    assert.equal(await packageEstimate.count(), 0, 'No price estimate without a start date')
    await form.locator('[name=arrivalDate]').fill('2026-11-20')
    assert.ok((await packageEstimate.innerText()).includes('₹16,940 per person for 4 nights.'))
    await form.locator('[type=submit]').click()
    await page.getByRole('heading', { name: 'Thank you for submitting your details.' }).waitFor()
    assert.equal(enquiry.fields.packageRate, '₹16,940 per person for 4 nights; based on ₹16,940 for 4 nights')
    assert.equal(enquiry.fields.priceInclusions, 'All taxes and charges included')
    assert.equal(enquiry.fields.tripNights, '4')
    assert.equal(enquiry.fields.departureDate, '2026-11-24')
    await page.goto(`${origin}/hotels`)
    const hotel = page.locator('.hotel-card')
    assert.equal(await hotel.locator('.hotel-rates strong').innerText(), '₹2,233')
    assert.equal(await hotel.locator('s').innerText(), '₹2,900')
    assert.equal(await hotel.locator('.discount-label').innerText(), '23% off')
    assert.ok(!/GST|INR/i.test(await hotel.innerText()))
    assert.ok((await hotel.innerText()).includes('All taxes and charges included'))
    assert.equal(await hotel.locator('.hotel-ac-status').innerText(), 'Hot & cold AC')
    assert.equal(await hotel.getByRole('img', { name: 'Hot & cold AC available', exact: true }).locator('svg.lucide-check').count(), 1)
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
    assert.equal(await rates.locator('.hotel-ac-status').innerText(), 'Hot & cold AC')
    assert.equal(await rates.getByRole('img', { name: 'Hot & cold AC available', exact: true }).count(), 1)
    await rates.getByLabel('Breakfast', { exact: false }).check()
    await rates.getByLabel('Dinner', { exact: false }).check()
    assert.equal(await rates.locator('strong[role=status]').innerText(), '₹2,733')
    assert.equal(await rates.locator('s').innerText(), '₹2,900', 'Meals do not inflate the regular room rate')
    assert.equal(await rates.locator('.discount-label').innerText(), '23% off', 'Room discount stays separate from meal add-ons')
    assert.ok((await rates.locator('.hotel-meal-coverage').innerText()).includes('for 2 people per room'))
    await form.locator('[name=checkInDate]').fill('2026-11-20')
    await form.locator('[name=checkOutDate]').fill('2026-11-21')
    assert.ok((await form.locator('.hotel-stay-estimate').innerText()).includes('₹2,733'))
    await form.locator('[name=checkOutDate]').fill('2026-11-23')
    assert.ok((await form.locator('.hotel-stay-estimate').innerText()).includes('₹8,199'))
    assert.ok((await form.innerText()).includes('All taxes and charges included'))
    await submitHotel()
    assert.ok(enquiry.fields.hotelStayEstimate.includes('5,466'))
    assert.equal(enquiry.fields.priceInclusions, 'All taxes and charges included')
    assert.ok(!/GST|INR/i.test(JSON.stringify(enquiry.fields)))
    await page.goto(`${origin}/hotels/${id}`)
    assert.equal(await page.locator('.detail-aside .hotel-rates strong').innerText(), '₹2,233')
    assert.equal(await page.locator('.detail-aside .hotel-ac-status').innerText(), 'Hot & cold AC')
    await page.locator('.hotel-end-booking').getByRole('button', { name: 'Book Now', exact: true }).click()
    await rates.getByLabel('Room type', { exact: true }).selectOption('Family')
    await rates.getByLabel('Breakfast', { exact: false }).check()
    await rates.getByLabel('Dinner', { exact: false }).check()
    await form.getByLabel('Adults', { exact: true }).fill('8')
    assert.equal(await rates.locator('strong[role=status]').innerText(), '₹5,466')
    assert.equal(await rates.locator('s').innerText(), '₹5,800')
    assert.ok((await rates.locator('.hotel-meal-coverage').innerText()).includes('2 rooms cover 8 people'))
    await submitHotel()
    assert.ok(enquiry.fields.hotelStayEstimate.includes('21,864'))
    await page.goto(`${origin}/tour-packages`)
    const planner = page.locator('.trip-planner')
    await planner.getByLabel('Start date').fill('2026-11-20')
    await planner.getByLabel('End date').fill('2026-11-24')
    await planner.getByRole('button', { name: 'Next: places' }).click()
    await planner.getByRole('button', { name: 'Next: vehicle' }).click()
    await planner.getByRole('button', { name: 'Next: activities' }).click()
    await planner.getByRole('button', { name: 'Next: hotels' }).click()
    await planner.getByRole('button', { name: 'Stay in Gulmarg', exact: true }).click()
    const plannedHotel = planner.locator('.planner-hotel-card').filter({ hasText: 'Pricing Test Hotel' })
    await plannedHotel.locator('.planner-hotel-tile').click()
    assert.equal(await plannedHotel.locator('s').innerText(), '₹2,900')
    assert.equal(await plannedHotel.locator('.discount-label').innerText(), '23% off')
    await plannedHotel.getByLabel('Dinner', { exact: false }).check()
    assert.ok((await planner.locator('.planner-trip-estimate').innerText()).includes('Selected stays: ₹2,533'))
    assert.ok(!(await planner.innerText()).includes('INR'))
    await planner.getByRole('button', { name: 'Continue with this plan' }).click()
    await form.getByLabel('Name', { exact: true }).fill('Discounted Planner Guest')
    await form.getByLabel('Phone number').fill('9876543210')
    await form.getByRole('button', { name: 'Submit enquiry' }).click()
    await page.getByRole('heading', { name: 'Thank you for submitting your details.' }).waitFor()
    assert.ok(enquiry.fields.customDetails.includes('hotel rate: ₹2,533'))
    await page.goto(`${origin}/car-rentals`)
    assert.ok((await page.locator('.catalog-card').first().locator('.price').innerText()).includes('2,000'))
    assert.ok((await page.locator('.offer-tile-cabs').innerText()).includes('30% off'))
    await page.goto(`${origin}/admin/panel`)
    await page.getByRole('heading', { name: 'Enquiry dashboard', exact: true }).waitFor()
    assert.equal(await page.locator('[name=discountPercent]').inputValue(), '23')
    await page.goto(`${origin}/admin/panel/hotels`)
    assert.equal(await page.locator('[name=gstPercent]').count(), 0)
    await page.goto(`${origin}/register-hotel`)
    assert.equal(await page.locator('[name=taxDetails], [name=gstPercent]').count(), 0)
    assert.ok(pricingRequests > 0)
    acAvailable = false
    await page.goto(`${origin}/hotels`)
    const unavailable = page.locator('.hotel-card .hotel-ac-status')
    assert.equal(await unavailable.innerText(), 'Hot & cold AC')
    assert.equal(await unavailable.getAttribute('aria-label'), 'Hot & cold AC not available')
    assert.equal(await unavailable.locator('svg.lucide-x').count(), 1)
  } finally { await browser.close() }
})
