import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'

const baseUrl = process.env.AVELOF_ACTIVITY_TEST_URL || 'http://localhost:8791'
const publicKey = Buffer.alloc(65, 1).toString('base64url')

async function mockDevice(page, { permission = 'default', subscribed = false, registrationFails = false } = {}) {
  await page.addInitScript(({ permission, subscribed, registrationFails, publicKey }) => {
    const state = { permission, subscribed, registrationFails, permissionChoice: 'granted', requested: 0, subscriptions: 0, ready: false }
    window.notificationTest = state
    Object.defineProperty(window, 'Notification', { value: {
      get permission() { return state.permission },
      async requestPermission() { state.requested++; state.permission = state.permissionChoice; return state.permission },
    } })
    Object.defineProperty(window, 'PushManager', { value: function PushManager() {} })
    const key = Uint8Array.from(atob(publicKey.replaceAll('-', '+').replaceAll('_', '/')), (char) => char.charCodeAt(0)).buffer
    const subscription = {
      endpoint: 'https://push.example.test/test-device',
      options: { applicationServerKey: key },
      toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'p'.repeat(65), auth: 'a'.repeat(22) } } },
      async unsubscribe() { state.subscribed = false; return true },
    }
    const worker = { pushManager: {
      async getSubscription() {
        if (!state.ready) throw new Error('Worker is not ready')
        return state.subscribed ? subscription : null
      },
      async subscribe() {
        if (!state.ready) throw new Error('Worker is not ready')
        state.subscriptions++
        state.subscribed = true
        return subscription
      },
    } }
    Object.defineProperty(navigator, 'serviceWorker', { value: {
      async register() {
        if (state.registrationFails) throw new Error('Test setup failure')
        return worker
      },
      get ready() { return new Promise((resolve) => setTimeout(() => { state.ready = true; resolve(worker) }, 150)) },
    } })
  }, { permission, subscribed, registrationFails, publicKey })
  await page.route('**/api/enquiry-access?**', (route) => route.fulfill({
    json: { enquiries: [], total: 0, page: 1, pageSize: 25 },
  }))
  const requests = []
  let testStatus = 200
  await page.route('**/api/push', (route) => {
    const request = route.request()
    if (request.method() === 'GET') return route.fulfill({ json: { available: true, publicKey, subscriptionCount: 0 } })
    const body = request.postDataJSON()
    requests.push(body)
    if (body.action === 'test') return route.fulfill({
      status: testStatus, json: testStatus === 200 ? { sent: true } : { error: 'This device subscription is missing or expired. Enable alerts on this device again.' },
    })
    return route.fulfill({ json: { enabled: body.action === 'subscribe', subscriptionCount: body.action === 'subscribe' ? 1 : 0 } })
  })
  return { requests, expireTest: () => { testStatus = 409 } }
}

test('owner can enable after reinstall, send a test, recover expiry and disable without changing app launch', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  try {
    const mock = await mockDevice(page)
    await page.goto(baseUrl)
    await page.getByRole('button', { name: 'Open menu', exact: true }).click()
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Admin sign-in', exact: true }).click()
    assert.equal(new URL(page.url()).pathname, '/admin/panel')
    assert.equal(await page.getByRole('button', { name: 'Open menu', exact: true }).getAttribute('aria-expanded'), 'false')
    const panel = page.getByRole('region', { name: 'Mobile notifications' })
    await panel.getByRole('button', { name: 'Enable on this device', exact: true }).click()
    await panel.getByRole('button', { name: 'Send test notification' }).waitFor()
    assert.equal(await page.evaluate(() => notificationTest.requested), 1)
    assert.equal(mock.requests.filter((item) => item.action === 'subscribe').length, 1)
    await panel.getByRole('button', { name: 'Send test notification' }).click()
    await page.waitForFunction(() => document.querySelector('.admin-push-copy [role="status"]').textContent.includes('Test sent'))
    assert.equal(mock.requests.at(-1).endpoint, 'https://push.example.test/test-device')
    mock.expireTest()
    await panel.getByRole('button', { name: 'Send test notification' }).click()
    await panel.getByRole('button', { name: 'Enable on this device', exact: true }).waitFor()
    await panel.getByRole('button', { name: 'Enable on this device', exact: true }).click()
    await panel.getByRole('button', { name: 'Disable on this device' }).click()
    await panel.getByRole('button', { name: 'Enable on this device', exact: true }).waitFor()
    assert.equal(mock.requests.at(-1).action, 'unsubscribe')
    await panel.getByText('Phone setup & troubleshooting', { exact: true }).click()
    assert.ok((await panel.innerText()).includes('Installing the app still opens the homepage'))
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    const manifest = await (await page.request.get(`${baseUrl}/manifest.webmanifest`)).json()
    assert.equal(manifest.start_url, '/')
    await page.goto(new URL(manifest.start_url, baseUrl).href)
    assert.equal(new URL(page.url()).pathname, '/')
    assert.equal(await page.locator('.admin-push-notifications').count(), 0)
    await page.locator('.site-footer').getByRole('link', { name: 'Admin sign-in', exact: true }).click()
    await page.getByRole('region', { name: 'Mobile notifications' }).waitFor()
    assert.equal(new URL(page.url()).pathname, '/admin/panel')
  } finally { await browser.close() }
})

test('blocked permission can be rechecked after changing settings without automatically prompting', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage()
  try {
    await mockDevice(page, { permission: 'denied' })
    await page.goto(`${baseUrl}/admin/panel`)
    const panel = page.getByRole('region', { name: 'Mobile notifications' })
    await page.waitForFunction(() => document.querySelector('.admin-push-copy [role="status"]')?.textContent.includes('Notifications are blocked'))
    assert.equal(await panel.getByRole('button', { name: 'Enable on this device', exact: true }).count(), 0)
    await page.evaluate(() => { notificationTest.permission = 'granted' })
    await panel.getByRole('button', { name: 'Recheck notification settings' }).click()
    await panel.getByRole('button', { name: 'Enable on this device', exact: true }).waitFor()
    assert.equal(await page.evaluate(() => notificationTest.requested), 0)
    await page.evaluate(() => { notificationTest.permissionChoice = 'default' })
    await panel.getByRole('button', { name: 'Enable on this device', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.admin-push-copy [role="status"]').textContent.includes('Permission was not granted'))
    assert.equal(await panel.getByRole('button', { name: 'Enable on this device', exact: true }).count(), 1)
  } finally { await browser.close() }
})

test('registration failure is retryable and an existing device subscription is restored server-side', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage()
  try {
    const mock = await mockDevice(page, { permission: 'granted', subscribed: true, registrationFails: true })
    await page.goto(`${baseUrl}/admin/panel`)
    const panel = page.getByRole('region', { name: 'Mobile notifications' })
    await page.waitForFunction(() => document.querySelector('.admin-push-copy [role="status"]')?.textContent.includes('could not be loaded'))
    await page.evaluate(() => { notificationTest.registrationFails = false })
    await panel.getByRole('button', { name: 'Recheck notification settings' }).click()
    await panel.getByRole('button', { name: 'Send test notification' }).waitFor()
    assert.ok(mock.requests.some((item) => item.action === 'subscribe'))
    assert.equal(await page.evaluate(() => notificationTest.requested), 0)
  } finally { await browser.close() }
})
