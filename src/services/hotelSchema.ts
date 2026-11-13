import { z } from 'zod'
import { heatingOptions, hotelAmenities, hotelCategories, hotelMealPlans, hotelPhotoCount, hotelTaxOptions, registrationLocations } from '../data/hotelRegistration.ts'
import { indianPhoneNumber } from './phoneNumbers.ts'

const text = (max: number) => z.string().trim().min(1).max(max)
export const hotelStatusSchema = z.enum(['pending', 'approved', 'rejected'])
export const hotelPriceSchema = z.number().min(1).max(1000000).refine((price) => Math.abs(price * 100 - Math.round(price * 100)) < 0.00001, 'Use at most two decimal places.')
export const mealPriceSchema = z.number().min(0).max(1000000).refine((price) => Math.abs(price * 100 - Math.round(price * 100)) < 0.00001, 'Use at most two decimal places.')
export const hotelDetailsSchema = z.object({
  name: text(120), location: z.enum(registrationLocations), category: z.enum(hotelCategories),
  description: text(1600).min(20), price: hotelPriceSchema,
  mealPlan: z.enum(hotelMealPlans), taxDetails: z.enum(hotelTaxOptions),
  breakfastPrice: mealPriceSchema.optional(), dinnerPrice: mealPriceSchema.optional(),
  heating: z.enum(heatingOptions),
  amenities: z.array(z.enum(hotelAmenities)).max(hotelAmenities.length).refine((items) => new Set(items).size === items.length),
  highlights: z.array(text(160)).min(1).max(8),
  roomTypes: z.array(text(100)).min(1).max(6),
  checkIn: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  checkOut: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  totalRooms: z.number().int().min(1).max(10000),
}).strict()
export const hotelSubmissionSchema = hotelDetailsSchema.extend({
  id: z.uuidv4().toLowerCase(), contactName: text(80),
  phone: text(30).transform(indianPhoneNumber).refine(Boolean, 'Enter a valid 10-digit Indian phone number.'),
  publicationConsent: z.literal(true), website: z.string().max(200).default(''),
}).strict()
export const publicHotelSchema = hotelDetailsSchema.extend({
  id: z.uuidv4().toLowerCase(), hotelId: z.string().regex(/^AVELOF_HTL_[A-F0-9]{32}$/),
  photos: z.array(z.string().regex(/^\/api\/hotel-images\/[a-f0-9-]{36}\/[0-4]$/)).min(1).max(hotelPhotoCount),
})
export const adminHotelSchema = publicHotelSchema.extend({
  contactName: z.string(), phone: z.string(), submittedPrice: hotelPriceSchema,
  status: hotelStatusSchema, version: z.number().int().min(0),
  ownerNote: z.string(), createdAt: z.string(), updatedAt: z.string(),
})
export const hotelReceiptSchema = z.object({
  saved: z.literal(true), id: z.uuidv4(), hotelId: z.string(),
  accessCode: z.string().regex(/^[a-f0-9]{64}$/), status: hotelStatusSchema,
})
export const hotelModerationSchema = z.object({
  id: z.uuidv4().toLowerCase(), version: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  status: hotelStatusSchema, price: hotelPriceSchema, ownerNote: z.string().trim().max(1000),
  breakfastPrice: mealPriceSchema.optional(), dinnerPrice: mealPriceSchema.optional(),
}).strict()
export const hotelLookupSchema = z.object({
  identifier: text(80), accessCode: z.string().trim().regex(/^[a-f0-9]{64}$/),
}).strict()
export type HotelSubmission = z.infer<typeof hotelSubmissionSchema>
export type PublicHotel = z.infer<typeof publicHotelSchema>
export type AdminHotel = z.infer<typeof adminHotelSchema>
export type HotelStatus = z.infer<typeof hotelStatusSchema>
