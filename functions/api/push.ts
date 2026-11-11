import { z } from 'zod'
import { isAdmin, privateReply, sameOrigin } from '../_lib/enquiryAccess.ts'
import type { AccessEnv } from '../_lib/enquiryAccess.ts'

const endpointSchema = z.string().url().max(2048).refine((value) => new URL(value).protocol === 'https:')
const subscriptionSchema = z.object({
  endpoint: endpointSchema,
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string().min(32).max(200), auth: z.string().min(16).max(128) }).strict(),
}).strict()
const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('subscribe'), subscription: subscriptionSchema }).strict(),
  z.object({ action: z.literal('unsubscribe'), endpoint: endpointSchema }).strict(),
])

async function readSubscriptionCount(database: D1Database) {
  return (await database.prepare('SELECT count(*) AS total FROM push_subscriptions').bind().first<{ total: number }>())?.total ?? 0
}

export const onRequest: PagesFunction<AccessEnv> = async ({ request, env }) => {
  if (!['GET', 'POST', 'DELETE'].includes(request.method)) return privateReply({ error: 'Method not allowed.' }, 405, { Allow: 'GET, POST, DELETE' })
  if (!env.DB) return privateReply({ error: 'Notification storage is unavailable.' }, 503)
  if (request.headers.get('Sec-Fetch-Site') === 'cross-site' || (request.method !== 'GET' && !sameOrigin(request))) return privateReply({ error: 'Origin not allowed.' }, 403)
  if (!await isAdmin(request, env)) return privateReply({ error: 'Please sign in.' }, 401)
  try {
    if (request.method === 'GET') return privateReply({
      available: Boolean(env.ENQUIRY_VAPID_PUBLIC_KEY && env.ENQUIRY_VAPID_PRIVATE_KEY && env.ENQUIRY_VAPID_SUBJECT),
      publicKey: env.ENQUIRY_VAPID_PUBLIC_KEY ?? null,
      subscriptionCount: await readSubscriptionCount(env.DB),
    })
    if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return privateReply({ error: 'JSON required.' }, 415)
    if (Number(request.headers.get('Content-Length')) > 4096) return privateReply({ error: 'Notification request too large.' }, 413)
    const text = await request.text()
    if (text.length > 4096) return privateReply({ error: 'Notification request too large.' }, 413)
    let input: unknown
    try { input = JSON.parse(text) } catch { return privateReply({ error: 'Invalid notification request.' }, 400) }
    const parsed = actionSchema.safeParse(input)
    if (!parsed.success) return privateReply({ error: 'Invalid notification subscription.' }, 400)
    if (parsed.data.action === 'unsubscribe') {
      await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(parsed.data.endpoint).run()
      return privateReply({ enabled: false, subscriptionCount: await readSubscriptionCount(env.DB) })
    }
    if (!env.ENQUIRY_VAPID_PUBLIC_KEY || !env.ENQUIRY_VAPID_PRIVATE_KEY || !env.ENQUIRY_VAPID_SUBJECT) return privateReply({ error: 'Mobile notifications are not configured yet.' }, 503)
    const { endpoint, keys } = parsed.data.subscription
    await env.DB.prepare('INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES (?, ?, ?) ON CONFLICT (endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth')
      .bind(endpoint, keys.p256dh, keys.auth).run()
    return privateReply({ enabled: true, subscriptionCount: await readSubscriptionCount(env.DB) })
  } catch {
    return privateReply({ error: 'Notification settings are temporarily unavailable.' }, 503)
  }
}