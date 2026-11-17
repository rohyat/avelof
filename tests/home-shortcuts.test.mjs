import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { business } from '../src/config.ts'
import { brandPromises } from '../src/data/brandPromises.ts'

const origin = process.env.AVELOF_HOTEL_TEST_URL || 'http://127.0.0.1:8792'

test('Kashmir and Ladakh shortcuts sit one text-sized gap below the hero promises', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage()
  await page.route('**/api/pricing', (route) => route.fulfill({ json: { discountPercent: 23, version: 1 } }))
  await page.route('**/api/hotels*', (route) => route.fulfill({ json: { hotels: [], total: 0, page: 1, pageSize: 25 } }))
  try {
    for (const path of ['/', '/ladakh']) {
      await page.goto(`${origin}${path}`)
      for (const reducedMotion of ['no-preference', 'reduce']) {
        await page.emulateMedia({ reducedMotion })
        for (const width of [320, 390, 768, 1024, 1440]) {
          await page.setViewportSize({ width, height: 900 })
          await page.locator('.home-hero').evaluate((hero) => Promise.all(hero.getAnimations({ subtree: true }).filter((animation) => animation.effect.getTiming().iterations !== Infinity).map((animation) => animation.finished)))
          const gap = await page.locator('.home-hero').evaluate((hero) => {
            const promises = hero.querySelector('.hero-trust').getBoundingClientRect()
            const shortcuts = document.querySelector('.home-shortcut-grid').getBoundingClientRect()
            return { actual: shortcuts.top - promises.bottom, expected: parseFloat(getComputedStyle(hero.querySelector('h1')).marginBottom) }
          })
          assert.ok(Math.abs(gap.actual - gap.expected) < 1, `${path} at ${width}px (${reducedMotion}): ${gap.actual}px gap should match ${gap.expected}px text spacing`)
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
        }
      }
    }
  } finally { await browser.close() }
})

test('homepage shortcuts place local trips after cabs and offer a full-width direct call', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage()
  await page.route('**/api/pricing', (route) => route.fulfill({ json: { discountPercent: 23, version: 1 } }))
  await page.route('**/api/hotels*', (route) => route.fulfill({ json: { hotels: [], total: 0, page: 1, pageSize: 25 } }))
  try {
    await page.goto(origin)
    const nav = page.getByRole('navigation', { name: 'Explore AVELOF' })
    assert.deepEqual(await nav.getByRole('link').allTextContents(), ['Plan a trip', 'Packages', 'Hotels', 'Cabs', 'Local Trips', 'Drivers', 'Bookings', 'Places', 'Activities', 'Food & Shopping', 'Travel Guide', 'Handicrafts'])
    assert.equal(await nav.getByRole('link', { name: 'Partner', exact: true }).count(), 0)
    assert.equal(await page.locator('footer').getByRole('link', { name: 'Partner with AVELOF', exact: true }).getAttribute('href'), '/partners')
    assert.equal(await nav.getByRole('link', { name: 'Reviews', exact: true }).count(), 0)
    const call = page.locator('.home-shortcuts .home-call-tile')
    assert.equal(await call.getAttribute('href'), `tel:${business.phone.replace(/[^\d+]/g, '')}`)
    assert.ok((await call.textContent()).includes(business.phone))
    assert.equal(await call.getByText(/Your Kashmir memories/).count(), 0)
    assert.equal(await call.locator('.home-call-copy > span:last-child').textContent(), 'We’ll help you plan your trip based on your requirements.')
    assert.equal(await call.locator('.home-call-action > span').textContent(), 'Call AVELOF directly ')
    const reassurance = call.locator('.hero-trust')
    assert.equal(await call.locator('.hero-trust').count(), 1)
    assert.equal(await page.locator('.home-call-panel > .hero-trust').count(), 0)
    assert.equal(await call.getByText('From Kashmir, with care').count(), 0)
    assert.deepEqual(await reassurance.locator('li span').allTextContents(), [...brandPromises])
    assert.equal(await reassurance.locator('li').first().evaluate((el) => getComputedStyle(el).animationName), 'hero-trust-cycle')
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      const navBox = await nav.boundingBox()
      const callBox = await call.boundingBox()
      assert.ok(callBox.y >= navBox.y + navBox.height)
      assert.ok(Math.abs(navBox.width - callBox.width) < 1)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      assert.equal(await call.evaluate((el) => el.scrollWidth > el.clientWidth), false)
      const trustBox = await reassurance.boundingBox()
      const headlineBox = await call.locator('.home-call-copy > span:last-child').boundingBox()
      assert.ok(trustBox.y >= callBox.y && trustBox.y + trustBox.height <= headlineBox.y)
      if (width <= 600) {
        const icon = await call.locator('.home-call-icon').boundingBox()
        const headline = await call.locator('.home-call-copy > span:last-child').boundingBox()
        assert.ok(Math.abs(icon.y + icon.height / 2 - headline.y - headline.height / 2) < 1, 'Mobile phone icon is centred on the headline')
        assert.ok(callBox.height <= 200, `Mobile call tile stays under 200px at ${width}px: ${callBox.height}`)
      }
    }
    await page.emulateMedia({ reducedMotion: 'reduce' })
    for (const item of await reassurance.locator('li').all()) {
      assert.equal(await item.evaluate((el) => getComputedStyle(el).animationName), 'none')
      assert.equal(await item.isVisible(), true)
    }
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
    assert.equal(await call.evaluate((el) => getComputedStyle(el).color), 'rgb(255, 255, 255)')
  } finally { await browser.close() }
})

