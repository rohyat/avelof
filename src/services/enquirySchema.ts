import { z } from 'zod'
import { indianPhoneNumber } from './phoneNumbers.ts'

const shortText = z.string().trim().max(300)
const dateText = z.iso.date()
const guestCount = z.string().regex(/^(0|[1-9]\d{0,2})$/).refine((value) => Number(value) <= 100)

export const enquirySchema = z.object({
  reference: z.string().regex(/^AV-[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/),
  kind: z.enum(['package', 'hotel', 'car', 'contact']),
  website: z.string().max(200).default(''),
  fields: z.object({
    fullName: z.string().trim().min(1).max(100),
    phoneNumber: z.string().trim().regex(/^[+0-9\s()-]{7,25}$/).refine((value) => Boolean(indianPhoneNumber(value))),
    adults: guestCount.refine((value) => Number(value) >= 1),
    children: guestCount,
    packagePreference: shortText.optional(),
    travelGroup: z.enum(['Couple', 'Family', 'Friends', 'Solo traveller', 'Group']).optional(),
    carRental: shortText.optional(),
    arrivalDate: dateText.optional(),
    departureDate: dateText.optional(),
    startDate: dateText.optional(),
    endDate: dateText.optional(),
    checkInDate: dateText.optional(),
    checkOutDate: dateText.optional(),
    preferredStay: shortText.optional(),
    stayDuration: shortText.optional(),
    breakfast: z.enum(['Included', 'Not included']).optional(),
    dinner: z.enum(['Included', 'Not included']).optional(),
    nightlyRate: shortText.optional(),
    tripDays: shortText.optional(),
    tripNights: shortText.optional(),
    rentalDays: shortText.optional(),
    vehicleDailyRate: shortText.optional(),
    vehicleRentalEstimate: shortText.optional(),
    placesToVisit: z.string().trim().max(20000).optional(),
    selectedDestinations: z.string().trim().max(2000).optional(),
    planningNote: z.string().trim().max(2000).optional(),
    customDetails: z.string().trim().max(20000).optional(),
  }).strict(),
}).strict().superRefine(({ kind, fields }, context) => {
  const start = kind === 'hotel' ? fields.checkInDate : kind === 'car' ? fields.startDate : fields.arrivalDate
  const end = kind === 'hotel' ? fields.checkOutDate : kind === 'car' ? fields.endDate : fields.departureDate
  if (kind !== 'contact' && (!start || !end || (kind === 'car' ? end < start : end <= start))) {
    context.addIssue({ code: 'custom', message: 'Valid start and end dates are required.', path: ['fields'] })
  }
  const selection = kind === 'hotel' ? fields.preferredStay : kind === 'car' ? fields.carRental : fields.packagePreference
  if (!selection) context.addIssue({ code: 'custom', message: 'An enquiry preference is required.', path: ['fields'] })
})