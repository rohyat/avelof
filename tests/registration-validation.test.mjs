import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'

const origin = process.env.AVELOF_HOTEL_TEST_URL || 'http://localhost:8791'

test('all partner registrations mark required fields and show nearby feedback on blur and correction', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage()
  try {
    for (const [path, phoneName] of [['register-hotel', 'phone'], ['register-driver', 'phone'], ['register-business', 'contactPhone']]) {
      await page.goto(`${origin}/${path}`)
      const form = page.locator('form.validated-registration')
      await form.waitFor()
      assert.equal(await form.getByText('Fields marked', { exact: false }).count(), 1)
      const required = form.locator('input[required], select[required], textarea[required]')
      for (const field of await required.all()) {
        assert.ok(await field.evaluate((input) => getComputedStyle(input.closest('label'), '::after').content.includes('*')), 'Required field has a visible star')
      }
      const phone = form.locator(`[name=${phoneName}]`)
      await phone.fill('123')
      await phone.blur()
      const label = phone.locator('..')
      await label.locator('.registration-field-error').waitFor()
      assert.equal(await phone.getAttribute('aria-invalid'), 'true')
      assert.match(await label.locator('.registration-field-error').innerText(), /Indian phone number/)
      await phone.fill('9876543210')
      await phone.blur()
      assert.equal(await label.locator('.registration-field-error').count(), 0)
      assert.equal(await phone.getAttribute('aria-invalid'), 'false')
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${path} fits at ${width}px`)
      }
    }
    await page.goto(`${origin}/register-driver`)
    const age = page.locator('input[name=age]')
    await age.focus()
    await age.blur()
    await age.locator('../..').getByRole('alert').waitFor()
    await page.getByRole('button', { name: 'Increase Age (minimum 18)', exact: true }).click()
    assert.equal(await age.inputValue(), '19')
    await age.locator('../..').getByRole('alert').waitFor({ state: 'detached' })
    const number = page.locator('input[name=vehicleNumber]')
    for (const [input, expected] of [['JK13J7748', 'JK13J-7748'], ['JK 13 J 7748', 'JK13J-7748'], ['jk13j-7748', 'JK13J-7748'], ['DL01AB1234', 'DL01AB-1234'], ['pb 10 ab 5678', 'PB10AB-5678']]) {
      await number.fill(input)
      await number.blur()
      assert.equal(await number.inputValue(), expected)
      assert.equal(await number.getAttribute('aria-invalid'), 'false')
    }
    await number.fill('JK13J77')
    await number.blur()
    await number.locator('..').getByRole('alert').waitFor()
    await page.goto(`${origin}/register-business`)
    const email = page.locator('[name=contactEmail]')
    await email.fill('not-an-email')
    await email.blur()
    assert.equal(await email.getAttribute('aria-invalid'), 'true')
    await email.fill('owner@example.com')
    await email.blur()
    assert.equal(await email.getAttribute('aria-invalid'), 'false')
  } finally { await browser.close() }
})
