import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { destinationOptions } from '../src/data/destinationOptions.ts'
import { activitiesForPlaces } from '../src/data/activities.ts'
import { parseRecentPlaceSearches, recentPlaceSearchesKey, searchPlaceSuggestions } from '../src/services/destinationSearch.ts'

const origin = process.env.AVELOF_HOTEL_TEST_URL || 'http://localhost:8791'

test('place suggestions complete partial names and common misspellings with their parent destinations', () => {
  assert.deepEqual(searchPlaceSuggestions('g'), [])
  assert.equal(searchPlaceSuggestions('gu')[0].label, 'Gulmarg')
  for (const [query, label, parent] of [
    ['gu', 'Gulmarg', 'gulmarg'],
    ['chan', 'Chandanwari', 'pahalgam'],
    ['chandwani', 'Chandanwari', 'pahalgam'],
    ['ddrun', 'Drung Waterfall', 'gulmarg'],
    ['drunk', 'Drung Waterfall', 'gulmarg'],
    ['yousmarg', 'Yusmarg', 'yusmarg'],
  ]) {
    const matches = searchPlaceSuggestions(query)
    assert.ok(matches.slice(0, 8).some((item) => item.label === label && item.destinationId === parent), query)
  }
  assert.deepEqual(parseRecentPlaceSearches('["gulmarg", "invalid", "gulmarg"]' ).map((item) => item.id), ['gulmarg'])
})

test('search supports keyboard, touch, parent destinations and browser-local recent history', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  try {
    await page.goto(`${origin}/destinations`)
    const search = page.getByRole('combobox', { name: 'Search places or attractions' })
    await search.fill('g')
    assert.equal(await page.getByRole('listbox').count(), 0)
    await search.fill('gu')
    await page.getByRole('option', { name: 'Gulmarg', exact: true }).waitFor()
    await search.press('ArrowDown')
    assert.ok(await search.getAttribute('aria-activedescendant'))
    await search.press('Enter')
    assert.equal(await search.inputValue(), 'Gulmarg')
    assert.equal(await page.locator('.place-entry').count(), 1)
    await page.waitForFunction(() => document.activeElement?.id === 'place-gulmarg')
    await search.fill('chan')
    const chandanwari = page.getByRole('option', { name: /Chandanwari.*In Pahalgam/ })
    await chandanwari.tap()
    assert.equal(await search.inputValue(), 'Chandanwari')
    await page.getByRole('article', { name: 'Pahalgam', exact: true }).waitFor()
    assert.equal(await page.locator('.place-entry').count(), 1)
    await search.fill('DDRUn')
    await page.getByRole('option', { name: /Drung Waterfall.*In Gulmarg/ }).tap()
    await page.getByRole('article', { name: 'Gulmarg', exact: true }).waitFor()
    assert.equal(await page.locator('.place-entry').count(), 1)
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await search.fill('ch')
      await page.getByRole('listbox').waitFor()
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    }
    await page.reload()
    await search.click()
    await page.getByText('Recent searches', { exact: true }).waitFor()
    assert.equal(await page.getByRole('option', { name: 'Gulmarg', exact: true }).count(), 1)
    await page.getByRole('option', { name: 'Gulmarg', exact: true }).tap()
    assert.equal(await page.locator('.place-entry').count(), 1)
    const ids = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), recentPlaceSearchesKey)
    assert.deepEqual(ids, ['gulmarg', 'gulmarg:Drung Waterfall', 'pahalgam:Chandanwari'])
    await search.fill('')
    await page.getByRole('button', { name: 'Clear history' }).click()
    assert.equal(await page.getByRole('listbox').count(), 0)
    await page.reload()
    await search.click()
    assert.equal(await page.getByRole('listbox').count(), 0)
    await search.fill('chan')
    await search.press('Escape')
    assert.equal(await page.getByRole('listbox').count(), 0)
    await search.press('ArrowDown')
    await page.getByRole('listbox').waitFor()
    assert.equal(await search.getAttribute('aria-expanded'), 'true')
    await page.getByRole('button', { name: 'Search places', exact: true }).click()
    await page.getByRole('article', { name: 'Pahalgam', exact: true }).waitFor()
  } finally { await browser.close() }
})

