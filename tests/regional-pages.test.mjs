import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { mockPartnerPhotos } from './partner-photo-preview.mjs'

const origin = process.env.AVELOF_NAVIGATION_TEST_URL || 'http://127.0.0.1:8792'
const id = '00000000-0000-4000-8000-000000000022'
const hotel = {
  id, hotelId: 'AVELOF_HTL_10022LEH', region: 'Ladakh', location: 'Leh', name: 'Regional Test Hotel',
  category: 'Premium', exactLocation: 'Changspa', description: 'Sample hotel used only for automated regional tests.',
  price: 2310, originalPrice: 3000, discountPercent: 23, roomRates: [{ roomType: 'Standard', count: 2, price: 2310, originalPrice: 3000 }],
  roomTypes: ['Standard (2 rooms)'], totalRooms: 2, mealPlan: 'Room only', breakfastPrice: 300, dinnerPrice: 400,
  heating: 'Room heaters', hotColdAc: false, amenities: ['Parking'], highlights: ['Mountain views'],
  checkIn: '14:00', checkOut: '11:00', photos: [`/api/hotel-images/${id}/0`], averageRating: null, reviewCount: 0,
}
const listing = (hotels) => ({ hotels, total: hotels.length, page: 1, pageSize: 25 })
test('regional registration defaults and dependent location choices reset correctly', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  try {
    await page.goto(`${origin}/register-hotel`)
    const region = page.getByRole('combobox', { name: 'Region', exact: true })
    const location = page.getByRole('combobox', { name: 'Location', exact: true })
    assert.equal(await region.inputValue(), 'Kashmir')
    await location.selectOption('Srinagar')
    await region.selectOption('Ladakh')
    assert.equal(await location.inputValue(), '')
    assert.equal(await location.getByRole('option', { name: 'Srinagar', exact: true }).count(), 0)
    await location.selectOption('Leh')
    const area = page.getByLabel('Exact area', { exact: true })
    await area.selectOption('Changspa')
    await region.selectOption('Jammu')
    assert.equal(await location.inputValue(), '')
    assert.equal(await area.inputValue(), '')
    await location.selectOption('Katra')
    await area.selectOption('Katra town (Vaishno Devi base)')
    await page.goto(`${origin}/register-driver`)
    assert.equal(await region.inputValue(), 'Kashmir')
    const district = page.getByRole('combobox', { name: 'District', exact: true })
    await district.selectOption('Srinagar')
    await region.selectOption('Ladakh')
    assert.equal(await district.inputValue(), '')
    assert.deepEqual(await district.getByRole('option').allTextContents(), ['Select district', 'Kargil', 'Leh'])
    await district.selectOption('Leh')
    await region.selectOption('Jammu')
    assert.equal(await district.inputValue(), '')
    assert.equal(await district.getByRole('option', { name: 'Srinagar', exact: true }).count(), 0)
  } finally { await browser.close() }
})

