import assert from 'node:assert/strict'
import { test } from 'node:test'
import { destinations } from '../src/data/catalog.ts'

test('Wular has a distinct illustrative photo without changing Manasbal', () => {
  const wular = destinations.find((place) => place.id === 'wular')
  const manasbal = destinations.find((place) => place.id === 'manasbal')
  const srinagar = destinations.find((place) => place.id === 'srinagar')
  assert.ok(wular && manasbal && srinagar)
  assert.notEqual(wular.image, manasbal.image)
  assert.notEqual(wular.image, srinagar.image)
  assert.equal(manasbal.image, srinagar.image)
  assert.equal(wular.photoIsUserProvided, undefined)
  assert.equal(wular.photoCredit, undefined)
  assert.equal(wular.additionalPhotos, undefined)
})
