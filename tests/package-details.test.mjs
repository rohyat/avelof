import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { tourPackages } from '../src/data/catalog.ts'

const origin = process.env.AVELOF_HOTEL_TEST_URL || 'http://localhost:8791'

test('package detail cards preserve itinerary, experiences, inclusions, pricing and booking actions', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage()
  await page.route('**/api/pricing', (route) => route.fulfill({ json: { discountPercent: 23, version: 1 } }))
  await page.route('**/api/hotels*', (route) => route.fulfill({ json: { hotels: [], total: 0, page: 1, pageSize: 25 } }))
  try {
    for (const item of tourPackages.filter((item) => !item.underDevelopment)) {
      await page.goto(`${origin}/tour-packages/${item.id}`)
      await page.getByRole('heading', { name: item.name, exact: true, level: 1 }).waitFor()
      assert.deepEqual(await page.locator('.package-itinerary h3').allTextContents(), item.itinerary.map((stop) => stop.title))
      assert.deepEqual(await page.locator('.package-itinerary .package-day-copy p').allTextContents(), item.itinerary.map((stop) => stop.detail))
      assert.equal(await page.locator('.package-day-marker svg[aria-hidden=true]').count(), item.itinerary.length)
      assert.deepEqual(await page.locator('.package-experiences li > span:last-child').allTextContents(), item.experiences)
      assert.equal(await page.locator('.package-experiences svg[aria-hidden=true]').count(), item.experiences.length)
      assert.deepEqual(await page.locator('.package-inclusions .include-grid > div').first().locator('li > span').allTextContents(), item.inclusions)
      assert.deepEqual(await page.locator('.package-inclusions .include-grid > div').last().locator('li > span').allTextContents(), item.exclusions)
      assert.equal(await page.locator('.package-inclusions li > svg[aria-hidden=true]').count(), item.inclusions.length + item.exclusions.length)
      for (const stay of item.stays) assert.ok((await page.locator('.package-stay-grid').innerText()).includes(stay.hotel))
      assert.ok((await page.locator('.detail-aside').innerText()).includes(item.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })))
      assert.deepEqual(await page.getByRole('list', { name: 'Package highlights' }).getByRole('listitem').allTextContents(), [item.duration, item.id === 'luxury' ? 'Hotels with breakfast' : 'Hotels with breakfast & dinner', 'Private vehicle & local driver', 'Sightseeing included'])
      assert.equal(await page.locator('.package-notes-grid article').count(), 3)
      const question = page.locator('.package-faq summary').first()
      await question.focus()
      await page.keyboard.press('Enter')
      assert.equal(await page.locator('.package-faq details').first().getAttribute('open'), '')
      await page.locator('.package-faq details').first().getByText('Yes. This route is a starting point.', { exact: false }).waitFor({ state: 'visible' })
      await page.keyboard.press('Enter')
      assert.equal(await page.locator('.package-faq details').first().getAttribute('open'), null)
      for (const width of [320, 390, 560, 768, 820, 821, 1024, 1060, 1061, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${item.name} fits at ${width}px`)
        assert.equal(await page.locator('.package-detail-top').getByRole('button', { name: 'Book Now', exact: true }).count(), 0, 'No duplicate booking action in the header')
        if (width <= 1060) {
          const highlights = await page.locator('.package-hero-facts > span').evaluateAll((elements) => elements.map((element) => {
            const { x, y, width, height } = element.getBoundingClientRect()
            return { x, y, width, height }
          }))
          assert.equal(highlights[0].y, highlights[1].y, 'First pair shares a row')
          assert.equal(highlights[2].y, highlights[3].y, 'Second pair shares a row')
          assert.equal(highlights[0].x, highlights[2].x, 'Left column is aligned')
          assert.equal(highlights[1].x, highlights[3].x, 'Right column is aligned')
          assert.ok(highlights[2].y >= highlights[0].y + highlights[0].height, 'Second row follows the first')
          for (const highlight of highlights) {
            assert.ok(Math.abs(highlight.width - highlights[0].width) < 1, 'Highlight widths match')
            assert.equal(highlight.height, highlights[0].height, 'Highlight heights match')
          }
        } else {
          assert.equal(await page.locator('.package-hero-facts').evaluate((element) => getComputedStyle(element).display), 'flex', 'Desktop layout remains unchanged')
        }
        const bottomBooking = page.locator('.package-end-booking button')
        assert.equal(await bottomBooking.isVisible(), width <= 820, `Bottom booking matches the single-column layout at ${width}px`)
        const aside = page.locator('.detail-aside')
        assert.equal(await aside.evaluate((element) => getComputedStyle(element).position), width <= 820 ? 'static' : 'sticky')
        if (width <= 820) {
          const positions = await page.evaluate(() => ({
            finalSectionBottom: document.querySelector('.package-faq').getBoundingClientRect().bottom,
            buttonTop: document.querySelector('.package-end-booking button').getBoundingClientRect().top,
            priceCardBottom: document.querySelector('.detail-aside').getBoundingClientRect().bottom,
            bodyTop: document.querySelector('.detail-body').getBoundingClientRect().top,
          }))
          assert.ok(positions.buttonTop >= positions.finalSectionBottom, 'Booking action follows all package details')
          assert.ok(positions.priceCardBottom <= positions.bodyTop, 'Price card appears above package details')
        }
        for (const card of await page.locator('.package-itinerary article, .package-experiences li, .package-inclusions .include-grid > div, .package-notes-grid article, .package-faq details, .package-hero-facts').all()) {
          assert.equal(await card.evaluate((element) => element.scrollWidth > element.clientWidth), false, `Card content fits at ${width}px`)
        }
      }
      await page.setViewportSize({ width: 390, height: 900 })
      for (const section of ['.package-end-booking', '.detail-aside']) {
        await page.locator(section).getByRole('button', { name: 'Book Now', exact: true }).click()
        const dialog = page.getByRole('dialog', { name: 'Send us your trip enquiry.' })
        await dialog.waitFor()
        assert.equal(await dialog.locator('select[name=packagePreference]').inputValue(), item.name)
        await dialog.getByRole('button', { name: 'Close enquiry', exact: true }).click()
      }
    }
    await page.goto(`${origin}/tour-packages/luxury`)
    await page.getByRole('heading', { name: 'Luxury', exact: true }).waitFor()
    assert.ok(await page.getByRole('button', { name: 'Book Now', exact: true }).count() > 0)
    await page.goto(`${origin}/car-rentals/swift-dzire`)
    assert.equal(await page.locator('.package-detail-top, .package-detail-layout').count(), 0)
    assert.equal(await page.locator('.detail-heading > button').count(), 1, 'Non-package header layout stays unchanged')
  } finally { await browser.close() }
})
