import assert from 'node:assert/strict'

export async function mockPartnerPhotos(page, count = 3, itemIds = []) {
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 20; canvas.height = 20
    const context = canvas.getContext('2d')
    context.fillStyle = '#305746'; context.fillRect(0, 0, 20, 20)
    return canvas.toDataURL('image/jpeg')
  })
  const requests = []
  await page.route('**/api/partner-photos', (route) => {
    assert.equal(route.request().method(), 'POST')
    assert.equal(new URL(route.request().url()).search, '')
    const input = route.request().postDataJSON()
    requests.push(input)
    return route.fulfill({ json: input.itemPhotos ? { itemPhotos: Object.fromEntries(itemIds.map((id) => [id, image])) } : { photos: Array(count).fill(image) } })
  })
  return requests
}
