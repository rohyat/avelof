import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'

const origin = process.env.AVELOF_REVIEW_TEST_URL || 'http://127.0.0.1:8792'
const id = '00000000-0000-4000-8000-000000000001'
const hotelId = 'AVELOF_HTL_10001SRG'
const driverId = 'AVELOF-DRV-10001'
const hotel = {
  id, hotelId, name: 'Alpine Hotel', location: 'Srinagar', category: 'Premium',
  description: 'Comfortable property for a relaxing Kashmir holiday.', price: 2000,
  roomRates: [{ roomType: 'Deluxe', count: 2, price: 2000 }], roomTypes: ['Deluxe'],
  totalRooms: 2, mealPlan: 'Room only', heating: 'Room heaters', amenities: ['Wi-Fi'],
  highlights: ['Near the market'], checkIn: '14:00', checkOut: '11:00',
  breakfastPrice: 200, dinnerPrice: 400, extraBedPrice: 800, photos: [`/api/hotel-images/${id}/0`],
}
const driver = {
  id, driverId, fullName: 'Test Driver', vehicleId: 'innova', vehicleName: 'Toyota Innova',
  maskedPhone: '9*******10', location: 'Srinagar', seats: 6, photo: `/api/driver-images/${id}/0`,
}
const review = (number, kind) => ({
  id: `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
  reviewerName: `Guest ${number}`, bookingId: '', experience: kind === 'hotel' ? 'Hotel stay' : 'Driver experience',
  rating: 5, title: `Review ${number}`, reviewText: `Full ${kind} review ${number}. ${'A very comfortable experience. '.repeat(15)}`,
  hotelId: kind === 'hotel' ? hotelId : null, driverId: kind === 'driver' ? driverId : null,
  publishedAt: '2026-11-18T12:00:00Z',
})

async function setup(page, state) {
  await page.route('**/api/pricing*', (route) => route.fulfill({ json: { discountPercent: 23, version: 1 } }))
  await page.route('**/api/hotels*', (route) => route.fulfill({ json: { hotels: [hotel], total: 1, page: 1, pageSize: 25 } }))
  await page.route('**/api/drivers*', (route) => route.fulfill({ json: { drivers: [driver], total: 1, page: 1, pageSize: 25 } }))
  await page.route('**/api/reviews*', (route) => {
    if (route.request().method() === 'POST') {
      const input = route.request().postDataJSON()
      state.posts ??= []
      state.posts.push(input)
      if (state.failSave) return route.fulfill({ status: 503, json: { error: 'Review storage unavailable.' } })
      state.saved ??= []
      if (!state.saved.some((review) => review.id === input.id)) state.saved.unshift({ ...input, driverId: input.driverId || null, hotelId: input.hotelId || null, publishedAt: '2026-11-19T12:00:00Z' })
      return route.fulfill({ status: 201, json: { saved: true, id: input.id, status: 'published' } })
    }
    const query = new URL(route.request().url()).searchParams
    const kind = query.has('hotelId') ? 'hotel' : 'driver'
    assert.equal(query.get(kind === 'hotel' ? 'hotelId' : 'driverId'), kind === 'hotel' ? hotelId : driverId)
    if (state.error) return route.fulfill({ status: 503, json: { error: 'Review service unavailable.' } })
    const reviews = [...(state.saved || []), ...(state.empty ? [] : [review(1, kind), review(2, kind)])]
    return route.fulfill({ json: { reviews, total: reviews.length, averageRating: reviews.length ? 5 : null, page: 1, pageSize: 25 } })
  })
}

test('hotel and driver review previews rotate, pause, open full reviews and link to writing', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    for (const [path, name, kind] of [[`/hotels/${id}`, hotel.name, 'hotel'], ['/drivers', driver.fullName, 'driver'], [`/car-rentals/${id}`, driver.fullName, 'driver']]) {
      const page = await browser.newPage()
      try {
        const state = {}
        await setup(page, state)
        await page.clock.install()
        await page.goto(`${origin}${path}`)
        const preview = page.getByRole('region', { name: `Reviews for ${name}`, exact: true })
        const tile = preview.locator('.partner-review-tile')
        await tile.waitFor()
        assert.equal(await page.getByRole('link', { name: 'View hotel reviews', exact: true }).count(), 0)
        assert.equal(await preview.getByRole('link', { name: 'View reviews', exact: true }).getAttribute('href'), `/${kind === 'hotel' ? 'hotels' : 'drivers'}/${kind === 'hotel' ? hotelId : driverId}/reviews`)
        assert.match(await tile.innerText(), /Guest 1/)
        if (kind === 'hotel') {
          assert.ok(await preview.evaluate((element) => {
            const photo = document.querySelector('.hotel-detail-photo').getBoundingClientRect()
            const rates = document.querySelector('.detail-aside').getBoundingClientRect()
            const box = element.getBoundingClientRect()
            return box.top >= photo.bottom && box.bottom <= rates.top
          }))
        }
        await page.clock.fastForward(5100)
        assert.match(await tile.innerText(), /Guest 2/)
        await tile.click()
        const popup = page.getByRole('dialog', { name: `Review for ${name}`, exact: true })
        await popup.waitFor()
        assert.equal(await popup.locator('blockquote').innerText(), review(2, kind).reviewText.trim())
        assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden')
        await page.keyboard.press('Escape')
        await popup.waitFor({ state: 'detached' })
        assert.equal(await tile.evaluate((element) => element === document.activeElement), true)
        await page.clock.fastForward(11000)
        assert.match(await tile.innerText(), /Guest 2/)
        await preview.getByRole('button', { name: 'Previous review', exact: true }).click()
        assert.match(await tile.innerText(), /Guest 1/)
        await preview.getByRole('button', { name: 'Resume review rotation', exact: true }).click()
        await page.mouse.move(0, 0)
        await page.clock.fastForward(5100)
        assert.match(await tile.innerText(), /Guest 2/)
        for (const width of [320, 390, 820, 1440]) {
          await page.setViewportSize({ width, height: 900 })
          for (const theme of ['light', 'dark']) {
            await page.evaluate((value) => { document.documentElement.dataset.theme = value }, theme)
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${path} ${width} ${theme}`)
            assert.equal(await preview.evaluate((element) => element.scrollWidth > element.clientWidth), false)
            assert.ok((await tile.boundingBox()).height <= 150)
            const view = await preview.getByRole('link', { name: 'View reviews', exact: true }).boundingBox()
            const write = await preview.getByRole('button', { name: 'Write a review', exact: true }).boundingBox()
            assert.ok(Math.abs(view.y - write.y) < 1)
            assert.ok(write.x >= view.x + view.width)
            assert.ok(view.y >= (await tile.boundingBox()).y + (await tile.boundingBox()).height)
            if (theme === 'dark') assert.equal(await preview.evaluate((element) => getComputedStyle(element).backgroundColor), 'rgb(16, 27, 26)')
          }
        }
        const previousUrl = page.url()
        await preview.getByRole('button', { name: 'Write a review', exact: true }).click()
        const form = page.getByRole('dialog', { name: `Write a review for ${name}`, exact: true })
        await form.waitFor()
        assert.equal(page.url(), previousUrl)
        for (const width of [320, 390, 820, 1440]) {
          await page.setViewportSize({ width, height: 900 })
          assert.equal(await form.evaluate((element) => element.scrollWidth > element.clientWidth), false, `Review form overflow at ${width}px`)
          assert.ok((await form.getByLabel('Display name', { exact: true }).boundingBox()).height >= 44)
        }
        assert.equal(await form.locator('[name="title"]').count(), 0)
        for (const selector of ['input[name="reviewerName"]', 'input[name="rating"]', 'textarea[name="reviewText"]']) {
          assert.equal(await form.locator(selector).first().getAttribute('required'), '')
        }
        assert.equal(await form.getByLabel('Booking ID (optional)', { exact: true }).getAttribute('required'), null)
        await form.getByRole('button', { name: 'Submit review', exact: true }).click()
        assert.equal(state.posts, undefined, 'Required fields prevent incomplete submissions')
        await form.getByLabel('Display name', { exact: true }).fill('New reviewer')
        await form.locator('.review-star-options label').filter({ has: page.getByRole('radio', { name: '5 stars', exact: true }) }).click()
        await form.getByLabel('Review', { exact: true }).fill('A lovely experience.')
        await form.locator('[name="publicationConsent"]').check()
        state.failSave = true
        await form.getByRole('button', { name: 'Submit review', exact: true }).click()
        await form.getByRole('alert').waitFor()
        assert.equal(await form.getByText('Thank you. Your review is published.').count(), 0)
        state.failSave = false
        await form.getByRole('button', { name: 'Submit review', exact: true }).click()
        await form.getByText('Thank you. Your review is published.').waitFor()
        assert.equal(state.posts[0].id, state.posts[1].id, 'Retry keeps the same idempotency ID')
        assert.equal(state.posts[1].bookingId, '')
        assert.equal(state.posts[1].title, '')
        assert.equal(state.posts[1][kind === 'hotel' ? 'hotelId' : 'driverId'], kind === 'hotel' ? hotelId : driverId)
        assert.equal(page.url(), previousUrl)
        for (let count = 0; count < 3; count++) {
          await form.getByRole('button', { name: 'Write another review', exact: true }).click()
          await form.getByLabel('Display name', { exact: true }).fill('New reviewer')
          await form.locator('.review-star-options label').filter({ has: page.getByRole('radio', { name: '4 stars', exact: true }) }).click()
          await form.getByLabel('Review', { exact: true }).fill('Another experience.')
          await form.locator('[name="publicationConsent"]').check()
          await form.getByRole('button', { name: 'Submit review', exact: true }).click()
          await form.getByText('Thank you. Your review is published.').waitFor()
        }
        assert.equal(state.saved.length, 4)
        await page.keyboard.press('Escape')
        await form.waitFor({ state: 'detached' })
        await preview.getByRole('button', { name: 'Read full review by New reviewer', exact: true }).waitFor()
        assert.equal(await preview.getByRole('button', { name: 'Write a review', exact: true }).evaluate((element) => element === document.activeElement), true)
        await preview.getByRole('link', { name: 'View reviews', exact: true }).click()
        await page.getByRole('heading', { name: `Reviews for this ${kind}`, exact: true }).waitFor()
        assert.equal(new URL(page.url()).pathname, `/${kind === 'hotel' ? 'hotels' : 'drivers'}/${kind === 'hotel' ? hotelId : driverId}/reviews`)
      } finally { await page.close() }
    }
  } finally { await browser.close() }
})

