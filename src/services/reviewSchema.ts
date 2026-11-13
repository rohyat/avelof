import { z } from 'zod'

export const reviewStatusSchema = z.enum(['pending', 'published', 'rejected'])
export const driverReviewIdSchema = z.string().regex(/^AVELOF-DRV-[0-9]{5,10}$/)
export const hotelReviewIdSchema = z.string().regex(/^AVELOF_HTL_[A-F0-9]{32}$/)
export const reviewSubmissionSchema = z.object({
  id: z.uuidv4(),
  reviewerName: z.string().trim().max(80).default(''),
  bookingId: z.string().trim().max(80).default(''),
  experience: z.enum(['General experience', 'Deluxe', 'Premium', 'Luxury', 'Custom package', 'Hotel stay', 'Cab rental', 'Driver experience']),
  driverId: z.union([driverReviewIdSchema, z.literal('')]).default(''),
  hotelId: z.union([hotelReviewIdSchema, z.literal('')]).default(''),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).default(''),
  reviewText: z.string().trim().max(1600).default(''),
  publicationConsent: z.literal(true),
  website: z.string().max(200).default(''),
}).strict().superRefine((review, context) => {
  const scoped = Boolean(review.driverId || review.hotelId)
  const written = Boolean(review.title || review.reviewText)
  if (review.driverId && review.hotelId) context.addIssue({ code: 'custom', path: ['hotelId'], message: 'Choose one review subject.' })
  if (!scoped && !review.reviewerName) context.addIssue({ code: 'custom', path: ['reviewerName'], message: 'Enter a display name.' })
  if (!scoped && review.reviewText.length < 20) context.addIssue({ code: 'custom', path: ['reviewText'], message: 'Review must contain at least 20 characters.' })
  if (scoped && written && !review.reviewerName) context.addIssue({ code: 'custom', path: ['reviewerName'], message: 'Enter your display name when adding written feedback.' })
  if (scoped && written && !review.bookingId) context.addIssue({ code: 'custom', path: ['bookingId'], message: 'Enter your booking ID when adding written feedback.' })
})

export type ReviewSubmission = z.infer<typeof reviewSubmissionSchema>

export const publicReviewSchema = z.object({
  id: z.uuidv4(), reviewerName: z.string(), bookingId: z.string(), experience: z.string(),
  rating: z.number().int().min(1).max(5), title: z.string(), reviewText: z.string(),
  driverId: driverReviewIdSchema.nullable().default(null),
  hotelId: hotelReviewIdSchema.nullable().default(null),
  publishedAt: z.string(),
  reviewMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable().default(null),
})

export const adminReviewSchema = publicReviewSchema.omit({ publishedAt: true }).extend({
  status: reviewStatusSchema, version: z.number().int().min(0),
  createdAt: z.string(), publishedAt: z.string().nullable(),
  submissionSource: z.enum(['guest_submission', 'owner_provided']).default('guest_submission'),
})

export type PublicReview = z.infer<typeof publicReviewSchema>
export type AdminReview = z.infer<typeof adminReviewSchema>
export type ReviewStatus = z.infer<typeof reviewStatusSchema>