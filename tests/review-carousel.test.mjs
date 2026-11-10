import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { ownerGuestReviewMonths, ownerProvidedGuestReviews } from '../src/data/catalog.ts'

const origin = process.env.AVELOF_REVIEW_TEST_URL || 'http://localhost:8792'
const reviews = ownerProvidedGuestReviews.map((review, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  reviewerName: review.name, experience: review.packageName, rating: review.rating,
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

test('review carousel preserves layout and supports accessible automatic and manual switching', async (context) => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    await context.test('desktop stays a grid; small screens preserve widths and show dots', async () => {
      const page = await openReviews(browser, { viewport: { width: 1440, height: 1000 } })
      try {
        await page.goto(`${origin}/reviews`)
        await page.locator('.review-card').nth(9).waitFor()
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

    await context.test('autoplay pauses, resumes, and stops after dot or keyboard interaction', async () => {
      const page = await openReviews(browser)
      try {
        await page.clock.install()
        await instantTestScroll(page)
        await page.goto(`${origin}/reviews`)
        await page.locator('.review-card').nth(9).waitFor()
        const rail = page.locator('.review-carousel-rail')
        await page.clock.runFor(50)
        await page.clock.fastForward(6500)
        assert.ok(await rail.evaluate((element) => element.scrollLeft > 0))
        await page.getByRole('button', { name: 'Pause automatic review switching', exact: true }).evaluate((button) => button.click())
        await page.clock.runFor(30)
        const pausedPosition = await rail.evaluate((element) => element.scrollLeft)
        await page.clock.fastForward(20000)
        assert.equal(await rail.evaluate((element) => element.scrollLeft), pausedPosition)
        await page.getByRole('button', { name: 'Resume automatic review switching', exact: true }).evaluate((button) => button.click())
        await page.clock.runFor(30)
        await page.clock.fastForward(6500)
        assert.ok(await rail.evaluate((element) => element.scrollLeft) > pausedPosition)
        await page.getByRole('button', { name: 'Show review 4', exact: true }).evaluate((button) => button.click())
        await page.clock.runFor(30)
        const chosenPosition = await rail.evaluate((element) => element.scrollLeft)
        await page.clock.fastForward(20000)
        assert.equal(await rail.evaluate((element) => element.scrollLeft), chosenPosition)
        await rail.focus()
        await rail.press('Home')
        assert.equal(await rail.evaluate((element) => element.scrollLeft), 0)
        await rail.press('ArrowRight')
        assert.ok(await rail.evaluate((element) => element.scrollLeft > 0))
      } finally { await page.close() }
    })

    await context.test('touch interaction stops autoplay and the play control can resume it', async () => {
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
        const resume = page.getByRole('button', { name: 'Resume automatic review switching', exact: true })
        await resume.waitFor()
        const stoppedPosition = await rail.evaluate((element) => element.scrollLeft)
        await page.clock.fastForward(15000)
        assert.equal(await rail.evaluate((element) => element.scrollLeft), stoppedPosition)
        await resume.evaluate((button) => button.scrollIntoView({ block: 'center', behavior: 'instant' }))
        const buttonBounds = await resume.boundingBox()
        await page.touchscreen.tap(buttonBounds.x + buttonBounds.width / 2, buttonBounds.y + buttonBounds.height / 2)
        await page.clock.runFor(30)
        await page.clock.fastForward(6500)
        assert.ok(await rail.evaluate((element) => element.scrollLeft) > stoppedPosition)
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
        assert.equal(await page.getByRole('button', { name: 'Automatic switching disabled by motion preference' }).isDisabled(), true)
        await page.getByRole('button', { name: 'Show review 2', exact: true }).evaluate((button) => button.click())
        assert.ok(await rail.evaluate((element) => element.scrollLeft > 0))
      } finally { await page.close() }
    })
  } finally { await browser.close() }
})