import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'

const origin = process.env.AVELOF_HOTEL_TEST_URL || 'http://127.0.0.1:8792'

test('partner edit links stay below registration buttons and form headers are compact and readable', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage()
  await page.addInitScript(() => { if (!localStorage.getItem('avelof:theme')) localStorage.setItem('avelof:theme', 'light') })
  await page.route('**/api/pricing', (route) => route.fulfill({ json: { discountPercent: 23, version: 1 } }))
  try {
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`${origin}/partners`)
      const groups = page.locator('.partner-options .partner-edit-action')
      assert.equal(await groups.count(), 3)
      for (const [index, kind] of ['hotel', 'driver', 'business'].entries()) {
        const links = groups.nth(index).getByRole('link')
        assert.equal(await links.nth(0).getAttribute('href'), `/register-${kind}`)
        assert.equal(await links.nth(1).getAttribute('href'), `/${kind}-status`)
        assert.equal(await links.nth(1).textContent(), 'Edit your details ')
        const register = await links.nth(0).boundingBox()
        const edit = await links.nth(1).boundingBox()
        assert.ok(edit.y >= register.y + register.height)
      }
      assert.equal(await page.locator('.home-call-tile').count(), 1)
      for (const kind of ['hotel', 'driver']) {
        await page.goto(`${origin}/register-${kind}`)
        const hero = page.locator('.partner-registration-hero')
        assert.equal(await hero.locator('h1').textContent(), kind === 'hotel' ? 'Register your hotel or houseboat' : 'Register as a driver')
        assert.equal(await hero.locator('p, .partner-edit-action').count(), 0)
        assert.equal(await hero.getByText('Reviewed before going live', { exact: true }).count(), 1)
        assert.equal(await page.locator('.partner-registration-guide ol li').count(), 3)
        assert.ok((await hero.boundingBox()).height < 180)
        await page.getByRole('switch', { name: 'Dark mode', exact: true }).click()
        const contrast = await hero.evaluate((element) => {
          const luminance = (color) => {
            const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map((value) => {
              const s = value / 255
              return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4
            })
            return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722
          }
          const background = luminance('rgb(32, 59, 53)')
          return ['h1', '.partner-review-badge'].map((selector) => {
            const foreground = luminance(getComputedStyle(element.querySelector(selector)).color)
            return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05)
          })
        })
        assert.ok(contrast.every((ratio) => ratio >= 4.5), `Dark header contrast: ${contrast}`)
        assert.equal(await hero.evaluate((element) => getComputedStyle(element).backgroundImage), 'linear-gradient(120deg, rgb(32, 59, 53), rgb(28, 48, 44))')
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
        await page.getByRole('switch', { name: 'Dark mode', exact: true }).click()
      }
      await page.goto(`${origin}/register-business`)
      assert.equal(await page.getByRole('link', { name: 'Edit your details', exact: true }).count(), 0)
    }
  } finally { await browser.close() }
})
