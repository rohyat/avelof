import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { destinations, tourPackages } from '../src/data/catalog.ts'
import { business } from '../src/config.ts'
import { brandPromises } from '../src/data/brandPromises.ts'
import { kashmirPhotosForPdf } from '../src/data/kashmirPhotoGallery.ts'
import { localTrekPhotos } from '../src/data/localTrips.ts'
import { discountedHotelPackagePrice } from '../src/services/pricing.ts'
import { buildBrandedItineraryPdf, tourPackagePdfData, ladakhJourneyPdfData } from '../src/services/itineraryPdf.ts'
import { ladakhJourneys, ladakhJourneyPhotos } from '../src/data/ladakhJourneys.ts'

const origin = process.env.AVELOF_HOTEL_TEST_URL || 'http://127.0.0.1:8792'
const nativeFetch = globalThis.fetch
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url
  if (url.startsWith('/images/')) {
    const photoPath = new URL(`../public${url}`, import.meta.url)
    return new Response(await readFile(photoPath), { headers: { 'content-type': 'image/jpeg' } })
  }
  return nativeFetch(input, init)
}

test('branded PDF contains the current promises, every contact link, itinerary, inclusions, and final thanks', async () => {
  const pdf = await buildBrandedItineraryPdf({
    title: 'Custom Kashmir Itinerary',
    subtitle: 'A family journey planned around selected preferences.',
    dates: '20-25 November 2026',
    guests: '2 adults, 1 child',
    overview: ['Places selected: Srinagar, Gulmarg, Pahalgam.'],
    days: [{ label: 'Day 1', title: 'Arrive in Srinagar', detail: 'Airport arrival and hotel check-in.' }],
    stays: ['Srinagar: Mallard Hotel, Standard room.'],
    vehicle: 'Toyota Innova, five days.',
    activities: ['Shikara ride requested; subject to availability.'],
    unionCabs: ['Add union cabs in Pahalgam.'],
    estimate: 'Planning estimate only.',
    inclusions: ['Selected vehicle and hotel requests.'],
    exclusions: ['Flights and travel insurance.'],
    notes: ['Routes and availability require confirmation.'],
  })
  const contents = Buffer.from(pdf.output('arraybuffer')).toString('latin1')
  assert.ok(contents.startsWith('%PDF-'))
  assert.ok(pdf.getNumberOfPages() >= 6, 'Includes cover, itinerary, photo gallery, inclusions/exclusions and thank-you pages')
  for (const promise of brandPromises) assert.ok(contents.includes(promise), `Cover includes: ${promise}`)
  for (const contact of [business.phone, business.email, business.instagramHandle, 'avelof.in']) assert.ok(contents.includes(contact))
  for (const url of [business.website, `mailto:${business.email}`, business.instagram]) assert.ok(contents.includes(url))
  for (const text of ['Custom Kashmir Itinerary', 'Arrive in Srinagar', 'Selected stays', 'Activities requested', 'Union cabs requested', 'will refund the amount', 'paid for that cab', 'planning guide', 'refine your choices', 'Inclusions', 'Exclusions', 'Thank you.']) {
    assert.ok(contents.includes(text), `PDF contains ${text}`)
  }
  assert.ok((contents.match(/info@avelof\.in/g) ?? []).length >= pdf.getNumberOfPages(), 'Contact details appear in each page footer')
  assert.ok((contents.match(/\/Subtype\s*\/Image/g) ?? []).length >= kashmirPhotosForPdf.length, 'All ten supplied photos are embedded')
  for (const photo of kashmirPhotosForPdf) assert.ok(contents.includes(photo.caption), `PDF includes photo caption: ${photo.caption}`)
})

