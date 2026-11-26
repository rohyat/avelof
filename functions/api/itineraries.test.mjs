import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { onRequest } from './itineraries.ts'
import { createAdminSession, hashText } from '../_lib/enquiryAccess.ts'

test('itinerary access checks are private and all storage methods are permanently disabled without DB access', async () => {
  const env = {
    ENQUIRY_ACCESS_SECRET: 'test-secret-with-more-than-thirty-two-characters',
    ENQUIRY_ADMIN_CODE_HASH: await hashText('123456789012345678901234567890123456789012345678'),
    DB: { prepare() { throw new Error('Itinerary endpoint must never access the database') } },
  }
  const token = await createAdminSession(env)
  async function request(method, anonymous = false) {
    return onRequest({ env, request: new Request('https://avelof.test/api/itineraries', {
      method, headers: anonymous ? {} : { Cookie: `__Host-avelof_admin=${token}` },
      ...(method === 'GET' ? {} : { body: '{"guestName":"Must never be stored"}' }),
    }) })
  }
  for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal((await request(method, true)).status, 401)
    const response = await request(method)
    assert.equal(response.status, method === 'GET' ? 200 : 410)
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
    if (method === 'GET') assert.deepEqual(await response.json(), { authorized: true, storage: false })
  }
})

test('migration removes existing itinerary records/table without touching other data', () => {
  const sqlite = new DatabaseSync(':memory:')
  try {
    sqlite.exec(readFileSync(new URL('../../migrations/0028_itinerary_drafts.sql', import.meta.url), 'utf8'))
    sqlite.exec("INSERT INTO itinerary_drafts VALUES ('test',0,'{}','today'); CREATE TABLE unrelated (id INTEGER); INSERT INTO unrelated VALUES (1)")
    sqlite.exec(readFileSync(new URL('../../migrations/0029_remove_itinerary_drafts.sql', import.meta.url), 'utf8'))
    assert.equal(sqlite.prepare("SELECT count(*) AS count FROM sqlite_master WHERE name='itinerary_drafts'").get().count, 0)
    assert.equal(sqlite.prepare('SELECT count(*) AS count FROM unrelated').get().count, 1)
  } finally { sqlite.close() }
})