test('blocked browser storage reports history errors without blocking place searches', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage()
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Storage blocked', 'SecurityError') }
  })
  try {
    await page.goto(`${origin}/destinations`)
    const search = page.getByRole('combobox', { name: 'Search places or attractions' })
    await search.fill('chan')
    await search.press('Enter')
    await page.getByRole('article', { name: 'Pahalgam', exact: true }).waitFor()
    await page.getByRole('alert').filter({ hasText: 'Your browser could not save recent searches' }).waitFor()
  } finally { await browser.close() }
})

test('all destination guides use five highlights and the same guide sections without a separate visit form', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage()
  try {
    await page.goto(`${origin}/destinations`)
    await page.locator('.place-entry').first().waitFor()
    assert.equal(await page.locator('.place-entry').count(), destinationOptions.length)
    assert.equal(await page.locator('main form, main input[type=checkbox], #visit-planner').count(), 0)
    assert.equal(await page.getByText('Plan your visit.', { exact: true }).count(), 0)
    for (const place of destinationOptions) {
      assert.equal(place.attractions.length, 5, `${place.name} has five main highlights`)
      const card = page.getByRole('article', { name: place.name, exact: true })
      assert.equal(await card.locator('.place-attractions li').count(), 5)
      assert.deepEqual(await card.locator('h3').allTextContents(), [' Main attractions', ' Activities & experiences', ' Before you go'])
      assert.equal(await card.getByRole('link', { name: 'Customise your trip' }).getAttribute('href'), '/#custom-trip')
      const activities = activitiesForPlaces([place.id])
      assert.equal(await card.locator('.place-experiences li').count(), activities.length)
      for (const activity of activities) {
        assert.equal(await card.getByRole('heading', { name: activity.name, exact: true }).count(), 1)
        assert.ok((await card.locator('.place-experiences').innerText()).includes(activity.note))
      }
      if (!activities.length) assert.match(await card.locator('.place-experiences').innerText(), /No paid activities for this place are currently listed/)
    }
    for (const width of [320, 390, 768, 1060, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Guide fits at ${width}px`)
    }
    await page.getByLabel('Search places or attractions').fill('Yousmarg')
    assert.equal(await page.locator('.place-entry').count(), 1)
    await page.getByRole('heading', { name: 'Yusmarg', exact: true }).waitFor()
    await page.getByLabel('Search places or attractions').fill('skiing')
    await page.getByRole('heading', { name: 'Gulmarg', exact: true }).waitFor()
    assert.equal(await page.getByLabel('One-way drive').count(), 0)
    assert.equal(await page.getByText('Starting from central Srinagar', { exact: true }).count(), 0)
    await page.getByLabel('Search places or attractions').fill('zzzzzzzzzz')
    await page.getByRole('heading', { name: 'No places match' }).waitFor()
    await page.getByRole('button', { name: 'Clear search' }).click()
    assert.equal(await page.locator('.place-entry').count(), destinationOptions.length)
    await page.getByRole('article', { name: 'Yusmarg', exact: true }).getByRole('link', { name: 'Customise your trip' }).click()
    await page.getByLabel('Start date').waitFor()
    assert.equal(new URL(page.url()).hash, '#custom-trip')
  } finally { await browser.close() }
})

test('destination customise links preserve the originating planner and its choices', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.route('**/api/hotels*', (route) => route.fulfill({ json: { hotels: [], total: 0, page: 1, pageSize: 25 } }))
  try {
    for (const path of ['/', '/tour-packages']) {
      await page.goto(`${origin}${path}`)
      const planner = page.locator('.trip-planner')
      await planner.getByLabel('Start date').fill('2027-01-10')
      await planner.getByLabel('End date').fill('2027-01-16')
      await planner.getByRole('button', { name: 'Next: places' }).click()
      await planner.locator('.planner-place-card').filter({ hasText: 'Yusmarg' }).getByRole('checkbox').check()
      await planner.locator('.planner-place-card').filter({ hasText: 'Yusmarg' }).getByRole('link', { name: 'View this place' }).click()
      const link = page.getByRole('article', { name: 'Yusmarg', exact: true }).getByRole('link', { name: 'Customise your trip' })
      assert.equal(await link.getAttribute('href'), path === '/' ? '/#custom-trip' : '/tour-packages#package-planner')
      await link.click()
      const selectedPlace = planner.locator('.planner-place-card').filter({ hasText: 'Yusmarg' })
      await selectedPlace.waitFor()
      assert.equal(await selectedPlace.getByRole('checkbox').isChecked(), true)
      assert.equal(await planner.locator('.planner-steps [aria-current=step] .planner-step-label').innerText(), 'Places')
    }
  } finally { await browser.close() }
})