test('Kashmir Handicrafts shortcut opens the craft guide without an unsupported shop endorsement', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.route('**/api/businesses*', (route) => route.fulfill({ json: { businesses: [], total: 0, page: 1, pageSize: 25 } }))
  try {
    await page.goto(origin)
    await page.getByRole('navigation', { name: 'Explore AVELOF' }).getByRole('link', { name: 'Handicrafts', exact: true }).click()
    await page.waitForURL(`${origin}/food-and-shopping#handicrafts`)
    await page.getByRole('heading', { name: "Kashmir's handicraft heritage", exact: true }).waitFor()
    assert.equal(await page.locator('#handicrafts .discovery-card').count(), 4)
    assert.match(await page.locator('#handicrafts').innerText(), /not a product catalogue or a guarantee of authenticity/)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  } finally { await browser.close() }
})

test('listing and planner call assistance shares the compact design while partner help is registration-specific', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage()
  await page.route('**/api/pricing', (route) => route.fulfill({ json: { discountPercent: 23, version: 1 } }))
  await page.route('**/api/hotels*', (route) => route.fulfill({ json: { hotels: [], total: 0, page: 1, pageSize: 25 } }))
  try {
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      for (const route of ['/tour-packages', '/hotels', '/car-rentals', '/local-trips', '/partners', '/']) {
        await page.goto(`${origin}${route}`)
        const tiles = page.locator('.home-call-tile')
        await tiles.first().waitFor()
        assert.equal(await tiles.count(), route === '/' || route === '/tour-packages' ? 2 : 1)
        for (const tile of await tiles.all()) {
          assert.equal(await tile.getAttribute('href'), `tel:${business.phone.replace(/[^\d+]/g, '')}`)
          assert.equal(await tile.evaluate((el) => el.scrollWidth > el.clientWidth), false)
          assert.equal(await tile.locator('.hero-trust').count(), route === '/partners' ? 0 : 1)
        }
        if (route === '/partners') assert.ok((await tiles.textContent()).includes('Need help with registration?'))
        if (route === '/' || route === '/tour-packages') {
          const planner = page.locator('.trip-planner')
          assert.equal(await page.locator('.custom-trip-intro .home-call-tile').count(), 0)
          const assistance = planner.locator('.home-call-tile')
          assert.equal(await assistance.count(), 1)
          const next = planner.getByRole('button', { name: 'Next: places' })
          await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
          const nextBox = await next.boundingBox()
          const assistanceBox = await assistance.boundingBox()
          assert.ok(assistanceBox.y >= nextBox.y + nextBox.height, 'Planner assistance sits below Next: places')
        }
        if (route === '/tour-packages') {
          assert.ok(await tiles.first().evaluate((el) => Boolean(el.compareDocumentPosition(document.querySelector('.package-comparison-intro')) & Node.DOCUMENT_POSITION_FOLLOWING)))
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      }
    }
  } finally { await browser.close() }
})
