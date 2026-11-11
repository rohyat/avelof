import { createECDH } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { parseEnv } from 'node:util'
import { business } from '../src/config.ts'

const settingsPath = resolve('.dev.vars')
const pushKeyNames = ['ENQUIRY_VAPID_PUBLIC_KEY', 'ENQUIRY_VAPID_PRIVATE_KEY', 'ENQUIRY_VAPID_SUBJECT']

function base64Url(value) {
  return Buffer.from(value).toString('base64url')
}

function generateVapidKeys() {
  const key = createECDH('prime256v1')
  key.generateKeys()
  return {
    ENQUIRY_VAPID_PUBLIC_KEY: base64Url(key.getPublicKey(undefined, 'uncompressed')),
    ENQUIRY_VAPID_PRIVATE_KEY: base64Url(key.getPrivateKey()),
    ENQUIRY_VAPID_SUBJECT: `mailto:${business.email}`,
  }
}

function uploadSecrets(secrets) {
  const wrangler = resolve('node_modules/wrangler/bin/wrangler.js')
  const result = spawnSync(process.execPath, ['--use-system-ca', wrangler, 'pages', 'secret', 'bulk', '--project-name', 'avelof'], {
    input: JSON.stringify(secrets), encoding: 'utf8', stdio: ['pipe', 'ignore', 'ignore'],
  })
  if (result.status !== 0) throw new Error('Cloudflare secret upload failed. Check Wrangler sign-in; secret values were not printed.')
}

async function main() {
  const args = process.argv.slice(2)
  if (args.some((argument) => argument !== '--cloudflare')) throw new Error('Only --cloudflare is supported. Never pass keys as command arguments.')
  const localText = await readFile(settingsPath, 'utf8').catch(() => {
    throw new Error('Run npm run setup:access first so existing local secrets can be preserved.')
  })
  const settings = parseEnv(localText)
  const present = pushKeyNames.filter((name) => settings[name])
  if (present.length > 0 && present.length < pushKeyNames.length) throw new Error('Existing push settings are incomplete. Restore the complete VAPID set rather than rotating it.')
  const secrets = present.length === pushKeyNames.length
    ? Object.fromEntries(pushKeyNames.map((name) => [name, settings[name]]))
    : generateVapidKeys()
  if (secrets.ENQUIRY_VAPID_SUBJECT !== `mailto:${business.email}`) throw new Error('The saved VAPID contact must match the configured AVELOF business email.')
  const next = { ...settings, ...secrets }
  await writeFile(settingsPath, `${Object.entries(next).map(([name, value]) => `${name}=${JSON.stringify(value)}`).join('\n')}\n`, { mode: 0o600 })
  if (args.includes('--cloudflare')) uploadSecrets(secrets)
  console.log(args.includes('--cloudflare')
    ? 'Push keys are configured locally and uploaded to the AVELOF Pages project. Values were not printed.'
    : 'Push keys are configured locally. Use --cloudflare to upload them to Pages. Values were not printed.')
}

main().catch((error) => { console.error(error.message); process.exitCode = 1 })