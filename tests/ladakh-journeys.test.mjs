import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { ladakhJourneys, ladakhPackageJourneys, ladakhBikeJourneys, ladakhCabJourneys } from '../src/data/ladakhJourneys.ts'

const origin = process.env.AVELOF_NAVIGATION_TEST_URL || 'http://127.0.0.1:8792'
const pathFor = (trip) => `/ladakh/${trip.section}/${trip.id}`

async function setup(page) {
  await page.route('**/api/**', (route) => route.fulfill({ status: 503, json: { error: 'Offline journey test' } }))
  await page.route('**/api/pricing', (route) => route.fulfill({ json: { discountPercent: 23, version: 1 } }))
}

test('Ladakh has three packages, two bike itineraries and three cab options with safe proposed routes', () => {
  assert.equal(ladakhPackageJourneys.length, 3)
  assert.equal(ladakhBikeJourneys.length, 2)
  assert.equal(ladakhCabJourneys.length, 3)
  assert.equal(new Set(ladakhJourneys.map(pathFor)).size, 8)
  for (const trip of ladakhJourneys) {
    assert.ok(trip.checks.length >= 3)
    if (trip.section !== 'bike-trips' && trip.id !== 'kashmir-to-ladakh') assert.ok(!trip.photo.unverified)
    assert.ok(trip.itinerary.length > 0)
    assert.equal('price' in trip, false, 'No invented rates')
    assert.equal(new Set(trip.itinerary.map((day) => day.day)).size, trip.itinerary.length)
    if (trip.stops.includes('Pangong')) {
      const higher = trip.itinerary.findIndex((day) => day.title === 'Leh to Nubra Valley')
      assert.ok(higher >= (trip.start === 'Leh' ? 2 : 4), 'Rest before the higher circuit')
      assert.match(trip.itinerary[higher].detail, /at least 48 hours/)
      assert.match(trip.itinerary.find((day) => day.title === 'Nubra towards Pangong').detail, /overnight is not compulsory/)
    }
  }
  assert.deepEqual(ladakhPackageJourneys.map((trip) => trip.itinerary.length), [7, 8, 9])
})

test('Ladakh homepage and Kashmir to Ladakh package swap photos without changing other journey covers', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage()
  await setup(page)
  try {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`${origin}/ladakh`)
      const hero = page.locator('.ladakh-hero')
      await hero.waitFor()
      assert.match(await hero.evaluate((element) => getComputedStyle(element).backgroundImage), /ladakh-phuktal-user\.jpg/)
      await page.goto(`${origin}/ladakh/packages`)
      const expected = ['ladakh-pangong-user.jpg', 'ladakh-nubra-signpost-user.jpg', 'ladakh-river-canyon-user.jpg']
      for (const [index, filename] of expected.entries()) {
        assert.equal(await page.locator('.catalog-image img').nth(index).getAttribute('src'), `/images/destinations/${filename}`)
      }
      await page.goto(`${origin}/ladakh/packages/kashmir-to-ladakh`)
      const cover = page.locator('.detail-gallery img').first()
      await cover.waitFor()
      assert.equal(await cover.getAttribute('src'), '/images/destinations/ladakh-river-canyon-user.jpg')
      await cover.evaluate((image) => image.decode())
      assert.ok(await cover.evaluate((image) => image.naturalWidth > 0))
      assert.match(await page.locator('.package-image-note').innerText(), /location unverified/)
      assert.match(ladakhPackageJourneys[2].photo.note, /location unverified/)
    }
    assert.equal(ladakhCabJourneys[2].photo.src, '/images/destinations/ladakh-phuktal-user.jpg')
    assert.equal(ladakhBikeJourneys[1].photo.src, '/images/destinations/ladakh-bike-convoy-user.jpg')
  } finally { await browser.close() }
})

