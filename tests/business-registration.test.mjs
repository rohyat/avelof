import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { assertCentered, assertSaving } from './submission-feedback.mjs'
import { mockPartnerPhotos } from './partner-photo-preview.mjs'

const origin = process.env.AVELOF_HOTEL_TEST_URL || 'http://localhost:8792'
const id = 'c0a80123-4567-489a-8abc-000000000001'
const publicBusiness = {
  id, name: 'Saffron Table', kind: 'restaurant', location: 'Srinagar',
  address: 'Main market, Srinagar', description: 'A locally owned restaurant serving Kashmiri specialities to visitors and residents.',
  website: 'https://example.com', photo: `/api/business-images/${id}`,
  items: ['Kashmiri wazwan', 'Kahwa'],
  photos: Array.from({ length: 5 }, (_, index) => `/api/business-images/${id}?index=${index}`),
  latitude: 34.0837123, longitude: 74.7973456,
}
const adminBusiness = {
  ...publicBusiness, contactName: 'Private Owner', contactPhone: '9876543210', contactEmail: 'private-owner@example.test',
  status: 'pending', version: 0, ownerNote: '', createdAt: '2026-11-14T00:00:00Z',
}
const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q==', 'base64')

async function photoFile(page) {
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 800
    const context = canvas.getContext('2d')
    context.fillStyle = '#38523d'
    context.fillRect(0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  return { name: 'restaurant.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') }
}

async function assertNoOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
}

