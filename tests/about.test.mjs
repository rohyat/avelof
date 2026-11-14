import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { business } from '../src/config.ts'

const origin = process.env.AVELOF_ABOUT_TEST_URL || 'http://localhost:8791'

test('about and contact presents a responsive brand story and direct contact without an enquiry form', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage()
  try {
    await page.goto(`${origin}/about`)
    await page.locator('.about-welcome h1').waitFor()
    assert.equal(await page.locator('main h1').count(), 1)
    assert.deepEqual(await page.locator('.about-service-grid a').evaluateAll((links) => links.map((link) => link.getAttribute('href'))), ['/hotels', '/car-rentals', '/tour-packages'])
    const contact = page.locator('#contact')
    assert.equal(await contact.locator('a[href^="tel:"]').getAttribute('href'), `tel:${business.phone.replace(/[^+\d]/g, '')}`)
    assert.equal(await contact.locator('a[href^="mailto:"]').getAttribute('href'), `mailto:${business.email}`)
    const whatsapp = new URL(await contact.locator('.contact-method[href^="https://wa.me"]').getAttribute('href'))
    assert.equal(whatsapp.pathname, `/${business.phone.replace(/\D/g, '')}`)
    assert.equal(await page.locator('.about-page form').count(), 0)
    assert.equal(await page.getByText('Send an enquiry', { exact: true }).count(), 0)
    assert.equal(await page.locator('.about-story-points li').count(), 3)
    assert.equal(await page.locator('.about-story-content > p').count(), 0, 'Brand story uses concise list items instead of introductory paragraphs')
    assert.deepEqual(await page.locator('.about-story-points h3').allTextContents(), ['Local Kashmir knowledge', 'A plan that fits you', 'Your journey, brought together'])
    assert.equal(await page.locator('#about-story-title').innerText(), 'Kashmir is our home.\nYour journey is personal.')
    assert.equal(await page.locator('.about-story-intro > p:not(.eyebrow)').innerText(), 'Local knowledge, thoughtful planning and a welcome that feels like Kashmir.')
    assert.equal(await page.getByRole('link', { name: 'Plan a trip', exact: true }).getAttribute('href'), '/#custom-trip')
    for (const width of [320, 390, 768, 820, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Page fits at ${width}px`)
      const headingLayout = await page.locator('.about-story-intro').evaluate((element) => {
        const icon = element.querySelector('.about-story-mark').getBoundingClientRect()
        const label = element.querySelector('.eyebrow').getBoundingClientRect()
        return {
          aligned: Math.abs(icon.y + icon.height / 2 - label.y - label.height / 2) < 1,
          beside: label.x >= icon.right,
          titleSize: parseFloat(getComputedStyle(element.querySelector('h2')).fontSize),
        }
      })
      assert.equal(headingLayout.aligned && headingLayout.beside, true, 'Icon aligns beside Meet AVELOF')
      assert.ok(headingLayout.titleSize >= 26 && headingLayout.titleSize <= 32, 'Title uses a balanced size')
      for (const card of await page.locator('.about-service-grid article, .contact-method, .about-story-intro, .about-story-content').all()) {
        assert.equal(await card.evaluate((element) => element.scrollWidth > element.clientWidth), false, `Card fits at ${width}px`)
      }
    }
    await page.getByRole('link', { name: 'Talk to our team', exact: true }).click()
    assert.equal(new URL(page.url()).hash, '#contact')
    await page.goto(`${origin}/contact`)
    await page.waitForURL(`${origin}/about#contact`)
    await contact.getByRole('heading', { name: 'A real conversation, with a local team.' }).waitFor()
    assert.equal(await page.getByRole('dialog').count(), 0, 'No receipt shown before submission')
  } finally { await browser.close() }
})
