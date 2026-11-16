import { z } from 'zod'

export const discountPercentSchema = z.number().min(0).max(100)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001, 'Use at most two decimal places.')
export const pricingSettingsSchema = z.object({
  discountPercent: discountPercentSchema,
  version: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
}).strict()
export type PricingSettings = z.infer<typeof pricingSettingsSchema>

export function discountedPrice(regularPrice: number, discountPercent: number) {
  return Math.round(regularPrice * (10000 - Math.round(discountPercent * 100)) / 100) / 100
}
