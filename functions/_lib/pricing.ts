import { pricingSettingsSchema } from '../../src/services/pricingSchema.ts'

export async function loadPricingSettings(DB: D1Database) {
  return pricingSettingsSchema.parse(await DB.prepare('SELECT discount_percent AS discountPercent, version FROM pricing_settings WHERE id = ?').bind(1).first())
}
