import { pbkdf2Sync, randomBytes } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'
import { business } from '../src/config.ts'
import { hiddenQuestion, runWrangler } from './adminSetupTools.mjs'

async function main() {
  if (process.argv.slice(2).some((argument) => argument !== '--cloudflare')) throw new Error('Only --cloudflare is supported. Never pass a password as a command argument.')
  const path = resolve('.dev.vars')
  const settings = parseEnv(await readFile(path, 'utf8').catch(() => { throw new Error('Run npm run setup:access first. Existing access settings must be preserved.') }))
  if (!settings.ENQUIRY_ACCESS_SECRET || settings.ENQUIRY_ACCESS_SECRET.length < 32) throw new Error('Existing access secret is missing. Restore it rather than rotating customer access settings.')
  console.log('Choose a NEW password, not one shared in chat. Input is hidden and will not be stored in plaintext.')
  const password = await hiddenQuestion('New admin password (hidden): ')
  if (password.trim().length < 14 || password.length > 128) throw new Error('Use a password or passphrase with 14 to 128 characters.')
  if (/^[+0-9\s()-]+$/.test(password) && password.replace(/\D/g, '') === business.phone.replace(/\D/g, '')) throw new Error('The public business phone number cannot be used as the password.')
  const confirmation = await hiddenQuestion('Confirm new password (hidden): ')
  if (password !== confirmation) throw new Error('Passwords do not match. Nothing was changed.')
  const salt = randomBytes(16)
  const hash = pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex')
  const encoded = `pbkdf2_sha256$100000$${salt.toString('hex')}$${hash}`
  const secrets = { ENQUIRY_ACCESS_SECRET: settings.ENQUIRY_ACCESS_SECRET, ENQUIRY_ADMIN_CODE_HASH: encoded }
  const cloudflare = process.argv.includes('--cloudflare')
  if (cloudflare) runWrangler(['pages', 'secret', 'bulk', '--project-name', 'avelof'], JSON.stringify(secrets))
  await writeFile(path, `${Object.entries({ ...settings, ...secrets }).map(([name, value]) => `${name}=${JSON.stringify(value)}`).join('\n')}\n`, { mode: 0o600 })
  if (cloudflare) {
    runWrangler(['pages', 'deploy', 'dist', '--project-name', 'avelof', '--branch', 'main', '--commit-dirty=true'])
    const origin = 'https://avelof.pages.dev'
    const endpoint = `${origin}/api/enquiry-access`
    const post = (body, Cookie = '') => fetch(endpoint, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...(Cookie ? { Cookie } : {}) }, body: JSON.stringify(body) })
    const authenticatorCode = settings.ENQUIRY_ADMIN_TOTP_SECRET ? (await hiddenQuestion('Current authenticator code for live verification (hidden): ')).trim() : undefined
    const login = await post({ action: 'admin-login', username: business.phone, code: password, ...(authenticatorCode ? { authenticatorCode } : {}) })
    if (login.status !== 200) throw new Error('Password settings were uploaded, but live sign-in could not be verified. No password was printed. Check the owner sign-in directly.')
    const cookie = login.headers.get('set-cookie')
    if (!cookie || !cookie.includes('HttpOnly') || !cookie.includes('Secure')) throw new Error('Live session verification failed. No credentials were printed.')
    const Cookie = cookie.split(';')[0]
    const listing = await fetch(endpoint, { headers: { Cookie } })
    if (listing.status !== 200) throw new Error('Password sign-in worked, but dashboard access could not be verified.')
    await post({ action: 'logout' }, Cookie)
    console.log(`Live password updated and verified. Admin sign-in: ${origin}/admin/panel`)
  } else console.log('Local password updated. Restart the local Pages server to load the new hash. The cloud password was not changed.')
  console.log('The previous admin code is no longer accepted by environments using this new hash. Keep your new password in a password manager.')
}

main().catch((error) => { console.error(error.message); process.exitCode = 1 })