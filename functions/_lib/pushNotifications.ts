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
  waitUntil(deliverOwnerPush(env, message).catch(() => undefined))
}

async function deliverOwnerPush(env: AccessEnv, message: OwnerPushMessage) {
  const database = env.DB
  if (!database || !env.ENQUIRY_VAPID_PUBLIC_KEY || !env.ENQUIRY_VAPID_PRIVATE_KEY || !env.ENQUIRY_VAPID_SUBJECT) return
  const result = await database.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions LIMIT 50').bind().all<StoredSubscription>()
  const vapid: VapidKeys = {
    subject: env.ENQUIRY_VAPID_SUBJECT,
    publicKey: env.ENQUIRY_VAPID_PUBLIC_KEY,
    privateKey: env.ENQUIRY_VAPID_PRIVATE_KEY,
  }
  await Promise.all(result.results.map(async (stored) => {
    try {
      const subscription: WebPushSubscription = {
        endpoint: stored.endpoint,
        expirationTime: null,
        keys: { p256dh: stored.p256dh, auth: stored.auth },
      }
      const request = await buildPushPayload({ data: { title: message.title, body: message.body, url: message.url, tag: message.tag }, options: { ttl: 3600, urgency: 'high' } }, subscription, vapid)
      const response = await fetch(stored.endpoint, { ...request, signal: AbortSignal.timeout(8000) })
      if (response.status === 404 || response.status === 410) {
        await database.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(stored.endpoint).run()
      }
    } catch {
      // Push delivery is best-effort; saving an enquiry must not depend on it.
    }
  }))
}