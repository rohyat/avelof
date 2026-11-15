import { randomBytes } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'
import { business } from '../src/config.ts'
import { validAdminHash, verifyAdminPassword } from '../functions/_lib/enquiryAccess.ts'
import { matchingTotpCounter } from '../functions/_lib/adminTotp.ts'
import { hiddenQuestion, runWrangler } from './adminSetupTools.mjs'

async function main() {
  const argumentsList = process.argv.slice(2)
  if (argumentsList.some((argument) => !['--cloudflare', '--replace'].includes(argument))) throw new Error('Only --cloudflare and --replace are supported. Never pass credentials as arguments.')
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Run this in a private interactive local terminal, not through chat. Enrollment keys must stay private.')
  const path = resolve('.dev.vars')
  const settings = parseEnv(await readFile(path, 'utf8'))
  if (!settings.ENQUIRY_ACCESS_SECRET || settings.ENQUIRY_ACCESS_SECRET.length < 32 || !validAdminHash(settings.ENQUIRY_ADMIN_CODE_HASH ?? '')) throw new Error('Existing admin/access settings are required. Restore them before enrollment.')
  if (settings.ENQUIRY_ADMIN_TOTP_SECRET !== undefined && !argumentsList.includes('--replace')) throw new Error('An authenticator is already configured. Use --replace only for an intentional recovery or device change.')
  const password = await hiddenQuestion('Current admin password (hidden): ')
  if (!await verifyAdminPassword(password, settings.ENQUIRY_ADMIN_CODE_HASH)) throw new Error('Invalid admin password. Nothing was changed.')

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const bytes = randomBytes(20)
  let buffer = 0
  let bits = 0
  let secret = ''
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte
    bits += 8
    while (bits >= 5) {
      bits -= 5
      secret += alphabet[(buffer >>> bits) & 31]
    }
  }
  console.log('In your authenticator app, add a time-based account manually:')
  console.log(`Account: AVELOF admin (${business.phone})`)
  console.log(`Private setup key: ${secret}`)
  console.log('Use SHA-1, 6 digits, 30 seconds. Keep this key in a secure password manager for recovery.')
  console.log('Do not paste this key or screenshots into chat. No configuration changes have been made yet.')
  const code = (await hiddenQuestion('Current six-digit code from the new account (hidden): ')).trim()
  if (await matchingTotpCounter(secret, code) === null) throw new Error('The authenticator code did not match. Nothing was changed. Check automatic phone time and enroll again.')

  if (argumentsList.includes('--cloudflare')) {
    runWrangler(['d1', 'migrations', 'apply', 'DB', '--remote'])
    runWrangler(['pages', 'secret', 'bulk', '--project-name', 'avelof'], JSON.stringify({ ENQUIRY_ADMIN_TOTP_SECRET: secret }))
  }
  await writeFile(path, `${Object.entries({ ...settings, ENQUIRY_ADMIN_TOTP_SECRET: secret }).map(([name, value]) => `${name}=${JSON.stringify(value)}`).join('\n')}\n`, { mode: 0o600 })
  console.log(argumentsList.includes('--cloudflare')
    ? 'Enrollment verified and uploaded. Build and deploy the updated site to activate it in production; then test password plus authenticator sign-in.'
    : 'Local enrollment verified. Apply local D1 migrations and restart the local Pages server. Production was not changed.')
  console.log('Activation invalidates old admin sessions only; customer access codes, notification subscriptions and the app homepage are unchanged.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Authenticator setup did not complete. No credential changes can be assumed; review the private terminal instructions before retrying.')
  process.exitCode = 1
})
