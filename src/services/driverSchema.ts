import { z } from 'zod'
import { driverVehicleIds } from '../data/driverRegistration.ts'
import { registrationLocations } from '../data/hotelRegistration.ts'
import { hotelPriceSchema, hotelStatusSchema } from './hotelSchema.ts'
import { indianPhoneNumber } from './phoneNumbers.ts'
const text = (max: number) => z.string().trim().min(1).max(max)
export const driverDetailsSchema = z.object({
  fullName: text(100), vehicleId: z.enum(driverVehicleIds),
  location: z.enum(registrationLocations), seats: z.number().int().min(1).max(60),
  price: hotelPriceSchema,
}).strict()
export const driverPrivateSchema = z.object({
  age: z.number().int().min(18).max(100),
  phone: text(30).transform(indianPhoneNumber).refine(Boolean, 'Enter a valid Indian phone number.'),
  licenceNumber: text(40).regex(/^[A-Za-z0-9 -]{5,40}$/),
  vehicleNumber: text(30).regex(/^[A-Za-z0-9 -]{5,30}$/),
})
export const driverSubmissionSchema = driverDetailsSchema.extend({
  ...driverPrivateSchema.shape, id: z.uuidv4().toLowerCase(),
  publicationConsent: z.literal(true), website: z.string().max(200).default(''),
}).strict()
export const publicDriverSchema = driverDetailsSchema.extend({
  id: z.uuidv4(), driverId: z.string().regex(/^AVELOF_DRV_[A-F0-9]{32}$/),
  vehicleName: text(120), maskedPhone: z.string().regex(/^[0-9*]+$/),
  photo: z.string().regex(/^\/api\/driver-images\/[a-f0-9-]{36}\/0$/),
  averageRating: z.number().min(1).max(5).nullable().default(null), reviewCount: z.number().int().min(0).default(0),
})
export const adminDriverSchema = publicDriverSchema.extend({
  ...driverPrivateSchema.shape, submittedPrice: hotelPriceSchema, status: hotelStatusSchema,
  version: z.number().int().min(0), ownerNote: z.string(), createdAt: z.string(),
})
export const driverReceiptSchema = z.object({
  saved: z.literal(true), id: z.uuidv4(), driverId: z.string().regex(/^AVELOF_DRV_[A-F0-9]{32}$/),
  accessCode: z.string().regex(/^[a-f0-9]{64}$/), status: hotelStatusSchema,
})
export const ownerDriverSchema = adminDriverSchema.omit({ photo: true, version: true })
export type DriverSubmission = z.infer<typeof driverSubmissionSchema>
export type PublicDriver = z.infer<typeof publicDriverSchema>
export type AdminDriver = z.infer<typeof adminDriverSchema>