test('all supplied photos exist and are used in relevant package and destination galleries', async () => {
  const catalogPhotos = [
    ...tourPackages.flatMap((item) => [item.image, ...item.gallery]),
    ...destinations.flatMap((place) => [place.image, ...(place.additionalPhotos ?? []).map((photo) => photo.image)]),
  ]
  for (const photo of kashmirPhotosForPdf) {
    const path = new URL(`../public${photo.image}`, import.meta.url)
    const bytes = await readFile(path)
    assert.ok(bytes.length > 10_000, `${photo.image} is present and optimized`)
    assert.ok(catalogPhotos.includes(photo.image), `${photo.image} is mapped into a package or destination gallery`)
  }
  const suppliedPhotoPaths = new Set(kashmirPhotosForPdf.map((photo) => photo.image))
  for (const image of [...catalogPhotos, ...Object.values(localTrekPhotos).map((photo) => photo.image)]) {
    assert.ok(suppliedPhotoPaths.has(image), `${image} uses a supplied photo without a printed destination name`)
  }
})

test('all package PDFs use their current package itinerary and union-cab terms', () => {
  for (const item of tourPackages) {
    const data = tourPackagePdfData(item)
    assert.equal(data.days.length, item.itinerary.length)
    assert.deepEqual(data.inclusions, item.inclusions)
    assert.deepEqual(data.exclusions, item.exclusions)
    assert.ok(data.notes?.some((note) => note.includes('AVELOF will refund the amount you paid for that cab')))
  }
})

test('Ladakh PDFs match each displayed itinerary without Kashmir routes, rates or photo galleries', async () => {
  for (const trip of ladakhJourneys) {
    const data = ladakhJourneyPdfData(trip)
    assert.equal(data.region, 'Ladakh')
    assert.equal(data.photos[0].image, trip.photo.src)
    if (trip.id === 'kashmir-to-ladakh') assert.match(data.photoNote, /location unverified/)
    assert.deepEqual(data.days.map(({ label, title, detail }) => ({ day: label, title, detail })), trip.itinerary)
    const pdf = await buildBrandedItineraryPdf(data)
    const contents = Buffer.from(pdf.output('arraybuffer')).toString('latin1')
    for (const text of [trip.name, 'Summer 2027 planning preview', 'at least 48 hours', 'Price on enquiry', 'A glimpse of Ladakh', 'No travel service is included by default']) assert.ok(contents.includes(text), text)
    for (const photo of ladakhJourneyPhotos(trip)) assert.ok(contents.includes(photo.title))
    if (trip.id === 'kashmir-to-ladakh') assert.ok(contents.includes('Exact river and location unverified.'))
    for (const text of ['Your Kashmir journey', 'A glimpse of Kashmir', 'Current displayed package rate', 'Deluxe', 'Premium']) assert.ok(!contents.includes(text), text)
  }
})

