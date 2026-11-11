import { business } from '../../src/config.ts'
import { indianPhoneNumber } from '../../src/services/phoneNumbers.ts'

export interface AccessEnv {
  DB?: D1Database
  ENQUIRY_ACCESS_SECRET?: string
  ENQUIRY_ADMIN_CODE_HASH?: string
  ENQUIRY_VAPID_PUBLIC_KEY?: string
  ENQUIRY_VAPID_PRIVATE_KEY?: string
  ENQUIRY_VAPID_SUBJECT?: string
}

const encoder = new TextEncoder()
const sessionLifetime = 1800

export function privateReply(body: Record<string, unknown>, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: {
    'Cache-Control': 'private, no-store',
    'Vary': 'Cookie',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    ...headers,
  } })
}

export async function hashText(value: string) {
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function phoneCandidates(value: string) {
  const national = indianPhoneNumber(value)
  return national ? [national, `91${national}`] : []
}

export function correctAdminUsername(value: string) {
  return phoneCandidates(value).includes(business.phone.replace(/\D/g, ''))
}

export function validAdminHash(value: string) {
  return /^[a-f0-9]{64}$/.test(value) || /^pbkdf2_sha256\$100000\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(value)
}

export async function verifyAdminPassword(password: string, encoded: string) {
  if (/^[a-f0-9]{64}$/.test(encoded)) return /^\d{48}$/.test(password) && equalHashes(await hashText(password), encoded)
  const match = /^pbkdf2_sha256\$100000\$([a-f0-9]{32})\$([a-f0-9]{64})$/.exec(encoded)
  if (!match) return false
  const salt = Uint8Array.from(match[1].match(/../g)!, (byte) => Number.parseInt(byte, 16))
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256)
  const hash = Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return equalHashes(hash, match[2])
}

async function signingKey(secret: string) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function customerAccessCode(secret: string, reference: string) {
  const signature = await crypto.subtle.sign('HMAC', await signingKey(secret), encoder.encode(`customer:${reference}`))
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function equalHashes(first: string, second: string) {
  if (first.length !== second.length) return false
  let difference = 0
  for (let index = 0; index < first.length; index++) difference |= first.charCodeAt(index) ^ second.charCodeAt(index)
  return difference === 0
}

export function sameOrigin(request: Request) {
  return request.headers.get('Origin') === new URL(request.url).origin && request.headers.get('Sec-Fetch-Site') !== 'cross-site'
}

export function accessConfigured(env: AccessEnv) {
  return Boolean(env.ENQUIRY_ACCESS_SECRET && env.ENQUIRY_ACCESS_SECRET.length >= 32)
}

function cookieName(request: Request) {
  return new URL(request.url).protocol === 'https:' ? '__Host-avelof_admin' : 'avelof_admin_local'
}

export function adminCookie(request: Request, token: string, clear = false) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return `${cookieName(request)}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${clear ? 0 : sessionLifetime}${secure}`
}

export async function createAdminSession(env: AccessEnv) {
  const expires = Math.floor(Date.now() / 1000) + sessionLifetime
  const payload = `v1.${expires}.${crypto.randomUUID()}`
  const signature = await crypto.subtle.sign('HMAC', await signingKey(`${env.ENQUIRY_ACCESS_SECRET}:${env.ENQUIRY_ADMIN_CODE_HASH}`), encoder.encode(payload))
  const encoded = btoa(String.fromCharCode(...new Uint8Array(signature))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
  return `${payload}.${encoded}`
}

export async function isAdmin(request: Request, env: AccessEnv) {
  if (!accessConfigured(env) || !validAdminHash(env.ENQUIRY_ADMIN_CODE_HASH ?? '')) return false
  const token = request.headers.get('Cookie')?.split(';').map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith(`${cookieName(request)}=`))?.split('=').slice(1).join('=')
  if (!token || token.length > 256) return false
  const [version, expiry, nonce, signature, extra] = token.split('.')
  const expires = Number(expiry)
  const now = Math.floor(Date.now() / 1000)
  if (extra || version !== 'v1' || !Number.isInteger(expires) || expires <= now || expires > now + sessionLifetime || !/^[a-f0-9-]{36}$/.test(nonce ?? '') || !/^[A-Za-z0-9_-]{43}$/.test(signature ?? '')) return false
  try {
    const bytes = Uint8Array.from(atob(signature.replaceAll('-', '+').replaceAll('_', '/') + '='), (character) => character.charCodeAt(0))
    return await crypto.subtle.verify('HMAC', await signingKey(`${env.ENQUIRY_ACCESS_SECRET}:${env.ENQUIRY_ADMIN_CODE_HASH}`), bytes, encoder.encode(`${version}.${expiry}.${nonce}`))
  } catch {
    return false
  }
}

export async function allowAccessAttempt(request: Request, database: D1Database, scope: string, maximumAttempts = 10) {
  const bucket = Math.floor(Date.now() / 600000)
  const clientHash = await hashText(`${bucket}:${scope}:${request.headers.get('CF-Connecting-IP') ?? 'local'}`)
  await database.prepare('DELETE FROM enquiry_access_limits WHERE bucket < ?').bind(bucket - 1).run()
  const row = await database.prepare('INSERT INTO enquiry_access_limits (bucket, client_hash, attempts) VALUES (?, ?, 1) ON CONFLICT (bucket, client_hash) DO UPDATE SET attempts = attempts + 1 RETURNING attempts').bind(bucket, clientHash).first<{ attempts: number }>()
  return Boolean(row && row.attempts <= maximumAttempts)
}