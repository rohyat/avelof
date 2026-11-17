import { z } from 'zod'
import { businessKinds, businessLocations } from '../data/businessRegistration.ts'
import { indianPhoneNumber } from './phoneNumbers.ts'
import { hotelEditAuthSchema, hotelStatusSchema } from './hotelSchema.ts'
import { partnerStatusAccessCodePattern } from './partnerAccessCode.ts'
import { coordinateFields, coordinatePairError, coordinatesPaired } from './locationSchema.ts'

const text = (max: number) => z.string().trim().min(1).max(max)
const website = z.string().trim().max(200).refine((value) => {
  if (!value) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch { return false }
}, 'Use a full https:// website address without embedded credentials.')

export const businessItemSchema = z.object({
  id: z.uuidv4().toLowerCase(),
  name: text(100),
  description: text(1000),
}).strict()
const businessDetailsObject = z.object({
  name: text(120).refine((value) => /[\p{L}\p{N}]/u.test(value.normalize('NFKD')), 'Enter a business name containing a letter or number.'),
  kind: z.enum(businessKinds),
  location: z.enum(businessLocations),
  address: text(200),
  description: z.string().trim().max(1600).default(''),
  items: z.array(z.union([text(100), businessItemSchema])).max(20).default([])
    .refine((items) => { const ids = items.filter((item) => typeof item !== 'string').map((item) => item.id); return new Set(ids).size === ids.length }, 'Item IDs must be unique.'),
  website,
  ...coordinateFields,
}).strict()
export const businessDetailsSchema = businessDetailsObject.refine(coordinatesPaired, coordinatePairError)

export const businessSubmissionSchema = businessDetailsObject.extend({
  id: z.uuidv4().toLowerCase(),
  contactName: text(100),
  contactPhone: text(30).transform(indianPhoneNumber).refine(Boolean, 'Enter a valid Indian phone number.'),
  contactEmail: z.string().trim().email().max(200),
  publicationConsent: z.literal(true),
  websiteTrap: z.string().max(200).default(''),
}).strict().refine(coordinatesPaired, coordinatePairError)
  .refine((business) => business.items.every((item) => typeof item !== 'string'), 'Each item needs a heading, description and one photo.')

export const businessStatusSchema = hotelStatusSchema
const businessPublicObject = businessDetailsObject.extend({
  id: z.uuidv4().toLowerCase(),
  photo: z.string().regex(/^\/api\/business-images\/[a-f0-9-]{36}$/),
  photos: z.array(z.string().regex(/^\/api\/business-images\/[a-f0-9-]{36}(?:\?index=[0-4])?$/)).min(1).max(5).optional(),
})
export const businessPublicSchema = businessPublicObject.refine(coordinatesPaired, coordinatePairError)
export const businessAdminSchema = businessPublicObject.extend({
  contactName: z.string(),
  contactPhone: z.string(),
  contactEmail: z.string().email(),
  status: businessStatusSchema,
  version: z.number().int().min(0),
  ownerNote: z.string(),
  createdAt: z.string(),
}).refine(coordinatesPaired, coordinatePairError)
export const businessListSchema = z.object({
  businesses: z.array(businessPublicSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.literal(25),
})
export const businessAdminListSchema = z.object({
  businesses: z.array(businessAdminSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.literal(25),
})
export const businessReceiptSchema = z.object({
  saved: z.literal(true),
  id: z.uuidv4().toLowerCase(),
  status: businessStatusSchema,
  accessCode: z.string().regex(partnerStatusAccessCodePattern),
})
export const businessEditAuthSchema = hotelEditAuthSchema
export const businessOwnerSchema = businessDetailsObject.extend({
  id: z.uuidv4().toLowerCase(),
  contactName: z.string(),
  contactPhone: z.string(),
  contactEmail: z.string().email(),
  status: businessStatusSchema,
  version: z.number().int().min(0),
}).refine(coordinatesPaired, coordinatePairError)
export type OwnerBusiness = z.infer<typeof businessOwnerSchema>
export type BusinessEditAuth = z.infer<typeof businessEditAuthSchema>
export type BusinessReceipt = z.infer<typeof businessReceiptSchema>
export const businessModerationSchema = businessDetailsObject.extend({
  id: z.uuidv4().toLowerCase(),
  version: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  status: businessStatusSchema,
  ownerNote: z.string().trim().max(1000),
}).strict().refine(coordinatesPaired, coordinatePairError)
export const businessDeletionSchema = z.object({
  id: z.uuidv4().toLowerCase(),
  version: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
}).strict()

export type BusinessKind = (typeof businessKinds)[number]
export type BusinessDetails = z.infer<typeof businessDetailsSchema>
export type BusinessSubmission = z.infer<typeof businessSubmissionSchema>
export type PublicBusiness = z.infer<typeof businessPublicSchema>
export type AdminBusiness = z.infer<typeof businessAdminSchema>
export type BusinessStatus = z.infer<typeof businessStatusSchema>
export type BusinessItem = z.infer<typeof businessItemSchema>
