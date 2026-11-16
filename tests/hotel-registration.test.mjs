import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { dismissSubmission } from './submission-feedback.mjs'
import { mockPartnerPhotos } from './partner-photo-preview.mjs'
import { validHotelJpeg } from '../functions/_lib/hotelRegistration.ts'
import { hotelPhotoLimit } from '../src/data/hotelRegistration.ts'

const origin = process.env.AVELOF_HOTEL_TEST_URL || 'http://localhost:8792'
const id = '00000000-0000-4000-8000-000000000001'
const hotelId = 'AVELOF_HTL_10001GLM'
const accessCode = 'VALL3210'
const hotel = {
  id, hotelId, name: 'Valley Partner Hotel', contactName: 'Private Partner', phone: '9876543210',
  location: 'Gulmarg', category: 'Premium', description: 'A mountain hotel with comfortable rooms and local hospitality.',
  price: 4500, submittedPrice: 5000, mealPlan: 'Breakfast included', taxDetails: 'Taxes included', gstPercent: 0,
  heating: 'Centralised heating', amenities: ['Wi-Fi', 'Parking'], highlights: ['Mountain views', 'Near the market'],
  roomTypes: ['Standard (2 rooms)', 'Deluxe (3 rooms)', 'Family (4 rooms)', 'Suite (3 rooms)'], checkIn: '14:00', checkOut: '11:00', totalRooms: 12,
  photos: [`/api/hotel-images/${id}/0`], status: 'pending', version: 0, ownerNote: 'Thank you for registering.',
  createdAt: '2026-11-13T10:00:00Z', updatedAt: '2026-11-13T10:00:00Z',
  latitude: 34.0484123, longitude: 74.3805678,
}
const list = (hotels) => ({ hotels, total: hotels.length, page: 1, pageSize: 25 })
const publicHotel = () => {
  const { contactName, phone, submittedPrice, status, version, ownerNote, createdAt, updatedAt, ...publicDetails } = hotel
  void contactName; void phone; void submittedPrice; void status; void version; void ownerNote; void createdAt; void updatedAt
  return publicDetails
}
async function makePhoto(page) {
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 2000; canvas.height = 1400
    const context = canvas.getContext('2d')
    const gradient = context.createLinearGradient(0, 0, 2000, 1400)
    gradient.addColorStop(0, '#305746'); gradient.addColorStop(1, '#e6cb92')
    context.fillStyle = gradient; context.fillRect(0, 0, 2000, 1400)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  return { name: 'hotel.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') }
}
async function fillRegistration(page) {
  await page.getByLabel('Hotel name', { exact: true }).fill(hotel.name)
  await page.getByLabel("Contact person's name (private)").fill(hotel.contactName)
  await page.getByLabel('Phone number (private)').fill(hotel.phone)
  await page.getByRole('combobox', { name: 'Location', exact: true }).selectOption(hotel.location)
  await page.getByRole('combobox', { name: 'Exact area', exact: true }).selectOption('Tangmarg')
  await page.getByLabel('AVELOF category').selectOption(hotel.category)
  for (const roomType of ['Standard', 'Deluxe', 'Premium', 'Family', 'Suite']) {
    const input = page.getByLabel(`${roomType} rooms`, { exact: true })
    assert.equal(await input.inputValue(), '0')
  }
  await page.getByRole('button', { name: 'Increase Standard rooms', exact: true }).click()
  assert.equal(await page.getByLabel('Standard rooms', { exact: true }).inputValue(), '1')
  await page.getByRole('button', { name: 'Decrease Standard rooms', exact: true }).click()
  assert.equal(await page.getByLabel('Standard rooms', { exact: true }).inputValue(), '0')
  for (const [roomType, count] of [['Standard', 2], ['Deluxe', 3], ['Premium', 0], ['Family', 4], ['Suite', 3]]) {
    await page.getByLabel(`${roomType} rooms`, { exact: true }).fill(String(count))
  }
  assert.equal(await page.locator('.hotel-amenity-options').getByLabel('Family rooms', { exact: true }).count(), 0)
  for (const [index, roomType] of ['Standard', 'Deluxe', 'Premium', 'Family', 'Suite'].entries()) {
    assert.equal(await page.getByLabel(`${roomType} rate (INR)`, { exact: true }).inputValue(), '2000')
    await page.getByLabel(`${roomType} rate (INR)`, { exact: true }).fill(String(hotel.submittedPrice + index * 1000))
  }
  assert.equal(await page.getByLabel('Breakfast add-on (INR)', { exact: true }).inputValue(), '500')
  await page.getByRole('button', { name: 'Increase Breakfast add-on (INR)', exact: true }).click()
  await page.getByRole('button', { name: 'Decrease Dinner add-on (INR)', exact: true }).click()
  await page.getByLabel('Standard rate (INR)', { exact: true }).pressSequentially('abc')
  assert.equal(await page.getByLabel('Standard rate (INR)', { exact: true }).inputValue(), String(hotel.submittedPrice))
  const heating = page.getByLabel('Heating system')
  assert.equal(await page.locator('select[name="taxDetails"]').count(), 0)
  assert.deepEqual(await heating.locator('option:not([disabled])').allTextContents(), ['Centralised heating', 'Hot & cold AC', 'Room heaters', 'No heating'])
  await heating.selectOption('Hot & cold AC')
  assert.equal(await heating.inputValue(), 'Hot & cold AC')
  await heating.selectOption(hotel.heating)
  await page.getByLabel('Hot & cold AC', { exact: true }).selectOption('yes')
  await page.getByLabel('Wi-Fi', { exact: true }).check()
  await page.getByLabel('Mountain views', { exact: true }).check()
  await page.getByLabel('Near the market', { exact: true }).check()
  await page.locator('[name="publicationConsent"]').check()
}

