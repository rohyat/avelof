import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { hotelSubmissionSchema } from '../src/services/hotelSchema.ts'
import { hotelIdPattern, hotelLookupIdPattern } from '../src/data/hotelRegistration.ts'

const origin = process.env.AVELOF_HOTEL_TEST_URL || 'http://localhost:8792'
const pricing = { discountPercent: 23, version: 1 }
const base = {
  id: '00000000-0000-4000-8000-000000000011', contactName: 'Boat Owner', phone: '9876543210', publicationConsent: true,
  name: 'Lotus Houseboat', propertyType: 'Houseboat', region: 'Kashmir', location: 'Srinagar', exactLocation: 'Dal Lake', category: 'Premium Houseboat',
  description: 'Premium Houseboat on Dal Lake in Srinagar.', price: 4000, roomRates: [{ roomType: 'Deluxe', count: 3, price: 4000 }],
  mealPlan: 'Room only', breakfastPrice: 500, dinnerPrice: 500, heating: 'Room heaters', hotColdAc: false,
  amenities: ['Wi-Fi', 'Shikara pick-up & drop'], highlights: ['Lake views'], roomTypes: ['Deluxe (3 rooms)'],
  checkIn: '13:00', checkOut: '11:00', totalRooms: 3,
}
const photo = (id) => [`/api/hotel-images/${id}/0`]
const publicStay = (overrides) => {
  const { contactName, phone, publicationConsent, ...details } = { ...base, ...overrides }
  void contactName; void phone; void publicationConsent
  return { ...details, photos: photo(details.id), averageRating: null, reviewCount: 0 }
}

test('houseboat schema rules', () => {
  assert.equal(hotelSubmissionSchema.safeParse(base).success, true)
  assert.equal(hotelSubmissionSchema.safeParse({ ...base, extraBedPrice: 800 }).success, true)
  assert.equal(hotelSubmissionSchema.safeParse({ ...base, extraBedPrice: -100 }).success, false)
  assert.equal(hotelSubmissionSchema.safeParse({ ...base, location: 'Gulmarg', exactLocation: 'Dal Lake' }).success, false)
  assert.equal(hotelSubmissionSchema.safeParse({ ...base, exactLocation: 'Near Airport' }).success, false)
  assert.equal(hotelSubmissionSchema.safeParse({ ...base, category: 'Premium' }).success, false)
  assert.equal(hotelSubmissionSchema.safeParse({ ...base, propertyType: undefined }).success, false)
  const { propertyType, ...legacyHotel } = { ...base, category: 'Premium', exactLocation: 'Near Dal Lake' }
  void propertyType
  assert.equal(hotelSubmissionSchema.safeParse(legacyHotel).success, true)
  assert.ok(hotelIdPattern.test('AVELOF_HB_10001SXR'))
  assert.ok(hotelLookupIdPattern.test('AVELOF_HB_10001SXR'))
  assert.ok(hotelIdPattern.test('AVELOF_HTL_10001SXR'))
})

