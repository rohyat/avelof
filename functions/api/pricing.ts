import { pricingSettingsSchema } from '../../src/services/pricingSchema.ts'
import { isAdmin, privateReply, sameOrigin } from '../_lib/enquiryAccess.ts'
import type { AccessEnv } from '../_lib/enquiryAccess.ts'
import { limitedBody } from '../_lib/hotelRegistration.ts'
import { loadPricingSettings } from '../_lib/pricing.ts'

export const onRequest: PagesFunction<AccessEnv> = async ({ request, env }) => {
  if (!['GET', 'PATCH'].includes(request.method)) return privateReply({ error: 'Method not allowed.' }, 405, { Allow: 'GET, PATCH' })
  if (!env.DB) return privateReply({ error: 'Pricing storage is unavailable.' }, 503)
  try {
    if (request.method === 'GET') return privateReply(await loadPricingSettings(env.DB))
    if (!sameOrigin(request)) return privateReply({ error: 'Origin not allowed.' }, 403)
    if (!await isAdmin(request, env)) return privateReply({ error: 'Please sign in.' }, 401)
    if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') return privateReply({ error: 'JSON required.' }, 415)
    const bytes = await limitedBody(request, 2000)
    if (bytes === null) return privateReply({ error: 'Pricing update too large.' }, 413)
    let input: unknown
    try { input = JSON.parse(new TextDecoder().decode(bytes)) } catch { return privateReply({ error: 'Invalid pricing update.' }, 400) }
    const parsed = pricingSettingsSchema.safeParse(input)
    if (!parsed.success) return privateReply({ error: 'Enter a discount from 0 to 100%, with at most two decimal places, and a valid version.' }, 400)
    const row = await env.DB.prepare('UPDATE pricing_settings SET discount_percent = ?, version = version + 1 WHERE id = 1 AND version = ? RETURNING discount_percent AS discountPercent, version')
      .bind(parsed.data.discountPercent, parsed.data.version).first()
    if (!row) return privateReply({ error: 'Pricing changed. Reload the current discount before saving again.' }, 409)
    return privateReply(pricingSettingsSchema.parse(row))
  } catch (error) {
    console.error('Pricing settings request failed', error)
    return privateReply({ error: 'Could not confirm pricing settings. Reload before retrying.' }, 503)
  }
}
