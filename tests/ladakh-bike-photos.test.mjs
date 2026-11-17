import assert from 'node:assert/strict'
import { statSync } from 'node:fs'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { ladakhBikePhotos } from '../src/data/ladakhBikePhotos.ts'
import { ladakhBikeJourneys, ladakhJourneyPhotos, ladakhPackageJourneys, ladakhCabJourneys } from '../src/data/ladakhJourneys.ts'

const origin = process.env.AVELOF_NAVIGATION_TEST_URL || 'http://127.0.0.1:8792'

test('all four bike photos are optimised and limited to bike journeys', () => {
  assert.equal(ladakhBikePhotos.length, 4)
  for (const photo of ladakhBikePhotos) assert.ok(statSync(new URL(`../public${photo.src}`, import.meta.url)).size < 300000)
  for (const trip of ladakhBikeJourneys) {
    assert.ok(ladakhBikePhotos.some((photo) => photo.src === trip.photo.src))
    assert.equal(ladakhJourneyPhotos(trip).length, 4)
  }
  for (const trip of [...ladakhPackageJourneys, ...ladakhCabJourneys]) assert.ok(ladakhJourneyPhotos(trip).every((photo) => !photo.src.includes('ladakh-bike-')))
})

test('bike page loads all four supplied photos, detail covers and home preview without overflow', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  await page.route('**/api/**', (route) => route.fulfill({ status: 503, json: { error: 'Offline photo test' } }))
  try {
    for (const theme of ['light', 'dark']) {
      await page.goto(`${origin}/ladakh/bike-trips`)
      await page.evaluate((theme) => { document.documentElement.dataset.theme = theme }, theme)
      const gallery = page.getByRole('region', { name: 'Bike trip photo inspiration', exact: true })
      assert.equal(await gallery.locator('figure').count(), 4)
      assert.match(await gallery.innerText(), /not confirmed AVELOF departures/)
      for (const img of await gallery.locator('img').all()) {
        await img.evaluate((img) => { img.loading = 'eager' })
        await img.scrollIntoViewIfNeeded()
        await page.waitForFunction((src) => [...document.images].some((img) => img.getAttribute('src') === src && img.complete && img.naturalWidth > 0), await img.getAttribute('src'))
        await img.evaluate((img) => img.decode())
        assert.ok(await img.evaluate((img) => img.naturalWidth > 0))
      }
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      }
      assert.ok((await page.locator('.catalog-card .catalog-image img').evaluateAll((imgs) => imgs.map((img) => img.getAttribute('src')))).every((src) => src.includes('ladakh-bike-')))
    }
    for (const trip of ladakhBikeJourneys) {
      await page.goto(`${origin}/ladakh/bike-trips/${trip.id}`)
      assert.equal(await page.locator('.gallery-main').getAttribute('src'), trip.photo.src)
      assert.ok((await page.locator('.detail-gallery img').evaluateAll((imgs) => imgs.map((img) => img.getAttribute('src')))).every((src) => src.includes('ladakh-bike-')))
      assert.match(await page.locator('.package-image-note').innerText(), /locations unverified/)
    }
    await page.goto(`${origin}/ladakh`)
    assert.equal(await page.locator(`.ladakh-card img[src="${ladakhBikePhotos[0].src}"]`).count(), 1)
  } finally { await browser.close() }
})
