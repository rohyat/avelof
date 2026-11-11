import { z } from 'zod'

const settingsSchema = z.object({ available: z.boolean(), publicKey: z.string().nullable(), subscriptionCount: z.number().int().min(0) })
const subscriptionResultSchema = z.object({ enabled: z.boolean(), subscriptionCount: z.number().int().min(0) })

export class PushNotificationError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

async function requestPush(method = 'GET', body?: unknown): Promise<unknown> {
  const response = await fetch('/api/push', {
    method,
    cache: 'no-store',
    credentials: 'same-origin',
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  })
  const result: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message = result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
      ? result.error
      : 'Mobile notification settings could not be updated.'
    throw new PushNotificationError(message, response.status)
  }
  return result
}

export async function loadPushSettings() {
  return settingsSchema.parse(await requestPush())
}

export async function savePushSubscription(subscription: PushSubscription) {
  const value = subscription.toJSON()
  if (!value.endpoint || !value.keys?.p256dh || !value.keys.auth) throw new Error('This browser returned an incomplete notification subscription.')
  return subscriptionResultSchema.parse(await requestPush('POST', {
    action: 'subscribe',
    subscription: { endpoint: value.endpoint, expirationTime: value.expirationTime, keys: value.keys },
  }))
}

export async function removePushSubscription(endpoint: string) {
  return subscriptionResultSchema.parse(await requestPush('DELETE', { action: 'unsubscribe', endpoint }))
}