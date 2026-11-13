import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'

const origin = process.env.AVELOF_HOTEL_TEST_URL || 'http://localhost:8792'
const id = '00000000-0000-4000-8000-000000000002'
const driverId = 'AVELOF-DRV-10001'
const accessCode = 'b'.repeat(64)
const driver = {
  id, driverId, fullName: 'Public Driver Name', maskedPhone: '987*****10', vehicleId: 'innova-crysta', age: 30,
  phone: '9876543210', licenceNumber: 'JK01 123456789', vehicleNumber: 'JK01 AB1234',
  vehicleName: 'Toyota Innova Crysta', location: 'Srinagar', seats: 6,
  price: 3200, submittedPrice: 3500, status: 'pending', version: 0,
  ownerNote: '', createdAt: '2026-11-13T10:00:00Z', photo: `/api/driver-images/${id}/0`,
  averageRating: 4.5, reviewCount: 2,
}
const listing = (drivers) => ({ drivers, total: drivers.length, page: 1, pageSize: 25 })
const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q==', 'base64')
test('partner onboarding and approved listings work separately from customer navigation', async (context) => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    await context.test('partner links are footer-only and both registration paths are available', async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
      try {
        await page.goto(`${origin}/partners`)
        assert.equal(await page.locator('header').getByRole('link', { name: /register|partner/i }).count(), 0)
        await page.getByRole('button', { name: 'Open menu' }).click()
        assert.ok(await page.locator('header').getByRole('link', { name: 'Check Bookings' }).count() > 0)
        await page.getByRole('button', { name: 'Close menu' }).click()
        assert.equal(await page.locator('footer').getByRole('link', { name: 'Partner with AVELOF' }).count(), 1)
        assert.equal(await page.getByRole('link', { name: 'Register your hotel', exact: true }).getAttribute('href'), '/register-hotel')
        assert.equal(await page.getByRole('link', { name: 'Register as a driver', exact: true }).getAttribute('href'), '/register-driver')
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      } finally { await page.close() }
    })
    await context.test('driver save failures do not confirm receipt and unchanged retries preserve the ID', async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
      let saved, fail = true
      await page.route('**/api/drivers*', async (route) => {
        if (route.request().method() !== 'POST') return route.fulfill({ json: listing([]) })
        const form = await new Response(route.request().postDataBuffer(), { headers: { 'Content-Type': route.request().headers()['content-type'] } }).formData()
        saved = JSON.parse(form.get('details'))
        assert.equal(form.getAll('photos').length, 1)
        if (fail) return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Vite</title>' })
        return route.fulfill({ status: 201, json: { saved: true, id: saved.id, driverId, accessCode, status: 'pending' } })
      })
      try {
        await page.goto(`${origin}/register-driver`)
        assert.equal(await page.getByLabel('Driver portrait (one photo required)').getAttribute('multiple'), null)
        assert.equal(await page.getByLabel('Taxes').count(), 0)
        assert.equal(await page.getByLabel('Luggage capacity').count(), 0)
        assert.equal(await page.getByText('Trips offered (select at least one)').count(), 0)
        const fields = {
          'Full legal name (shown publicly after approval)': driver.fullName,
          'Age (private)': '30', 'Phone number (masked publicly)': driver.phone,
          'Driving licence number (private)': driver.licenceNumber, 'Vehicle registration number (private)': driver.vehicleNumber,
          'Passenger seats (excluding driver)': '6',
          'Proposed daily rate (INR)': '3500',
        }
        for (const [label, value] of Object.entries(fields)) await page.getByRole('textbox', { name: label }).fill(value)
        await page.getByRole('combobox', { name: 'Vehicle' }).selectOption('innova-crysta')
        await page.locator('[name="publicationConsent"]').check()
        await page.getByLabel('Driver portrait (one photo required)').setInputFiles({ name: 'portrait.jpg', mimeType: 'image/jpeg', buffer: jpeg })
        await page.locator('.hotel-photo-grid img').waitFor()
        await page.getByRole('button', { name: 'Submit driver for approval' }).click()
        await page.getByRole('alert').filter({ hasText: 'registration API is not connected to this preview' }).waitFor()
        assert.equal(await page.getByRole('heading', { name: 'Your driver registration has been saved.' }).count(), 0)
        const firstId = saved.id
        fail = false
        await page.getByRole('button', { name: 'Submit driver for approval' }).click()
        await page.getByRole('heading', { name: 'Your driver registration has been saved.' }).waitFor()
        assert.equal(saved.id, firstId)
        assert.equal(saved.age, 30)
        assert.equal(saved.vehicleId, 'innova-crysta')
        assert.ok((await page.locator('.hotel-receipt').innerText()).includes(accessCode))
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      } finally { await page.close() }
    })
    await context.test('owner can approve driver and private lookup uses POST body credentials', async () => {
      const page = await browser.newPage()
      let current = driver, update, lookup
      await page.route('**/api/drivers*', (route) => {
        const request = route.request()
        if (request.method() === 'PATCH') {
          update = request.postDataJSON()
          current = { ...driver, ...update, version: 1 }
          return route.fulfill({ json: { driver: current } })
        }
        if (request.method() === 'POST') {
          lookup = request
          const { photo, version, ...owner } = current
          void photo; void version
          return route.fulfill({ json: { driver: owner } })
        }
        return route.fulfill({ json: listing([current]) })
      })
      await page.route('**/api/push*', (route) => route.fulfill({ status: 503, json: { error: 'Push is not configured.' } }))
      try {
        await page.goto(`${origin}/admin/panel/drivers`)
        await page.getByRole('heading', { name: `${driver.fullName} · ${driver.vehicleName}` }).waitFor()
        await page.getByLabel('Reviewed daily rate (INR)', { exact: true }).fill('2900.25')
        await page.getByLabel('Driver listing status').selectOption('approved')
        await page.getByLabel('Note to driver').fill('Reviewed and approved.')
        await page.getByRole('button', { name: 'Save driver price and status' }).click()
        await page.getByRole('status').filter({ hasText: 'Driver price and status saved.' }).waitFor()
        assert.deepEqual(update, { id, version: 0, status: 'approved', price: 2900.25, ownerNote: 'Reviewed and approved.' })
        await page.goto(`${origin}/driver-status`)
        await page.getByLabel('Driver ID or phone number').fill(driver.phone)
        await page.getByLabel('Private access code').fill(accessCode)
        await page.getByRole('button', { name: 'Check status' }).click()
        await page.locator('.hotel-owner-status').waitFor()
        assert.deepEqual(lookup.postDataJSON(), { identifier: driver.phone, accessCode })
        assert.equal(lookup.url().includes(accessCode), false)
      } finally { await page.close() }
    })
    await context.test('approved vehicle and optional hotel meals reach booking selectors without private driver data', async () => {
      const page = await browser.newPage()
      const { age, phone, licenceNumber, vehicleNumber, submittedPrice, status, version, ownerNote, createdAt, ...publicDriver } = driver
      void age; void phone; void licenceNumber; void vehicleNumber; void submittedPrice; void status; void version; void ownerNote; void createdAt
      const hotel = {
        id, hotelId: `AVELOF_HTL_${id.replaceAll('-', '').toUpperCase()}`, name: 'Meal Partner Hotel',
        location: 'Gulmarg', category: 'Premium', description: 'A comfortable mountain hotel with optional breakfast and dinner.',
        price: 4000, breakfastPrice: 500, dinnerPrice: 700, mealPlan: 'Room only', taxDetails: 'Taxes included',
        heating: 'Centralised heating', amenities: ['Wi-Fi'], highlights: ['Mountain views'], roomTypes: ['Double room'],
        totalRooms: 10, checkIn: '14:00', checkOut: '11:00', photos: [`/api/hotel-images/${id}/0`],
      }
      await page.route('**/api/drivers*', (route) => route.fulfill({ json: listing([publicDriver]) }))
      await page.route('**/api/hotels*', (route) => route.fulfill({ json: { hotels: [hotel], total: 1, page: 1, pageSize: 25 } }))
      const submittedReviews = []
      await page.route('**/api/reviews*', (route) => {
        if (route.request().method() === 'POST') {
          const review = route.request().postDataJSON()
          submittedReviews.push(review)
          return route.fulfill({ status: 201, json: { saved: true, id: review.id, status: 'published' } })
        }
        return route.fulfill({ json: { reviews: [], total: 0, averageRating: null, page: 1, pageSize: 25 } })
      })
      try {
        await page.goto(`${origin}/drivers`)
        assert.equal(await page.locator('.driver-directory-card-demo').count(), 0)
        const directoryCard = page.locator('.driver-directory-card').filter({ hasText: driver.fullName })
        await directoryCard.waitFor()
        assert.ok((await directoryCard.innerText()).includes(driver.maskedPhone))
        assert.ok((await directoryCard.innerText()).includes(driverId))
        assert.ok((await directoryCard.innerText()).includes('4.5 · 2 reviews'))
        assert.equal(await directoryCard.locator('.driver-directory-price').count(), 0)
        assert.equal((await directoryCard.innerText()).includes('3,200'), false)
        assert.equal(await directoryCard.locator('.driver-directory-photo').getAttribute('src'), driver.photo)
        const portraitBox = await directoryCard.locator('.driver-directory-photo').boundingBox()
        assert.equal(Math.round(portraitBox.width), Math.round(portraitBox.height))
        assert.equal((await directoryCard.innerText()).includes(driver.phone), false)
        await directoryCard.getByRole('link', { name: 'View reviews about this driver' }).click()
        await page.getByRole('heading', { name: driver.fullName, exact: true }).waitFor()
        assert.equal(await page.locator('[name="reviewerName"]').getAttribute('required'), null)
        assert.equal(await page.locator('[name="bookingId"]').getAttribute('required'), null)
        await page.getByLabel('5 stars').check({ force: true })
        await page.getByRole('checkbox', { name: /consent to immediate publication/ }).check()
        await page.getByRole('button', { name: 'Submit driver rating' }).click()
        await page.getByRole('heading', { name: 'Thank you. Your driver rating has been saved.' }).waitFor()
        const driverReview = submittedReviews[0]
        assert.equal(driverReview.driverId, driverId)
        assert.equal(driverReview.reviewerName, '')
        assert.equal(driverReview.bookingId, '')
        assert.equal(driverReview.rating, 5)
        assert.equal(driverReview.reviewText, '')
        await page.goto(`${origin}/car-rentals`)
        const car = page.locator('.catalog-card').filter({ hasText: driver.fullName })
        await car.waitFor()
        assert.ok((await car.innerText()).includes(driver.fullName))
        assert.equal((await car.innerText()).includes(driver.phone), false)
        assert.ok((await car.innerText()).includes(driver.maskedPhone))
        assert.equal((await car.innerText()).includes('Before offer'), false)
        await car.getByRole('button', { name: 'Book Now' }).click()
        await page.locator('[name="carRental"]').waitFor()
        assert.equal(await page.locator('[name="carRental"]').inputValue(), `${driver.vehicleName} (${driverId})`)
        await page.goto(`${origin}/hotels`)
        const stay = page.locator('.catalog-card').filter({ hasText: hotel.name })
        await stay.waitFor()
        await stay.getByRole('link', { name: 'View hotel reviews' }).click()
        await page.getByRole('heading', { name: hotel.name, exact: true }).waitFor()
        await page.locator('[name="reviewText"]').fill('A comfortable and welcoming hotel stay.')
        assert.equal(await page.locator('[name="reviewerName"]').getAttribute('required'), '')
        assert.equal(await page.locator('[name="bookingId"]').getAttribute('required'), '')
        await page.locator('[name="reviewText"]').fill('')
        assert.equal(await page.locator('[name="reviewerName"]').getAttribute('required'), null)
        await page.getByLabel('4 stars').check({ force: true })
        await page.getByRole('checkbox', { name: /consent to immediate publication/ }).check()
        await page.getByRole('button', { name: 'Submit hotel rating' }).click()
        await page.getByRole('heading', { name: 'Thank you. Your hotel rating has been saved.' }).waitFor()
        const hotelReview = submittedReviews[1]
        assert.equal(hotelReview.hotelId, hotel.hotelId)
        assert.equal(hotelReview.reviewerName, '')
        assert.equal(hotelReview.bookingId, '')
        await page.goto(`${origin}/hotels`)
        const stayAfterReview = page.locator('.catalog-card').filter({ hasText: hotel.name })
        await stayAfterReview.waitFor()
        await stayAfterReview.getByLabel('Breakfast', { exact: false }).check()
        await stayAfterReview.getByLabel('Dinner', { exact: false }).check()
        assert.ok((await stayAfterReview.locator('.hotel-rates').innerText()).includes('5,200'))
        await stayAfterReview.getByRole('button', { name: 'Book Now' }).click()
        const rates = page.locator('.enquiry-form .hotel-rates')
        await rates.waitFor()
        await rates.getByLabel('Breakfast', { exact: false }).check()
        await rates.getByLabel('Dinner', { exact: false }).check()
        assert.ok((await rates.innerText()).includes('5,200'))
        let enquiry
        await page.route('**/api/enquiries', (route) => {
          enquiry = route.request().postDataJSON()
          return route.fulfill({ status: 201, json: { saved: true, requestReference: enquiry.reference, reference: 'AVELOF_HTL_10001' } })
        })
        await page.locator('[name="fullName"]').fill('Test Guest')
        await page.locator('[name="phoneNumber"]').fill('9876543210')
        await page.locator('[name="checkInDate"]').fill('2027-01-10')
        await page.locator('[name="checkOutDate"]').fill('2027-01-12')
        await page.locator('.enquiry-form [type="submit"]').click()
        await page.getByRole('heading', { name: 'Thank you for submitting your details.' }).waitFor()
        assert.equal(enquiry.fields.breakfast, 'Included')
        assert.equal(enquiry.fields.dinner, 'Included')
        assert.equal(enquiry.fields.nightlyRate, 'INR 5,200 per room per night for 2 adults; breakfast included, dinner included; Taxes included')
        await page.goto(`${origin}/tour-packages`)
        const planner = page.locator('.trip-planner')
        await planner.getByLabel('Start date').fill('2027-01-10')
        await planner.getByLabel('End date').fill('2027-01-14')
        const vehicle = planner.locator('.planner-vehicle-choice').filter({ hasText: driver.fullName })
        await vehicle.getByRole('radio').check()
        assert.equal((await vehicle.innerText()).includes('Before offer'), false)
        assert.ok((await planner.locator('.planner-vehicle-total').innerText()).includes('16,000'))
        await planner.getByRole('button', { name: 'Stay in Gulmarg', exact: true }).first().click()
        const plannedHotel = planner.locator('.planner-hotel-card').filter({ hasText: hotel.name }).first()
        await plannedHotel.getByLabel('Breakfast', { exact: false }).check()
        await plannedHotel.getByLabel('Dinner', { exact: false }).check()
        assert.ok((await plannedHotel.locator('.hotel-rates').innerText()).includes('5,200'))
        await planner.getByRole('button', { name: 'Continue with this plan' }).click()
        await page.locator('.enquiry-form [name="carRental"]').waitFor()
        assert.equal(await page.locator('.enquiry-form [name="carRental"]').inputValue(), `${driver.vehicleName} (${driverId})`)
      } finally { await page.close() }
    })
  } finally { await browser.close() }
})