test('every PDF cover has compact tiles with centred icons/text and clear dates below', async () => {
  const { jsPDF } = await import('jspdf')
  const covers = []
  const recordCover = function () {
    const operations = []
    covers.push(operations)
    for (const method of ['text', 'roundedRect', 'circle', 'line']) {
      const original = this[method]
      this[method] = function (...args) {
        if (this.getCurrentPageInfo().pageNumber === 1) {
          operations.push({
            method, args,
            ...(method === 'text' ? { height: this.getTextDimensions(args[0]).h } : {}),
          })
        }
        return original.apply(this, args)
      }
    }
  }
  const event = ['initialized', recordCover]
  jsPDF.API.events.push(event)
  try {
    const custom = {
      title: 'Custom Kashmir Itinerary',
      subtitle: 'A trip planned around your selections.',
      dates: '18 Nov 2026 - 22 Nov 2026 (5 days, 4 nights)',
      guests: '2 adults',
      days: [], inclusions: [], exclusions: [],
    }
    for (const data of [custom, ...tourPackages.map(tourPackagePdfData)]) {
      await buildBrandedItineraryPdf(data)
      const operations = covers.at(-1)
      const tiles = operations.filter(({ method, args }) => method === 'roundedRect' && args[2] > 80 && args[2] < 100)
      assert.equal(tiles.length, brandPromises.length)
      for (const [index, tile] of tiles.entries()) {
        const [x, top, width, height] = tile.args
        assert.ok(height <= 22, 'Promise tiles are smaller than the previous 30 mm height')
        const text = operations.find(({ method, args }) => method === 'text' && [].concat(args[0]).join(' ') === brandPromises[index])
        assert.ok(text, `Cover includes promise ${index + 1}`)
        assert.equal(text.args[3].baseline, 'top')
        assert.ok(Math.abs(text.args[2] + text.height / 2 - (top + height / 2)) < 0.1, 'Wrapped promise text is vertically centred')
        assert.ok(text.args[1] >= x + 16 && text.args[1] < x + width, 'Text leaves room for the icon')
        const iconBounds = operations.flatMap(({ method, args }) => {
          if (method === 'circle') return [{ left: args[0] - args[2], right: args[0] + args[2], top: args[1] - args[2], bottom: args[1] + args[2] }]
          if (method === 'line') return [{ left: Math.min(args[0], args[2]), right: Math.max(args[0], args[2]), top: Math.min(args[1], args[3]), bottom: Math.max(args[1], args[3]) }]
          if (method === 'roundedRect' && args[2] < 8) return [{ left: args[0], right: args[0] + args[2], top: args[1], bottom: args[1] + args[3] }]
          return []
        }).filter((bounds) => bounds.left >= x + 5 && bounds.right <= x + 13 && bounds.top > top && bounds.bottom < top + height)
        assert.ok(iconBounds.length > 0)
        const iconCentre = (Math.min(...iconBounds.map((bounds) => bounds.top)) + Math.max(...iconBounds.map((bounds) => bounds.bottom))) / 2
        assert.ok(Math.abs(iconCentre - (top + height / 2)) < 0.6, 'Icon and text share the tile centre')
      }
      const cardsBottom = Math.max(...tiles.map(({ args }) => args[1] + args[3]))
      const summary = operations.find(({ method, args }) => method === 'text' && [].concat(args[0]).join(' ').startsWith(data.dates.replace(/·/g, '-')))
      assert.ok(summary.args[2] - summary.height > cardsBottom + 2, 'Dates and guests are fully below the tiles')
      const note = operations.find(({ method, args }) => method === 'roundedRect' && args[2] > 180)
      assert.ok(summary.args[2] + summary.height < note.args[1], 'Wrapped package summary does not reach the planning note')
      assert.ok(note.args[1] + note.args[3] < 263, 'Planning note stays above the footer')
    }
  } finally {
    jsPDF.API.events.splice(jsPDF.API.events.indexOf(event), 1)
  }
})

test('Luxury costs 52999 after 23% off and includes six hotel nights, a final houseboat night and the requested inclusions', () => {
  const luxury = tourPackages.find((item) => item.id === 'luxury')
  assert.ok(luxury)
  assert.ok(!luxury.underDevelopment)
  assert.equal(luxury.originalPrice, 68829.87)
  assert.equal(luxury.price, 52999)
  assert.equal(discountedHotelPackagePrice(luxury.originalPrice, 23), 52999)
  assert.equal(Number(((luxury.originalPrice - luxury.price) / luxury.originalPrice * 100).toFixed(2)), 23)
  assert.equal(luxury.duration, '7 nights · 8 days')
  assert.deepEqual(luxury.itinerary.map((day) => day.title), [
    'Arrive in Srinagar', 'Doodhpathri day trip', 'Srinagar to Sonamarg', 'Sonamarg to Srinagar',
    'Srinagar to Gulmarg', 'Gulmarg to Pahalgam', 'Pahalgam to Srinagar', 'Departure',
  ])
  assert.deepEqual(luxury.stays.map(({ location, nights }) => ({ location, nights })), [
    { location: 'Srinagar', nights: 3 }, { location: 'Sonamarg', nights: 1 },
    { location: 'Gulmarg', nights: 1 }, { location: 'Pahalgam', nights: 1 },
    { location: 'Srinagar', nights: 1 },
  ])
  assert.equal(luxury.stays.reduce((total, stay) => total + stay.nights, 0), 7)
  assert.ok(luxury.stays.slice(0, -1).every((stay) => stay.hotel === 'Stay at a luxury hotel'))
  assert.equal(luxury.stays.at(-1).hotel, 'Stay on a luxury houseboat (final night)')
  assert.ok(luxury.itinerary.slice(0, 6).every((day) => day.detail.includes('Stay at a luxury hotel')))
  assert.match(luxury.itinerary[6].detail, /Stay on a luxury houseboat/)
  assert.match(luxury.itinerary[7].detail, /from your Srinagar houseboat/)
  for (const inclusion of ['Gulmarg Gondola tickets', 'Daily breakfast and dinner', 'Union cabs in Tangmarg, Pahalgam and Gulmarg', 'Complimentary one-hour Shikara ride']) {
    assert.ok(luxury.inclusions.includes(inclusion), `Luxury includes ${inclusion}`)
  }
  assert.deepEqual(luxury.exclusions, ['Flights and travel insurance', 'Optional activities other than the included Gondola ride', 'Lunches'])
  for (const item of tourPackages) assert.ok(item.inclusions.includes('Complimentary one-hour Shikara ride'), `${item.name} includes a one-hour Shikara ride`)
  assert.deepEqual(tourPackagePdfData(luxury).days, luxury.itinerary.map((day) => ({ label: day.day, title: day.title, detail: day.detail })))
})