test('review previews show retry and empty states, respect reduced motion and stay region-scoped', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  const state = { error: true, empty: false }
  try {
    await setup(page, state)
    await page.goto(`${origin}/hotels/${id}`)
    const preview = page.getByRole('region', { name: `Reviews for ${hotel.name}`, exact: true })
    await preview.getByRole('alert').waitFor()
    assert.match(await preview.innerText(), /Review service unavailable/)
    state.error = false
    state.empty = true
    await preview.getByRole('button', { name: 'Retry reviews', exact: true }).click()
    await preview.getByText('No reviews yet. Be the first to share your experience.').waitFor()
    assert.equal(await preview.locator('.partner-review-tile').count(), 0)
    assert.equal(await preview.getByRole('button', { name: 'Write a review', exact: true }).count(), 1)
    state.empty = false
    await page.reload()
    await preview.locator('.partner-review-tile').waitFor()
    await page.clock.install()
    await page.clock.fastForward(11000)
    assert.match(await preview.locator('.partner-review-tile').innerText(), /Guest 1/)
    assert.equal(await preview.getByRole('button', { name: /review rotation/ }).count(), 0)
    for (const region of ['Ladakh', 'Jammu']) {
      await page.route('**/api/hotels*', (route) => route.fulfill({ json: { hotels: [{ ...hotel, region, location: region === 'Ladakh' ? 'Leh' : 'Jammu' }], total: 1, page: 1, pageSize: 25 } }))
      await page.goto(`${origin}/${region.toLowerCase()}/hotels/${id}`)
      await preview.locator('.partner-review-tile').waitFor()
      const url = page.url()
      await preview.getByRole('button', { name: 'Write a review', exact: true }).click()
      const form = page.getByRole('dialog', { name: `Write a review for ${hotel.name}`, exact: true })
      await form.waitFor()
      assert.equal(page.url(), url)
      await page.keyboard.press('Escape')
      await form.waitFor({ state: 'detached' })
    }
    await page.goto(`${origin}/jammu/hotels/${hotelId}/reviews#share-review`)
    await page.getByRole('dialog', { name: `Write a review for ${hotel.name}`, exact: true }).waitFor()
    assert.equal(await page.locator('form input[name="title"]').count(), 0)
  } finally { await browser.close() }
})