test('hotel registration, private lookup and moderation integrate with public stays', async (context) => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    await context.test('simple hotel prices preserve meal charges and ignore legacy GST metadata', async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
      const current = {
        ...publicHotel(), price: 2900, mealPlan: 'Room only', breakfastPrice: 250, dinnerPrice: 400, gstPercent: 5,
        roomRates: [{ roomType: 'Standard', count: 6, price: 2900 }, { roomType: 'Suite', count: 6, price: 5800 }],
      }
      await page.route('**/api/hotels*', (route) => route.fulfill({ json: list([current]) }))
      try {
        await page.goto(`${origin}/hotels`)
        const card = page.locator('.hotel-card')
        await card.waitFor()
        assert.ok((await card.locator('.hotel-rates strong').innerText()).includes('2,900'))
        assert.equal(await card.locator('s, .discount-label').count(), 0)
        assert.equal(await card.locator('.hotel-price-comparison').count(), 0)
        assert.ok(!/GST/i.test(await card.innerText()))
        assert.ok((await card.innerText()).includes('All taxes and charges included'))
        for (const width of [320, 390, 1440]) {
          await page.setViewportSize({ width, height: 900 })
          assert.equal(await card.locator('.hotel-rates').evaluate((element) => element.scrollWidth > element.clientWidth), false)
        }
        await page.setViewportSize({ width: 390, height: 844 })
        await page.goto(`${origin}/hotels/${id}`)
        assert.equal(await page.locator('.detail-aside .hotel-rates strong').innerText(), '₹2,900')
        await page.getByRole('button', { name: 'Book Now', exact: true }).click()
        const form = page.locator('.enquiry-form')
        await form.getByLabel('Room type', { exact: true }).selectOption('Suite')
        const rates = form.locator('.hotel-rates')
        assert.equal(await rates.locator('strong[role="status"]').innerText(), '₹5,800')
        assert.equal(await rates.locator('s, .discount-label').count(), 0)
        await rates.getByLabel('Breakfast', { exact: false }).check()
        assert.equal(await rates.locator('strong[role="status"]').innerText(), '₹6,050')
        assert.ok((await rates.locator('.hotel-meal-coverage').innerText()).includes('breakfast for 2 people per room per day'))
        assert.ok(!/GST|tax|discount/i.test(await rates.innerText()))
      } finally { await page.close() }
    })
    await context.test('exact areas follow destination, clear stale choices and display on hotel pages', async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
      await page.route('**/api/hotels*', (route) => route.fulfill({ json: list([{ ...publicHotel(), exactLocation: 'Tangmarg' }]) }))
      try {
        await page.goto(`${origin}/register-hotel`)
        const destination = page.getByRole('combobox', { name: 'Location', exact: true })
        const area = page.getByRole('combobox', { name: 'Exact area', exact: true })
        assert.equal(await area.isDisabled(), true)
        const choices = [
          ['Gulmarg', ['Main Gulmarg', 'Tangmarg']],
          ['Pahalgam', ['Main Pahalgam', 'Rafting Point']],
          ['Srinagar', ['Near Dal Lake', 'Near Airport', 'Main Srinagar']],
          ...['Sonamarg', 'Doodhpathri', 'Yusmarg', 'Gurez'].map((value) => [value, [`Main ${value}`]]),
        ]
        for (const [value, options] of choices) {
          await destination.selectOption(value)
          assert.equal(await area.inputValue(), '')
          assert.deepEqual(await area.locator('option:not([value=""])').allTextContents(), [...options, 'Specify location'])
          await area.selectOption('custom')
          const custom = page.getByRole('textbox', { name: 'Specify exact location', exact: true })
          assert.equal(await custom.getAttribute('required'), '')
          await custom.fill('Near the market')
          await area.selectOption(options[0])
          assert.equal(await custom.count(), 0)
        }
        await page.goto(`${origin}/hotels`)
        await page.locator('.hotel-card .hotel-exact-location').waitFor()
        assert.equal((await page.locator('.hotel-card .hotel-exact-location').textContent()).trim(), 'Tangmarg, Gulmarg')
        await page.getByRole('link', { name: hotel.name, exact: true }).click()
        assert.equal((await page.locator('.hotel-heading-summary .hotel-exact-location').textContent()).trim(), 'Tangmarg, Gulmarg')
      } finally { await page.close() }
    })
    await context.test('five hotel tiers appear in registration, public badges, filters and details', async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
      const tiers = [
        ['Deluxe', 'Deluxe - 2-star'], ['Premium', 'Premium - 3-star'],
        ['Premium Plus', 'Premium Plus - 3-star Plus'], ['Diamond', 'Diamond - 4-star'], ['Luxury', 'Luxury - 5-star'],
      ]
      const hotels = tiers.map(([category], index) => ({
        ...publicHotel(), category, name: `${category} Test Stay`,
        id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        hotelId: `AVELOF_HTL_${10001 + index}GLM`,
      }))
      await page.route('**/api/hotels*', (route) => route.fulfill({ json: list(hotels) }))
      try {
        await page.goto(`${origin}/register-hotel`)
        const category = page.getByLabel('AVELOF category')
        assert.deepEqual(await category.locator('option:not([value=""])').allTextContents(), tiers.map(([, label]) => label))
        for (const [value] of tiers) {
          await category.selectOption(value)
          assert.equal(await category.inputValue(), value)
        }
        await page.goto(`${origin}/hotels`)
        await page.locator('.hotel-card').nth(4).waitFor()
        for (const [value, label] of tiers) {
          await page.locator('.filters-bar select').first().selectOption(value)
          await page.waitForFunction(() => document.querySelectorAll('.hotel-card').length === 1)
          assert.equal(await page.locator('.hotel-card').count(), 1)
          assert.equal(await page.locator('.hotel-card .image-tag').textContent(), label)
          assert.equal(new URL(page.url()).searchParams.get('category'), value)
          await page.reload()
          await page.locator('.hotel-card').waitFor()
          assert.equal(await page.locator('.hotel-card .image-tag').textContent(), label)
        }
        await page.locator('.filters-bar select').first().selectOption('Premium Plus')
        await page.getByRole('link', { name: 'Premium Plus Test Stay', exact: true }).click()
        assert.ok((await page.locator('.detail-heading .eyebrow').textContent()).includes('Premium Plus - 3-star Plus'))
        assert.ok(await page.getByText('Hotel-provided photos reviewed for listing. Category labels are AVELOF categories, not official star certifications.', { exact: true }).isVisible())
      } finally { await page.close() }
    })
    await context.test('hotel price bands filter minimum room rates at every boundary and survive reload', async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
      const prices = [1499, 1500, 2499.99, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10500, 10500.01]
      const hotels = prices.map((price, index) => ({
        ...publicHotel(),
        id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        hotelId: `AVELOF_HTL_${10001 + index}GLM`,
        name: `Rate ${price}`,
        price,
      }))
      await page.route('**/api/hotels*', (route) => route.fulfill({ json: list(hotels) }))
      try {
        await page.goto(`${origin}/hotels`)
        await page.locator('.hotel-card').first().waitFor()
        const filter = page.getByRole('combobox', { name: 'Price', exact: true })
        assert.deepEqual(await filter.locator('option').allTextContents(), [
          'Any price', '₹1,500–₹2,500', '₹2,500–₹3,500', '₹3,500–₹4,500',
          '₹4,500–₹5,500', '₹5,500–₹6,500', '₹6,500–₹7,500',
          '₹7,500–₹8,500', '₹8,500–₹9,500', '₹9,500–₹10,500', 'Above ₹10,500',
        ])
        for (let minimum = 1500; minimum <= 9500; minimum += 1000) {
          const maximum = minimum + 1000
          await filter.selectOption(`${minimum}-${maximum}`)
          const expected = prices.filter((price) => price >= minimum && (maximum === 10500 ? price <= maximum : price < maximum))
          await page.waitForFunction((names) => JSON.stringify([...document.querySelectorAll('.hotel-card .catalog-title h3')].map((heading) => heading.textContent)) === JSON.stringify(names), expected.map((price) => `Rate ${price}`))
          assert.deepEqual(await page.locator('.hotel-card .catalog-title h3').allTextContents(), expected.map((price) => `Rate ${price}`))
        }
        await filter.selectOption('above-10500')
        await page.reload()
        await page.locator('.hotel-card').first().waitFor()
        assert.equal(await filter.inputValue(), 'above-10500')
        assert.deepEqual(await page.locator('.hotel-card .catalog-title h3').allTextContents(), ['Rate 10500.01'])
        await filter.selectOption('all')
        await page.waitForFunction((count) => document.querySelectorAll('.hotel-card').length === count, prices.length)
        assert.equal(await page.locator('.hotel-card').count(), prices.length)
        assert.equal(new URL(page.url()).searchParams.has('price'), false)
        await page.goto(`${origin}/hotels?price=25000`)
        await page.locator('.hotel-card').first().waitFor()
        assert.equal(await filter.inputValue(), 'all')
        assert.equal(await page.locator('.hotel-card').count(), prices.length)
      } finally { await page.close() }
    })
    await context.test('room rates are reviewed individually, cards show the minimum, and enquiries use the chosen room', async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
      const roomRates = [
        { roomType: 'Standard', count: 4, price: 3000 },
        { roomType: 'Deluxe', count: 4, price: 4500 },
        { roomType: 'Suite', count: 4, price: 6000 },
      ]
      let current = { ...hotel, photos: [`/api/hotel-images/${id}/0`, `/api/hotel-images/${id}/1`], price: 3000, roomRates, roomTypes: roomRates.map((room) => `${room.roomType} (4 rooms)`), mealPlan: 'Room only', breakfastPrice: 400, dinnerPrice: 600 }
      let update, enquiry
      await page.route('**/api/hotels*', (route) => {
        if (route.request().method() === 'PATCH') {
          update = route.request().postDataJSON()
          current = { ...current, ...update, version: 1 }
          return route.fulfill({ json: { hotel: current } })
        }
        if (new URL(route.request().url()).searchParams.get('scope') === 'admin') return route.fulfill({ json: list([current]) })
        const { contactName, phone, submittedPrice, status, version, ownerNote, createdAt, updatedAt, ...published } = current
        void contactName; void phone; void submittedPrice; void status; void version; void ownerNote; void createdAt; void updatedAt
        return route.fulfill({ json: list([published]) })
      })
      await page.route('**/api/push*', (route) => route.fulfill({ status: 503, json: { error: 'Push is not configured.' } }))
      await page.route('**/api/enquiries', (route) => {
        enquiry = route.request().postDataJSON()
        return route.fulfill({ status: 201, json: { saved: true, requestReference: enquiry.reference, reference: 'AVELOF_HTL_10001' } })
      })
      try {
        await page.goto(`${origin}/admin/panel/hotels`)
        await page.getByLabel('Reviewed Standard rate (INR)', { exact: true }).fill('5000')
        await page.getByLabel('Reviewed Suite rate (INR)', { exact: true }).fill('6500')
        await page.getByLabel('Listing status').selectOption('approved')
        await page.getByRole('button', { name: 'Save price and status' }).click()
        await page.getByRole('status').filter({ hasText: 'Hotel price and status saved.' }).waitFor()
        assert.equal(update.price, 4500)
        assert.deepEqual(update.roomRates, roomRates.map((room) => room.roomType === 'Suite' ? { ...room, price: 6500 } : room.roomType === 'Standard' ? { ...room, price: 5000 } : room))
        await page.goto(`${origin}/hotels`)
        const card = page.locator('.catalog-card').filter({ hasText: hotel.name })
        await card.waitFor()
        assert.ok((await card.locator('.hotel-rates').innerText()).includes('4,500'))
        assert.equal(await card.getByLabel('Room type', { exact: true }).count(), 0)
        assert.equal((await card.innerText()).includes('6,500'), false)
        assert.ok(await card.locator('.hotel-feature svg').count() >= 3)
        assert.equal(await card.getByRole('checkbox').count(), 0)
        assert.deepEqual(await card.getByRole('list', { name: 'Available room types' }).locator('li').allTextContents(), ['Standard', 'Deluxe', 'Suite'])
        for (const width of [320, 390, 768, 1024, 1440]) {
          await page.setViewportSize({ width, height: 900 })
          const box = await card.boundingBox()
          const photo = await card.locator('.catalog-image').boundingBox()
          assert.ok(photo.height / photo.width >= 0.55, `Hotel photo visibility at ${width}px`)
          assert.equal(await card.locator('.catalog-content .catalog-meta').count(), 0)
          assert.ok((await card.locator('.catalog-image .hotel-image-location').innerText()).includes('Gulmarg'))
          const mapLinkBox = await card.getByRole('link', { name: 'View on Google Maps' }).boundingBox()
          const acStatusBox = await card.locator('.hotel-ac-status').boundingBox()
          const seasonalNoteBox = await card.locator('.hotel-season-note').boundingBox()
          const maximumRatio = (box.width < 300 ? 1.85 : 1.7) + (mapLinkBox.height + acStatusBox.height + seasonalNoteBox.height + 6) / box.width
          assert.ok(box.height / box.width >= 1.2 && box.height / box.width <= maximumRatio, `Hotel card ratio at ${width}px: ${box.height / box.width}`)
          for (const action of [card.getByRole('link', { name: 'Explore Now' }), card.getByRole('button', { name: 'Book Now' })]) {
            assert.equal(await action.isVisible(), true)
            const contained = await action.evaluate((element) => {
              const actionBox = element.getBoundingClientRect()
              const cardBox = element.closest('.hotel-card').getBoundingClientRect()
              return actionBox.left >= cardBox.left && actionBox.right <= cardBox.right + 1 && actionBox.bottom <= cardBox.bottom + 1
            })
            assert.ok(contained, `Hotel card actions stay inside the card at ${width}px`)
          }
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
        }
        await page.setViewportSize({ width: 390, height: 844 })
        await card.getByRole('link', { name: hotel.name, exact: true }).click()
        await page.locator('.hotel-room-types-available').waitFor()
        assert.equal(await page.locator('.hotel-room-types-available li').count(), 3)
        assert.equal((await page.locator('.hotel-room-types-available').innerText()).includes('6,500'), false)
        assert.equal(await page.getByLabel('Room type', { exact: true }).count(), 0)
        assert.equal(await page.locator('.detail-aside input[type="checkbox"]').count(), 0)
        assert.equal(await page.locator('.detail-aside a[href^="mailto:"]').count(), 0)
        assert.ok((await page.locator('.hotel-heading-summary').innerText()).includes(hotelId))
        const summary = page.locator('.hotel-heading-summary')
        assert.ok((await summary.innerText()).includes('rooms'))
        assert.ok(await summary.getByRole('link', { name: 'View hotel reviews' }).isVisible())
        assert.ok((await summary.boundingBox()).y < (await page.locator('.hotel-detail-photo').boundingBox()).y)
        assert.equal(await page.locator('.detail-heading').getByRole('button', { name: 'Book Now' }).count(), 0)
        const bottomBooking = page.locator('.hotel-end-booking').getByRole('button', { name: 'Book Now' })
        const sidebarBooking = page.locator('.detail-aside').getByRole('button', { name: 'Book Now' })
        for (const width of [320, 390, 820, 821, 1440]) {
          await page.setViewportSize({ width, height: 900 })
          assert.equal(await bottomBooking.isVisible(), width <= 820)
          assert.equal(await sidebarBooking.isVisible(), width > 820)
          assert.equal(await page.getByRole('button', { name: 'Book Now', exact: true }).count(), 1)
          assert.equal(await page.locator('.hotel-detail-layout').evaluate((element) => element.scrollWidth > element.clientWidth), false)
          if (width <= 820) {
            const bottom = await bottomBooking.boundingBox()
            const sections = page.locator('.detail-body .detail-section')
            const lastSection = await sections.last().boundingBox()
            const pricing = await page.locator('.detail-aside').boundingBox()
            assert.ok(bottom.y >= lastSection.y + lastSection.height - 1)
            assert.ok(bottom.y >= pricing.y + pricing.height)
          } else {
            assert.equal(await page.locator('.detail-aside').evaluate((element) => getComputedStyle(element).position), 'sticky')
          }
        }
        await page.setViewportSize({ width: 390, height: 844 })
        assert.equal(await page.locator('.detail-body .hotel-identifier').count(), 0)
        assert.equal((await page.locator('.detail-aside').innerText()).includes('From'), false)
        assert.ok((await page.locator('.detail-aside .hotel-rates').innerText()).includes('Deluxe room'))
        assert.ok((await page.locator('.detail-aside .hotel-rates strong').innerText()).includes('4,500'))
        assert.ok(await page.locator('.detail-section .hotel-feature svg').count() >= 5)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
        await bottomBooking.click()
        const form = page.locator('.enquiry-form')
        assert.equal(await form.getByLabel('Room type', { exact: true }).inputValue(), 'Deluxe')
        assert.equal(await form.getByLabel('Room type', { exact: true }).locator('option').filter({ hasText: 'INR' }).count(), 0)
        await form.getByLabel('Room type', { exact: true }).selectOption('Suite')
        await form.getByLabel('Breakfast', { exact: false }).check()
        await form.getByLabel('Dinner', { exact: false }).check()
        assert.ok((await form.locator('.hotel-rates').innerText()).includes('7,500'))
        await form.locator('[name="fullName"]').fill('Room Type Guest')
        await form.locator('[name="phoneNumber"]').fill('9876543210')
        await form.locator('[name="checkInDate"]').fill('2026-11-20')
        await form.locator('[name="checkOutDate"]').fill('2026-11-22')
        await form.locator('[type="submit"]').click()
        await page.getByRole('heading', { name: 'Thank you for submitting your details.' }).waitFor()
        assert.equal(enquiry.fields.roomType, 'Suite')
        assert.ok(enquiry.fields.nightlyRate.includes('7,500'))
        assert.equal(enquiry.fields.breakfast, 'Included')
        assert.equal(enquiry.fields.dinner, 'Included')
        await page.goto(`${origin}/tour-packages`)
        const planner = page.locator('.trip-planner')
        assert.equal(await planner.getByRole('button', { name: 'Next: places' }).isDisabled(), true)
        assert.equal(await planner.locator('.planner-destination-picker').count(), 0)
        assert.deepEqual(await planner.locator('.planner-step-label').allTextContents(), ['Date', 'Places', 'Vehicle', 'Activities', 'Hotels', 'Contact details'])
        await planner.getByLabel('Start date').fill('2026-11-20')
        await planner.getByLabel('End date').fill('2026-11-21')
        await planner.getByRole('button', { name: 'Next: places' }).click()
        await planner.getByRole('button', { name: 'Next: vehicle' }).click()
        assert.ok((await planner.getByRole('alert').innerText()).includes('Not enough days'))
        assert.equal(await planner.locator('.planner-vehicle-picker').count(), 0)
        await planner.getByRole('button', { name: 'Back', exact: true }).click()
        await planner.getByLabel('End date').fill('2026-11-24')
        assert.equal(await planner.locator('.planner-vehicle-picker').count(), 0)
        assert.equal(await planner.locator('.day-plans').count(), 0)
        await planner.getByRole('button', { name: 'Next: places' }).click()
        assert.equal(await planner.locator('.planner-steps .is-complete svg').count(), 1)
        const progressLayout = await planner.locator('.planner-steps li').evaluateAll((items) => items.map((item, index) => {
          const number = item.querySelector('.planner-step-number').getBoundingClientRect()
          const label = item.querySelector('.planner-step-label').getBoundingClientRect()
          const line = getComputedStyle(item, '::before')
          return { top: number.top, labelBelow: label.top >= number.bottom, line: index ? line.backgroundColor : null, lineWidth: index ? parseFloat(line.width) : 0 }
        }))
        assert.ok(progressLayout.every((item) => item.top === progressLayout[0].top && item.labelBelow))
        assert.ok(progressLayout.slice(1).every((item) => item.lineWidth > 0))
        assert.notEqual(progressLayout[1].line, progressLayout[2].line)
        assert.equal(progressLayout[2].line, progressLayout[3].line)
        await planner.getByRole('button', { name: 'Next: vehicle' }).click()
        const progressBounds = await planner.locator('.planner-steps').boundingBox()
        const backBounds = await planner.getByRole('button', { name: 'Back', exact: true }).boundingBox()
        const vehicleBounds = await planner.locator('.planner-vehicle-picker').boundingBox()
        assert.ok(backBounds.y >= progressBounds.y + progressBounds.height && backBounds.y < vehicleBounds.y)
        assert.equal(await planner.locator('.planner-destination-picker').count(), 0)
        await planner.getByRole('button', { name: 'Next: activities' }).click()
        await planner.getByRole('button', { name: 'Next: hotels' }).click()
        assert.equal(await planner.locator('.planner-steps .is-complete svg').count(), 4)
        const hotelStepLines = await planner.locator('.planner-steps li').evaluateAll((items) => items.slice(1).map((item) => getComputedStyle(item, '::before').backgroundColor))
        assert.equal(hotelStepLines[0], hotelStepLines[1])
        assert.equal(hotelStepLines[1], hotelStepLines[2])
        assert.equal(hotelStepLines[2], hotelStepLines[3])
        assert.notEqual(hotelStepLines[3], hotelStepLines[4])
        const tripEstimate = planner.locator('.planner-trip-estimate')
        const vehicleEstimate = Number((await tripEstimate.locator('strong').innerText()).split('₹')[1].replaceAll(',', ''))
        assert.ok((await tripEstimate.innerText()).includes('4 unselected hotel nights are not included'))
        await planner.getByRole('button', { name: 'Stay in Gulmarg', exact: true }).first().click()
        const plannedHotel = planner.locator('.planner-hotel-card').filter({ hasText: hotel.name }).first()
        const hotelPhotos = plannedHotel.getByRole('region', { name: `${hotel.name} hotel photos` })
        assert.equal(await hotelPhotos.getAttribute('data-photo-count'), '2')
        const firstPhoto = await hotelPhotos.locator('img').getAttribute('src')
        await page.waitForFunction(({ name, src }) => document.querySelector(`[aria-label="${name} hotel photos"] img`)?.getAttribute('src') !== src, { name: hotel.name, src: firstPhoto })
        await plannedHotel.locator('.planner-hotel-tile').click()
        assert.equal(await plannedHotel.locator('.hotel-feature-chips').count(), 0)
        assert.equal(await plannedHotel.locator('.planner-hotel-category').textContent(), 'Premium - 3-star')
        assert.equal((await plannedHotel.innerText()).includes('Wi-Fi'), false)
        assert.equal((await plannedHotel.innerText()).includes('Centralised heating'), false)
        await plannedHotel.getByLabel('Room type', { exact: true }).selectOption('Deluxe')
        await plannedHotel.getByLabel('Dinner', { exact: false }).check()
        assert.ok((await plannedHotel.locator('.hotel-rates').innerText()).includes('5,100'))
        assert.ok((await tripEstimate.innerText()).includes(`Vehicle + selected stays: ₹${(vehicleEstimate + 5100).toLocaleString('en-IN')}`))
        assert.ok((await tripEstimate.innerText()).includes('Selected stays: ₹5,100 (1/4 nights)'))
        await plannedHotel.getByLabel('Room type', { exact: true }).selectOption('Suite')
        assert.ok((await tripEstimate.innerText()).includes(`Vehicle + selected stays: ₹${(vehicleEstimate + 7100).toLocaleString('en-IN')}`))
        await plannedHotel.getByLabel('Room type', { exact: true }).selectOption('Deluxe')
        await planner.getByRole('button', { name: 'Back', exact: true }).click()
        assert.equal(await planner.locator('.day-plans').count(), 0)
        await planner.getByRole('button', { name: 'Back', exact: true }).click()
        await planner.getByRole('button', { name: 'Back', exact: true }).click()
        assert.equal(await planner.locator('.planner-destination-picker').getByRole('checkbox', { name: /Gulmarg/ }).isChecked(), true)
        await planner.getByRole('button', { name: 'Back', exact: true }).click()
        assert.equal(await planner.getByLabel('Start date').inputValue(), '2026-11-20')
        await planner.getByRole('button', { name: 'Next: places' }).click()
        await planner.getByRole('button', { name: 'Next: vehicle' }).click()
        await planner.getByRole('button', { name: 'Next: activities' }).click()
        await planner.getByRole('button', { name: 'Next: hotels' }).click()
        assert.equal(await plannedHotel.getByLabel('Room type', { exact: true }).inputValue(), 'Deluxe')
        assert.equal(await plannedHotel.getByLabel('Dinner', { exact: false }).isChecked(), true)
        await plannedHotel.getByRole('link', { name: 'View hotel' }).click()
        await page.getByText('Wi-Fi', { exact: true }).first().waitFor()
        await page.getByRole('button', { name: 'Back to your trip', exact: true }).click()
        await plannedHotel.getByLabel('Room type', { exact: true }).waitFor()
        assert.equal(await plannedHotel.getByLabel('Room type', { exact: true }).inputValue(), 'Deluxe')
        for (const width of [320, 390, 1440]) {
          await page.setViewportSize({ width, height: 900 })
          await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
          assert.ok((await plannedHotel.boundingBox()).height < 900, `Selected hotel and meal coverage should fit within 900px at ${width}px`)
          const cardWidth = (await plannedHotel.boundingBox()).width
          const railWidth = (await plannedHotel.locator('..').locator('..').boundingBox()).width
          assert.ok(width > 560 ? cardWidth >= 250 : cardWidth >= 220 && cardWidth >= railWidth * 0.84, `Hotel cards should be wider at ${width}px: card ${cardWidth}px, rail ${railWidth}px`)
        }
        await planner.getByRole('button', { name: 'Continue with this plan' }).click()
        await page.getByRole('button', { name: 'Back to hotels', exact: true }).click()
        assert.equal(await plannedHotel.getByLabel('Dinner', { exact: false }).isChecked(), true)
        await planner.getByRole('button', { name: 'Continue with this plan' }).click()
        const plannedForm = page.locator('.enquiry-form')
        assert.equal(await planner.locator('.planner-steps .is-complete svg').count(), 5)
        for (const [index, label] of ['Date', 'Places', 'Vehicle', 'Activities', 'Hotels'].entries()) {
          await planner.getByRole('button', { name: `Step ${index + 1}: ${label}, completed. Edit`, exact: true }).click()
          assert.equal(await planner.locator('.planner-steps [aria-current="step"] .planner-step-label').innerText(), label)
          assert.equal(await planner.getByRole('button', { name: 'Step 6: Contact details', exact: true }).isDisabled(), true)
          for (let next = index; next < 4; next++) await planner.getByRole('button', { name: `Next: ${['places', 'vehicle', 'activities', 'hotels'][next]}`, exact: true }).click()
          assert.equal(await plannedHotel.getByLabel('Room type', { exact: true }).inputValue(), 'Deluxe')
          await planner.getByRole('button', { name: 'Continue with this plan' }).click()
          await planner.getByRole('heading', { name: 'Contact details', exact: true }).waitFor()
        }
        assert.equal(await plannedForm.locator('select, textarea, input[type="date"]').count(), 0)
        assert.equal(await plannedForm.locator('input:not([type="hidden"]):not([name="website"])').count(), 2)
        assert.equal(await page.getByRole('dialog').count(), 0)
        await plannedForm.getByLabel('Name', { exact: true }).fill('Planned Guest')
        await plannedForm.getByLabel('Phone number').fill('9876543210')
        await plannedForm.getByRole('button', { name: 'Submit enquiry' }).click()
        await page.getByRole('heading', { name: 'Thank you for submitting your details.' }).waitFor()
        assert.equal(enquiry.fields.adults, '2')
        assert.equal(enquiry.fields.children, '0')
        assert.equal(enquiry.fields.carRental.length > 0, true)
        assert.equal(enquiry.fields.arrivalDate, '2026-11-20')
        const itinerary = enquiry.fields.customDetails
        assert.ok(itinerary.includes('room type: Deluxe'))
        assert.ok(itinerary.includes('5,100'))
        assert.ok(itinerary.includes(`Vehicle + selected stays estimate: ₹${(vehicleEstimate + 5100).toLocaleString('en-IN')}`))
      } finally { await page.close() }
    })
    await context.test('Family rates cover four people and meal add-ons use twice the base charges everywhere', async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
      const published = {
        ...publicHotel(), price: 2000, mealPlan: 'Room only', breakfastPrice: 400, dinnerPrice: 600, totalRooms: 12,
        roomRates: [{ roomType: 'Standard', count: 6, price: 3000 }, { roomType: 'Family', count: 6, price: 2000 }],
        roomTypes: ['Standard (6 rooms)', 'Family (6 rooms)'],
      }
      let enquiry
      await page.route('**/api/hotels*', (route) => route.fulfill({ json: list([published]) }))
      await page.route('**/api/enquiries', (route) => {
        enquiry = route.request().postDataJSON()
        return route.fulfill({ status: 201, json: { saved: true, requestReference: enquiry.reference, reference: 'AVELOF_CSTM_10001' } })
      })
      try {
        await page.goto(`${origin}/hotels`)
        const card = page.locator('.hotel-card').filter({ hasText: hotel.name })
        await card.waitFor()
        assert.ok((await card.locator('.hotel-rates').innerText()).includes('Family room'))
        assert.ok((await card.locator('.hotel-rates').innerText()).includes('for 4 people'))
        assert.ok((await card.locator('.hotel-rates strong').innerText()).includes('2,000'))
        await card.getByRole('link', { name: 'Explore Now' }).click()
        await page.locator('.hotel-room-types-available').waitFor()
        assert.ok((await page.locator('.hotel-room-types-available li').filter({ hasText: 'Family room' }).innerText()).includes('4 people per room'))
        assert.ok((await page.locator('.detail-aside .hotel-rates').innerText()).includes('for 4 people'))
        await page.locator('.hotel-end-booking').getByRole('button', { name: 'Book Now' }).click()
        const form = page.locator('.enquiry-form')
        const rates = form.locator('.hotel-rates')
        assert.equal(await rates.getByLabel('Room type', { exact: true }).inputValue(), 'Family')
        assert.ok((await rates.getByLabel('Breakfast', { exact: false }).locator('..').innerText()).includes('+₹800'))
        assert.ok((await rates.getByLabel('Dinner', { exact: false }).locator('..').innerText()).includes('+₹1,200'))
        await rates.getByLabel('Breakfast', { exact: false }).check()
        assert.ok((await rates.locator('strong[role="status"]').innerText()).includes('2,800'))
        await rates.getByLabel('Dinner', { exact: false }).check()
        assert.ok((await rates.locator('strong[role="status"]').innerText()).includes('4,000'))
        await rates.getByLabel('Room type', { exact: true }).selectOption('Standard')
        assert.ok((await rates.innerText()).includes('for 2 people'))
        assert.ok((await rates.locator('strong[role="status"]').innerText()).includes('4,000'))
        assert.ok((await rates.getByLabel('Breakfast', { exact: false }).locator('..').innerText()).includes('+₹400'))
        await rates.getByLabel('Room type', { exact: true }).selectOption('Family')
        await form.getByLabel('Adults', { exact: true }).fill('4')
        await form.getByLabel('Name', { exact: true }).fill('Family Guest')
        await form.getByLabel('Phone number').fill('9876543210')
        await form.locator('[name="checkInDate"]').fill('2026-11-20')
        await form.locator('[name="checkOutDate"]').fill('2026-11-24')
        await form.getByRole('button', { name: 'Submit enquiry' }).click()
        await page.getByRole('heading', { name: 'Thank you for submitting your details.' }).waitFor()
        assert.equal(enquiry.fields.roomType, 'Family')
        assert.ok(enquiry.fields.nightlyRate.includes('4,000 per room per night for 4 people'))
        await page.goto(`${origin}/tour-packages`)
        const planner = page.locator('.trip-planner')
        await planner.getByLabel('Start date').fill('2026-11-20')
        await planner.getByLabel('End date').fill('2026-11-24')
        await planner.getByRole('button', { name: 'Next: places' }).click()
        await planner.getByRole('button', { name: 'Next: vehicle' }).click()
        await planner.getByRole('button', { name: 'Next: activities' }).click()
        await planner.getByRole('button', { name: 'Next: hotels' }).click()
        await planner.getByRole('button', { name: 'Stay in Gulmarg', exact: true }).click()
        const plannedHotel = planner.locator('.planner-hotel-card').filter({ hasText: hotel.name })
        await plannedHotel.locator('.planner-hotel-tile').click()
        await plannedHotel.getByLabel('Breakfast', { exact: false }).check()
        await plannedHotel.getByLabel('Dinner', { exact: false }).check()
        assert.ok((await plannedHotel.locator('.hotel-rates').innerText()).includes('for 4 people'))
        assert.ok((await planner.locator('.planner-trip-estimate').innerText()).includes('Selected stays: ₹4,000'))
        await planner.getByRole('button', { name: 'Continue with this plan' }).click()
        await form.getByLabel('Name', { exact: true }).fill('Family Planner Guest')
        await form.getByLabel('Phone number').fill('9876543210')
        await form.getByRole('button', { name: 'Submit enquiry' }).click()
        await page.getByRole('heading', { name: 'Thank you for submitting your details.' }).waitFor()
        assert.ok(enquiry.fields.customDetails.includes('room type: Family'))
        assert.ok(enquiry.fields.customDetails.includes('4,000 per room per night for 4 people'))
      } finally { await page.close() }
    })
    await context.test('guest counts drive vehicle suggestions and room quantities with inline planner submission', async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
      const published = {
        ...publicHotel(), price: 2000, mealPlan: 'Room only', breakfastPrice: 400, dinnerPrice: 600, totalRooms: 12,
        roomRates: [{ roomType: 'Standard', count: 6, price: 3000 }, { roomType: 'Family', count: 6, price: 2000 }],
        roomTypes: ['Standard (6 rooms)', 'Family (6 rooms)'],
      }
      const submissions = []
      let fail = false
      async function assertRoomCounterAlignment(container) {
        const counter = container.locator('.number-stepper').filter({ has: page.getByLabel('Number of rooms', { exact: true }) })
        const geometry = await counter.evaluate((element) => {
          const box = element.getBoundingClientRect()
          const [decrease, input, increase] = [...element.children].map((child) => child.getBoundingClientRect())
          return {
            height: box.height,
            leftGap: decrease.left - box.left,
            rightGap: box.right - increase.right,
            inputLeftGap: input.left - decrease.right,
            inputRightGap: increase.left - input.right,
            centerOffset: Math.abs((input.left + input.right) / 2 - (box.left + box.right) / 2),
            iconsCentered: [...element.querySelectorAll('button')].every((button) => {
              const buttonBox = button.getBoundingClientRect()
              const iconBox = button.querySelector('svg').getBoundingClientRect()
              return Math.abs((buttonBox.left + buttonBox.right - iconBox.left - iconBox.right) / 2) < 1
                && Math.abs((buttonBox.top + buttonBox.bottom - iconBox.top - iconBox.bottom) / 2) < 1
            }),
          }
        })
        assert.ok(geometry.height >= 44)
        assert.ok(geometry.leftGap <= 1 && geometry.rightGap <= 1)
        assert.ok(Math.abs(geometry.inputLeftGap) < 1 && Math.abs(geometry.inputRightGap) < 1)
        assert.ok(geometry.centerOffset < 1)
        assert.ok(geometry.iconsCentered)
      }
      await page.route('**/api/hotels*', (route) => route.fulfill({ json: list([published]) }))
      await page.route('**/api/enquiries', (route) => {
        const enquiry = route.request().postDataJSON()
        submissions.push(enquiry)
        return route.fulfill(fail ? { status: 503, json: { error: 'Test storage unavailable' } } : { status: 201, json: { saved: true, requestReference: enquiry.reference, reference: 'AVELOF_CSTM_10001' } })
      })
      try {
        await page.goto(`${origin}/hotels`)
        await page.locator('.hotel-card').getByRole('button', { name: 'Book Now' }).click()
        const form = page.locator('.enquiry-form')
        await form.getByLabel('Adults', { exact: true }).fill('6')
        await form.getByLabel('Children (5 years+)', { exact: true }).fill('2')
        assert.ok((await form.innerText()).includes('Children below 5 years are complimentary.'))
        const rates = form.locator('.hotel-rates')
        for (const width of [320, 390, 1440]) {
          await page.setViewportSize({ width, height: 900 })
          await assertRoomCounterAlignment(rates)
        }
        await page.setViewportSize({ width: 390, height: 844 })
        assert.equal(await rates.getByLabel('Number of rooms', { exact: true }).inputValue(), '2')
        await rates.getByLabel('Room type', { exact: true }).selectOption('Standard')
        assert.equal(await rates.getByLabel('Number of rooms', { exact: true }).inputValue(), '4')
        assert.equal(await rates.getByRole('button', { name: 'Decrease Number of rooms', exact: true }).isDisabled(), true)
        await rates.getByLabel('Breakfast', { exact: false }).check()
        await rates.getByLabel('Dinner', { exact: false }).check()
        assert.ok((await rates.locator('.hotel-rooms-total').innerText()).includes('16,000'))
        await rates.getByRole('button', { name: 'Increase Number of rooms', exact: true }).click()
        assert.equal(await rates.getByLabel('Number of rooms', { exact: true }).inputValue(), '5')
        assert.ok((await rates.locator('.hotel-rooms-total').innerText()).includes('20,000'))
        await rates.getByLabel('Room type', { exact: true }).selectOption('Family')
        assert.equal(await rates.getByLabel('Number of rooms', { exact: true }).inputValue(), '2')
        assert.ok((await rates.locator('.hotel-rooms-total').innerText()).includes('8,000'))
        await form.getByLabel('Name', { exact: true }).fill('Eight Guests')
        await form.getByLabel('Phone number').fill('9876543210')
        await form.locator('[name="checkInDate"]').fill('2026-11-20')
        await form.locator('[name="checkOutDate"]').fill('2026-11-22')
        assert.ok((await form.locator('.hotel-stay-estimate').innerText()).includes('16,000'))
        await rates.getByLabel('Number of rooms', { exact: true }).fill('1')
        await form.getByRole('button', { name: 'Submit enquiry' }).click()
        assert.equal(submissions.length, 0)
        await rates.getByLabel('Number of rooms', { exact: true }).fill('2')
        await form.getByRole('button', { name: 'Submit enquiry' }).click()
        await page.getByRole('heading', { name: 'Thank you for submitting your details.' }).waitFor()
        assert.equal(submissions[0].fields.roomCount, '2')
        assert.ok(submissions[0].fields.hotelNightlyTotal.includes('8,000'))
        assert.ok(submissions[0].fields.hotelStayEstimate.includes('16,000'))

        await page.goto(`${origin}/tour-packages`)
        const planner = page.locator('.trip-planner')
        await planner.getByLabel('Start date').fill('2026-11-20')
        await planner.getByLabel('End date').fill('2026-11-24')
        await planner.getByLabel('Adults', { exact: true }).fill('6')
        await planner.getByLabel('Children (5 years+)', { exact: true }).fill('2')
        assert.ok((await planner.innerText()).includes('Children below 5 years are complimentary.'))
        assert.ok(!(await planner.innerText()).includes('Every child counts toward vehicle seats and room capacity.'))
        await planner.getByRole('button', { name: 'Next: places' }).click()
        await planner.getByRole('button', { name: 'Next: vehicle' }).click()
        assert.ok((await planner.innerText()).includes('Suggested for 8 people: Tempo Traveller 12-seater'))
        const sedan = planner.locator('.planner-vehicle-choice').filter({ hasText: 'Comfort Sedan' })
        assert.equal(await sedan.getByRole('radio').isDisabled(), true)
        const traveller = planner.locator('.planner-vehicle-choice').filter({ hasText: 'Tempo Traveller' })
        assert.equal(await traveller.getByRole('radio').isChecked(), true)
        await planner.getByRole('button', { name: 'Next: activities' }).click()
        await planner.getByRole('button', { name: 'Next: hotels' }).click()
        await planner.getByRole('button', { name: 'Stay in Gulmarg', exact: true }).click()
        const hotelCard = planner.locator('.planner-hotel-card').filter({ hasText: hotel.name })
        await hotelCard.locator('.planner-hotel-tile').click()
        for (const width of [320, 390, 1440]) {
          await page.setViewportSize({ width, height: 900 })
          await assertRoomCounterAlignment(hotelCard)
        }
        await page.setViewportSize({ width: 390, height: 844 })
        assert.equal(await hotelCard.getByLabel('Number of rooms', { exact: true }).inputValue(), '2')
        await hotelCard.getByLabel('Room type', { exact: true }).selectOption('Standard')
        assert.equal(await hotelCard.getByLabel('Number of rooms', { exact: true }).inputValue(), '4')
        await hotelCard.getByLabel('Room type', { exact: true }).selectOption('Family')
        assert.equal(await hotelCard.getByLabel('Number of rooms', { exact: true }).inputValue(), '2')
        await hotelCard.getByLabel('Breakfast', { exact: false }).check()
        await hotelCard.getByLabel('Dinner', { exact: false }).check()
        assert.ok((await planner.locator('.planner-trip-estimate').innerText()).includes('Selected stays: ₹8,000'))
        await hotelCard.getByLabel('Number of rooms', { exact: true }).fill('1')
        assert.equal(await planner.getByRole('button', { name: 'Continue with this plan' }).isDisabled(), true)
        assert.ok((await planner.getByRole('alert').innerText()).includes('enough capacity'))
        await hotelCard.getByLabel('Number of rooms', { exact: true }).fill('2')
        await hotelCard.getByRole('button', { name: 'Increase Number of rooms', exact: true }).click()
        assert.ok((await planner.locator('.planner-trip-estimate').innerText()).includes('Selected stays: ₹12,000'))
        await hotelCard.getByRole('link', { name: 'View hotel' }).click()
        await page.getByRole('button', { name: 'Back to your trip' }).click()
        assert.equal(await hotelCard.getByLabel('Number of rooms', { exact: true }).inputValue(), '3')
        await planner.getByRole('button', { name: 'Continue with this plan' }).click()
        assert.equal(await page.getByRole('dialog').count(), 0)
        assert.equal(await form.locator('input:not([name="website"]):not([type="hidden"])').count(), 2)
        await planner.getByRole('button', { name: 'Back to hotels' }).click()
        assert.equal(await hotelCard.getByLabel('Number of rooms', { exact: true }).inputValue(), '3')
        await planner.getByRole('button', { name: 'Continue with this plan' }).click()
        await form.getByLabel('Name', { exact: true }).fill('Inline Planner Guest')
        await form.getByLabel('Phone number').fill('9876543210')
        fail = true
        await form.getByRole('button', { name: 'Submit enquiry' }).click()
        await form.getByRole('alert').waitFor()
        assert.equal(await planner.getByRole('heading', { name: 'Thank you for submitting your details.' }).count(), 0)
        fail = false
        await form.getByRole('button', { name: 'Submit enquiry' }).click()
        await planner.getByRole('heading', { name: 'Thank you for submitting your details.' }).waitFor()
        assert.equal(submissions[1].reference, submissions[2].reference)
        assert.equal(submissions[2].fields.adults, '6')
        assert.equal(submissions[2].fields.children, '2')
        assert.ok(submissions[2].fields.placesToVisit.includes('rooms: 3; all rooms per night: ₹12,000'))
        await dismissSubmission(page)
        assert.equal(await page.getByRole('dialog').count(), 0)
        await page.goto(`${origin}/`)
        await planner.getByLabel('Start date').fill('2026-11-20')
        await planner.getByLabel('End date').fill('2026-11-24')
        await planner.getByLabel('Adults', { exact: true }).fill('27')
        await planner.getByRole('button', { name: 'Next: places' }).click()
        await planner.getByRole('button', { name: 'Next: vehicle' }).click()
        assert.ok((await planner.innerText()).includes('No single listed vehicle fits your group'))
        await planner.getByRole('button', { name: 'Next: activities' }).click()
        assert.equal(await planner.locator('.day-plans').count(), 0)
        await planner.getByRole('button', { name: 'Back', exact: true }).click()
        await planner.getByRole('button', { name: 'Back', exact: true }).click()
        await planner.getByLabel('Adults', { exact: true }).fill('0')
        await planner.getByRole('button', { name: 'Next: places' }).click()
        assert.equal(await planner.locator('.planner-vehicle-picker').count(), 0)
        await planner.getByLabel('Adults', { exact: true }).fill('6')
        await planner.getByLabel('Children (5 years+)', { exact: true }).fill('2')
        await planner.getByRole('button', { name: 'Next: places' }).click()
        await planner.getByRole('button', { name: 'Next: vehicle' }).click()
        await planner.getByRole('button', { name: 'Next: activities' }).click()
        await planner.getByRole('button', { name: 'Next: hotels' }).click()
        await planner.getByRole('button', { name: 'Stay in Gulmarg', exact: true }).click()
        await hotelCard.locator('.planner-hotel-tile').click()
        await hotelCard.getByLabel('Number of rooms', { exact: true }).fill('4')
        await planner.getByRole('button', { name: 'Back', exact: true }).click()
        await planner.getByRole('button', { name: 'Back', exact: true }).click()
        await planner.getByRole('button', { name: 'Back', exact: true }).click()
        await planner.getByRole('button', { name: 'Back', exact: true }).click()
        await planner.getByLabel('Children (5 years+)', { exact: true }).fill('3')
        await planner.getByRole('button', { name: 'Next: places' }).click()
        await planner.getByRole('button', { name: 'Next: vehicle' }).click()
        await planner.getByRole('button', { name: 'Next: activities' }).click()
        await planner.getByRole('button', { name: 'Next: hotels' }).click()
        assert.equal(await hotelCard.getByLabel('Number of rooms', { exact: true }).inputValue(), '3')
        await hotelCard.getByLabel('Room type', { exact: true }).selectOption('Standard')
        assert.equal(await hotelCard.getByLabel('Number of rooms', { exact: true }).inputValue(), '5')
      } finally { await page.close() }
    })
    await context.test('registration preserves higher resolution for five photos and confirms only successful persistence', async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
      let saved
      let originalJpegSize
      let fail = true
      let releaseSave
      let markSavePending
      const savePending = new Promise((resolve) => { markSavePending = resolve })
      await page.route('**/api/hotels*', async (route) => {
        if (route.request().method() !== 'POST') return route.fulfill({ json: list([]) })
        const form = await new Response(route.request().postDataBuffer(), { headers: { 'Content-Type': route.request().headers()['content-type'] } }).formData()
        saved = JSON.parse(form.get('details'))
        const photos = form.getAll('photos')
        assert.equal(photos.length, 5)
        for (const photo of photos) {
          assert.equal(photo.type, 'image/jpeg')
          assert.ok(photo.size <= hotelPhotoLimit)
          assert.ok(photo.size < originalJpegSize, 'Uploads should be smaller than the previous 0.92-quality JPEG')
          const bytes = new Uint8Array(await photo.arrayBuffer())
          assert.equal(validHotelJpeg(bytes), true)
          const buffer = Buffer.from(bytes)
          const frame = buffer.indexOf(Buffer.from([0xff, 0xc0]))
          assert.ok(frame > 0)
          assert.equal(buffer.readUInt16BE(frame + 5), 1344)
          assert.equal(buffer.readUInt16BE(frame + 7), 1920)
        }
        if (!fail) await new Promise((resolve) => { releaseSave = resolve; markSavePending() })
        return route.fulfill({ status: fail ? 503 : 201, json: fail ? { error: 'Photo storage is unavailable.' } : { saved: true, id: saved.id, hotelId, status: 'pending', accessCode } })
      })
      try {
        await page.goto(`${origin}/register-hotel`)
        const pricingSection = page.getByRole('region', { name: 'Rooms & rates', exact: true })
        assert.ok((await pricingSection.innerText()).includes('local Kashmiri brand'))
        const partnership = pricingSection.locator('.hotel-partnership-note')
        assert.ok((await partnership.innerText()).includes('Born in Kashmir, built for Kashmir'))
        assert.equal(await partnership.locator('li').count(), 3)
        assert.equal(await partnership.locator('li svg').count(), 3)
        assert.equal((await partnership.innerText()).includes('Room rates are adjusted'), false)
        assert.equal((await pricingSection.innerText()).includes('9%'), false)
        assert.equal((await pricingSection.innerText()).includes('commission'), false)
        assert.equal(await page.locator('.photo-upload-heading svg').count(), 1)
        await fillRegistration(page)
        assert.equal(await page.locator('.location-picker').count(), 0)
        const photo = await makePhoto(page)
        originalJpegSize = await page.evaluate(async (base64) => {
          const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
          const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
          try {
            const canvas = document.createElement('canvas')
            canvas.width = 1920; canvas.height = 1344
            canvas.getContext('2d').drawImage(bitmap, 0, 0, 1920, 1344)
            return (await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))).size
          } finally { bitmap.close() }
        }, photo.buffer.toString('base64'))
        await page.evaluate(() => {
          const original = globalThis.createImageBitmap
          const metrics = { active: 0, maximum: 0, names: [] }
          globalThis.photoProcessingMetrics = metrics
          globalThis.createImageBitmap = async (...args) => {
            metrics.names.push(args[0].name)
            metrics.maximum = Math.max(metrics.maximum, ++metrics.active)
            try {
              await new Promise((resolve) => setTimeout(resolve, 10))
              const bitmap = await original(...args)
              const close = bitmap.close.bind(bitmap)
              bitmap.close = () => { metrics.active--; close() }
              return bitmap
            } catch (error) { metrics.active--; throw error }
          }
        })
        await page.getByLabel('Hotel photos (1-5 required)').setInputFiles([
          ...Array.from({ length: 5 }, (_, index) => ({ ...photo, name: `hotel-${index}.png` })),
          { name: 'ignored.txt', mimeType: 'text/plain', buffer: Buffer.from('Not a photo; only the first five files should be processed.') },
        ])
        await page.locator('.hotel-photo-grid img').nth(4).waitFor()
        assert.equal(await page.locator('.hotel-photo-grid img').count(), 5)
        const metrics = await page.evaluate(() => globalThis.photoProcessingMetrics)
        assert.deepEqual(metrics.names, Array.from({ length: 5 }, (_, index) => `hotel-${index}.png`))
        assert.equal(metrics.maximum, 2)
        assert.equal(metrics.active, 0)
        await page.getByRole('status').filter({ hasText: 'Only the first 5 will be uploaded.' }).waitFor()
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
        for (const roomType of ['Standard', 'Deluxe', 'Family', 'Suite']) await page.getByLabel(`${roomType} rooms`, { exact: true }).fill('0')
        await page.getByRole('button', { name: 'Submit hotel for approval' }).click()
        await page.getByRole('alert').filter({ hasText: 'Offer at least one room across the room types.' }).waitFor()
        assert.equal(saved, undefined)
        for (const [roomType, count] of [['Standard', 2], ['Deluxe', 3], ['Family', 4], ['Suite', 3]]) await page.getByLabel(`${roomType} rooms`, { exact: true }).fill(String(count))
        await page.getByRole('button', { name: 'Submit hotel for approval' }).click()
        await page.getByRole('alert').filter({ hasText: 'Photo storage is unavailable.' }).waitFor()
        assert.equal(await page.getByRole('heading', { name: 'Your hotel registration has been saved.' }).count(), 0)
        assert.equal(await page.getByRole('dialog').count(), 0)
        const originalId = saved.id
        assert.equal(saved.exactLocation, 'Tangmarg')
        fail = false
        await page.getByRole('button', { name: 'Submit hotel for approval' }).click()
        const progress = page.getByRole('dialog', { name: 'Saving your hotel registration' })
        await progress.waitFor()
        assert.equal(await progress.locator('.registration-spinner').isVisible(), true)
        const assertCentered = async (dialog) => {
          const box = await dialog.boundingBox()
          const viewport = page.viewportSize()
          assert.ok(Math.abs(box.x + box.width / 2 - viewport.width / 2) < 2)
          assert.ok(Math.abs(box.y + box.height / 2 - viewport.height / 2) < 2)
          assert.ok(box.y >= 0 && box.y + box.height <= viewport.height)
        }
        await assertCentered(progress)
        await page.keyboard.press('Escape')
        assert.equal(await progress.isVisible(), true)
        assert.equal(await page.getByRole('dialog', { name: 'Hotel registration saved' }).count(), 0)
        await savePending
        releaseSave()
        const success = page.getByRole('dialog', { name: 'Hotel registration saved' })
        await success.waitFor()
        await assertCentered(success)
        assert.equal(await progress.count(), 0)
        assert.ok((await success.innerText()).includes(hotelId))
        assert.ok((await success.innerText()).includes(accessCode))
        assert.ok((await success.innerText()).includes('not a confirmed listing or booking'))
        assert.equal(await success.getByRole('button', { name: 'View registration details' }).evaluate((element) => element === document.activeElement), true)
        await page.keyboard.press('Escape')
        await success.waitFor({ state: 'hidden' })
        await page.getByRole('heading', { name: 'Your hotel registration has been saved.' }).waitFor()
        await page.waitForFunction(() => document.activeElement?.classList.contains('review-ready'))
        assert.equal(await page.locator('.review-ready').evaluate((element) => element === document.activeElement), true)
        assert.equal(saved.id, originalId)
        assert.equal(saved.phone, hotel.phone)
        assert.equal(saved.latitude, null)
        assert.equal(saved.longitude, null)
        assert.equal(saved.category, 'Premium')
        assert.equal(saved.heating, 'Centralised heating')
        assert.equal(saved.hotColdAc, true)
        assert.equal(saved.taxDetails, undefined)
        assert.equal(saved.mealPlan, 'Room only')
        assert.equal(saved.breakfastPrice, 550)
        assert.equal(saved.dinnerPrice, 450)
        assert.equal(saved.totalRooms, hotel.totalRooms)
        assert.deepEqual(saved.roomTypes, hotel.roomTypes)
        assert.equal(saved.price, 5000)
        assert.deepEqual(saved.roomRates, [
          { roomType: 'Standard', count: 2, price: 5000 }, { roomType: 'Deluxe', count: 3, price: 6000 },
          { roomType: 'Family', count: 4, price: 8000 }, { roomType: 'Suite', count: 3, price: 9000 },
        ])
        assert.equal(saved.description, 'Premium accommodation in Gulmarg.')
        assert.deepEqual(saved.highlights, hotel.highlights)
        assert.ok((await page.locator('.hotel-receipt').innerText()).includes(accessCode))
        assert.ok((await page.locator('.review-ready').innerText()).includes('Awaiting approval'))
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      } finally { await page.close() }
    })
    await context.test('invalid or empty photo selections prevent submission and can be replaced', async () => {
      const page = await browser.newPage()
      try {
        await page.goto(`${origin}/register-hotel`)
        const photo = await makePhoto(page)
        await page.getByLabel('Hotel photos (1-5 required)').setInputFiles({ name: 'not-a-photo.txt', mimeType: 'text/plain', buffer: Buffer.from('Invalid photo') })
        await page.getByRole('alert').filter({ hasText: 'Use JPEG, PNG or WebP' }).waitFor()
        assert.equal(await page.getByRole('button', { name: 'Submit hotel for approval' }).isEnabled(), false)
        await page.getByLabel('Hotel photos (1-5 required)').setInputFiles(photo)
        await page.locator('.hotel-photo-grid img').waitFor()
        assert.equal(await page.getByRole('button', { name: 'Submit hotel for approval' }).isEnabled(), true)
        await page.getByLabel('Hotel photos (1-5 required)').setInputFiles([])
        await page.getByRole('alert').filter({ hasText: 'Select at least one photo.' }).waitFor()
        assert.equal(await page.locator('.hotel-photo-grid img').count(), 0)
        assert.equal(await page.getByRole('button', { name: 'Submit hotel for approval' }).isEnabled(), false)
      } finally { await page.close() }
    })
    await context.test('status lookup sends the code in the body and excludes private hotel details', async () => {
      const page = await browser.newPage()
      let requested
      await page.route('**/api/hotel-status', (route) => {
        requested = route.request()
        const { photos, contactName, phone, submittedPrice, version, ownerNote, createdAt, updatedAt, ...statusHotel } = hotel
        void photos; void contactName; void phone; void submittedPrice; void version; void ownerNote; void createdAt; void updatedAt
        return route.fulfill({ json: { hotel: { ...statusHotel, status: 'rejected', contactName, phone, version } } })
      })
      try {
        await page.goto(`${origin}/hotel-status`)
        await page.getByLabel('Hotel ID or phone number').fill(hotel.phone)
        await page.getByLabel('Status access code').fill(accessCode)
        await page.getByRole('button', { name: 'Check status' }).click()
        await page.getByRole('region', { name: 'Hotel submission status' }).waitFor()
        assert.deepEqual(requested.postDataJSON(), { identifier: hotel.phone, accessCode })
        assert.equal(requested.url().includes(accessCode), false)
        assert.equal(page.url().includes(accessCode), false)
        assert.equal((await page.locator('.hotel-owner-status').innerText()).includes(hotel.phone), false)
        assert.equal((await page.locator('.hotel-owner-status').innerText()).includes(hotel.contactName), false)
      } finally { await page.close() }
    })
    await context.test('hotel partners edit privately, retain photos by default and confirm only persisted changes', async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
      const current = {
        ...publicHotel(), contactName: hotel.contactName, phone: hotel.phone, version: 3, status: 'approved',
        exactLocation: 'Near the gondola',
        breakfastPrice: 500, dinnerPrice: 700, mealPlan: 'Room only',
        roomRates: [{ roomType: 'Standard', count: 12, price: hotel.price }],
        roomTypes: ['Standard (12 rooms)'],
      }
      delete current.photos
      let saved, auth, replacementCount, retainedPhotos, fail = true
      const previews = await mockPartnerPhotos(page)
      await page.route('**/api/hotel-status', (route) => route.fulfill({ json: { hotel: current } }))
      await page.route('**/api/hotel-update', async (route) => {
        const form = await new Response(route.request().postDataBuffer(), { headers: { 'Content-Type': route.request().headers()['content-type'] } }).formData()
        saved = JSON.parse(form.get('details'))
        auth = JSON.parse(form.get('auth'))
        replacementCount = form.getAll('photos').length
        retainedPhotos = JSON.parse(form.get('retainedPhotos'))
        if (fail) return route.fulfill({ status: 409, json: { error: 'This hotel changed. Check your status again before editing.' } })
        return route.fulfill({ json: { saved: true, id, hotelId, accessCode: 'NEWH3210', status: 'pending' } })
      })
      try {
        await page.goto(`${origin}/hotel-status`)
        await page.getByLabel('Hotel ID or phone number').fill(hotelId)
        await page.getByLabel('Status access code').fill(accessCode)
        await page.getByRole('button', { name: 'Check status', exact: true }).click()
        await page.getByRole('button', { name: 'Edit hotel details' }).click()
        await page.getByAltText('Existing hotel photo 3').waitFor()
        assert.ok(previews.length > 0)
        for (const preview of previews) assert.deepEqual(preview, { kind: 'hotel', id, accessCode, version: 3 })
        await page.getByRole('button', { name: 'Remove existing photo 2', exact: true }).click()
        await page.getByLabel('Add hotel photos', { exact: true }).setInputFiles(await makePhoto(page))
        await page.getByRole('status').filter({ hasText: '3 of 5 photos selected.' }).waitFor()
        await page.getByRole('button', { name: 'Remove new photo 1', exact: true }).click()
        assert.equal(await page.getByRole('combobox', { name: 'Exact area', exact: true }).inputValue(), 'custom')
        assert.equal(await page.getByRole('textbox', { name: 'Specify exact location', exact: true }).inputValue(), 'Near the gondola')
        assert.equal(await page.getByLabel('Hotel name', { exact: true }).inputValue(), hotel.name)
        assert.equal(await page.getByLabel("Contact person's name (private)", { exact: true }).inputValue(), hotel.contactName)
        assert.equal(await page.getByLabel('Standard rooms', { exact: true }).inputValue(), '12')
        assert.equal(await page.getByLabel('Suite rooms', { exact: true }).inputValue(), '0')
        assert.equal(await page.getByLabel('Standard rate (INR)', { exact: true }).inputValue(), '4500')
        assert.equal(await page.getByLabel('Hot & cold AC', { exact: true }).inputValue(), 'no')
        await page.getByLabel('Hot & cold AC', { exact: true }).selectOption('yes')
        await page.getByLabel('Hotel name', { exact: true }).fill('New Hotel Name')
        await page.getByLabel('Standard rate (INR)', { exact: true }).fill('4800')
        await page.locator('[name="publicationConsent"]').check()
        await page.getByRole('button', { name: 'Save changes for approval' }).click()
        await page.getByRole('alert').filter({ hasText: 'This hotel changed' }).waitFor()
        assert.equal(await page.getByRole('dialog').count(), 0)
        assert.equal(await page.getByLabel('Hotel name', { exact: true }).inputValue(), 'New Hotel Name')
        assert.deepEqual(retainedPhotos, [0, 2])
        assert.equal(await page.getByAltText('Existing hotel photo 1').count(), 1)
        assert.equal(await page.getByAltText('Existing hotel photo 2').count(), 0)
        fail = false
        await page.getByRole('button', { name: 'Save changes for approval' }).click()
        await page.getByRole('dialog', { name: 'Hotel registration saved' }).waitFor()
        assert.equal(saved.id, id)
        assert.equal(saved.price, 4800)
        assert.equal(saved.name, 'New Hotel Name')
        assert.equal(saved.latitude, hotel.latitude)
        assert.equal(saved.longitude, hotel.longitude)
        assert.deepEqual(auth, { version: 3, accessCode })
        assert.equal(replacementCount, 0)
        assert.equal(page.url().includes(accessCode), false)
        await page.getByRole('button', { name: 'View registration details' }).click()
        assert.ok((await page.locator('.review-ready').innerText()).includes('hidden publicly until AVELOF approves'))
        assert.ok((await page.locator('.review-ready').innerText()).includes('NEWH3210'))
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      } finally { await page.close() }
    })
    await context.test('private photo loading errors require retry and cancel never submits removals', async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
      const current = { ...publicHotel(), contactName: hotel.contactName, phone: hotel.phone, status: 'pending', version: 0 }
      delete current.photos
      await mockPartnerPhotos(page, 5)
      let failed = true, updates = 0
      await page.route('**/api/partner-photos', (route) => failed
        ? route.fulfill({ status: 503, json: { error: 'Could not load your existing photos.' } })
        : route.fallback())
      await page.route('**/api/hotel-status', (route) => route.fulfill({ json: { hotel: current } }))
      await page.route('**/api/hotel-update', (route) => { updates++; return route.fulfill({ status: 503, json: { error: 'Unexpected submission.' } }) })
      try {
        await page.goto(`${origin}/hotel-status`)
        await page.getByLabel('Hotel ID or phone number').fill(hotelId)
        await page.getByLabel('Status access code').fill(accessCode)
        await page.getByRole('button', { name: 'Check status', exact: true }).click()
        await page.getByRole('button', { name: 'Edit hotel details' }).click()
        await page.getByRole('alert').filter({ hasText: 'Could not load your existing photos.' }).waitFor()
        assert.equal(await page.getByRole('button', { name: 'Save changes for approval' }).isDisabled(), true)
        failed = false
        await page.getByRole('button', { name: 'Retry loading photos' }).click()
        await page.getByAltText('Existing hotel photo 5').waitFor()
        assert.equal(await page.getByLabel('Add hotel photos', { exact: true }).isDisabled(), true)
        await page.waitForFunction(() => [...document.querySelectorAll('.partner-photo-editor img')].every((image) => image.complete && image.naturalWidth > 0))
        await page.getByRole('button', { name: 'Remove existing photo 3', exact: true }).click()
        assert.equal(await page.getByLabel('Add hotel photos', { exact: true }).isDisabled(), false)
        await page.getByRole('button', { name: 'Cancel editing' }).click()
        assert.equal(updates, 0)
        await page.getByLabel('Hotel ID or phone number').fill(hotelId)
        await page.getByLabel('Status access code').fill(accessCode)
        await page.getByRole('button', { name: 'Check status', exact: true }).click()
        await page.getByRole('button', { name: 'Edit hotel details' }).click()
        await page.getByAltText('Existing hotel photo 3').waitFor()
        assert.equal(await page.locator('.partner-photo-editor img').count(), 5)
        for (const width of [320, 390, 1440]) {
          await page.setViewportSize({ width, height: 900 })
          assert.equal(await page.locator('.partner-photo-editor').evaluate((element) => element.scrollWidth > element.clientWidth), false)
        }
      } finally { await page.close() }
    })
    await context.test('legacy hotel edit preserves room labels and meal pricing without inventing room rates', async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
      const current = { ...publicHotel(), contactName: hotel.contactName, phone: hotel.phone, status: 'rejected', version: 0 }
      delete current.photos
      await mockPartnerPhotos(page, 1)
      await page.route('**/api/hotel-status', (route) => route.fulfill({ json: { hotel: current } }))
      try {
        await page.goto(`${origin}/hotel-status`)
        await page.getByLabel('Hotel ID or phone number').fill(hotelId)
        await page.getByLabel('Status access code').fill(accessCode)
        await page.getByRole('button', { name: 'Check status', exact: true }).click()
        await page.getByRole('button', { name: 'Edit hotel details' }).click()
        assert.equal(await page.getByLabel('Room types (one per line)').inputValue(), hotel.roomTypes.join('\n'))
        assert.equal(await page.getByRole('combobox', { name: /^Meal plan/ }).inputValue(), hotel.mealPlan)
        assert.equal(await page.getByLabel('Nightly rate (INR)', { exact: true }).inputValue(), '4500')
        assert.equal(await page.getByLabel('Breakfast add-on (INR)', { exact: true }).count(), 0)
        await page.getByRole('button', { name: 'Cancel editing' }).click()
        await page.getByRole('button', { name: 'Check status', exact: true }).waitFor()
      } finally { await page.close() }
    })
    await context.test('owner can review photos, edit the price and approve a hotel', async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
      let update, deletion
      let current = hotel
      await page.route('**/api/hotels*', (route) => {
        if (route.request().method() === 'DELETE') {
          deletion = route.request().postDataJSON()
          current = null
          return route.fulfill({ json: { deleted: true, id } })
        }
        if (route.request().method() === 'PATCH') {
          update = route.request().postDataJSON()
          current = { ...hotel, ...update, version: 1 }
          return route.fulfill({ json: { hotel: current } })
        }
        return route.fulfill({ json: list(current ? [current] : []) })
      })
      await page.route('**/api/push*', (route) => route.fulfill({ status: 503, json: { error: 'Push is not configured.' } }))
      try {
        await page.goto(`${origin}/admin/panel/hotels`)
        await page.getByRole('heading', { name: hotel.name }).waitFor()
        assert.equal(await page.locator('.hotel-photo-grid img').count(), 1)
        await page.getByLabel('Reviewed price (INR)', { exact: true }).fill('3900.25')
        await page.getByLabel('Hot & cold AC', { exact: true }).selectOption('yes')
        assert.equal(await page.getByLabel('Confirmed hotel GST (%)', { exact: false }).count(), 0)
        await page.getByLabel('Listing status').selectOption('approved')
        await page.getByLabel('Note to hotel owner').fill('Approved at the agreed rate.')
        await page.getByRole('button', { name: 'Save price and status' }).click()
        await page.getByRole('status').filter({ hasText: 'Hotel price and status saved.' }).waitFor()
        assert.deepEqual(update, { id, version: 0, status: 'approved', price: 3900.25, ownerNote: 'Approved at the agreed rate.', hotColdAc: true })
        page.once('dialog', (dialog) => dialog.accept())
        await page.getByRole('button', { name: 'Delete hotel registration' }).click()
        await page.getByRole('status').filter({ hasText: 'Hotel registration permanently deleted.' }).waitFor()
        assert.deepEqual(deletion, { id, version: 1 })
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      } finally { await page.close() }
    })
    await context.test('approved hotels appear with highlights, real photos and the correct booking rate', async () => {
      const page = await browser.newPage()
      const photos = [0, 1, 2].map((index) => `/api/hotel-images/${id}/${index}`)
      await page.route('**/api/hotels*', (route) => route.fulfill({ json: list([{ ...publicHotel(), photos }]) }))
      try {
        await page.goto(`${origin}/hotels`)
        const card = page.locator('.catalog-card').filter({ hasText: hotel.name })
        await card.waitFor()
        assert.equal(new URL(await card.getByRole('link', { name: 'View on Google Maps' }).getAttribute('href')).searchParams.get('query'), `${hotel.latitude},${hotel.longitude}`)
        const cardPhotos = card.getByRole('region', { name: `${hotel.name} hotel photos` })
        assert.equal(await cardPhotos.getAttribute('data-photo-count'), '3')
        await page.waitForFunction(({ hotelIdValue, hotelName }) => document.querySelector(`[aria-label="${hotelName} hotel photos"] img`)?.getAttribute('src') === `/api/hotel-images/${hotelIdValue}/1`, { hotelIdValue: id, hotelName: hotel.name })
        assert.ok((await card.innerText()).includes('Mountain views'))
        assert.equal((await card.innerText()).includes('Hotel-provided photo'), false)
        assert.equal((await card.innerText()).includes(hotel.phone), false)
        assert.equal((await card.innerText()).includes('Before offer'), false)
        await card.getByRole('link', { name: hotel.name, exact: true }).click()
        await page.getByRole('heading', { name: hotel.name, exact: true }).waitFor()
        assert.equal(new URL(await page.getByRole('link', { name: 'View on Google Maps', exact: true }).getAttribute('href')).searchParams.get('query'), `${hotel.latitude},${hotel.longitude}`)
        assert.equal(await page.getByRole('region', { name: `${hotel.name} hotel photos` }).getAttribute('data-photo-count'), '3')
        assert.ok((await page.locator('.detail-aside').innerText()).includes('Breakfast included'))
        await page.locator('.detail-aside').getByRole('button', { name: 'Book Now' }).click()
        await page.locator('.selected-hotel-field').waitFor()
        assert.equal(await page.locator('[name="preferredStay"]').inputValue(), `${hotel.name} (${hotelId})`)
        assert.ok((await page.locator('.enquiry-form .hotel-rates').innerText()).includes('4,500'))
        assert.ok(!/GST|tax/i.test(await page.locator('.enquiry-form .hotel-rates').innerText()))
      } finally { await page.close() }
    })
  } finally { await browser.close() }
})
