import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { ownerGuestReviewMonths, ownerProvidedGuestReviews } from '../src/data/catalog.ts'

const origin = process.env.AVELOF_REVIEW_TEST_URL || 'http://localhost:8792'
const reviews = ownerProvidedGuestReviews.map((review, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  reviewerName: review.name, bookingId: index === 0 ? 'b'.repeat(80) : index === 1 ? '' : review.bookingId, experience: review.packageName, rating: review.rating,
  title: review.reviewTitle, reviewText: review.reviewText,
  publishedAt: '2026-11-10T12:00:00.000Z', reviewMonth: ownerGuestReviewMonths[review.id],
}))

async function openReviews(browser, options = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, ...options })
  await page.route('**/api/reviews*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reviews, total: reviews.length, averageRating: 5, page: 1, pageSize: 25 }) }))
  return page
}

async function instantTestScroll(page) {
  await page.addInitScript(() => {
    const scrollTo = Element.prototype.scrollTo
    Element.prototype.scrollTo = function (options, ...rest) {
      if (this.classList.contains('review-carousel-rail') && typeof options === 'object') return scrollTo.call(this, { ...options, behavior: 'instant' })
      return scrollTo.call(this, options, ...rest)
    }
  })
}

test('admin separates review subjects and retains filters for moderation and deletion', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const partnerId = '00000000-0000-4000-8000-000000000099'
  const driver = {
    id: partnerId, driverId: 'AVELOF-DRV-10001', fullName: 'Test Driver', age: 30,
    phone: '9876543210', maskedPhone: '987*****10', licenceNumber: 'JK01 123456789', vehicleNumber: 'JK01AB-1234',
    vehicleId: 'innova', vehicleName: 'Toyota Innova', location: 'Srinagar', seats: 6,
    status: 'pending', version: 0, ownerNote: '', createdAt: '2026-11-13T10:00:00Z',
    photo: `/api/driver-images/${partnerId}/0`,
  }
  const hotel = {
    id: partnerId, hotelId: 'AVELOF_HTL_10001SRG', name: 'Test Hotel', contactName: 'Test Partner', phone: '9876543210',
    location: 'Srinagar', category: 'Premium', description: 'A comfortable hotel with mountain views and local hospitality.',
    price: 2000, submittedPrice: 2000, mealPlan: 'Room only', taxDetails: 'Taxes included', heating: 'Room heaters',
    amenities: ['Wi-Fi'], highlights: ['Mountain views'], roomTypes: ['Standard'], totalRooms: 2,
    checkIn: '14:00', checkOut: '11:00', photos: [`/api/hotel-images/${partnerId}/0`],
    status: 'rejected', version: 0, ownerNote: '', createdAt: '2026-11-13T10:00:00Z', updatedAt: '2026-11-13T10:00:00Z',
  }
  let records = ['guest', 'driver', 'hotel'].map((category, index) => ({
    ...reviews[0], id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    reviewerName: `${category} reviewer`, driverId: category === 'driver' ? driver.driverId : null,
    hotelId: category === 'hotel' ? hotel.hotelId : null, status: 'published', version: 0,
    createdAt: '2026-11-13T10:00:00Z', submissionSource: 'guest_submission',
  }))
  const queries = []
  let failPartners = true
  await page.route('**/api/drivers*', (route) => {
    const requestedPage = Number(new URL(route.request().url()).searchParams.get('page'))
    return route.fulfill({ json: { drivers: requestedPage === 1 ? [driver] : [{ ...driver, id: '00000000-0000-4000-8000-000000000098', driverId: 'AVELOF-DRV-10002', fullName: 'Second Driver' }], total: 26, page: requestedPage, pageSize: 25 } })
  })
  await page.route('**/api/hotels*', (route) => route.fulfill(failPartners
    ? { status: 503, json: { error: 'Test partners unavailable' } }
    : { json: { hotels: [hotel], total: 1, page: 1, pageSize: 25 } }))
  await page.route('**/api/reviews*', (route) => {
    const request = route.request()
    if (request.method() === 'GET') {
      const query = new URL(request.url()).searchParams
      queries.push(query.toString())
      const filtered = records.filter((review) => {
        const category = review.driverId ? 'driver' : review.hotelId ? 'hotel' : 'guest'
        return category === query.get('category')
          && (!query.get('driverId') || review.driverId === query.get('driverId'))
          && (!query.get('hotelId') || review.hotelId === query.get('hotelId'))
          && (query.get('status') === 'all' || review.status === query.get('status'))
      })
      return route.fulfill({ json: { reviews: filtered, total: filtered.length, averageRating: null, page: Number(query.get('page')), pageSize: 25 } })
    }
    const body = request.postDataJSON()
    if (request.method() === 'DELETE') {
      records = records.filter((review) => review.id !== body.id)
      return route.fulfill({ json: { deleted: true, id: body.id } })
    }
    const record = records.find((review) => review.id === body.id)
    record.status = body.status
    record.version++
    return route.fulfill({ json: { review: record } })
  })
  try {
    await page.goto(`${origin}/admin/panel/reviews`)
    await page.getByText('guest reviewer', { exact: true }).waitFor()
    assert.equal(await page.locator('.admin-review-record').count(), 1)
    await page.getByRole('button', { name: 'Driver reviews', exact: true }).click()
    await page.getByText('driver reviewer', { exact: true }).waitFor()
    await page.getByLabel('Select driver').selectOption('AVELOF-DRV-10002')
    await page.getByText('No reviews in this view.').waitFor()
    await page.getByLabel('Select driver').selectOption(driver.driverId)
    await page.getByText('driver reviewer', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Hide review', exact: true }).click()
    await page.getByText('Review hidden.', { exact: true }).waitFor()
    await page.getByLabel('Review status').selectOption('rejected')
    await page.getByRole('button', { name: 'Publish review', exact: true }).click()
    await page.getByText('No reviews in this view.').waitFor()
    await page.getByLabel('Review status').selectOption('all')
    await page.getByRole('button', { name: 'Return to pending', exact: true }).click()
    await page.getByText('Review awaiting approval.', { exact: true }).waitFor()
    page.on('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Delete review', exact: true }).click()
    await page.getByText('No reviews in this view.').waitFor()
    assert.equal(await page.getByLabel('Select driver').inputValue(), driver.driverId)
    assert.ok(queries.at(-1).includes(`driverId=${driver.driverId}`))
    await page.getByRole('button', { name: 'Hotel reviews', exact: true }).click()
    await page.getByText('hotel reviewer', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Retry loading partners' }).waitFor()
    failPartners = false
    await page.getByRole('button', { name: 'Retry loading partners' }).click()
    await page.getByLabel('Select hotel').selectOption(hotel.hotelId)
    await page.getByText('hotel reviewer', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Delete review', exact: true }).click()
    await page.getByText('No reviews in this view.').waitFor()
    assert.equal(await page.getByLabel('Select hotel').inputValue(), hotel.hotelId)
    assert.ok(queries.at(-1).includes(`hotelId=${hotel.hotelId}`))
    await page.getByRole('button', { name: 'Guest reviews', exact: true }).click()
    await page.getByText('guest reviewer', { exact: true }).waitFor()
    assert.equal(await page.getByLabel('Select hotel').count(), 0)
    const overflow = await page.evaluate(() => [...document.querySelectorAll('.admin-reviews-page, .admin-reviews-page *')].filter((element) => {
      const box = element.getBoundingClientRect()
      return !element.classList.contains('sr-only') && box.width > 0 && (box.right > innerWidth + 1 || element.scrollWidth > element.clientWidth + 1)
    }).map((element) => `${element.tagName}.${element.className}`).slice(0, 15))
    assert.deepEqual(overflow, [])
  } finally { await page.close(); await browser.close() }
})

test('review carousel preserves layout and supports accessible automatic and manual switching', async (context) => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    await context.test('desktop stays a grid; small screens preserve widths and show dots', async () => {
      const page = await openReviews(browser, { viewport: { width: 1440, height: 1000 } })
      try {
        await page.goto(`${origin}/reviews`)
        await page.locator('.review-card').nth(9).waitFor()
        for (const [index, review] of reviews.entries()) {
          const card = page.locator('.review-card').nth(index)
          assert.equal(await card.locator('.review-booking-id').count(), review.bookingId ? 1 : 0)
          if (review.bookingId) {
            assert.equal(await card.locator('.review-booking-id').textContent(), `Booking ID: ${review.bookingId}`)
            const name = await card.locator('strong').boundingBox()
            const booking = await card.locator('.review-booking-id').boundingBox()
            assert.ok(booking.y >= name.y + name.height, 'Booking ID should be below the reviewer name')
          }
        }
        assert.equal(await page.locator('.review-carousel-controls').isVisible(), false)
        assert.ok(await page.evaluate(() => document.querySelector('.review-invite-top').compareDocumentPosition(document.querySelector('.review-feed-heading')) & Node.DOCUMENT_POSITION_FOLLOWING))
        for (const width of [900, 768, 640, 390, 320]) {
          await page.setViewportSize({ width, height: 900 })
          await page.locator('.review-carousel[aria-roledescription="carousel"]').waitFor()
          const layout = await page.locator('.review-carousel-rail').evaluate((rail) => {
            const columns = Number(getComputedStyle(rail).getPropertyValue('--review-columns'))
            const gap = Number.parseFloat(getComputedStyle(rail).columnGap)
            const card = rail.firstElementChild
            const style = getComputedStyle(card)
            return { columns, expectedWidth: (rail.clientWidth - gap * (columns - 1)) / columns, actualWidth: card.getBoundingClientRect().width, padding: style.padding, fontSize: getComputedStyle(card.querySelector('blockquote')).fontSize, overflow: document.documentElement.scrollWidth > innerWidth }
          })
          assert.ok(Math.abs(layout.actualWidth - layout.expectedWidth) < 1, `Card width at ${width}px`)
          assert.equal(layout.padding, '21px')
          assert.equal(layout.fontSize, '19px')
          assert.equal(layout.overflow, false)
          assert.equal(await page.locator('.review-carousel-controls').isVisible(), true)
          await page.waitForFunction((count) => document.querySelectorAll('.review-carousel-dots button').length === count, reviews.length - layout.columns + 1)
        }
        await mkdir('.wrangler/tmp/review-carousel-checks', { recursive: true })
        await page.locator('.review-carousel').screenshot({ path: '.wrangler/tmp/review-carousel-checks/mobile.png' })
        await page.setViewportSize({ width: 768, height: 1000 })
        await page.locator('.review-carousel').screenshot({ path: '.wrangler/tmp/review-carousel-checks/tablet.png' })
        await page.setViewportSize({ width: 1440, height: 1000 })
        await page.locator('.review-carousel').screenshot({ path: '.wrangler/tmp/review-carousel-checks/desktop.png' })
      } finally { await page.close() }
    })

    await context.test('submitted review publishes and scrolls into the public feed', async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
      let submitted
      await page.route('**/api/reviews*', async (route) => {
        if (route.request().method() === 'POST') {
          submitted = route.request().postDataJSON()
          return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ saved: true, id: submitted.id, status: 'published' }) })
        }
        const published = submitted ? [{ id: submitted.id, reviewerName: submitted.reviewerName, bookingId: submitted.bookingId, experience: submitted.experience, rating: submitted.rating, title: submitted.title, reviewText: submitted.reviewText, publishedAt: '2026-11-11T12:00:00.000Z', reviewMonth: null }, ...reviews] : reviews
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reviews: published, total: published.length, averageRating: 5, page: 1, pageSize: 25 }) })
      })
      try {
        await page.goto(`${origin}/reviews`)
        await page.locator('.review-card').nth(9).waitFor()
        await page.getByRole('link', { name: 'Write a review' }).click()
        await page.locator('input[name="reviewerName"]').fill('Fresh Guest')
        await page.getByLabel('Booking ID (optional, shown publicly)').fill('AVELOF_PRM_00123-ab')
        assert.ok((await page.locator('.review-consent').innerText()).includes('booking ID, if provided'))
        await page.locator('input[name="title"]').fill('A lovely journey')
        await page.locator('input[name="rating"][value="5"]').check({ force: true })
        await page.locator('textarea[name="reviewText"]').fill('The local team made our journey easy and welcoming.')
        await page.locator('input[name="publicationConsent"]').check()
        await page.getByRole('button', { name: 'Submit review' }).click()
        await page.getByRole('heading', { name: 'Thank you. Your review has been saved.' }).waitFor()
        const card = page.locator(`#guest-review-${submitted.id}`)
        await card.waitFor()
        assert.ok((await card.innerText()).includes('Fresh Guest'))
        assert.equal(await card.locator('.review-booking-id').textContent(), 'Booking ID: AVELOF_PRM_00123-ab')
        assert.ok((await card.boundingBox()).y < 500)
      } finally { await page.close() }
    })

    await context.test('home shortcut tiles stay clear and readable across screen sizes', async () => {
      const page = await browser.newPage({ viewport: { width: 768, height: 1024 } })
      try {
        await page.goto(origin)
        const tiles = page.locator('.home-shortcut-link')
        const shortcuts = page.getByRole('navigation', { name: 'Explore AVELOF' })
        await tiles.last().waitFor()
        assert.deepEqual(await tiles.allTextContents(), ['Plan a trip', 'Packages', 'Cabs', 'Hotels', 'Places', 'Bookings', 'Reviews', 'Drivers', 'Partner'])
        assert.equal(await page.getByRole('button', { name: 'Ask AVELOF' }).count(), 0)
        assert.ok(await page.getByRole('heading', { name: 'Experience Kashmir Beyond Expectations.' }).isVisible())
        assert.ok(await page.getByText("Where Kashmir's natural beauty meets warm hospitality, memorable stays and genuine local care.", { exact: true }).isVisible())
        assert.equal(await page.locator('.home-hero .home-shortcut-link').count(), 0)
        const homeHero = page.locator('.home-hero')
        assert.equal(await homeHero.getAttribute('aria-label'), null)
        assert.match(await homeHero.evaluate((hero) => getComputedStyle(hero).backgroundImage), /homepage-background\.jpg/)
        assert.equal(await homeHero.locator('img').count(), 0)
        await page.clock.install()
        await page.goto(`${origin}/destinations`)
        const destinationPhotos = [
          ['Srinagar', 'srinagar-preview.webp'],
          ['Gulmarg', 'gulmarg-user.jpg'],
          ['Pahalgam', 'pahalgam-user.jpg'],
          ['Sonamarg', 'sonamarg-user.jpg'],
          ['Yusmarg', 'yusmarg-user.jpg'],
          ['Doodhpathri', 'doodhpathri-user.jpg'],
          ['Gurez Valley', 'gurez-valley-user.jpg'],
        ]
        for (const [place, filename] of destinationPhotos) {
          const entry = page.locator('.place-entry').filter({ has: page.getByRole('heading', { name: place, exact: true }) }).first()
          const image = entry.locator(`img[src$="${filename}"]`)
          await image.scrollIntoViewIfNeeded()
          await image.evaluate((img) => img.decode())
          assert.ok(await image.evaluate((img) => img.naturalWidth > 0), `${filename} should load for ${place}`)
          assert.equal(await entry.locator('.destination-photo-frame img').count(), 1, `${place} should show only one image at a time`)
        }
        const srinagar = page.locator('.place-entry').filter({ has: page.getByRole('heading', { name: 'Srinagar', exact: true }) })
        assert.equal(await srinagar.locator('.destination-photo-frame').getAttribute('data-photo-count'), '3')
        await page.clock.fastForward(1500)
        await srinagar.locator('img[src$="tulip-garden-user.jpg"]').waitFor()
        await page.clock.fastForward(1500)
        await srinagar.locator('img[src$="hazratbal-user.jpg"]').waitFor()
        const sonamarg = page.locator('.place-entry').filter({ has: page.getByRole('heading', { name: 'Sonamarg', exact: true }) })
        assert.equal(await sonamarg.locator('.destination-photo-frame').getAttribute('data-photo-count'), '2')
        await page.clock.fastForward(1500)
        await sonamarg.locator('img[src$="kashmir-great-lakes-trek-user.jpg"]').waitFor()
        await page.goto(origin)
        await page.getByText('Why choose AVELOF?', { exact: true }).waitFor()
        assert.ok(await page.getByRole('heading', { name: /Your Kashmir holiday/ }).isVisible())
        assert.ok(await page.getByText('Rooted in Kashmir', { exact: true }).isVisible())
        assert.ok(await page.getByText('Stays for your plans', { exact: true }).isVisible())
        assert.ok(await page.getByText('Comfortable local transport', { exact: true }).isVisible())
        assert.ok(await page.getByText('Personal travel assistance', { exact: true }).isVisible())
        assert.equal(await page.getByText(/professionally licensed|registered with J&K Tourism/i).count(), 0)
        assert.ok(await page.locator('.home-shortcuts').evaluate((shortcuts) => shortcuts.compareDocumentPosition(document.querySelector('.reasons-section')) & Node.DOCUMENT_POSITION_FOLLOWING))
        assert.equal(await shortcuts.getByRole('link', { name: 'Plan a trip', exact: true }).getAttribute('href'), '#custom-trip')
        assert.equal(await shortcuts.getByRole('link', { name: 'Packages', exact: true }).getAttribute('href'), '/tour-packages')
        assert.equal(await shortcuts.getByRole('link', { name: 'Cabs', exact: true }).getAttribute('href'), '/car-rentals')
        assert.equal(await shortcuts.getByRole('link', { name: 'Hotels', exact: true }).getAttribute('href'), '/hotels')
        assert.equal(await shortcuts.getByRole('link', { name: 'Places', exact: true }).getAttribute('href'), '/destinations')
        assert.equal(await shortcuts.getByRole('link', { name: 'Bookings', exact: true }).getAttribute('href'), '/my-enquiries')
        assert.equal(await shortcuts.getByRole('link', { name: 'Reviews', exact: true }).getAttribute('href'), '/reviews')
        assert.equal(await shortcuts.getByRole('link', { name: 'Drivers', exact: true }).getAttribute('href'), '/drivers')
        assert.equal(await shortcuts.getByRole('link', { name: 'Partner', exact: true }).getAttribute('href'), '/partners')
        for (const width of [1440, 1060, 900, 821, 820, 768, 744, 390, 320]) {
          await page.setViewportSize({ width, height: 900 })
          const layout = await page.locator('.home-shortcut-grid').evaluate((grid) => {
            const tiles = [...grid.querySelectorAll('.home-shortcut-link')]
            const rows = new Set(tiles.map((tile) => Math.round(tile.getBoundingClientRect().y)))
            return { count: tiles.length, overflow: document.documentElement.scrollWidth > innerWidth, rowCount: rows.size, clippedText: tiles.some((tile) => tile.scrollWidth > tile.clientWidth) }
          })
          assert.equal(layout.count, 9)
          assert.equal(layout.overflow, false, `Page overflow at ${width}px`)
          assert.equal(layout.clippedText, false, `Tile labels should fit at ${width}px`)
          assert.equal(layout.rowCount, 3, `Tiles should form three balanced rows at ${width}px`)
        }
        for (const [width, height] of [[320, 640], [360, 740], [390, 844], [446, 699], [430, 932]]) {
          await page.setViewportSize({ width, height })
          await page.evaluate(() => { window.scrollTo({ top: 0, behavior: 'instant' }); return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))) })
          const firstView = await page.locator('.home-shortcut-grid').evaluate((grid) => {
            const tiles = [...grid.querySelectorAll('.home-shortcut-link')].map((tile) => tile.getBoundingClientRect())
            const hero = document.querySelector('.home-hero').getBoundingClientRect()
            const content = document.querySelector('.hero-content').getBoundingClientRect()
            return {
              firstRowVisible: tiles.slice(0, 3).every((tile) => tile.top >= 0 && tile.bottom <= innerHeight),
              secondRowFraction: (innerHeight - tiles[3].top) / tiles[3].height,
              heroContentFits: content.top >= hero.top && content.bottom <= hero.bottom,
              overflow: document.documentElement.scrollWidth > innerWidth,
              firstTop: tiles[0].top, firstBottom: tiles[0].bottom,
            }
          })
          assert.ok(firstView.firstRowVisible, `First shortcut row should be fully visible at ${width}x${height}: ${JSON.stringify(firstView)}`)
          assert.ok(firstView.secondRowFraction >= 0.5, `At least half the second row should be visible at ${width}x${height}: ${firstView.secondRowFraction}`)
          assert.ok(firstView.heroContentFits, `Hero text should fit at ${width}x${height}`)
          assert.equal(firstView.overflow, false)
        }
        await page.goto(`${origin}/about`)
        await page.getByRole('heading', { name: 'Experience Kashmir Beyond Expectations.' }).waitFor()
        await page.getByRole('heading', { name: 'Your complete Kashmir travel companion.' }).waitFor()
        await page.getByText('Our promise', { exact: true }).waitFor()
        assert.ok((await page.locator('.about-promise').innerText()).includes('Your Stay. Your Journey. Your Kashmir Experience.'))
        assert.equal(await page.getByText(/professionally licensed local drivers/i).count(), 0)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      } finally { await page.close() }
    })

    await context.test('two-second autoplay pauses on manual dot or keyboard interaction', async () => {
      const page = await openReviews(browser)
      try {
        await page.clock.install()
        await instantTestScroll(page)
        await page.goto(`${origin}/reviews`)
        await page.locator('.review-card').nth(9).waitFor()
        const rail = page.locator('.review-carousel-rail')
        assert.equal(await page.locator('.review-autoplay-toggle').count(), 0)
        await page.clock.runFor(50)
        await page.clock.fastForward(2100)
        assert.ok(await rail.evaluate((element) => element.scrollLeft > 0))
        await page.getByRole('button', { name: 'Show review 4', exact: true }).evaluate((button) => button.click())
        await page.clock.runFor(30)
        const chosenPosition = await rail.evaluate((element) => element.scrollLeft)
        await page.clock.fastForward(3000)
        assert.equal(await rail.evaluate((element) => element.scrollLeft), chosenPosition)
        await rail.focus()
        await rail.press('Home')
        assert.equal(await rail.evaluate((element) => element.scrollLeft), 0)
        await rail.press('ArrowRight')
        assert.ok(await rail.evaluate((element) => element.scrollLeft > 0))
      } finally { await page.close() }
    })

    await context.test('touch interaction stops autoplay without a resume control', async () => {
      const page = await openReviews(browser, { hasTouch: true })
      try {
        await page.clock.install()
        await instantTestScroll(page)
        await page.goto(`${origin}/reviews`)
        await page.locator('.review-card').nth(9).waitFor()
        const rail = page.locator('.review-carousel-rail')
        await rail.evaluate((element) => element.scrollIntoView({ block: 'center', behavior: 'instant' }))
        const bounds = await rail.boundingBox()
        await page.touchscreen.tap(bounds.x + 30, bounds.y + 30)
        await page.clock.runFor(30)
        assert.equal(await page.locator('.review-autoplay-toggle').count(), 0)
        const stoppedPosition = await rail.evaluate((element) => element.scrollLeft)
        await page.clock.fastForward(3000)
        assert.equal(await rail.evaluate((element) => element.scrollLeft), stoppedPosition)
      } finally { await page.close() }
    })

    await context.test('opening the mobile menu stops review autoplay', async () => {
      const page = await openReviews(browser)
      try {
        await page.clock.install()
        await instantTestScroll(page)
        await page.goto(`${origin}/reviews`)
        await page.locator('.review-card').nth(9).waitFor()
        const rail = page.locator('.review-carousel-rail')
        await page.getByRole('button', { name: 'Open menu', exact: true }).click()
        await page.clock.runFor(30)
        const stoppedPosition = await rail.evaluate((element) => element.scrollLeft)
        await page.clock.fastForward(3000)
        assert.equal(await rail.evaluate((element) => element.scrollLeft), stoppedPosition)
      } finally { await page.close() }
    })

    await context.test('reduced motion disables autoplay, but manual dots work', async () => {
      const page = await openReviews(browser, { reducedMotion: 'reduce' })
      try {
        await page.clock.install()
        await page.goto(`${origin}/reviews`)
        await page.locator('.review-card').nth(9).waitFor()
        await page.clock.runFor(50)
        await page.clock.fastForward(20000)
        const rail = page.locator('.review-carousel-rail')
        assert.equal(await rail.evaluate((element) => element.scrollLeft), 0)
        assert.equal(await page.locator('.review-autoplay-toggle').count(), 0)
        await page.getByRole('button', { name: 'Show review 2', exact: true }).evaluate((button) => button.click())
        assert.ok(await rail.evaluate((element) => element.scrollLeft > 0))
      } finally { await page.close() }
    })
  } finally { await browser.close() }
})