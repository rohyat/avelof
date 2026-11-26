import { z } from 'zod'
import { rentalCars } from '../data/catalog.ts'

const shortText = z.string().trim().min(1).max(160)
export const itineraryImageSchema = z.string().regex(/^\/(?:images\/[a-zA-Z0-9_./-]+\.(?:jpg|jpeg|png|webp)|api\/hotel-images\/[a-f0-9-]{36}\/[0-4])$/).refine(path => !path.includes('..'), 'Choose a website photograph.')
export const itineraryDaySchema = z.object({
  dayType: z.enum(['Travel', 'Leisure']),
  id: z.uuidv4(), destination: shortText, overnight: z.string().trim().max(80),
  overnightType: z.enum(['Hotel', 'Houseboat']),
  title: shortText, detail: z.string().trim().min(1).max(800),
  bullets: z.array(shortText).max(5), image: itineraryImageSchema,
}).strict()
export const itineraryRoomTypes = ['Double', 'Triple', 'Family'] as const
export type ItineraryRoomType = typeof itineraryRoomTypes[number]
const itineraryDraftObjectSchema = z.object({
  guestName: z.string().trim().min(1, 'Enter the guest name first.').max(60).regex(/^[\x20-\x7e]+$/, 'Use English letters for the guest name so it displays correctly in the PDF.'),
  title: shortText.max(80), tier: z.enum(['deluxe', 'premium', 'luxury']),
  travellers: z.number().int().min(1).max(100), roomsPerNight: z.number().int().min(1).max(100).nullable(),
  roomTypes: z.array(z.enum(itineraryRoomTypes)).max(100),
  roomExtraBeds: z.array(z.boolean()).max(100), pricePerPerson: z.number().min(0).max(10000000),
  travelDate: z.union([z.literal(''), z.iso.date()]),
  arrivalLocation: z.enum(['Srinagar', 'Jammu', 'Katra']), arrivalSightseeing: z.boolean(),
  advancePercent: z.number().int().min(0).max(100),
  priceNote: z.string().trim().max(120),
  transport: shortText.max(60).refine(value => rentalCars.some(vehicle => vehicle.name === value), 'Choose a vehicle from the website list.'),
  days: z.array(itineraryDaySchema).min(2).max(15),
  hotelChoices: z.record(z.string().max(80), z.array(z.uuidv4()).max(3)),
  hotelPhotos: z.record(z.uuidv4(), itineraryImageSchema),
  hotelNames: z.record(z.string().max(80), z.object({ useCategory: z.boolean(), name: z.string().trim().max(120) }).strict()),
  packageItems: z.array(z.object({ id: z.string().min(1).max(80), label: shortText, included: z.boolean() }).strict()).min(1).max(40)
    .refine(items => new Set(items.map(item => item.id)).size === items.length, 'Checklist items must have unique IDs.'),
  tips: z.array(z.object({ title: shortText.max(40), detail: z.string().trim().min(1).max(250) }).strict()).max(8),
}).strict().superRefine((data, ctx) => {
  if (data.packageItems.some(item => item.id === 'accommodation' && item.included) && data.roomsPerNight === null) {
    ctx.addIssue({ code: 'custom', path: ['roomsPerNight'], message: 'Enter the number of rooms per night.' })
  }
  if (data.roomExtraBeds.length !== (data.roomsPerNight ?? 0)) {
    ctx.addIssue({ code: 'custom', path: ['roomExtraBeds'], message: 'Check the extra-bed selection for each room.' })
  }
      if (data.roomTypes.length !== (data.roomsPerNight ?? 0)) {
        ctx.addIssue({ code: 'custom', path: ['roomTypes'], message: 'Choose a room type for each room.' })
      }
      if (data.roomExtraBeds.some((extraBed, index) => extraBed && data.roomTypes[index] !== 'Double')) {
        ctx.addIssue({ code: 'custom', path: ['roomExtraBeds'], message: 'Extra beds are available only for Double rooms.' })
      }
  data.days.forEach((day, index) => {
    const start = index === 0 ? data.arrivalLocation : data.days[index - 1].overnight
    if (day.dayType === 'Leisure' && (day.destination !== start || day.overnight !== start)) ctx.addIssue({ code: 'custom', path: ['days', index, 'dayType'], message: 'A leisure day stays in the same place as the previous night.' })
    if (index < data.days.length - 1 && day.dayType === 'Travel' && ![day.destination, 'Srinagar', start].includes(day.overnight)) ctx.addIssue({ code: 'custom', path: ['days', index, 'overnight'], message: 'Choose the visited destination, Srinagar, or the starting location for the night.' })
    if (day.overnight === 'Shiv Khori') ctx.addIssue({ code: 'custom', path: ['days', index, 'overnight'], message: 'Shiv Khori is a day trip and cannot be an overnight stay.' })
    if (day.destination === 'Shiv Khori' && day.overnight !== start) ctx.addIssue({ code: 'custom', path: ['days', index, 'overnight'], message: 'Return to the starting location after visiting Shiv Khori.' })
    if (index === data.days.length - 1 && day.dayType !== 'Travel') ctx.addIssue({ code: 'custom', path: ['days', index, 'dayType'], message: 'The departure day must be Travel.' })
    if (index === data.days.length - 1 && !['Srinagar', 'Jammu'].includes(day.destination)) ctx.addIssue({ code: 'custom', path: ['days', index, 'destination'], message: 'Departure must be Srinagar or Jammu.' })
    if (index === 0 && !data.arrivalSightseeing && day.destination !== data.arrivalLocation) ctx.addIssue({ code: 'custom', path: ['days', index, 'destination'], message: 'Choose a Day 1 destination or keep arrival and transfer only.' })
    if (day.overnightType === 'Houseboat' && day.overnight !== 'Srinagar') ctx.addIssue({ code: 'custom', path: ['days', index, 'overnightType'], message: 'Houseboats are available only for Srinagar stays.' })
    if (index < data.days.length - 1 && !day.overnight) ctx.addIssue({ code: 'custom', path: ['days', index, 'overnight'], message: 'Choose an overnight destination for each night.' })
    if (index === data.days.length - 1 && day.overnight) ctx.addIssue({ code: 'custom', path: ['days', index, 'overnight'], message: 'The final day is departure; no overnight stay.' })
  })
})
// Templates saved before room types existed only had Double rooms with optional extra beds.
export const itineraryDraftSchema = z.preprocess(value => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || 'roomTypes' in value) return value
  const roomExtraBeds = (value as { roomExtraBeds?: unknown }).roomExtraBeds
  return Array.isArray(roomExtraBeds) ? { ...value, roomTypes: roomExtraBeds.map(() => 'Double') } : value
}, itineraryDraftObjectSchema)
export type ItineraryDraft = z.infer<typeof itineraryDraftObjectSchema>
export type BuilderDay = z.infer<typeof itineraryDaySchema>