test('regional hotel links, details, reviews and enquiry choices stay in the selected region', async (context) => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage()
  await page.route('**/api/hotels*', (route) => {
    const url = new URL(route.request().url())
    return route.fulfill({ json: listing(url.searchParams.get('region') === 'Ladakh' || url.searchParams.has('hotelId') ? [hotel] : []) })
  })

  await context.test('private partner edits restore region and send the new regional location for fresh approval', async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true })
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    try {
      await page.goto(origin)
      await mockPartnerPhotos(page, 1)
      const ownerHotel = { ...hotel, price: 2000, roomRates: [{ roomType: 'Standard', count: 2, price: 2000 }], status: 'approved', contactName: 'Test Owner', phone: '9876543210', version: 1 }
      for (const key of ['photos', 'averageRating', 'reviewCount', 'originalPrice', 'discountPercent']) delete ownerHotel[key]
      const ownerDriver = {
        id, driverId: 'AVELOF-DRV-10022', region: 'Ladakh', location: 'Leh', fullName: 'Regional Test Driver', vehicleId: 'swift-dzire',
        vehicleName: 'Sedan', maskedPhone: '9*******10', seats: 4, age: 30, phone: '9876543210', licenceNumber: 'JK0123456789', vehicleNumber: 'JK01AB-1234', status: 'approved', version: 1,
      }
      for (const [kind, record, editLabel] of [['hotel', ownerHotel, 'Edit hotel details'], ['driver', ownerDriver, 'Edit registration']]) {
        let details
        await page.route(kind === 'hotel' ? '**/api/hotel-status' : '**/api/drivers', async (route) => {
          if (route.request().headers()['content-type']?.startsWith('multipart/form-data')) {
            const request = new Request(route.request().url(), { method: 'POST', headers: route.request().headers(), body: route.request().postDataBuffer() })
            details = JSON.parse((await request.formData()).get('details'))
            return route.fulfill({ json: { saved: true, id, driverId: ownerDriver.driverId, accessCode: 'REGI3210', status: 'pending' } })
          }
          return route.fulfill({ json: { [kind]: record } })
        })
        await page.route('**/api/hotel-update', async (route) => {
          const request = new Request(route.request().url(), { method: 'POST', headers: route.request().headers(), body: route.request().postDataBuffer() })
          details = JSON.parse((await request.formData()).get('details'))
          return route.fulfill({ json: { saved: true, id, hotelId: hotel.hotelId, accessCode: 'REGI3210', status: 'pending' } })
        })
        await page.goto(`${origin}/${kind}-status`)
        await page.locator('[name="identifier"]').fill(kind === 'hotel' ? hotel.hotelId : ownerDriver.driverId)
        await page.locator('[name="accessCode"]').fill('REGI3210')
        await page.getByRole('button', { name: 'Check status', exact: true }).click()
        await page.getByRole('button', { name: editLabel, exact: true }).click()
        const region = page.getByRole('combobox', { name: 'Region', exact: true })
        assert.equal(await region.inputValue(), 'Ladakh')
        assert.equal(await page.locator('[name="location"]').inputValue(), 'Leh')
        if (kind === 'hotel') assert.equal(await page.getByLabel('Exact area', { exact: true }).inputValue(), 'Changspa')
        await region.selectOption('Jammu')
        await page.locator('[name="location"]').selectOption(kind === 'hotel' ? 'Katra' : 'Jammu')
        if (kind === 'hotel') await page.getByLabel('Exact area', { exact: true }).selectOption('Katra town (Vaishno Devi base)')
        await page.locator('[name="publicationConsent"]').check()
        await page.getByRole('button', { name: 'Save changes for approval', exact: true }).click()
        await page.locator('.registration-success').waitFor()
        assert.equal(details.region, 'Jammu')
        assert.equal(details.location, kind === 'hotel' ? 'Katra' : 'Jammu')
        await page.unroute(kind === 'hotel' ? '**/api/hotel-status' : '**/api/drivers')
        await page.unroute('**/api/hotel-update')
      }
    } finally { await browser.close() }
  })
  try {
    await page.goto(`${origin}/ladakh/hotels`)
    await page.getByRole('heading', { name: hotel.name }).waitFor()
    await page.getByRole('link', { name: 'Explore Now', exact: true }).click()
    await page.waitForURL(`${origin}/ladakh/hotels/${id}`)
    await page.getByRole('heading', { name: hotel.name, exact: true }).waitFor()
    assert.equal(await page.getByRole('link', { name: 'View hotel reviews', exact: true }).getAttribute('href'), `/ladakh/hotels/${hotel.hotelId}/reviews`)
    await page.locator('.detail-aside').getByRole('button', { name: 'Book Now', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByText('Selected hotel', { exact: true }).waitFor()
    assert.equal(await dialog.locator('[name="preferredStay"]').inputValue(), `${hotel.name} (${hotel.hotelId})`)
    assert.equal(await dialog.getByText(/Deluxe Package|Premium Package|Luxury Package/).count(), 0)
    await page.goto(`${origin}/hotels`)
    await page.getByRole('heading', { name: 'No approved hotels yet' }).waitFor()
    await page.goto(`${origin}/jammu/hotels`)
    await page.getByRole('heading', { name: 'No approved hotels yet' }).waitFor()
    assert.equal(await page.getByText(hotel.name, { exact: true }).count(), 0)
    await page.goto(`${origin}/jammu/hotels/${id}`)
    await page.getByRole('heading', { name: /find that page/i }).waitFor()
    assert.equal(await page.getByRole('heading', { name: hotel.name, exact: true }).count(), 0)
  } finally { await browser.close() }
})

test('Ladakh enquiries retain region and chosen route, retry safely and only show success after database acknowledgement', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  try {
    for (const [section, kind, preference] of [
      ['contact?service=Ladakh%20Essentials', 'contact', 'Ladakh Essentials'],
      ['packages', 'package', 'Ladakh package planning'],
      ['car-rentals', 'car', 'Ladakh cab or transfer'],
      ['bike-trips', 'package', 'Ladakh bike trip planning'],
    ]) {
      let payload
      let release
      let markPending
      const pendingResponse = new Promise((resolve) => { markPending = resolve })
      let failed = false
      const received = []
      await page.route('**/api/enquiries', async (route) => {
        payload = route.request().postDataJSON()
        received.push(payload)
        if (!failed) { failed = true; return route.fulfill({ status: 503, json: { error: 'Test database unavailable' } }) }
        await new Promise((resolve) => { release = resolve; markPending() })
        await route.fulfill({ status: 201, json: { saved: true, requestReference: payload.reference, reference: `AVELOF_${kind === 'contact' ? 'INQ' : kind === 'car' ? 'CAB' : 'CSTM'}_10022` } })
      })
      await page.goto(`${origin}/ladakh/${section}`)
      const form = page.locator('.ladakh-enquiry')
      await form.getByLabel('Name', { exact: true }).fill('Regional Guest')
      await form.getByLabel('Phone number', { exact: true }).fill('9876543210')
      if (kind !== 'contact') {
        await form.getByLabel('Start date', { exact: true }).fill('2027-07-10')
        await form.getByLabel('End date', { exact: true }).fill('2027-07-17')
      }
      await form.getByRole('button', { name: 'Submit enquiry', exact: true }).click()
      await form.getByRole('alert').waitFor()
      assert.equal(await page.getByRole('dialog').count(), 0)
      await form.getByRole('button', { name: 'Submit enquiry', exact: true }).click()
      await page.waitForFunction(() => document.querySelector('.ladakh-enquiry').getAttribute('aria-busy') === 'true')
      await pendingResponse
      assert.equal(await page.locator('.booking-modal:not(.registration-progress)').count(), 0, 'No receipt while database response is pending')
      assert.equal(payload.fields.region, 'Ladakh')
      assert.equal(payload.kind, kind)
      assert.equal(payload.fields.packagePreference, preference)
      assert.equal(received[0].reference, received[1].reference, 'Retries keep the same idempotency reference')
      release()
      await page.locator('.booking-modal:not(.registration-progress)').waitFor()
      assert.match(await page.getByRole('dialog').innerText(), /not a confirmed booking/i)
      await page.unroute('**/api/enquiries')
    }
  } finally { await browser.close() }
})