test('houseboat registration and stays filter', async (context) => {
  const browser = await chromium.launch({ channel: 'msedge' })
  try {
    await context.test('registration form switches to houseboat fields', async () => {
      const page = await browser.newPage()
      await page.route('**/api/pricing*', (route) => route.fulfill({ json: pricing }))
      try {
        await page.goto(`${origin}/register-hotel`)
        await page.getByLabel('Houseboat', { exact: true }).check()
        assert.equal(await page.getByRole('combobox', { name: 'Location', exact: true }).inputValue(), 'Srinagar')
        assert.equal(await page.getByRole('combobox', { name: 'Location', exact: true }).isDisabled(), true)
        const areas = page.getByRole('combobox', { name: 'Lake or river', exact: true })
        assert.deepEqual(await areas.locator('option:not([disabled])').allTextContents(), ['Dal Lake', 'Nigeen Lake', 'Jhelum River'])
        assert.deepEqual(await page.getByLabel('Houseboat category').locator('option:not([disabled])').allTextContents(), ['Standard Houseboat', 'Deluxe Houseboat', 'Premium Houseboat', 'Luxury Houseboat'])
        assert.equal(await page.getByLabel('Shikara pick-up & drop', { exact: true }).count(), 1)
        assert.equal(await page.getByLabel('Lift', { exact: true }).count(), 0)
        await page.getByLabel('Deluxe bedrooms', { exact: true }).waitFor()
        assert.equal(await page.getByLabel('Standard bedrooms', { exact: true }).count(), 0)
        assert.equal(await page.locator('.registration-room-rate').count(), 4)
        for (const roomType of ['Deluxe', 'Premium', 'Family', 'Suite']) {
          assert.equal(await page.getByLabel(`${roomType} bedrooms`, { exact: true }).inputValue(), '0')
          assert.equal(await page.getByLabel(`${roomType} rate (INR)`, { exact: true }).inputValue(), '0')
        }
        for (const label of ['Breakfast add-on (INR)', 'Dinner add-on (INR)', 'Extra bed charge (INR)']) {
          assert.equal(await page.getByLabel(label, { exact: true }).inputValue(), '0')
        }
        assert.match(await page.locator('.hotel-room-types').innerText(), /B2B travel-agent rates, not guest-facing prices/)
        await page.getByRole('button', { name: 'Submit houseboat for approval' }).waitFor()
        await page.getByLabel('Hotel', { exact: true }).check()
        assert.equal(await page.getByRole('combobox', { name: 'Location', exact: true }).inputValue(), '')
        assert.equal(await page.getByLabel('Shikara pick-up & drop', { exact: true }).count(), 0)
        await page.getByLabel('AVELOF category').waitFor()
      } finally { await page.close() }
    })
    await context.test('stays page filters hotels and houseboats', async () => {
      const page = await browser.newPage()
      const boat = publicStay({ hotelId: 'AVELOF_HB_10001SXR' })
      const hotel = publicStay({ id: '00000000-0000-4000-8000-000000000012', hotelId: 'AVELOF_HTL_10002SXR', name: 'Valley Hotel', propertyType: undefined, category: 'Premium', exactLocation: 'Near Dal Lake' })
      await page.route('**/api/pricing*', (route) => route.fulfill({ json: pricing }))
      await page.route('**/api/hotels*', (route) => route.fulfill({ json: { hotels: [boat, hotel], total: 2, page: 1, pageSize: 25 } }))
      try {
        await page.goto(`${origin}/hotels`)
        const cards = page.locator('.catalog-card')
        await cards.nth(1).waitFor()
        assert.equal(await cards.filter({ hasText: 'Lotus Houseboat' }).locator('.stay-type-tag').innerText(), 'HOUSEBOAT')
        await page.getByRole('button', { name: 'Houseboats', exact: true }).click()
        await page.waitForURL(/type=Houseboat/)
        await cards.nth(1).waitFor({ state: 'detached' })
        assert.equal(await cards.count(), 1)
        assert.ok((await cards.first().innerText()).includes('Lotus Houseboat'))
        await page.getByRole('button', { name: 'Hotels', exact: true }).click()
        await cards.filter({ hasText: 'Valley Hotel' }).waitFor()
        assert.equal(await cards.count(), 1)
        assert.ok((await cards.first().innerText()).includes('Valley Hotel'))
        await page.getByRole('button', { name: 'All stays', exact: true }).click()
        await cards.nth(1).waitFor()
        assert.equal(await cards.count(), 2)
      } finally { await page.close() }
    })
    await context.test('extra bed checkbox appears only when offered and adds its charge', async () => {
      const page = await browser.newPage()
      const boat = publicStay({ hotelId: 'AVELOF_HB_10001SXR', extraBedPrice: 800 })
      const hotel = publicStay({ id: '00000000-0000-4000-8000-000000000012', hotelId: 'AVELOF_HTL_10002SXR', name: 'Valley Hotel', propertyType: undefined, category: 'Premium', exactLocation: 'Near Dal Lake' })
      await page.route('**/api/pricing*', (route) => route.fulfill({ json: pricing }))
      await page.route('**/api/hotels*', (route) => route.fulfill({ json: { hotels: [boat, hotel], total: 2, page: 1, pageSize: 25 } }))
      try {
        await page.goto(`${origin}/hotels`)
        const boatCard = page.locator('.catalog-card').filter({ hasText: 'Lotus Houseboat' })
        await boatCard.waitFor()
        await page.locator('.catalog-card').filter({ hasText: 'Valley Hotel' }).getByRole('button', { name: 'Book Now' }).click()
        const dialog = page.getByRole('dialog')
        await dialog.getByText('Rooms total:').waitFor()
        assert.equal(await dialog.locator('.hotel-extra-bed').count(), 0)
        await page.keyboard.press('Escape')
        await dialog.waitFor({ state: 'detached' })
        await boatCard.getByRole('button', { name: 'Book Now' }).click()
        const selectedName = dialog.locator('.selected-hotel-field strong')
        await selectedName.waitFor()
        assert.equal(await selectedName.innerText(), 'Lotus Houseboat')
        const helpLinks = dialog.locator('.enquiry-help-links a')
        assert.deepEqual((await helpLinks.allTextContents()).map((text) => text.trim()), ['Need help?', 'Book a package', 'View other options'])
        assert.match(await helpLinks.first().getAttribute('href'), /^https:\/\/wa\.me\//)
        assert.equal(await helpLinks.nth(1).getAttribute('href'), '/tour-packages')
        assert.equal(await helpLinks.last().getAttribute('href'), '/hotels')
        assert.equal(await dialog.getByRole('heading', { name: 'Amenities', exact: true }).count(), 0)
        assert.equal(await dialog.getByRole('heading', { name: 'Highlights', exact: true }).count(), 0)
        assert.equal(await dialog.getByRole('combobox', { name: 'Room type', exact: true }).count(), 1)
        for (const width of [390, 1440]) {
          await page.setViewportSize({ width, height: 900 })
          for (const theme of ['light', 'dark']) {
            await page.evaluate((value) => { document.documentElement.dataset.theme = value }, theme)
            const contrast = await selectedName.evaluate((element) => {
              const style = getComputedStyle(element)
              const luminance = (color) => color.match(/\d+/g).slice(0, 3).map(Number)
                .map((channel) => channel / 255)
                .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
                .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0)
              const text = luminance(style.color)
              const background = luminance(style.backgroundColor)
              return (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05)
            })
            assert.ok(contrast >= 4.5, `Selected hotel name contrast ${contrast} in ${theme} at ${width}px`)
          }
        }
        const extraBed = dialog.locator('.hotel-extra-bed')
        assert.equal(await extraBed.locator('small').count(), 0)
        assert.equal(await dialog.locator('.hotel-season-note').count(), 0)
        assert.equal(await dialog.getByText(/By submitting, you agree/).count(), 0)
        assert.equal(await dialog.getByText(/Minimum \d+ for \d+ people/).count(), 0)
        assert.equal(await dialog.getByText('Availability on confirmation.', { exact: true }).count(), 1)
        assert.ok((await extraBed.innerText()).includes('₹800'))
        await dialog.getByText('Rooms total: ₹4,000 per night').waitFor()
        await extraBed.getByRole('checkbox').check()
        await dialog.getByText('Rooms total: ₹4,800 per night').waitFor()
        assert.ok((await extraBed.innerText()).includes('Extra bed requested in each room'))
        await dialog.getByLabel('Breakfast for 2 people per room', { exact: false }).check()
        await dialog.getByText('Rooms total: ₹5,550 per night', { exact: true }).waitFor()
        assert.match(await extraBed.getByRole('checkbox').locator('..').innerText(), /\+₹1,050/)
        assert.match(await extraBed.innerText(), /Includes breakfast for 1 extra person/)
        await dialog.getByLabel('Dinner for 2 people per room', { exact: false }).check()
        await dialog.getByText('Rooms total: ₹6,300 per night', { exact: true }).waitFor()
        assert.match(await extraBed.getByRole('checkbox').locator('..').innerText(), /\+₹1,300/)
        assert.match(await extraBed.innerText(), /Includes breakfast and dinner for 1 extra person/)
        await dialog.getByLabel('Check-in date', { exact: true }).fill('2026-12-05')
        await dialog.getByLabel('Check-out date', { exact: true }).fill('2026-12-07')
        await dialog.getByText(/Stay estimate: ₹13,000/).waitFor()
        assert.match(await dialog.locator('.hotel-price-breakdown').innerText(), /extra bed ₹1,300/)
        await extraBed.getByRole('checkbox').uncheck()
        await dialog.getByText('Rooms total: ₹5,000 per night', { exact: true }).waitFor()
      } finally { await page.close() }
    })
  } finally { await browser.close() }
})
