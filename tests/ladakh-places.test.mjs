import assert from 'node:assert/strict'
import { test } from 'node:test'
import { statSync } from 'node:fs'
import { chromium } from 'playwright'
import { ladakhPlaceCategories, ladakhPlaces } from '../src/data/ladakhPlaces.ts'

const origin = process.env.AVELOF_NAVIGATION_TEST_URL || 'http://127.0.0.1:8792'

test('Ladakh guides contain descriptive highlights, practical notes and bounded local photos', () => {
  assert.equal(ladakhPlaces.length, 9)
  assert.equal(new Set(ladakhPlaces.map((place) => place.id)).size, ladakhPlaces.length)
  const images = []
  for (const place of ladakhPlaces) {
    assert.ok(ladakhPlaceCategories.includes(place.category))
    for (const field of ['description', 'highlights', 'nearby', 'planning', 'season', 'route']) assert.ok(place[field].length > 40, `${place.id}: descriptive ${field}`)
    assert.equal(place.visitNotes.length, 3)
    assert.match(place.source, /^https:\/\/(?:leh|kargil)\.nic\.in\/tourist-place\/[\w-]+\/$/)
    if (place.photo) images.push(place.photo)
    images.push(...place.gallery ?? [])
  }
  assert.equal(images.length, 5)
  for (const image of images) {
    assert.ok(image.alt.length > 30)
    const file = new URL(`../public${image.src}`, import.meta.url)
    assert.ok(statSync(file).size < 300000, `${image.src}: under 300 KB`)
  }
})

test('Ladakh places show matched photos, icon bullets, working filters and accessible planning details', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/api/**', (route) => route.fulfill({ status: 503, json: { error: 'Offline destination test' } }))
  try {
    await page.goto(`${origin}/ladakh/places`)
    for (const theme of ['light', 'dark']) {
      await page.evaluate((theme) => { document.documentElement.dataset.theme = theme }, theme)
      for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        assert.equal(await page.locator('.ladakh-place-card').count(), 9)
        const pangong = page.getByRole('article', { name: 'Pangong Lake', exact: true })
        assert.equal(await pangong.locator('.ladakh-place-highlights').first().locator('li > svg').count(), 3)
        const summary = pangong.locator('summary')
        await summary.focus()
        await page.keyboard.press('Enter')
        await pangong.getByText('The colourful photo props', { exact: false }).waitFor()
        for (const image of await pangong.locator('img').all()) {
          await image.scrollIntoViewIfNeeded()
          await image.evaluate((img) => img.decode())
          assert.ok(await image.evaluate((img) => img.naturalWidth > 0))
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${theme}/${width}: no horizontal overflow`)
        await summary.focus()
        await page.keyboard.press('Enter')
      }
    }
    const filter = page.getByRole('group', { name: 'Filter Ladakh places' })
    for (const category of ladakhPlaceCategories) {
      await filter.getByRole('button', { name: category, exact: true }).click()
      assert.equal(await filter.getByRole('button', { name: category, exact: true }).getAttribute('aria-pressed'), 'true')
      const count = category === 'All places' ? 9 : ladakhPlaces.filter((place) => place.category === category).length
      assert.equal(await page.locator('.ladakh-place-card').count(), count)
      assert.match(await page.locator('.ladakh-result-count').innerText(), new RegExp(`^${count} places to explore$`))
    }
    await filter.getByRole('button', { name: 'All places', exact: true }).click()
    for (const image of await page.locator('.ladakh-place-photo img').all()) {
      await image.scrollIntoViewIfNeeded()
      await image.evaluate((img) => img.decode())
    }
    await page.getByRole('link', { name: 'Ask about Zanskar & Phuktal', exact: true }).click()
    await page.waitForURL(`${origin}/ladakh/contact?place=zanskar-phuktal`)
    const details = page.locator('textarea[name=customDetails]')
    assert.match(await details.inputValue(), /explore Zanskar & Phuktal/)
    await details.fill('A slower Zanskar itinerary, please.')
    assert.equal(await details.inputValue(), 'A slower Zanskar itinerary, please.')
    await page.goto(`${origin}/ladakh/contact?place=not-a-catalog-place`)
    assert.equal(await page.locator('textarea[name=customDetails]').inputValue(), '')
    await page.goto(`${origin}/ladakh`)
    assert.equal(await page.locator('.ladakh-places-preview .ladakh-place-card').count(), 3)
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Homepage preview at ${width}px`)
    }
    await page.getByRole('link', { name: 'Explore places including Pangong Lake', exact: true }).click()
    await page.waitForURL(`${origin}/ladakh/places`)
    assert.deepEqual(errors, [])
  } finally { await browser.close() }
})
