import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

export async function hiddenQuestion(prompt) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Use an interactive local terminal. Credentials must not be passed as arguments or pasted into chat.')
  const muted = new Writable({ write(_chunk, _encoding, callback) { callback() } })
  const reader = createInterface({ input: process.stdin, output: muted, terminal: true })
  process.stdout.write(prompt)
  try { return await reader.question('') }
  finally { reader.close(); process.stdout.write('\n') }
}

export function runWrangler(argumentsList, input) {
  const result = spawnSync(process.execPath, [resolve('node_modules/wrangler/bin/wrangler.js'), ...argumentsList], {
    ...(input ? { input } : {}), encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
  })
  if (result.status !== 0) throw new Error('The Cloudflare operation failed. Check Wrangler sign-in and trusted system certificates; no credential output was printed.')
}
