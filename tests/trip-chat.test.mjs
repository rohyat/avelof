import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { getTripChatReply } from '../src/services/tripChatService.ts'

const origin = process.env.AVELOF_TRIP_CHAT_TEST_URL || 'http://localhost:8792'

test('trip chat replies from the published catalog', () => {
  assert.match(getTripChatReply('What should I know about Pahalgam?'), /90-100 km/)
  assert.match(getTripChatReply('What can I see in Pahalgam?'), /Aru Valley/)
  assert.match(getTripChatReply('Show hotels in Srinagar'), /Hotel Royal Imsar/)
  assert.match(getTripChatReply('What cars are available?'), /Tempo Traveller 12-seater/)
  assert.match(getTripChatReply('Suggest a 5-day trip'), /Day 01: Arrive in Srinagar/)
  assert.match(getTripChatReply('Compare tour packages'), /Deluxe: 4 nights/)
  assert.match(getTripChatReply('Compare tour packages'), /Premium: 5 nights/)
})

test('trip chat renders a local answer without an API request or mobile overflow', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    let chatRequests = 0
    await page.route('**/api/ask-ai', async (route) => {
      chatRequests++
      await route.abort()
    })
    try {
      await page.goto(origin)
      const launcher = page.getByRole('button', { name: 'Ask AVELOF' })
      assert.equal(await launcher.isVisible(), true)
      assert.equal(await page.locator('.floating-enquiry').count(), 0)
      assert.equal(await launcher.evaluate((button) => getComputedStyle(button).fontWeight), '700')
      await launcher.click()
      await page.getByText('Messages aren’t sent to an AI provider or saved by AVELOF.', { exact: false }).waitFor()
      const helpLink = page.getByRole('link', { name: 'Contact us' })
      assert.equal(await helpLink.isVisible(), true)
      assert.equal(await helpLink.getAttribute('href'), '/contact')
      assert.ok(await helpLink.evaluate((link) => link.compareDocumentPosition(link.closest('.trip-chat-panel').querySelector('.trip-chat-form')) & Node.DOCUMENT_POSITION_PRECEDING))
      await page.getByLabel('Your question').fill('What should I know about Pahalgam?')
      await page.getByRole('button', { name: 'Send question' }).click()
      const reply = page.getByText(/From Srinagar: 90-100 km/)
      await reply.waitFor()
      assert.equal(chatRequests, 0)
      assert.equal(await reply.locator('script').count(), 0)
      assert.equal(await page.locator('html').evaluate(node => node.scrollWidth > node.clientWidth), false)
    } finally { await page.close() }
  } finally { await browser.close() }
})