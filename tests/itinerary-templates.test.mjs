import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createItineraryDraft } from '../src/data/itineraryBuilder.ts'
import { deleteItineraryTemplate, itineraryTemplatesKey, openItineraryTemplate, readItineraryTemplates, saveItineraryTemplate } from '../src/services/itineraryTemplates.ts'

function memoryStorage() {
  const data = new Map()
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
}
const draft = () => ({ ...createItineraryDraft(), guestName: 'Previous Guest', travelDate: '2026-12-01', roomsPerNight: 2, roomTypes: ['Double', 'Triple'], roomExtraBeds: [true, false], pricePerPerson: 12000, travellers: 4 })
test('10 local templates persist, remove guest identity and reopen with unchanged journey details', () => {
  const storage = memoryStorage()
  const input = draft()
  for (let i = 0; i < 10; i++) saveItineraryTemplate(storage, `Plan ${i}`, input)
  assert.equal(readItineraryTemplates(storage).length, 10)
  assert.ok(!storage.getItem(itineraryTemplatesKey).includes('Previous Guest'))
  assert.ok(!storage.getItem(itineraryTemplatesKey).includes('2026-12-01'))
  assert.throws(() => saveItineraryTemplate(storage, 'Eleventh', input), /10 templates/)
  const first = readItineraryTemplates(storage)[0]
  const opened = openItineraryTemplate(first)
  assert.equal(opened.guestName, '')
  assert.equal(opened.travelDate, '')
  for (const key of ['days', 'packageItems', 'hotelChoices', 'hotelNames', 'hotelPhotos', 'tips', 'roomsPerNight', 'roomTypes', 'roomExtraBeds', 'pricePerPerson', 'travellers']) assert.deepEqual(opened[key], input[key])
  opened.days[0].title = 'Changed'
  assert.notEqual(first.draft.days[0].title, opened.days[0].title)
  saveItineraryTemplate(storage, 'Updated', { ...input, pricePerPerson: 15000 }, first.id)
  assert.equal(readItineraryTemplates(storage)[0].draft.pricePerPerson, 15000)
  assert.equal(readItineraryTemplates(storage).length, 10)
  deleteItineraryTemplate(storage, first.id)
  assert.equal(readItineraryTemplates(storage).length, 9)
})
test('templates may save without a guest, but reject invalid journeys and corrupt or unavailable storage', () => {
  const storage = memoryStorage()
  assert.equal(saveItineraryTemplate(storage, 'Reusable', { ...draft(), guestName: '' }).length, 1)
  assert.throws(() => saveItineraryTemplate(storage, '', draft()))
  assert.throws(() => saveItineraryTemplate(storage, 'Bad', { ...draft(), days: [] }))
  storage.setItem(itineraryTemplatesKey, '{broken')
  assert.throws(() => readItineraryTemplates(storage))
  assert.throws(() => saveItineraryTemplate(storage, 'No overwrite', draft()))
  assert.equal(storage.getItem(itineraryTemplatesKey), '{broken')
  assert.throws(() => saveItineraryTemplate({ getItem: () => null, setItem: () => { throw new Error('Quota exceeded') } }, 'Unavailable', draft()), /Quota/)
})