test('Premium includes a Sonamarg day trip and the final night in Srinagar', () => {
  const premium = tourPackages.find((item) => item.id === 'premium')
  assert.ok(premium)
  assert.ok(premium.location.includes('Sonamarg'))
  assert.deepEqual(premium.itinerary.map((day) => day.title), [
    'Arrive in Srinagar', 'Sonamarg day trip', 'Srinagar to Gulmarg',
    'Gulmarg to Pahalgam', 'Pahalgam to Srinagar', 'Departure',
  ])
  assert.deepEqual(premium.stays.map(({ location, nights }) => ({ location, nights })), [
    { location: 'Srinagar', nights: 3 }, { location: 'Gulmarg', nights: 1 }, { location: 'Pahalgam', nights: 1 },
  ])
  assert.match(premium.itinerary[1].detail, /return to Srinagar.*Jamal Resorts/)
  assert.match(premium.itinerary[4].detail, /Srinagar by evening.*Jamal Resorts/)
  assert.match(premium.itinerary[5].detail, /from your Srinagar hotel/)
  assert.ok(premium.gallery.includes('/images/destinations/kashmir-snowy-peaks.jpg'))
  assert.deepEqual(tourPackagePdfData(premium).days, premium.itinerary.map((day) => ({ label: day.day, title: day.title, detail: day.detail })))
})

test('destination and local-trek pages display only supplied unlabelled gallery photos', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' })
  await page.route('**/api/pricing', (route) => route.fulfill({ json: { discountPercent: 23, version: 1 } }))
  await page.route('**/api/hotels*', (route) => route.fulfill({ json: { hotels: [], total: 0, page: 1, pageSize: 25 } }))
  const suppliedPhotoPaths = new Set(kashmirPhotosForPdf.map((photo) => photo.image))
  try {
    for (const [path, selector] of [['/destinations', '.destination-photo-frame img'], ['/local-trips', '#local-treks .local-discovery-photo']]) {
      await page.goto(`${origin}${path}`)
      const images = page.locator(selector)
      await images.first().waitFor()
      assert.ok(await images.count() > 0)
      for (const image of await images.all()) {
        await image.scrollIntoViewIfNeeded()
        await image.evaluate(async (img) => {
          img.loading = 'eager'
          await img.decode().catch((cause) => { throw new Error(`Could not decode ${img.src}`, { cause }) })
        })
        assert.ok(suppliedPhotoPaths.has(await image.getAttribute('src')), `${path} uses supplied photos`)
        assert.ok(await image.evaluate((img) => img.naturalWidth > 0), `${path} image loads`)
      }
      assert.equal(await documentWidthOverflows(page), false)
    }
  } finally { await browser.close() }
})

