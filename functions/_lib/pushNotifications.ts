import { buildPushPayload } from '@block65/webcrypto-web-push'
import type { PushSubscription as WebPushSubscription, VapidKeys } from '@block65/webcrypto-web-push'
import type { AccessEnv } from './enquiryAccess.ts'

interface StoredSubscription {
  endpoint: string
  p256dh: string
  auth: string
}

export interface OwnerPushMessage {
  title: string
  body: string
  url: string
  tag: string
}

export function queueOwnerPush(env: AccessEnv, waitUntil: (promise: Promise<unknown>) => void, message: OwnerPushMessage) {
  if (!env.DB || !env.ENQUIRY_VAPID_PUBLIC_KEY || !env.ENQUIRY_VAPID_PRIVATE_KEY || !env.ENQUIRY_VAPID_SUBJECT) return
  waitUntil(deliverOwnerPush(env, message).catch(() => { console.error('Owner notification delivery failed.') }))
}

async function sendPush(env: AccessEnv, stored: StoredSubscription, message: OwnerPushMessage): Promise<'sent' | 'expired'> {
  if (!env.DB || !env.ENQUIRY_VAPID_PUBLIC_KEY || !env.ENQUIRY_VAPID_PRIVATE_KEY || !env.ENQUIRY_VAPID_SUBJECT) throw new Error('Mobile notifications are not configured.')
  const vapid: VapidKeys = {
    subject: env.ENQUIRY_VAPID_SUBJECT,
    publicKey: env.ENQUIRY_VAPID_PUBLIC_KEY,
    privateKey: env.ENQUIRY_VAPID_PRIVATE_KEY,
  }
  const subscription: WebPushSubscription = {
    endpoint: stored.endpoint,
    expirationTime: null,
    keys: { p256dh: stored.p256dh, auth: stored.auth },
  }
  const request = await buildPushPayload({ data: { title: message.title, body: message.body, url: message.url, tag: message.tag }, options: { ttl: 3600, urgency: 'high' } }, subscription, vapid)
  const response = await fetch(stored.endpoint, { ...request, signal: AbortSignal.timeout(8000) })
  if (response.status === 404 || response.status === 410) {
    await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(stored.endpoint).run()
    return 'expired'
  }
  if (!response.ok) throw new Error(`Push service rejected notification (${response.status}).`)
  return 'sent'
}

export async function sendDeviceTestPush(env: AccessEnv, endpoint: string): Promise<'sent' | 'expired' | 'missing'> {
  if (!env.DB) throw new Error('Notification storage is unavailable.')
  const stored = await env.DB.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).first<StoredSubscription>()
  if (!stored) return 'missing'
  return sendPush(env, stored, {
    title: 'AVELOF test notification',
    body: 'Test alert from your admin panel. This is not a booking.',
    url: '/admin/panel',
    tag: 'avelof-device-test',
  })
}

async function deliverOwnerPush(env: AccessEnv, message: OwnerPushMessage) {
  const database = env.DB
  if (!database || !env.ENQUIRY_VAPID_PUBLIC_KEY || !env.ENQUIRY_VAPID_PRIVATE_KEY || !env.ENQUIRY_VAPID_SUBJECT) return
  const result = await database.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions LIMIT 50').bind().all<StoredSubscription>()
  await Promise.all(result.results.map(async (stored) => {
    try {
      await sendPush(env, stored, message)
    } catch {
      console.error('Owner device notification failed; enquiry storage is unaffected.')
    }
  }))
}