import { z } from 'zod'
import { driverDistricts, driverVehicleIds, driverVehicleNumberPattern, normalizeDriverVehicleNumber } from '../data/driverRegistration.ts'
import { hotelLookupSchema, hotelStatusSchema } from './hotelSchema.ts'
import { indianPhoneNumber } from './phoneNumbers.ts'
import { partnerStatusAccessCodePattern } from './partnerAccessCode.ts'
const text = (max: number) => z.string().trim().min(1).max(max)
export const driverDetailsSchema = z.object({
  fullName: text(100), vehicleId: z.enum(driverVehicleIds),
  location: text(80), seats: z.number().int().min(1).max(60),
}).strict()
export const driverPrivateSchema = z.object({
  age: z.number().int().min(18).max(100),
  phone: text(30).transform(indianPhoneNumber).refine(Boolean, 'Enter a valid Indian phone number.'),
  licenceNumber: text(40).regex(/^[A-Za-z0-9 -]{5,40}$/),
  vehicleNumber: text(30).regex(/^[A-Za-z0-9 -]{5,30}$/),
})
export const driverVehicleNumberSchema = z.string().trim().transform(normalizeDriverVehicleNumber)
  .refine((value) => driverVehicleNumberPattern.test(value), 'Use JK13B-1444 or JK01AB-1485 format.')
export const driverSubmissionSchema = driverDetailsSchema.extend({
  ...driverPrivateSchema.shape, location: z.enum(driverDistricts), vehicleNumber: driverVehicleNumberSchema, id: z.uuidv4().toLowerCase(),
  publicationConsent: z.literal(true), website: z.string().max(200).default(''),
}).strict()
export const driverEditDetailsSchema = driverSubmissionSchema.omit({ id: true })
export const driverEditAuthSchema = hotelLookupSchema.extend({
  version: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
}).strict()
export const publicDriverSchema = driverDetailsSchema.extend({
  id: z.uuidv4(), driverId: z.string().regex(/^AVELOF-DRV-[0-9]{5,10}$/),
  vehicleName: text(120), maskedPhone: z.string().regex(/^[0-9*]+$/),
  vehicleNumber: driverPrivateSchema.shape.vehicleNumber.optional(),
  maskedLicenceNumber: z.string().regex(/^[A-Z0-9*]+$/).optional(),
  photo: z.string().regex(/^\/api\/driver-images\/[a-f0-9-]{36}\/0$/),
  averageRating: z.number().min(1).max(5).nullable().default(null), reviewCount: z.number().int().min(0).default(0),
})
export const adminDriverSchema = publicDriverSchema.extend({
  ...driverPrivateSchema.shape, status: hotelStatusSchema,
  version: z.number().int().min(0), ownerNote: z.string(), createdAt: z.string(),
})
export const driverStatusResultSchema = publicDriverSchema.omit({ photo: true, averageRating: true, reviewCount: true }).extend({
  ...driverPrivateSchema.shape, status: hotelStatusSchema, version: z.number().int().min(0),
})
export const driverReceiptSchema = z.object({
  saved: z.literal(true), id: z.uuidv4(), driverId: z.string().regex(/^AVELOF-DRV-[0-9]{5,10}$/),
  accessCode: z.string().regex(partnerStatusAccessCodePattern), status: hotelStatusSchema,
})
export type DriverSubmission = z.infer<typeof driverSubmissionSchema>
export type DriverEditDetails = z.infer<typeof driverEditDetailsSchema>
export type DriverEditAuth = z.infer<typeof driverEditAuthSchema>
export type OwnerDriver = z.infer<typeof driverStatusResultSchema>
export type PublicDriver = z.infer<typeof publicDriverSchema>
export type AdminDriver = z.infer<typeof adminDriverSchema>
