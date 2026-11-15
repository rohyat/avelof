const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function validTotpSecret(secret: string) {
  return /^[A-Z2-7]{32}$/.test(secret)
}

export async function totpCode(secret: string, counter: number) {
  if (!validTotpSecret(secret) || !Number.isSafeInteger(counter) || counter < 0) throw new Error('Invalid authenticator configuration.')
  const keyBytes = new Uint8Array(20)
  let bits = 0
  let buffer = 0
  let index = 0
  for (const character of secret) {
    buffer = (buffer << 5) | alphabet.indexOf(character)
    bits += 5
    if (bits >= 8) {
      bits -= 8
      keyBytes[index++] = (buffer >>> bits) & 255
    }
  }
  const message = new Uint8Array(8)
  new DataView(message.buffer).setBigUint64(0, BigInt(counter))
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, message))
  const offset = signature[signature.length - 1] & 15
  const value = new DataView(signature.buffer).getUint32(offset) & 0x7fffffff
  return String(value % 1000000).padStart(6, '0')
}

export async function matchingTotpCounter(secret: string, code: string, now = Date.now()) {
  if (!validTotpSecret(secret) || !/^\d{6}$/.test(code) || !Number.isFinite(now) || now < 0) return null
  const counter = Math.floor(now / 30000)
  let matched: number | null = null
  for (const candidate of [counter - 1, counter, counter + 1]) {
    if (candidate < 0) continue
    const expected = await totpCode(secret, candidate)
    let difference = 0
    for (let index = 0; index < 6; index++) difference |= expected.charCodeAt(index) ^ code.charCodeAt(index)
    if (difference === 0) matched = candidate
  }
  return matched
}
