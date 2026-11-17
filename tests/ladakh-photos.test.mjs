import assert from 'node:assert/strict'
import { statSync } from 'node:fs'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { ladakhPhotos } from '../src/data/ladakhPhotos.ts'
import { brandPromises } from '../src/data/brandPromises.ts'

const origin = process.env.AVELOF_NAVIGATION_TEST_URL || 'http://127.0.0.1:8792'

test('all eleven shared photos have bounded local images and explicit uncertain-location captions', () => {
  assert.equal(ladakhPhotos.length, 11)
  assert.equal(new Set(ladakhPhotos.map((photo) => photo.src)).size, 11)
  assert.equal(ladakhPhotos.filter((photo) => photo.unverified).length, 6)
  for (const photo of ladakhPhotos) {
    assert.ok(statSync(new URL(`../public${photo.src}`, import.meta.url)).size < 300000)
    if (photo.unverified) assert.match(photo.note, /unverified/i)
  }
})

test('Ladakh pages share Kashmir call help, display photo collections and retain responsive layouts', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  await page.route('**/api/**', (route) => route.fulfill({ status: 503, json: { error: 'Offline photo test' } }))
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  try {
    await page.goto(origin)
    const kashmirTile = page.locator('.home-shortcuts .home-call-tile')
    const expectedCopy = await kashmirTile.locator('.home-call-copy > span').innerText()
    const expectedPhone = await kashmirTile.getAttribute('href')
    const callStyles = (tile) => tile.evaluate((el) => {
      const style = getComputedStyle(el)
      const headline = getComputedStyle(el.querySelector('.home-call-copy > span'))
      return { display: style.display, padding: style.padding, gap: style.gap, background: style.backgroundImage, radius: style.borderRadius, headlineSize: headline.fontSize, headlineHeight: headline.lineHeight, height: el.getBoundingClientRect().height }
    })
    const expectedStyles = new Map()
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      expectedStyles.set(width, await callStyles(kashmirTile))
    }
    for (const path of ['', '/places', '/packages', '/bike-trips', '/car-rentals', '/hotels', '/drivers', '/contact', '/travel-guide', '/experiences']) {
      await page.goto(`${origin}/ladakh${path}`)
      const tile = page.locator('.home-call-tile').first()
      assert.equal(await tile.getAttribute('href'), expectedPhone)
      assert.equal(await tile.locator('.home-call-copy > span').innerText(), expectedCopy)
      assert.deepEqual(await tile.locator('.hero-trust-points li span').allTextContents(), [...brandPromises])
      const gallery = page.locator('.ladakh-photo-collection')
      assert.equal(await gallery.count(), 1)
      const full = path === '' || path === '/places'
      assert.equal(await gallery.locator('figure').count(), full ? 11 : 3)
      assert.equal(await gallery.getByText('Location unverified', { exact: true }).count(), full ? 6 : 0)
      if (!full) assert.equal(await gallery.getByRole('link').getAttribute('href'), '/ladakh/places#photo-inspiration')
      for (const theme of ['light', 'dark']) {
        await page.evaluate((theme) => { document.documentElement.dataset.theme = theme }, theme)
        for (const width of [320, 390, 768, 1440]) {
          await page.setViewportSize({ width, height: 900 })
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${path}/${theme}/${width}: no overflow`)
          assert.equal(await tile.evaluate((el) => el.scrollWidth <= el.clientWidth), true)
          if (path === '') assert.deepEqual(await callStyles(tile), expectedStyles.get(width), `Ladakh home call-help matches Kashmir at ${width}px`)
        }
      }
      if (path === '/places') {
        for (const image of await gallery.locator('img').all()) {
          await image.scrollIntoViewIfNeeded()
          await image.evaluate((img) => img.decode())
          assert.ok(await image.evaluate((img) => img.naturalWidth > 0))
        }
      }
    }
    await page.locator('.ladakh-photo-collection').getByRole('link').click()
    await page.waitForURL(`${origin}/ladakh/places#photo-inspiration`)
    await page.locator('#photo-inspiration').waitFor()
    await page.goto(`${origin}/jammu/drivers`)
    assert.equal(await page.locator('.home-call-tile .hero-trust-points').count(), 0)
    assert.equal(await page.locator('.ladakh-photo-collection').count(), 0)
    assert.deepEqual(errors, [])
  } finally { await browser.close() }
})