test('every Ladakh catalog card opens its own itinerary and enquiry, including direct refresh and unknown routes', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  await setup(page)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  try {
    for (const section of ['packages', 'bike-trips', 'car-rentals']) {
      await page.goto(`${origin}/ladakh/${section}`)
      const trips = ladakhJourneys.filter((trip) => trip.section === section)
      assert.equal(await page.locator('.catalog-card').count(), trips.length)
      for (const trip of trips) {
        const card = page.locator('.catalog-card').filter({ has: page.getByRole('heading', { name: trip.name, exact: true }) })
        assert.equal(await card.getByRole('link', { name: 'Explore Now', exact: true }).getAttribute('href'), pathFor(trip))
        assert.equal(await card.getByRole('link', { name: 'Enquire Now', exact: true }).getAttribute('href'), `${pathFor(trip)}#enquire`)
      }
    }
    for (const trip of ladakhJourneys) {
      await page.goto(`${origin}${pathFor(trip)}`)
      await page.getByRole('heading', { name: trip.name, exact: true }).waitFor()
      assert.equal(await page.title(), `${trip.name} | AVELOF Ladakh`)
      assert.equal(await page.locator('.package-itinerary article').count(), trip.itinerary.length)
      assert.equal(await page.locator('.detail-gallery img').count(), 3)
      for (const image of await page.locator('.detail-gallery img').all()) {
        await image.evaluate((img) => img.decode())
        assert.ok(await image.evaluate((img) => img.naturalWidth > 0))
      }
      assert.equal(await page.locator('.home-call-panel').count(), 1)
      assert.equal(await page.getByRole('button', { name: 'Book Now', exact: true }).count(), 0)
      assert.match(await page.locator('.detail-aside').innerText(), /Price on enquiry/)
      assert.match(await page.locator('.package-notes').innerText(), /at least 48 hours/)
      assert.equal(await page.locator('h1').count(), 1)
      assert.equal(await page.locator('.offer-banner').count(), 0)
      await page.locator('.detail-aside').getByRole('link', { name: 'Enquire Now', exact: true }).click()
      await page.waitForURL(`${origin}${pathFor(trip)}#enquire`)
      assert.match(await page.getByRole('textbox', { name: 'Dates, route and requirements', exact: true }).inputValue(), new RegExp(trip.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      assert.equal(await page.getByLabel('Start date', { exact: true }).count(), 1)
      for (const link of await page.locator('.main-nav a').all()) assert.match(await link.getAttribute('href'), /^\/ladakh\//)
      await page.reload()
      await page.getByRole('heading', { name: trip.name, exact: true }).waitFor()
    }
    for (const section of ['packages', 'bike-trips', 'car-rentals']) {
      await page.goto(`${origin}/ladakh/${section}/not-a-route`)
      assert.equal(await page.locator('.package-itinerary, .ladakh-enquiry').count(), 0)
      assert.match(await page.locator('h1').innerText(), /find|lost|page/i)
    }
    await page.goto(`${origin}${pathFor(ladakhBikeJourneys[0])}`)
    const downloading = page.waitForEvent('download')
    await page.getByRole('button', { name: `Download ${ladakhBikeJourneys[0].name} itinerary PDF`, exact: true }).click()
    const download = await downloading
    assert.match(download.suggestedFilename(), /ladakh-planning-guide\.pdf$/)
    const pdf = (await readFile(await download.path())).toString('latin1')
    assert.ok(pdf.startsWith('%PDF-'))
    assert.ok(pdf.includes('A glimpse of Ladakh'))
    assert.ok(!pdf.includes('A glimpse of Kashmir'))
    assert.deepEqual(errors, [])
  } finally { await browser.close() }
})

test('Ladakh cards and detail timelines use Kashmir styles across themes and mobile, tablet and desktop widths', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  await setup(page)
  const styles = async (selector, properties) => page.locator(selector).first().evaluate((element, properties) => {
    const style = getComputedStyle(element)
    return Object.fromEntries(properties.map((property) => [property, style.getPropertyValue(property)]))
  }, properties)
  try {
    for (const theme of ['light', 'dark']) {
      await page.goto(origin)
      await page.evaluate((theme) => localStorage.setItem('avelof:theme', theme), theme)
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        await page.goto(`${origin}/tour-packages`)
        await page.locator('.catalog-card').first().waitFor()
        const expected = {
          card: await styles('.catalog-card', ['display', 'background-color', 'border-radius', 'border-width']),
          content: await styles('.catalog-content', ['display', 'padding', 'flex-direction']),
          copy: await styles('.card-copy', ['font-size', 'line-height', 'color']),
          image: await styles('.catalog-image', ['height', 'aspect-ratio']),
        }
        for (const section of ['packages', 'bike-trips', 'car-rentals']) {
          await page.goto(`${origin}/ladakh/${section}`)
          assert.deepEqual(await styles('.catalog-card', ['display', 'background-color', 'border-radius', 'border-width']), expected.card)
          assert.deepEqual(await styles('.catalog-content', ['display', 'padding', 'flex-direction']), expected.content)
          assert.deepEqual(await styles('.card-copy', ['font-size', 'line-height', 'color']), expected.copy)
          assert.deepEqual(await styles('.catalog-image', ['height', 'aspect-ratio']), expected.image)
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${theme}/${width}/${section}: catalog fits`)
        }
        await page.goto(`${origin}/tour-packages/deluxe`)
        await page.locator('.package-day-copy').first().waitFor()
        const timeline = await styles('.package-day-copy h3', ['font-family', 'font-size', 'line-height', 'color'])
        for (const trip of ladakhJourneys) {
          await page.goto(`${origin}${pathFor(trip)}`)
          assert.deepEqual(await styles('.package-day-copy h3', ['font-family', 'font-size', 'line-height', 'color']), timeline)
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${theme}/${width}/${trip.id}: detail fits`)
        }
      }
    }
  } finally { await browser.close() }
})