test('planner and ready-made packages download branded PDFs at the intended steps', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext({ acceptDownloads: true })
  const page = await context.newPage()
  await page.route('**/api/pricing', (route) => route.fulfill({ json: { discountPercent: 23, version: 1 } }))
  await page.route('**/api/hotels*', (route) => route.fulfill({ json: { hotels: [], total: 0, page: 1, pageSize: 25 } }))
  try {
    for (const packageName of ['Deluxe', 'Premium', 'Luxury']) {
      await page.goto(`${origin}/tour-packages/${packageName.toLowerCase()}`)
      const packageDownload = page.getByRole('button', { name: `Download ${packageName} package PDF`, exact: true })
      if (packageName === 'Luxury') {
        assert.equal(await page.locator('.detail-aside > strong').innerText(), '₹52,999')
        assert.equal(await page.locator('.detail-aside .regular-price s').innerText(), '₹68,829.87')
        assert.equal(await page.locator('.detail-aside .discount-label').innerText(), '23% off')
      }
      const displayedPhotos = await page.locator('.detail-gallery img').evaluateAll((images) => images.map((image) => ({
        src: new URL(image.src).pathname,
        alt: image.alt,
        loaded: image.complete && image.naturalWidth > 0,
      })))
      assert.equal(displayedPhotos.length, 3)
      assert.ok(displayedPhotos.every((photo) => photo.loaded), `${packageName} package photos load`)
      assert.deepEqual(displayedPhotos.map((photo) => photo.alt), tourPackages.find((item) => item.name === packageName).galleryAlts)
      assert.deepEqual(await page.locator('.package-itinerary h3').allTextContents(), tourPackages.find((item) => item.name === packageName).itinerary.map((day) => day.title))
      assert.ok(await page.getByText('Illustrative travel and stay photos. The listed hotels and their availability are confirmed separately.', { exact: true }).isVisible())
      for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        assert.equal(await documentWidthOverflows(page), false)
        const bounds = await packageDownload.evaluate((button) => ({ buttonRight: button.getBoundingClientRect().right, parentRight: button.closest('.detail-body').getBoundingClientRect().right }))
        assert.ok(bounds.buttonRight <= bounds.parentRight)
        assert.equal(await packageDownload.isVisible(), true)
      }
      await page.setViewportSize({ width: 1440, height: 900 })
      await packageDownload.scrollIntoViewIfNeeded()
      const packageDownloadEvent = page.waitForEvent('download')
      await packageDownload.click()
      const packagePath = await (await packageDownloadEvent).path()
      assert.ok(packagePath)
      const packagePdf = await readFile(packagePath)
      assert.ok(packagePdf.subarray(0, 5).toString().startsWith('%PDF-'))
      assert.ok(packagePdf.toString('latin1').includes(`${packageName} Kashmir Tour Package`))
      assert.ok(packagePdf.toString('latin1').includes('Union-cab charges and usage depend on the package'))
      if (packageName === 'Premium') {
        assert.ok(packagePdf.toString('latin1').includes('Sonamarg day trip'))
        assert.ok(packagePdf.toString('latin1').includes('Pahalgam to Srinagar'))
        assert.ok(packagePdf.toString('latin1').includes('from your Srinagar hotel'))
      }
      if (packageName === 'Luxury') {
        assert.ok(packagePdf.toString('latin1').includes('Doodhpathri day trip'))
        assert.ok(packagePdf.toString('latin1').includes('Sonamarg to Srinagar'))
        assert.ok(packagePdf.toString('latin1').includes('Gulmarg Gondola tickets'))
        assert.ok(packagePdf.toString('latin1').includes('Stay at a luxury hotel'))
        assert.ok(packagePdf.toString('latin1').includes('Stay on a luxury houseboat'))
        assert.ok(packagePdf.toString('latin1').includes('Daily breakfast and dinner'))
        assert.ok(packagePdf.toString('latin1').includes('Union cabs in Tangmarg'))
        assert.ok(packagePdf.toString('latin1').includes('Complimentary one-hour Shikara ride'))
        assert.ok(packagePdf.toString('latin1').includes('52,999'))
      }
      assert.ok((packagePdf.toString('latin1').match(/\/Subtype\s*\/Image/g) ?? []).length >= kashmirPhotosForPdf.length)
    }

    await page.goto(origin)
    const planner = page.locator('.trip-planner')
    const start = new Date()
    start.setDate(start.getDate() + 2)
    const end = new Date(start)
    end.setDate(end.getDate() + 5)
    const inputDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    await planner.getByLabel('Start date').fill(inputDate(start))
    await planner.getByLabel('End date').fill(inputDate(end))
    await planner.getByRole('button', { name: 'Next: places', exact: true }).click()
    const navigationHelp = planner.locator('.planner-navigation > p')
    assert.ok((await navigationHelp.innerText()).includes('Choose at your own pace'))
    assert.ok((await navigationHelp.innerText()).includes('AVELOF will prepare a PDF'))
    assert.ok((await navigationHelp.innerText()).includes('revise your choices anytime'))
    assert.equal(await planner.getByRole('button', { name: 'Back', exact: true }).isVisible(), true)
    for (const next of ['Next: vehicle', 'Next: activities', 'Next: hotels']) {
      if (next === 'Next: activities') {
        await planner.locator('.planner-union-cabs').getByLabel(/Pahalgam/).check()
        assert.ok((await planner.locator('.planner-union-refund-note').innerText()).includes('AVELOF will refund'))
        assert.equal(await planner.locator('.planner-union-cabs > p:first-of-type + label').count(), 1, 'Refund promise appears before cab choices')
      }
      await planner.getByRole('button', { name: next, exact: true }).click()
    }
    await planner.getByRole('button', { name: 'Continue with this plan', exact: true }).click()
    const tripDownload = planner.getByRole('button', { name: 'Download your trip PDF', exact: true })
    await tripDownload.waitFor()
    for (const width of [320, 390, 640, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      const bounds = await planner.locator('.planner-pdf-prompt').evaluate((element) => {
        const prompt = element.getBoundingClientRect()
        const button = element.querySelector('button').getBoundingClientRect()
        return { promptRight: prompt.right, buttonRight: button.right, promptWidth: prompt.width, direction: getComputedStyle(element).flexDirection }
      })
      const navigationBounds = await planner.locator('.planner-navigation').evaluate((element) => {
        const row = element.getBoundingClientRect()
        const back = element.querySelector('.planner-back').getBoundingClientRect()
        const message = element.querySelector('p').getBoundingClientRect()
        return { rowRight: row.right, backRight: back.right, backTop: back.top, backHeight: back.height, messageTop: message.top, messageHeight: message.height, messageLeft: message.left, messageRight: message.right, direction: getComputedStyle(element).flexDirection, border: getComputedStyle(element.querySelector('p')).borderTopWidth }
      })
      assert.ok(bounds.buttonRight <= bounds.promptRight)
      if (width <= 640) assert.equal(bounds.direction, 'column')
      assert.ok(await planner.locator('.planner-pdf-assurance').isVisible())
      assert.ok(navigationBounds.messageRight <= navigationBounds.rowRight)
      assert.ok(navigationBounds.messageLeft >= navigationBounds.backRight)
      assert.equal(navigationBounds.direction, 'row')
      assert.ok(Math.abs(navigationBounds.messageTop - navigationBounds.backTop) < 1)
      assert.ok(Math.abs(navigationBounds.messageHeight - navigationBounds.backHeight) < 1)
      assert.equal(navigationBounds.border, '1px')
    }
    const tripDownloadEvent = page.waitForEvent('download')
    await tripDownload.click()
    const tripPath = await (await tripDownloadEvent).path()
    assert.ok(tripPath)
    const tripPdf = await readFile(tripPath)
    assert.ok(tripPdf.subarray(0, 5).toString().startsWith('%PDF-'))
    assert.ok(tripPdf.toString('latin1').includes('Your Custom Kashmir Itinerary'))
    assert.ok(tripPdf.toString('latin1').includes('Places selected:'))
    assert.ok(tripPdf.toString('latin1').includes('Add union cabs in Pahalgam'))
    assert.ok(!tripPdf.toString('latin1').includes('applicable local operator terms'))
    assert.ok(tripPdf.toString('latin1').includes('will refund the amount you paid'))
    assert.ok(tripPdf.toString('latin1').includes('planning guide'))
    assert.ok(tripPdf.toString('latin1').includes('Inclusions'))
    assert.ok(tripPdf.toString('latin1').includes('Thank you.'))
    assert.ok((tripPdf.toString('latin1').match(/\/Subtype\s*\/Image/g) ?? []).length >= kashmirPhotosForPdf.length)
  } finally {
    await browser.close()
  }
})

async function documentWidthOverflows(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
}
