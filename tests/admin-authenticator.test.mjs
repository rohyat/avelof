import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'

const baseUrl = process.env.AVELOF_ACTIVITY_TEST_URL || 'http://localhost:8791'

test('admin authenticator step keeps the dashboard private until verification and allows retry and back', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  let signedIn = false
  const attempts = []
  try {
    await page.route('**/api/enquiry-access**', (route) => {
      const request = route.request()
      if (request.method() === 'GET') return route.fulfill({
        status: signedIn ? 200 : 401,
        json: signedIn ? { enquiries: [], total: 0, page: 1, pageSize: 25 } : { error: 'Please sign in.' },
      })
      const body = request.postDataJSON()
      if (body.action === 'logout') { signedIn = false; return route.fulfill({ json: { signedOut: true } }) }
      attempts.push(body)
      if (!body.authenticatorCode) return route.fulfill({ json: { requiresAuthenticator: true } })
      if (body.authenticatorCode !== '123456') return route.fulfill({ status: 401, json: { error: 'Invalid or expired authenticator code. Use the current code from your app.' } })
      signedIn = true
      return route.fulfill({ json: { signedIn: true } })
    })
    await page.route('**/api/push', (route) => route.fulfill({ json: { available: false, publicKey: null, subscriptionCount: 0 } }))
    await page.goto(`${baseUrl}/admin/panel`)
    await page.getByLabel('Business phone number').fill('9876543210')
    await page.getByLabel('Password', { exact: true }).fill('Synthetic test passphrase')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await page.getByLabel('Authenticator code').waitFor()
    assert.equal(await page.getByRole('heading', { name: 'Enquiry dashboard' }).count(), 0)
    assert.equal(await page.locator('.admin-push-notifications').count(), 0)
    await page.getByLabel('Authenticator code').fill('111111')
    await page.getByRole('button', { name: 'Verify and sign in' }).click()
    await page.getByRole('alert').waitFor()
    assert.equal(await page.getByLabel('Authenticator code').inputValue(), '')
    await page.getByRole('button', { name: 'Back to password sign-in' }).click()
    assert.equal(await page.getByLabel('Password', { exact: true }).inputValue(), '')
    await page.getByLabel('Password', { exact: true }).fill('Synthetic test passphrase')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await page.getByLabel('Authenticator code').fill('123456')
    await page.getByRole('button', { name: 'Verify and sign in' }).click()
    await page.getByRole('heading', { name: 'Enquiry dashboard' }).waitFor()
    assert.equal(attempts.at(-1).authenticatorCode, '123456')
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await page.getByLabel('Password', { exact: true }).waitFor()
    assert.equal(await page.getByLabel('Password', { exact: true }).inputValue(), '')
    assert.equal(await page.getByLabel('Authenticator code').count(), 0)
  } finally { await browser.close() }
})

test('password-only login remains compatible until authenticator enrollment', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage()
  let signedIn = false
  try {
    await page.route('**/api/enquiry-access**', (route) => {
      if (route.request().method() === 'POST') { signedIn = true; return route.fulfill({ json: { signedIn: true } }) }
      return route.fulfill({ status: signedIn ? 200 : 401, json: signedIn
        ? { enquiries: [], total: 0, page: 1, pageSize: 25 } : { error: 'Please sign in.' } })
    })
    await page.route('**/api/push', (route) => route.fulfill({ json: { available: false, publicKey: null, subscriptionCount: 0 } }))
    await page.goto(`${baseUrl}/admin/panel`)
    await page.getByLabel('Business phone number').fill('9876543210')
    await page.getByLabel('Password', { exact: true }).fill('Synthetic test passphrase')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await page.getByRole('heading', { name: 'Enquiry dashboard' }).waitFor()
    assert.equal(await page.getByLabel('Authenticator code').count(), 0)
  } finally { await browser.close() }
})
