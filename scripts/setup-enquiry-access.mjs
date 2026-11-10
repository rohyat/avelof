import { randomBytes, randomInt, randomUUID, createHash } from 'node:crypto'
import { appendFile, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { parseEnv } from 'node:util'
import assert from 'node:assert/strict'
import { business } from '../src/config.ts'
import { adminCookie, createAdminSession } from '../functions/_lib/enquiryAccess.ts'

const codePath = resolve('.avelof-admin.local')
const variablesPath = resolve('.dev.vars')

async function optionalRead(path) {
  try { return await readFile(path, 'utf8') } catch (error) {
    if (error.code === 'ENOENT') return ''
    throw new Error('Could not read the local access settings.')
  }
}

async function main() {
  const existingText = await optionalRead(variablesPath)
  const existing = parseEnv(existingText)
  const savedCode = (await optionalRead(codePath)).trim()
  const passwordConfigured = /^pbkdf2_sha256\$100000\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(existing.ENQUIRY_ADMIN_CODE_HASH ?? '')
  if (existing.ENQUIRY_ADMIN_CODE_HASH && !savedCode && !passwordConfigured) throw new Error('Admin hash already exists but its private local code file is missing. Restore your code file instead of silently rotating credentials.')
  const adminCode = passwordConfigured ? '' : savedCode || Array.from({ length: 48 }, () => String(randomInt(10))).join('')
  if (!passwordConfigured && !/^\d{48}$/.test(adminCode)) throw new Error('The local admin code must contain exactly 48 digits.')
  const adminHash = passwordConfigured ? existing.ENQUIRY_ADMIN_CODE_HASH : createHash('sha256').update(adminCode).digest('hex')
  if (!passwordConfigured && existing.ENQUIRY_ADMIN_CODE_HASH && existing.ENQUIRY_ADMIN_CODE_HASH !== adminHash) throw new Error('The local admin code does not match the configured hash.')
  const settings = {
    ENQUIRY_ACCESS_SECRET: existing.ENQUIRY_ACCESS_SECRET || randomBytes(32).toString('hex'),
    ENQUIRY_ADMIN_CODE_HASH: adminHash,
  }
  if (settings.ENQUIRY_ACCESS_SECRET.length < 32) throw new Error('The existing access secret is too short. Do not rotate it without planning customer-code recovery.')
  if (!savedCode && !passwordConfigured) await writeFile(codePath, `${adminCode}\n`, { flag: 'wx', mode: 0o600 })
  const missing = Object.entries(settings).filter(([name]) => !existing[name])
  if (missing.length) await appendFile(variablesPath, `${existingText && !existingText.endsWith('\n') ? '\n' : ''}${missing.map(([name, value]) => `${name}=${JSON.stringify(value)}`).join('\n')}\n`, { mode: 0o600 })

  if (process.argv.includes('--cloudflare')) {
    const result = spawnSync(process.execPath, [resolve('node_modules/wrangler/bin/wrangler.js'), 'pages', 'secret', 'bulk', '--project-name', 'avelof'], {
      input: JSON.stringify(settings), encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    })
    if (result.status !== 0) throw new Error('Cloudflare secret upload failed. Check Wrangler sign-in and trusted system certificates; no secret values were printed.')
    console.log('Uploaded enquiry access secrets to Cloudflare Pages.')
  }

  const reviewIndex = process.argv.indexOf('--verify-reviews')
  if (reviewIndex >= 0) {
    const origin = new URL(process.argv[reviewIndex + 1]).origin
    const endpoint = `${origin}/api/reviews`
    const reviewIdIndex = process.argv.indexOf('--review-id')
    const id = reviewIdIndex >= 0 ? process.argv[reviewIdIndex + 1] : randomUUID()
    assert.match(id ?? '', /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i)
    const submission = { id, reviewerName: 'Review Workflow QA', bookingId: 'SYNTHETIC-PRIVATE-REFERENCE', experience: 'General experience', rating: 3, title: 'Synthetic workflow verification', reviewText: 'Synthetic workflow verification only. Not genuine customer feedback. Remove after testing.', publicationConsent: true, website: '' }
    const submit = await fetch(endpoint, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(submission) })
    assert.ok([200, 201].includes(submit.status))
    console.log(`Using synthetic review ${id}; remove this exact test record after verification.`)
    const token = await createAdminSession(settings)
    const Cookie = adminCookie(new Request(origin), token).split(';')[0]
    const listing = await fetch(`${endpoint}?scope=admin`, { headers: { Cookie } })
    assert.equal(listing.status, 200)
    const pending = await listing.json()
    assert.ok(pending.reviews.some((review) => review.id === id && review.bookingId === submission.bookingId))
    const anonymous = await fetch(`${endpoint}?scope=admin`)
    assert.equal(anonymous.status, 401)
    const moderate = (status, version) => fetch(endpoint, { method: 'PATCH', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie }, body: JSON.stringify({ id, status, version }) })
    assert.equal((await moderate('published', 0)).status, 200)
    const published = await (await fetch(endpoint)).json()
    const visible = published.reviews.find((review) => review.id === id)
    assert.ok(visible)
    assert.equal(visible.bookingId, undefined)
    assert.equal(visible.payload_hash, undefined)
    assert.equal(visible.verified, undefined)
    assert.equal((await moderate('rejected', 0)).status, 409)
    assert.equal((await moderate('rejected', 1)).status, 200)
    const hidden = await (await fetch(endpoint)).json()
    assert.equal(hidden.reviews.some((review) => review.id === id), false)
    console.log(`Verified pending/admin-only -> published -> hidden review ${id} at ${origin}. No credentials or customer details were printed.`)
  }

  const verifyIndex = process.argv.indexOf('--verify')
  if (verifyIndex >= 0) {
    if (passwordConfigured) throw new Error('A chosen admin password is active. Verify by signing in directly, or use the hidden password-setting command, which verifies the new password without printing it.')
    const assets = await readdir(resolve('dist'), { recursive: true })
    for (const asset of assets.filter((name) => /\.(js|html|css)$/.test(name))) {
      const contents = await readFile(resolve('dist', asset), 'utf8')
      for (const value of [adminCode, ...Object.values(settings)]) assert.equal(contents.includes(value), false, 'Credentials must not appear in public assets')
    }
    const origin = new URL(process.argv[verifyIndex + 1]).origin
    const endpoint = `${origin}/api/enquiry-access`
    const post = (body, Cookie = '') => fetch(endpoint, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...(Cookie ? { Cookie } : {}) }, body: JSON.stringify(body) })
    const anonymous = await fetch(endpoint)
    assert.equal(anonymous.status, 401, 'Anonymous listing must be blocked')
    const lookupPage = await fetch(`${origin}/my-enquiries`)
    assert.equal(lookupPage.status, 200)
    assert.match(lookupPage.headers.get('cache-control') ?? '', /no-store/)
    assert.match(lookupPage.headers.get('x-robots-tag') ?? '', /noindex/)
    const denied = await post({ action: 'admin-login', username: business.phone, code: '0'.repeat(48) })
    assert.equal(denied.status, 401, 'Incorrect admin codes must be rejected')
    const login = await post({ action: 'admin-login', username: business.phone, code: adminCode })
    assert.equal(login.status, 200, 'Admin login must succeed')
    const cookieHeader = login.headers.get('set-cookie')
    assert.match(cookieHeader, /HttpOnly/)
    assert.match(cookieHeader, /SameSite=Strict/)
    if (origin.startsWith('https:')) assert.match(cookieHeader, /Secure/)
    const Cookie = cookieHeader.split(';')[0]
    const listing = await fetch(endpoint, { headers: { Cookie } })
    assert.equal(listing.status, 200, 'Authenticated listing must succeed')
    const data = await listing.json()
    assert.ok(Array.isArray(data.enquiries))
    assert.ok(data.enquiries.every((enquiry) => !('accessCode' in enquiry) && !('access_code_hash' in enquiry) && !('payload_hash' in enquiry)))
    if (process.argv.includes('--verify-status')) {
      const requestReference = `AV-${randomUUID().toUpperCase()}`
      const save = await fetch(`${origin}/api/enquiries`, {
        method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: requestReference, kind: 'contact', fields: {
          fullName: 'Status Workflow', phoneNumber: '+91 9000000000', adults: '2', children: '0',
          packagePreference: 'Custom package', customDetails: 'Verification-only synthetic enquiry',
        } }),
      })
      assert.equal(save.status, 201)
      const saved = await save.json()
      console.log(`Created synthetic status verification enquiry ${saved.reference}; remove this test record after verification.`)
      const publicLookup = () => post({ action: 'booking-summary', reference: saved.reference })
      const initial = await publicLookup()
      assert.equal(initial.status, 200)
      const initialBody = await initial.json()
      assert.equal(initialBody.booking.status, 'received')
      assert.equal(initialBody.booking.maskedName, 'S***u* W******w')
      assert.equal(initialBody.booking.maskedPhone, '9*******00')
      assert.equal(JSON.stringify(initialBody).includes('Verification-only'), false)
      const byPhone = await post({ action: 'booking-search', identifier: '+91 9000000000' })
      assert.equal(byPhone.status, 200)
      const related = await byPhone.json()
      assert.ok(related.bookings.some((booking) => booking.reference === saved.reference))
      assert.ok(related.bookings.every((booking) => Object.keys(booking).sort().join(',') === 'bookingDetails,kind,maskedName,maskedPhone,reference,status'))
      assert.equal((await post({ action: 'admin-status', reference: saved.reference, status: 'booked', version: 0 })).status, 401)
      for (const [version, status] of ['booked', 'running', 'completed'].entries()) {
        const update = await post({ action: 'admin-status', reference: saved.reference, status, version }, Cookie)
        assert.equal(update.status, 200)
        const updated = await update.json()
        assert.equal(updated.enquiry.status, status)
        assert.equal(updated.enquiry.statusVersion, version + 1)
        const customer = await publicLookup()
        assert.equal(customer.status, 200)
        assert.equal((await customer.json()).booking.status, status)
      }
      assert.equal((await post({ action: 'admin-status', reference: saved.reference, status: 'booked', version: 0 }, Cookie)).status, 409)
      console.log(`Verified Confirmed -> Running -> Completed and masked customer status for ${saved.reference}.`)
    }
    const logout = await post({ action: 'logout' }, Cookie)
    assert.equal(logout.status, 200)
    assert.match(logout.headers.get('set-cookie'), /Max-Age=0/)
    console.log(`Verified protected admin access and logout at ${origin}. No credentials or customer details were printed.`)
  }

  console.log(passwordConfigured ? 'Your chosen admin password is configured as a salted hash; no plaintext password is stored.' : 'Your current private admin code is stored in .avelof-admin.local. It remains valid as the password until you replace it securely.')
}

main().catch((error) => {
  console.error(error instanceof assert.AssertionError ? 'An access verification assertion failed; review the endpoint status without printing credentials.' : error.message)
  process.exitCode = 1
})