import assert from 'node:assert/strict'

export async function assertCentered(page, dialog) {
  const box = await dialog.boundingBox()
  const viewport = page.viewportSize()
  assert.ok(Math.abs(box.x + box.width / 2 - viewport.width / 2) < 2)
  assert.ok(Math.abs(box.y + box.height / 2 - viewport.height / 2) < 2)
  assert.ok(box.y >= 0 && box.y + box.height <= viewport.height)
}

export async function assertSaving(page, title) {
  const dialog = page.getByRole('dialog', { name: title, exact: true })
  await dialog.waitFor()
  await assertCentered(page, dialog)
  assert.equal(await dialog.locator('.registration-spinner').isVisible(), true)
  assert.equal(await page.locator('dialog.registration-success[open]').count(), 0)
  await page.keyboard.press('Escape')
  assert.equal(await dialog.isVisible(), true)
}

export async function dismissSubmission(page) {
  const dialog = page.getByRole('dialog', { name: 'Enquiry saved', exact: true })
  await dialog.waitFor()
  await assertCentered(page, dialog)
  await dialog.getByRole('button', { name: 'View submission details' }).click()
  await dialog.waitFor({ state: 'hidden' })
}
