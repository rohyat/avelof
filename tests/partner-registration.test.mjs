import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'

const origin = process.env.AVELOF_HOTEL_TEST_URL || 'http://localhost:8792'
const id = '00000000-0000-4000-8000-000000000002'
const driverId = 'AVELOF-DRV-10001'
const accessCode = 'PUBL3210'
const driver = {
  id, driverId, fullName: 'Public Driver Name', maskedPhone: '987*****10', vehicleId: 'innova-crysta', age: 30,
  phone: '9876543210', licenceNumber: 'JK01 123456789', vehicleNumber: 'JK01AB-1234',
  vehicleName: 'Toyota Innova Crysta', location: 'Srinagar', seats: 6,
  status: 'pending', version: 0,
  ownerNote: '', createdAt: '2026-11-13T10:00:00Z', photo: `/api/driver-images/${id}/0`,
  averageRating: 4.5, reviewCount: 2,
}
const listing = (drivers) => ({ drivers, total: drivers.length, page: 1, pageSize: 25 })
const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q==', 'base64')
test('partner onboarding and approved listings work separately from customer navigation', async (context) => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    await context.test('without approved registrations hotels stay empty and the homepage and planner still work', async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.route('**/api/hotels*', (route) => route.fulfill({ json: { hotels: [], total: 0, page: 1, pageSize: 25 } }))
      try {
        await page.goto(`${origin}/hotels`)
        await page.getByRole('heading', { name: 'No approved hotels yet' }).waitFor()
        assert.equal(await page.locator('.catalog-card').count(), 0)
        assert.equal(await page.getByRole('link', { name: 'Register your hotel', exact: true }).getAttribute('href'), '/register-hotel')
        await page.goto(`${origin}/hotels/hotel-royal-imsar`)
        assert.equal(await page.locator('.hotel-rates').count(), 0)
        await page.goto(`${origin}/`)
        await page.getByRole('heading', { name: /Experience Kashmir/ }).waitFor()
        assert.equal(await page.locator('.offer-tile').filter({ hasText: 'Room only' }).count(), 0)
        const planner = page.locator('.trip-planner')
        await planner.getByLabel('Start date').fill('2027-01-10')
        await planner.getByLabel('End date').fill('2027-01-14')
        await planner.getByRole('button', { name: 'Next: vehicle' }).click()
        await planner.getByRole('button', { name: 'Next: hotels' }).click()
        await planner.locator('.planner-hotel-card').first().waitFor()
        assert.equal(await planner.locator('.hotel-rates').count(), 0)
        await planner.getByRole('button', { name: 'Continue with this plan' }).click()
        await page.locator('.enquiry-form').waitFor()
        assert.equal(await page.locator('[name="customDetails"]').count(), 0)
        assert.equal(await page.getByLabel('Number of people').count(), 0)
        assert.equal(await page.getByRole('dialog').count(), 0)
        assert.equal(await page.locator('.enquiry-form').getByRole('textbox').count(), 2)
        assert.deepEqual(errors, [])
      } finally { await page.close() }
    })
    await context.test('Srinagar day trips cannot depart from Gulmarg or Pahalgam while transfers remain available', async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
      await page.route('**/api/hotels*', (route) => route.fulfill({ json: { hotels: [], total: 0, page: 1, pageSize: 25 } }))
      try {
        const cases = ['Sonamarg', 'Doodhpathri', 'Yusmarg', 'Aharbal Waterfall and Peer Ki Gali', 'Manasbal Lake', 'Wular Lake', 'Dachigam National Park'].map((excursion) => ({ base: 'Pahalgam', excursion }))
        cases.push({ base: 'Gulmarg', excursion: 'Sonamarg' })
        for (const { base, excursion } of cases) {
          await page.goto(`${origin}/tour-packages`)
          const planner = page.locator('.trip-planner')
          await planner.getByLabel('Start date').fill('2027-01-10')
          await planner.getByLabel('End date').fill('2027-01-20')
          const place = (name) => planner.locator('.planner-place-card').filter({ has: page.getByText(name, { exact: true }) }).getByRole('checkbox')
          for (const name of ['Srinagar', 'Gulmarg', 'Pahalgam']) await place(name).uncheck()
          await place(base).check()
          await place(excursion).check()
          await planner.getByRole('button', { name: 'Next: vehicle' }).click()
          await planner.getByRole('button', { name: 'Next: hotels' }).click()
          assert.equal(await planner.getByRole('button', { name: `Stay in ${base}`, exact: true }).count(), 0)
          assert.ok((await planner.innerText()).includes(`tomorrow's ${excursion} day trip must start from Srinagar`))
          const excursionDay = planner.locator('.day-plan').filter({ has: page.locator('.planner-assigned-route').filter({ hasText: `Srinagar to ${excursion}` }) })
          assert.equal(await excursionDay.count(), 1)
          assert.equal((await planner.innerText()).includes(`${base} to Srinagar to ${excursion}`), false)
        }
        await page.goto(`${origin}/tour-packages`)
        const planner = page.locator('.trip-planner')
        await planner.getByLabel('Start date').fill('2027-01-10')
        await planner.getByLabel('End date').fill('2027-01-14')
        await planner.getByRole('button', { name: 'Next: vehicle' }).click()
        await planner.getByRole('button', { name: 'Next: hotels' }).click()
        await planner.getByRole('button', { name: 'Stay in Gulmarg', exact: true }).click()
        assert.ok((await planner.innerText()).includes('Gulmarg to Pahalgam'))
        await planner.getByRole('button', { name: 'Stay in Pahalgam', exact: true }).click()
        assert.ok((await planner.innerText()).includes('Pahalgam to Srinagar'))
      } finally { await page.close() }
    })
    await context.test('hotel and driver registration sections fit mobile and desktop screens', async () => {
      const page = await browser.newPage()
      try {
        for (const width of [320, 390, 640, 768, 1024, 1440]) {
          await page.setViewportSize({ width, height: 900 })
          for (const [path, heading, sections] of [['register-hotel', 'Register your hotel', 4], ['register-driver', 'Register as a driver', 3]]) {
            await page.goto(`${origin}/${path}`)
            await page.getByRole('heading', { name: heading, exact: true }).waitFor()
            assert.equal(await page.locator('.registration-section').count(), sections)
            assert.equal(await page.getByRole('complementary', { name: 'Registration guide' }).count(), 1)
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
            assert.equal(await page.locator('.registration-section input:not([type="checkbox"]):not([name="website"]), .registration-section select').evaluateAll((fields) =>
              fields.every((field) => {
                const bounds = field.getBoundingClientRect()
                const section = field.closest('.registration-section').getBoundingClientRect()
                return bounds.width > 0 && bounds.left >= section.left && bounds.right <= section.right
              })), true)
            assert.equal(await page.locator('form').evaluate((form) => getComputedStyle(form).display), 'block')
            const uploadLayout = await page.locator('.photo-upload-field').evaluate((field) => {
              const box = field.getBoundingClientRect()
              const children = [...field.children].map((child) => child.getBoundingClientRect())
              return {
                display: getComputedStyle(field).display,
                fits: children.every((child) => child.left >= box.left && child.right <= box.right + 1),
                separated: children.every((child, index) => !index || child.top >= children[index - 1].bottom),
                contains: children.every((child) => child.top >= box.top && child.bottom <= box.bottom),
              }
            })
            assert.equal(uploadLayout.display, 'grid')
            assert.ok(uploadLayout.fits && uploadLayout.separated && uploadLayout.contains, `${path} upload text and control must fit without overlapping at ${width}px`)
            const steppers = await page.locator('.number-stepper-field').evaluateAll((fields) =>
              fields.map((field) => {
                const label = field.getBoundingClientRect()
                const control = field.querySelector('.number-stepper').getBoundingClientRect()
                const container = field.closest('fieldset').getBoundingClientRect()
                const buttons = [...field.querySelectorAll('button')].map((button) => button.getBoundingClientRect())
                return {
                  width: control.width, height: control.height,
                  fits: control.left >= label.left && control.right <= label.right + 1 && label.left >= container.left && label.right <= container.right + 1,
                  fullWidth: Math.abs(control.width - label.width) < 1,
                  buttonsFit: buttons.every((button) => button.width >= 44 && button.height >= 44 && button.left >= control.left && button.right <= control.right),
                }
              }))
            assert.ok(steppers.every(({ fits, fullWidth, buttonsFit }) => fits && fullWidth && buttonsFit), `${path} controls must fit their labels at ${width}px`)
            assert.ok(steppers.every(({ height }) => Math.abs(height - steppers[0].height) < 1), `${path} controls must have equal heights at ${width}px`)
            if (path === 'register-hotel') {
              const rooms = steppers.slice(0, 10)
              assert.ok(rooms.every(({ width: roomWidth }) => Math.abs(roomWidth - rooms[0].width) < 1), `All five room controls must have equal widths at ${width}px`)
              const roomSpacing = await page.locator('.hotel-room-types .number-stepper-field').evaluateAll((fields) =>
                fields.map((field) => {
                  const label = field.querySelector('.number-stepper-label').getBoundingClientRect()
                  const control = field.querySelector('.number-stepper').getBoundingClientRect()
                  return { gap: control.top - label.bottom, leftAligned: Math.abs(control.left - label.left) < 1 }
                }))
              assert.equal(roomSpacing.length, 10)
              assert.ok(roomSpacing.every(({ gap, leftAligned }) => Math.abs(gap - 12) < 1 && leftAligned), `Every room label must sit 12px above its control at ${width}px`)
              assert.equal(await page.locator('.hotel-room-types').evaluate((field) => getComputedStyle(field).rowGap), '24px')
            }
          }
        }
      } finally { await page.close() }
    })
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
        assert.deepEqual(await page.getByRole('link', { name: 'Edit your details', exact: true }).evaluateAll((links) => links.map((link) => link.getAttribute('href'))), ['/hotel-status', '/driver-status'])
        assert.equal(await page.getByText('Already registered?', { exact: true }).count(), 0)
        assert.ok(await page.locator('.partner-edit-action .button-outline').evaluateAll((links) => links.every((link) => getComputedStyle(link).backgroundColor === 'rgb(255, 255, 255)')))
        for (const width of [320, 390, 1440]) {
          await page.setViewportSize({ width, height: 900 })
          assert.ok(await page.locator('.partner-options .partner-edit-action').evaluateAll((groups) => groups.every((group) => {
            const [edit, register] = [...group.querySelectorAll('.button')].map((button) => button.getBoundingClientRect())
            return Math.abs(edit.width - register.width) < 1 && Math.abs(edit.height - register.height) < 1 && Math.abs(edit.left - register.left) < 1
          })), `Edit and register buttons must match at ${width}px`)
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
        for (const kind of ['hotel', 'driver']) {
          await page.goto(`${origin}/register-${kind}`)
          const editLink = page.locator('.partner-registration-hero').getByRole('link', { name: 'Edit your details', exact: true })
          if (kind === 'hotel') {
            assert.equal(await editLink.count(), 0)
            await page.goto(`${origin}/partners`)
            await page.locator('a[href="/hotel-status"]').click()
            await page.getByRole('heading', { name: 'Edit your hotel details', exact: true }).waitFor()
            continue
          }
          assert.equal(await editLink.getAttribute('href'), `/${kind}-status`)
          await editLink.click()
          await page.getByRole('heading', { name: `Edit your ${kind} details`, exact: true }).waitFor()
          assert.equal(await page.getByRole('button', { name: 'Check status', exact: true }).count(), 1)
        }
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
        assert.equal(await page.locator('.photo-upload-heading svg').count(), 1)
        assert.equal(await page.getByLabel('Driver portrait (one photo required)').getAttribute('multiple'), null)
        assert.equal(await page.getByRole('button', { name: 'Decrease Age (minimum 18)' }).count(), 1)
        assert.equal(await page.getByRole('combobox', { name: 'District' }).locator('option').count(), 22)
        assert.equal(await page.getByRole('textbox', { name: 'Vehicle registration number' }).getAttribute('placeholder'), 'JK13B-1444 or JK01AB-1485')
        assert.equal(await page.getByLabel('Taxes').count(), 0)
        assert.equal(await page.getByLabel('Luggage capacity').count(), 0)
        assert.equal(await page.getByText('Trips offered (select at least one)').count(), 0)
        assert.equal(await page.getByLabel('Proposed daily rate (INR)').count(), 0)
        const vehicleNumber = page.getByRole('textbox', { name: 'Vehicle registration number' })
        await vehicleNumber.fill('JK01AB1234')
        await page.getByRole('alert').filter({ hasText: 'Use format JK13B-1444 or JK01AB-1485.' }).waitFor()
        assert.equal(await vehicleNumber.getAttribute('aria-invalid'), 'true')
        await vehicleNumber.fill('JK01AB-1485')
        assert.equal(await page.getByRole('alert').filter({ hasText: 'Use format JK13B-1444 or JK01AB-1485.' }).count(), 0)
        assert.equal(await vehicleNumber.getAttribute('aria-invalid'), 'false')
        const fields = {
          'Full legal name': driver.fullName,
          'Age (minimum 18)': '30', 'Phone number': driver.phone,
          'Driving licence number': driver.licenceNumber, 'Vehicle registration number': driver.vehicleNumber,
          'Passenger seats (excluding driver)': '6',
        }
        for (const [label, value] of Object.entries(fields)) await page.getByRole('textbox', { name: label }).fill(value)
        await page.getByRole('combobox', { name: 'Vehicle' }).selectOption('innova-crysta')
        await page.locator('[name="publicationConsent"]').check()
        await page.getByLabel('Driver portrait (one photo required)').setInputFiles({ name: 'portrait.jpg', mimeType: 'image/jpeg', buffer: jpeg })
        await page.locator('.hotel-photo-grid img').waitFor()
        await page.getByRole('button', { name: 'Submit driver for approval' }).click()
        await page.getByRole('alert').filter({ hasText: 'registration API is not connected to this preview' }).waitFor()
        assert.equal(await page.getByRole('heading', { name: 'Your driver registration has been saved.' }).count(), 0)
        assert.equal(await page.getByRole('dialog').count(), 0)
        const firstId = saved.id
        fail = false
        await page.getByRole('button', { name: 'Submit driver for approval' }).click()
        const success = page.getByRole('dialog', { name: 'Driver registration saved' })
        await success.waitFor()
        assert.ok((await success.innerText()).includes(driverId))
        assert.ok((await success.innerText()).includes(accessCode))
        assert.ok((await success.innerText()).includes('not a confirmed listing or booking'))
        await success.getByRole('button', { name: 'View registration details' }).click()
        await success.waitFor({ state: 'hidden' })
        await page.getByRole('heading', { name: 'Your driver registration has been saved.' }).waitFor()
        assert.equal(saved.id, firstId)
        assert.equal(saved.age, 30)
        assert.equal(saved.vehicleId, 'innova-crysta')
        assert.equal(saved.price, undefined)
        assert.ok((await page.locator('.hotel-receipt').innerText()).includes(accessCode))
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      } finally { await page.close() }
    })
    await context.test('owner can approve driver and private lookup uses POST body credentials', async () => {
      const page = await browser.newPage()
      let current = driver, update, lookup, deletion
      await page.route('**/api/drivers*', (route) => {
        const request = route.request()
        if (request.method() === 'DELETE') {
          deletion = request.postDataJSON()
          current = null
          return route.fulfill({ json: { deleted: true, id } })
        }
        if (request.method() === 'PATCH') {
          update = request.postDataJSON()
          current = { ...driver, ...update, version: 1 }
          return route.fulfill({ json: { driver: current } })
        }
        if (request.method() === 'POST') {
          lookup = request
          const { photo, version, age, phone, licenceNumber, ownerNote, createdAt, averageRating, reviewCount, ...owner } = current
          void photo; void version; void age; void phone; void licenceNumber; void ownerNote; void createdAt; void averageRating; void reviewCount
          return route.fulfill({ json: { driver: { ...owner, version, age, phone, licenceNumber } } })
        }
        return route.fulfill({ json: listing(current ? [current] : []) })
      })
      await page.route('**/api/push*', (route) => route.fulfill({ status: 503, json: { error: 'Push is not configured.' } }))
      try {
        await page.goto(`${origin}/admin/panel/drivers`)
        await page.getByRole('heading', { name: `${driver.fullName} · ${driver.vehicleName}` }).waitFor()
        assert.equal(await page.getByLabel('Daily rate (INR)', { exact: true }).count(), 0)
        await page.getByLabel('Driver listing status').selectOption('approved')
        await page.getByLabel('Note to driver').fill('Reviewed and approved.')
        await page.getByRole('button', { name: 'Save driver status' }).click()
        await page.getByRole('status').filter({ hasText: 'Driver vehicle registration and status saved.' }).waitFor()
        assert.deepEqual(update, { id, version: 0, status: 'approved', ownerNote: 'Reviewed and approved.', vehicleNumber: driver.vehicleNumber })
        await page.goto(`${origin}/driver-status`)
        await page.getByLabel('Driver ID or phone number').fill(driver.phone)
        await page.getByLabel('Status access code').fill(accessCode)
        await page.getByRole('button', { name: 'Check status' }).click()
        await page.locator('.hotel-owner-status').waitFor()
        assert.deepEqual(lookup.postDataJSON(), { identifier: driver.phone, accessCode })
        assert.equal(lookup.url().includes(accessCode), false)
        await page.goto(`${origin}/admin/panel/drivers`)
        page.once('dialog', (dialog) => dialog.accept())
        await page.getByRole('button', { name: 'Delete driver registration' }).click()
        await page.getByRole('status').filter({ hasText: 'Driver registration permanently deleted.' }).waitFor()
        assert.deepEqual(deletion, { id, version: 1 })
      } finally { await page.close() }
    })
    await context.test('drivers can privately edit details, keep or replace portraits and resubmit for approval', async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
      const { photo, ownerNote, createdAt, averageRating, reviewCount, ...editable } = driver
      void photo; void ownerNote; void createdAt; void averageRating; void reviewCount
      let saved, auth, photoCount, fail = true
      await page.route('**/api/drivers*', async (route) => {
        const request = route.request()
        if (request.headers()['content-type']?.startsWith('application/json')) return route.fulfill({ json: { driver: { ...editable, status: 'approved', version: 2 } } })
        const form = await new Response(request.postDataBuffer(), { headers: { 'Content-Type': request.headers()['content-type'] } }).formData()
        saved = JSON.parse(form.get('details'))
        auth = JSON.parse(form.get('auth'))
        photoCount = form.getAll('photos').length
        if (fail) return route.fulfill({ status: 503, json: { error: 'Driver update could not be confirmed. Retry with the same form.' } })
        return route.fulfill({ json: { saved: true, id, driverId, accessCode: 'NEWD3210', status: 'pending' } })
      })
      try {
        await page.goto(`${origin}/driver-status`)
        await page.getByLabel('Driver ID or phone number').fill(driverId)
        await page.getByLabel('Status access code').fill(accessCode)
        await page.getByRole('button', { name: 'Check status', exact: true }).click()
        await page.getByRole('button', { name: 'Edit registration' }).click()
        assert.equal(await page.getByLabel('Full legal name', { exact: true }).inputValue(), driver.fullName)
        assert.equal(await page.getByLabel('Age (minimum 18)', { exact: true }).inputValue(), '30')
        assert.equal(await page.getByLabel('Driving licence number', { exact: true }).inputValue(), driver.licenceNumber)
        assert.equal(await page.locator('input[type="file"]').count(), 0)
        await page.getByLabel('Full legal name', { exact: true }).fill('New Driver Name')
        await page.locator('[name="publicationConsent"]').check()
        await page.getByRole('button', { name: 'Save changes for approval' }).click()
        await page.getByRole('alert').filter({ hasText: 'Driver update could not be confirmed' }).waitFor()
        assert.equal(await page.getByRole('dialog').count(), 0)
        assert.equal(photoCount, 0)
        await page.getByLabel('Replace portrait', { exact: true }).check()
        await page.getByLabel('Driver portrait (one photo required)').setInputFiles({ name: 'portrait.jpg', mimeType: 'image/jpeg', buffer: jpeg })
        await page.locator('.hotel-photo-grid img').waitFor()
        fail = false
        await page.getByRole('button', { name: 'Save changes for approval' }).click()
        await page.getByRole('dialog', { name: 'Driver registration saved' }).waitFor()
        assert.equal(saved.fullName, 'New Driver Name')
        assert.equal(saved.price, undefined)
        assert.equal(saved.id, undefined)
        assert.deepEqual(auth, { identifier: driverId, accessCode, version: 2 })
        assert.equal(photoCount, 1)
        assert.equal(page.url().includes(accessCode), false)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
        await page.getByRole('button', { name: 'View registration details' }).click()
        assert.ok((await page.locator('.review-ready').innerText()).includes('Awaiting approval'))
        assert.ok((await page.locator('.review-ready').innerText()).includes('NEWD3210'))
        await page.getByRole('button', { name: 'Check driver status', exact: true }).click()
        await page.getByRole('button', { name: 'Check status', exact: true }).waitFor()
        assert.equal(await page.getByRole('button', { name: 'Edit registration' }).count(), 0)
      } finally { await page.close() }
    })
    await context.test('approved vehicle and optional hotel meals reach booking selectors without private driver data', async () => {
      const page = await browser.newPage()
      const { age, phone, licenceNumber, status, version, ownerNote, createdAt, ...publicDriverBase } = driver
      const publicDriver = { ...publicDriverBase, maskedLicenceNumber: 'JK0********89' }
      void age; void phone; void licenceNumber; void status; void version; void ownerNote; void createdAt
      const hotel = {
        id, hotelId: 'AVELOF_HTL_10001GLM', name: 'Meal Partner Hotel',
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
        assert.equal(await page.getByRole('link', { name: 'Register as a Driver', exact: true }).getAttribute('href'), '/register-driver')
        assert.equal(await directoryCard.getByLabel('AVELOF-approved driver').count(), 1)
        assert.ok((await directoryCard.innerText()).includes(driver.maskedPhone))
        assert.ok((await directoryCard.innerText()).includes(driverId))
        assert.ok((await directoryCard.innerText()).includes(`Vehicle registration: ${driver.vehicleNumber}`))
        assert.ok((await directoryCard.innerText()).includes('Driving licence: JK0********89'))
        assert.equal((await directoryCard.innerText()).includes(driver.licenceNumber), false)
        assert.ok((await directoryCard.getByRole('link', { name: 'View reviews' }).innerText()).includes('View reviews'))
        assert.ok((await directoryCard.innerText()).includes('4.5 · 2 reviews'))
        assert.equal(await directoryCard.locator('.driver-directory-price').count(), 0)
        assert.equal((await directoryCard.innerText()).includes('3,200'), false)
        assert.equal(await directoryCard.locator('.driver-directory-photo').getAttribute('src'), driver.photo)
        const portraitBox = await directoryCard.locator('.driver-directory-photo').boundingBox()
        assert.equal(Math.round(portraitBox.width), Math.round(portraitBox.height))
        assert.equal((await directoryCard.innerText()).includes(driver.phone), false)
        await directoryCard.getByRole('link', { name: 'View reviews' }).click()
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
        const car = page.locator('.catalog-card').filter({ hasText: driver.vehicleName })
        await car.waitFor()
        assert.equal(await page.locator('.vehicle-driver-count').count(), 0)
        assert.equal((await car.innerText()).includes(driver.fullName), false)
        assert.equal((await car.innerText()).includes(driver.phone), false)
        assert.equal((await car.innerText()).includes(driver.maskedPhone), false)
        assert.equal(await page.locator('.catalog-card').filter({ hasText: driver.fullName }).count(), 0)
        assert.equal((await car.innerText()).includes('Before offer'), true)
        await car.getByRole('button', { name: 'Book Now' }).click()
        await page.locator('[name="carRental"]').waitFor()
        assert.equal(await page.locator('[name="carRental"]').inputValue(), driver.vehicleName)
        assert.equal((await page.locator('[name="carRental"]').innerText()).includes(driverId), false)
        await page.goto(`${origin}/hotels`)
        const stay = page.locator('.catalog-card').filter({ hasText: hotel.name })
        await stay.waitFor()
        assert.equal((await stay.innerText()).includes(hotel.hotelId), false)
        assert.ok((await stay.innerText()).includes('Mountain views'))
        assert.equal(await page.locator('.catalog-card').count(), 1)
        assert.equal(await page.locator('.catalog-card').filter({ hasText: 'Hotel Royal Imsar' }).count(), 0)
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
        assert.equal(await stayAfterReview.getByRole('checkbox').count(), 0)
        assert.ok((await stayAfterReview.locator('.hotel-rates').innerText()).includes('4,000'))
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
        assert.equal(enquiry.fields.nightlyRate, 'INR 5,200 per room per night for 2 people; breakfast included, dinner included; Taxes included')
        await page.goto(`${origin}/car-rentals/${id}`)
        await page.getByRole('heading', { name: driver.vehicleName, exact: true }).waitFor()
        assert.equal(await page.locator('.detail-aside').getByText('Price on enquiry', { exact: true }).count(), 1)
        assert.equal(await page.locator('.detail-aside .offer-price').count(), 0)
        await page.goto(`${origin}/tour-packages`)
        const planner = page.locator('.trip-planner')
        await planner.getByLabel('Start date').fill('2027-01-10')
        await planner.getByLabel('End date').fill('2027-01-14')
        await planner.getByRole('button', { name: 'Next: vehicle' }).click()
        const traveller = planner.locator('.planner-vehicle-choice').filter({ hasText: 'Tempo Traveller' })
        assert.equal(await traveller.getByLabel('Traveller seating capacity').count(), 1)
        assert.equal(await traveller.getByLabel('Traveller seating capacity').locator('option').count(), 3)
        await traveller.getByLabel('Traveller seating capacity').selectOption('tempo-traveller-14')
        assert.equal(await traveller.getByLabel('Traveller seating capacity').inputValue(), 'tempo-traveller-14')
        const vehicle = planner.locator('.planner-vehicle-choice').filter({ hasText: driver.vehicleName })
        await vehicle.getByRole('radio').check()
        assert.equal((await planner.innerText()).includes(driver.fullName), false)
        assert.equal((await planner.innerText()).includes(driverId), false)
        assert.equal((await vehicle.innerText()).includes('Before offer'), true)
        assert.ok((await planner.locator('.planner-vehicle-total').innerText()).includes('17,500'))
        await planner.getByRole('button', { name: 'Next: hotels' }).click()
        await planner.getByRole('button', { name: 'Stay in Gulmarg', exact: true }).first().click()
        const plannedHotel = planner.locator('.planner-hotel-card').filter({ hasText: hotel.name }).first()
        await plannedHotel.locator('.planner-hotel-tile').click()
        await plannedHotel.getByLabel('Breakfast', { exact: false }).check()
        await plannedHotel.getByLabel('Dinner', { exact: false }).check()
        assert.ok((await plannedHotel.locator('.hotel-rates').innerText()).includes('5,200'))
        await planner.getByRole('button', { name: 'Continue with this plan' }).click()
        await page.locator('.enquiry-form').getByLabel('Name', { exact: true }).fill('Planner Guest')
        await page.locator('.enquiry-form').getByLabel('Phone number').fill('9876543210')
        await page.locator('.enquiry-form [type="submit"]').click()
        await page.getByRole('heading', { name: 'Thank you for submitting your details.' }).waitFor()
        assert.equal(enquiry.fields.carRental, driver.vehicleName)
        assert.equal(enquiry.fields.adults, '2')
        assert.equal(enquiry.fields.children, '0')
        assert.equal(enquiry.fields.customDetails.includes(driverId), false)
      } finally { await page.close() }
    })
  } finally { await browser.close() }
})