test('business registration, moderation and discovery work without exposing private contacts', async (context) => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    await context.test('photo registration handles failure, unchanged retry and private access-code receipt', async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
      const submissions = []
      const saveGate = Promise.withResolvers()
      const pageErrors = []
      page.on('pageerror', (error) => pageErrors.push(error.message))
      await page.route('**/api/business-images/*', (route) => route.fulfill({ contentType: 'image/jpeg', body: jpeg }))
      await page.route('**/api/businesses*', async (route) => {
        assert.equal(route.request().method(), 'POST')
        const body = route.request().postDataBuffer()
        const contentType = route.request().headers()['content-type']
        const form = await new Response(body, { headers: { 'Content-Type': contentType } }).formData()
        const details = JSON.parse(String(form.get('details')))
        const photos = form.getAll('photo')
        submissions.push(details)
        assert.equal(photos.length, 5)
        for (const photo of photos) {
          assert.equal(photo.type, 'image/jpeg')
          assert.ok(photo.size > 0 && photo.size <= 1000000)
        }
        assert.equal(details.contactEmail, adminBusiness.contactEmail)
        assert.equal(details.publicationConsent, true)
        if (submissions.length === 1) return route.fulfill({ status: 503, json: { error: 'Temporary database issue. Retry with the same unchanged form.' } })
        await saveGate.promise
        return route.fulfill({ status: 201, json: { saved: true, id: details.id, status: 'pending', accessCode: 'SAFF3210' } })
      })
      try {
        await page.goto(`${origin}/register-business`)
        assert.equal(await page.getByRole('link', { name: 'Already registered? Edit your details' }).count(), 0)
        await page.getByLabel('Business name', { exact: true }).fill(publicBusiness.name)
        await page.locator('[name=kind]').selectOption('restaurant')
        await page.locator('[name=location]').selectOption('Srinagar')
        await page.locator('[name=address]').fill(publicBusiness.address)
        assert.equal(await page.getByLabel('About your business', { exact: true }).count(), 0)
        await page.getByLabel('Item 1', { exact: true }).fill('Kashmiri wazwan')
        await page.getByRole('button', { name: 'Add another item' }).click()
        await page.getByLabel('Item 2', { exact: true }).fill('Kahwa')
        await page.getByLabel('Public website (optional)', { exact: true }).fill(publicBusiness.website)
        await page.getByLabel("Contact person's name", { exact: true }).fill(adminBusiness.contactName)
        await page.getByLabel('Private contact phone', { exact: true }).fill(adminBusiness.contactPhone)
        await page.getByLabel('Private contact email', { exact: true }).fill(adminBusiness.contactEmail)
        const file = await photoFile(page)
        await page.locator('input[type=file]').setInputFiles(Array.from({ length: 6 }, (_, index) => ({ ...file, name: `shop-${index}.png` })))
        await page.getByRole('alert').filter({ hasText: 'Choose between one and five' }).waitFor()
        assert.equal(await page.getByRole('button', { name: 'Submit for approval', exact: true }).isDisabled(), true)
        await page.locator('input[type=file]').setInputFiles(file)
        await page.getByRole('status').filter({ hasText: '1 photos ready' }).waitFor()
        await page.locator('input[type=file]').setInputFiles(Array.from({ length: 5 }, (_, index) => ({ ...file, name: `shop-${index}.png` })))
        await page.getByRole('status').filter({ hasText: '5 photos ready' }).waitFor()
        await page.locator('[name=publicationConsent]').check()
        assert.equal(await page.locator('.location-picker').count(), 0)
        const submit = page.getByRole('button', { name: 'Submit for approval', exact: true })
        await submit.waitFor()
        for (const width of [320, 390, 1440]) {
          await page.setViewportSize({ width, height: 900 })
          await assertNoOverflow(page)
        }
        await submit.click()
        await page.getByRole('alert').filter({ hasText: 'Temporary database issue' }).waitFor()
        assert.equal(submissions.length, 1)
        await submit.click()
        await assertSaving(page, 'Saving your business registration')
        saveGate.resolve()
        const dialog = page.getByRole('dialog')
        await dialog.getByRole('heading', { name: 'Business registration saved', exact: true }).waitFor()
        await assertCentered(page, dialog)
        assert.equal(submissions.length, 2)
        assert.equal(submissions[0].id, submissions[1].id)
        assert.deepEqual(submissions[0], submissions[1])
        assert.equal(submissions[1].latitude, null)
        assert.equal(submissions[1].longitude, null)
        assert.deepEqual(submissions[1].items, ['Kashmiri wazwan', 'Kahwa'])
        assert.ok((await dialog.innerText()).includes('Status access code'))
        assert.ok((await dialog.innerText()).includes('SAFF3210'))
        await dialog.getByRole('button', { name: 'View registration details' }).click()
        await page.getByRole('heading', { name: 'Your registration has been received.' }).waitFor()
        assert.equal(await page.getByRole('link', { name: 'Check business status', exact: true }).getAttribute('href'), '/business-status')
        assert.equal(await page.getByText(adminBusiness.contactEmail, { exact: true }).count(), 0)
        assert.deepEqual(pageErrors, [])
      } finally { await page.close() }
    })

    await context.test('restaurants and shops can privately check and edit details, retaining or replacing photos', async () => {
      for (const kind of ['restaurant', 'shop']) {
        const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
        const { photo, photos, ownerNote, createdAt, ...original } = adminBusiness
        void photo; void photos; void ownerNote; void createdAt
        let current = { ...original, kind, status: 'approved' }
        let code = 'SAFF3210'
        const updates = []
        const lookups = []
        const errors = []
        await mockPartnerPhotos(page)
        page.on('pageerror', (error) => errors.push(error.message))
        await page.route('**/api/businesses*', async (route) => {
          const request = route.request()
          assert.equal(request.method(), 'POST')
          assert.equal(new URL(request.url()).search, '')
          if (request.headers()['content-type'].startsWith('application/json')) {
            const input = request.postDataJSON()
            lookups.push(input)
            if (input.accessCode.toUpperCase() !== code) return route.fulfill({ status: 404, json: { error: 'No matching business and access code. Check your details.' } })
            return route.fulfill({ json: { business: current } })
          }
          const form = await new Response(request.postDataBuffer(), { headers: { 'Content-Type': request.headers()['content-type'] } }).formData()
          const details = JSON.parse(String(form.get('details')))
          const auth = JSON.parse(String(form.get('auth')))
          assert.deepEqual(auth, { accessCode: 'SAFF3210', version: 0 })
          assert.equal(details.id, id)
          assert.equal(details.description, original.description, 'Legacy descriptions survive owner editing')
          assert.equal(details.kind, kind)
          assert.equal(details.latitude, original.latitude)
          assert.equal(details.longitude, original.longitude)
          assert.deepEqual(details.items, ['Updated item', 'Kahwa'])
          assert.equal(form.getAll('photo').length, kind === 'shop' ? 2 : 0)
          assert.deepEqual(JSON.parse(form.get('retainedPhotos')), kind === 'shop' ? [0, 2] : [0, 1, 2])
          updates.push(details)
          if (updates.length === 1) return route.fulfill({ status: 503, json: { error: 'Update could not be saved. Try again.' } })
          const { publicationConsent, websiteTrap, ...saved } = details
          void publicationConsent; void websiteTrap
          current = { ...saved, status: 'pending', version: 1 }
          code = 'VALL6789'
          return route.fulfill({ json: { saved: true, id, status: 'pending', accessCode: code } })
        })
        try {
          await page.goto(`${origin}/partners`)
          assert.equal(await page.getByRole('link', { name: 'Browse the directory', exact: true }).count(), 0)
          assert.equal(await page.getByRole('link', { name: 'Edit your details', exact: true }).count(), 0)
          await page.goto(`${origin}/business-status`)
          assert.equal(new URL(page.url()).pathname, '/business-status')
          await page.getByLabel('Business ID or phone number', { exact: true }).fill(id)
          await page.getByLabel('Status access code', { exact: true }).fill('NOPE3210')
          await page.getByRole('button', { name: 'Check status', exact: true }).click()
          await page.getByRole('alert').filter({ hasText: 'No matching business' }).waitFor()
          assert.equal(await page.getByRole('button', { name: 'Edit registration', exact: true }).count(), 0)
          await page.getByLabel('Status access code', { exact: true }).fill('saff3210')
          await page.getByRole('button', { name: 'Check status', exact: true }).click()
          await page.getByRole('button', { name: 'Edit registration', exact: true }).click()
          assert.equal(await page.getByLabel('Business name', { exact: true }).inputValue(), original.name)
          assert.equal(await page.getByLabel('Private contact email', { exact: true }).inputValue(), original.contactEmail)
          assert.equal(await page.locator('[name=kind]').inputValue(), kind)
          assert.equal(await page.locator('input[type=file]').getAttribute('required'), null)
          await page.getByAltText('Existing business photo 3').waitFor()
          await page.getByLabel('Business name', { exact: true }).fill('Valley Business')
          await page.getByLabel('Private contact phone', { exact: true }).fill('9123456789')
          await page.getByLabel('Item 1', { exact: true }).fill('Updated item')
          if (kind === 'shop') {
            await page.getByRole('button', { name: 'Remove existing photo 2', exact: true }).click()
            const file = await photoFile(page)
            await page.locator('input[type=file]').setInputFiles([file, { ...file, name: 'products.png' }])
            await page.getByRole('status').filter({ hasText: '4 of 5 photos selected.' }).waitFor()
          }
          await page.locator('[name=publicationConsent]').check()
          const submit = page.getByRole('button', { name: 'Save changes for approval', exact: true })
          await submit.click()
          await page.getByRole('alert').filter({ hasText: 'Update could not be saved' }).waitFor()
          assert.equal(await page.getByRole('dialog').count(), 0)
          await submit.click()
          const dialog = page.getByRole('dialog')
          await dialog.getByRole('heading', { name: 'Business registration saved', exact: true }).waitFor()
          assert.deepEqual(updates[0], updates[1])
          assert.ok((await dialog.innerText()).includes('VALL6789'))
          assert.equal(new URL(page.url()).search, '')
          await dialog.getByRole('button', { name: 'View registration details' }).click()
          for (const width of [320, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); await assertNoOverflow(page) }
          await page.getByRole('button', { name: 'Check business status', exact: true }).click()
          assert.equal(await page.getByLabel('Status access code', { exact: true }).inputValue(), '')
          await page.getByLabel('Business ID or phone number', { exact: true }).fill('9123456789')
          await page.getByLabel('Status access code', { exact: true }).fill(code)
          await page.getByRole('button', { name: 'Check status', exact: true }).click()
          await page.getByRole('heading', { name: 'Valley Business', exact: true }).waitFor()
          await page.getByText('Not publicly listed.', { exact: true }).waitFor()
          assert.equal(lookups.at(-1).identifier, '9123456789')
          const storage = await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]))
          assert.equal(storage.includes('SAFF3210') || storage.includes('VALL6789'), false)
          await page.getByRole('button', { name: 'Edit registration', exact: true }).click()
          await page.getByRole('button', { name: 'Cancel editing', exact: true }).click()
          assert.equal(await page.getByRole('button', { name: 'Edit registration', exact: true }).count(), 0)
          assert.deepEqual(errors, [])
        } finally { await page.close() }
      }
    })

    await context.test('mobile menu dismisses outside or on Escape without blocking scrolling or navigation', async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
      try {
        await page.goto(`${origin}/partners`)
        const nav = page.getByRole('navigation', { name: 'Main navigation' })
        const toggle = page.locator('.menu-toggle')
        await toggle.click()
        assert.equal(await toggle.getAttribute('aria-expanded'), 'true')
        await page.keyboard.press('Escape')
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false')
        assert.equal(await toggle.evaluate((element) => element === document.activeElement), true)
        await toggle.click()
        const box = await nav.boundingBox()
        await page.mouse.click(12, box.y + box.height + 30)
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false')
        await toggle.click()
        await page.mouse.move(12, 800)
        await page.mouse.wheel(0, 400)
        await page.waitForFunction(() => window.scrollY > 0)
        assert.equal(await toggle.getAttribute('aria-expanded'), 'true')
        await toggle.click()
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false')
        await toggle.click()
        await nav.getByRole('link', { name: 'About & Contact', exact: true }).click()
        assert.equal(new URL(page.url()).pathname, '/about')
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false')
        await page.setViewportSize({ width: 1440, height: 900 })
        assert.equal(await nav.isVisible(), true)
        assert.equal(await nav.getByRole('link').count(), 6)
        await assertNoOverflow(page)
      } finally { await page.close() }
    })

    await context.test('admin edits and approves, public filters work, then hide and delete remove listing', async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
      let current = { ...adminBusiness }
      const actions = []
      const shop = {
        ...publicBusiness, id: 'c0a80123-4567-489a-8abc-000000000002', name: 'Valley Crafts',
        kind: 'shop', location: 'Gulmarg', address: 'Gulmarg market',
      }
      await page.route('**/api/business-images/*', (route) => route.fulfill({ contentType: 'image/jpeg', body: jpeg }))
      await page.route('**/api/businesses*', async (route) => {
        const request = route.request()
        const url = new URL(request.url())
        if (request.method() === 'PATCH') {
          const input = request.postDataJSON()
          actions.push(input)
          assert.equal(input.id, id)
          assert.equal(input.version, current.version)
          current = { ...current, ...input, version: current.version + 1 }
          return route.fulfill({ json: { business: current } })
        }
        if (request.method() === 'DELETE') {
          const input = request.postDataJSON()
          assert.deepEqual(input, { id, version: current.version })
          current = null
          return route.fulfill({ json: { deleted: true, id } })
        }
        if (url.searchParams.get('scope') === 'admin') {
          const status = url.searchParams.get('status')
          const businesses = current && (status === 'all' || status === current.status) ? [current] : []
          return route.fulfill({ json: { businesses, total: businesses.length, page: 1, pageSize: 25 } })
        }
        const approved = current?.status === 'approved' ? [{
          id: current.id, name: current.name, kind: current.kind, location: current.location,
          address: current.address, description: current.description, website: current.website, photo: current.photo,
          items: current.items, photos: current.photos,
          latitude: current.latitude, longitude: current.longitude,
        }, shop] : [shop]
        const businesses = approved.filter((item) => (!url.searchParams.get('kind') || item.kind === url.searchParams.get('kind')) && (!url.searchParams.get('location') || item.location === url.searchParams.get('location')))
        return route.fulfill({ json: { businesses, total: businesses.length, page: 1, pageSize: 25 } })
      })
      try {
        await page.goto(`${origin}/admin/panel/businesses`)
        await page.getByRole('heading', { name: 'Saffron Table · Restaurant', exact: true }).waitFor()
        assert.ok((await page.locator('main').innerText()).includes(adminBusiness.contactEmail))
        for (const width of [320, 390, 1440]) {
          await page.setViewportSize({ width, height: 900 })
          await assertNoOverflow(page)
        }
        await page.getByLabel('Business name', { exact: true }).fill('Saffron Table Kashmir')
        await page.locator('textarea[name=description]').fill('Reviewed Kashmiri restaurant information with local food and a friendly team.')
        await page.getByLabel('Listing status').selectOption('approved')
        await page.getByRole('button', { name: 'Save business listing', exact: true }).click()
        await page.getByText('Business listing and approval status saved.', { exact: true }).waitFor()
        assert.equal(actions[0].status, 'approved')
        assert.equal(actions[0].name, 'Saffron Table Kashmir')
        assert.equal(actions[0].latitude, publicBusiness.latitude)
        assert.equal(actions[0].longitude, publicBusiness.longitude)

        await page.goto(`${origin}/food-and-shopping`)
        await page.getByRole('heading', { name: 'Saffron Table Kashmir', exact: true }).waitFor()
        await page.getByRole('heading', { name: 'Valley Crafts', exact: true }).waitFor()
        const publishedCard = page.locator('.discovery-card').filter({ hasText: 'Saffron Table Kashmir' })
        assert.deepEqual(await publishedCard.locator('.business-available-items li').allTextContents(), publicBusiness.items)
        assert.equal(await publishedCard.locator('.business-available-items li .lucide-utensils').count(), publicBusiness.items.length)
        assert.equal(await page.locator('.discovery-card').filter({ hasText: 'Valley Crafts' }).locator('.business-available-items li .lucide-shopping-bag').count(), shop.items.length)
        assert.equal(await publishedCard.locator('.hotel-photo-grid img').count(), 5)
        assert.equal(new URL(await page.locator('.discovery-card').filter({ hasText: 'Saffron Table Kashmir' }).getByRole('link', { name: 'View on Google Maps' }).getAttribute('href')).searchParams.get('query'), `${publicBusiness.latitude},${publicBusiness.longitude}`)
        assert.equal((await page.locator('main').innerText()).includes(adminBusiness.contactName), false)
        assert.equal((await page.locator('main').innerText()).includes(adminBusiness.contactPhone), false)
        assert.equal((await page.locator('main').innerText()).includes(adminBusiness.contactEmail), false)
        for (const width of [320, 390, 1440]) {
          await page.setViewportSize({ width, height: 900 })
          await assertNoOverflow(page)
        }
        await page.getByLabel('Business type').selectOption('shop')
        await page.getByRole('heading', { name: 'Valley Crafts', exact: true }).waitFor()
        assert.equal(await page.getByRole('heading', { name: 'Saffron Table Kashmir', exact: true }).count(), 0)
        await page.getByLabel('Destination').selectOption('Srinagar')
        await page.getByRole('heading', { name: 'No approved listings match', exact: true }).waitFor()
        await page.getByLabel('Destination').selectOption('Gulmarg')
        await page.getByRole('heading', { name: 'Valley Crafts', exact: true }).waitFor()

        await page.goto(`${origin}/admin/panel/businesses`)
        await page.getByLabel('Business status').selectOption('approved')
        await page.getByRole('heading', { name: 'Saffron Table Kashmir · Restaurant', exact: true }).waitFor()
        assert.equal(await page.locator('.location-picker').count(), 0)
        await page.getByRole('button', { name: 'Save business listing', exact: true }).click()
        await page.getByText('Business listing and approval status saved.', { exact: true }).waitFor()
        assert.equal(actions[1].latitude, publicBusiness.latitude)
        assert.equal(actions[1].longitude, publicBusiness.longitude)
        await page.goto(`${origin}/food-and-shopping`)
        await page.getByRole('heading', { name: 'Saffron Table Kashmir', exact: true }).waitFor()
        assert.equal(await page.locator('.discovery-card').filter({ hasText: 'Saffron Table Kashmir' }).getByRole('link', { name: 'View on Google Maps' }).count(), 1)
        await page.goto(`${origin}/admin/panel/businesses`)
        await page.getByLabel('Business status').selectOption('approved')
        await page.getByRole('heading', { name: 'Saffron Table Kashmir · Restaurant', exact: true }).waitFor()
        await page.getByLabel('Listing status').selectOption('rejected')
        await page.getByRole('button', { name: 'Save business listing', exact: true }).click()
        await page.getByText('Business listing and approval status saved.', { exact: true }).waitFor()
        assert.equal(actions[2].status, 'rejected')
        await page.goto(`${origin}/food-and-shopping`)
        await page.getByRole('heading', { name: 'Valley Crafts', exact: true }).waitFor()
        assert.equal(await page.getByRole('heading', { name: 'Saffron Table Kashmir', exact: true }).count(), 0)

        await page.goto(`${origin}/admin/panel/businesses`)
        await page.getByLabel('Business status').selectOption('rejected')
        await page.getByRole('heading', { name: 'Saffron Table Kashmir · Restaurant', exact: true }).waitFor()
        page.once('dialog', (dialog) => dialog.accept())
        await page.getByRole('button', { name: 'Delete registration', exact: true }).click()
        await page.getByText('Business registration permanently deleted.', { exact: true }).waitFor()
        assert.equal(current, null)
        await page.getByText('No business registrations match this status.', { exact: true }).waitFor()
      } finally { await page.close() }
    })
  } finally { await browser.close() }
})
