import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium, webkit, devices } from 'playwright'

const baseUrl = process.env.AVELOF_ACTIVITY_TEST_URL || 'http://localhost:8791'

test('public app registers its worker and advertises versioned Chinar icons', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage()
  try {
    await page.goto(baseUrl)
    const worker = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready
      return registration.active.scriptURL
    })
    assert.equal(new URL(worker).pathname, '/sw.js')
    const response = await page.request.get(new URL('/manifest.webmanifest', baseUrl).href)
    assert.equal(response.status(), 200)
    const manifest = await response.json()
    assert.equal(manifest.id, '/')
    assert.equal(manifest.display, 'standalone')
    for (const icon of manifest.icons) {
      assert.ok(icon.src.includes('?v=chinar-1'))
      const image = await page.evaluate(async (src) => {
        const image = new Image()
        image.src = src
        await image.decode()
        return `${image.naturalWidth}x${image.naturalHeight}`
      }, icon.src)
      assert.equal(image, icon.sizes)
    }
    for (const rel of ['icon', 'apple-touch-icon']) {
      assert.ok((await page.locator(`link[rel="${rel}"]`).getAttribute('href')).includes('?v=chinar-1'))
    }
    const workerSource = await (await page.request.get(worker)).text()
    assert.ok(workerSource.includes("icon: '/app-icon-192.png?v=chinar-1'"))
    assert.ok(workerSource.includes("badge: '/app-icon-192.png?v=chinar-1'"))
  } finally { await browser.close() }
})

test('install prompt handles acceptance, cancellation, errors and completed installation', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/local-trips`)
    await page.getByRole('button', { name: 'Install app', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.waitFor()
    assert.equal(new URL(page.url()).pathname, '/local-trips')
    for (const outcome of ['accepted', 'dismissed', 'error']) {
      await page.evaluate((outcome) => {
        const event = new Event('beforeinstallprompt', { cancelable: true })
        event.prompt = async () => {
          if (outcome === 'error') throw new Error('Test prompt failure')
        }
        event.userChoice = Promise.resolve({ outcome })
        window.dispatchEvent(event)
        if (!event.defaultPrevented) throw new Error('Install event was not captured')
      }, outcome)
      await dialog.getByRole('button', { name: 'Install AVELOF', exact: true }).click()
      const message = outcome === 'accepted' ? 'Installation requested.'
        : outcome === 'dismissed' ? 'Installation cancelled.' : 'The install prompt could not open.'
      await page.waitForFunction((message) => document.querySelector('[role="status"]')?.textContent.includes(message), message)
      assert.equal(await dialog.getByRole('button', { name: 'Install AVELOF', exact: true }).count(), 0)
    }
    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')))
    await dialog.getByRole('heading', { name: 'AVELOF is installed' }).waitFor()
    await page.keyboard.press('Escape')
    assert.equal(await dialog.isVisible(), false)
    assert.equal(await page.getByRole('button', { name: 'App installed', exact: true }).evaluate((button) => button === document.activeElement), true)
  } finally { await browser.close() }
})

test('mobile browsers without an install prompt show usable instructions and the new logo', async () => {
  for (const profile of [
    { engine: webkit, options: {}, device: devices['iPhone 14'], apple: true },
    { engine: chromium, options: { channel: 'msedge' }, device: devices['Pixel 7'], apple: false },
    { engine: webkit, options: {}, device: { viewport: { width: 768, height: 1024 }, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15', hasTouch: true }, apple: true },
  ]) {
    const browser = await profile.engine.launch({ ...profile.options, headless: true })
    const context = await browser.newContext(profile.device)
    const page = await context.newPage()
    try {
      if (profile.apple) await page.addInitScript(() => {
        Object.defineProperty(navigator, 'platform', { value: /Macintosh/.test(navigator.userAgent) ? 'MacIntel' : 'iPhone' })
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 5 })
      })
      // Simulate setup failure separately from the real registration test above.
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'serviceWorker', {
          value: { register: async () => { throw new Error('Test registration failure') } },
        })
      })
      await page.goto(`${baseUrl}/local-trips`)
      await page.getByRole('button', { name: 'Install app', exact: true }).click()
      const dialog = page.getByRole('dialog')
      await dialog.waitFor()
      assert.ok((await dialog.innerText()).includes(profile.apple ? 'Add to Home Screen' : 'Add to Home screen'))
      assert.ok((await dialog.innerText()).includes(profile.apple ? 'Safari' : 'Samsung Internet'))
      await dialog.getByRole('alert').waitFor()
      assert.equal(new URL(page.url()).pathname, '/local-trips')
      assert.ok(await dialog.locator('.install-logo').evaluate((image) => image.complete && image.naturalWidth === 192))
      const bounds = await dialog.boundingBox()
      const viewport = page.viewportSize()
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width)
      assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= viewport.height)
      assert.equal(await dialog.evaluate((element) => element.scrollWidth > element.clientWidth), false)
      await dialog.getByRole('button', { name: 'Close app installation' }).click()
      assert.equal(await dialog.isVisible(), false)
    } finally { await browser.close() }
  }
})