test('detail enquiries keep the chosen Ladakh journey and wait for a valid database receipt', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  await setup(page)
  try {
    for (const trip of [ladakhPackageJourneys[1], ladakhBikeJourneys[1], ladakhCabJourneys[0]]) {
      const requests = []
      let release
      let pending
      const waiting = new Promise((resolve) => { pending = resolve })
      await page.route('**/api/enquiries', async (route) => {
        const payload = route.request().postDataJSON()
        requests.push(payload)
        if (requests.length === 1) return route.fulfill({ status: 503, json: { error: 'Database unavailable' } })
        await new Promise((resolve) => { release = resolve; pending() })
        await route.fulfill({ status: 201, json: { saved: true, requestReference: payload.reference, reference: `AVELOF_${trip.section === 'car-rentals' ? 'CAB' : 'CSTM'}_10034` } })
      })
      await page.goto(`${origin}${pathFor(trip)}#enquire`)
      const form = page.locator('.ladakh-enquiry')
      await form.getByLabel('Name', { exact: true }).fill('Journey Guest')
      await form.getByLabel('Phone number', { exact: true }).fill('9876543210')
      await form.getByLabel('Start date', { exact: true }).fill('2027-07-10')
      await form.getByLabel('End date', { exact: true }).fill('2027-07-20')
      await form.getByRole('button', { name: 'Submit enquiry', exact: true }).click()
      await form.getByRole('alert').waitFor()
      assert.equal(await page.locator('.booking-modal').count(), 0)
      await form.getByRole('button', { name: 'Submit enquiry', exact: true }).click()
      await waiting
      assert.equal(await page.locator('.booking-modal:not(.registration-progress)').count(), 0)
      assert.equal(requests[1].fields.region, 'Ladakh')
      assert.equal(requests[1].fields.packagePreference, trip.preference)
      assert.equal(requests[1].kind, trip.section === 'car-rentals' ? 'car' : 'package')
      assert.match(requests[1].fields.customDetails, new RegExp(trip.name))
      assert.equal(requests[0].reference, requests[1].reference)
      release()
      await page.locator('.booking-modal:not(.registration-progress)').waitFor()
      assert.match(await page.getByRole('dialog').innerText(), /not a confirmed booking/i)
      await page.unroute('**/api/enquiries')
    }
  } finally { await browser.close() }
})
