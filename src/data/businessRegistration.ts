import { registrationLocations } from './hotelRegistration.ts'

export const businessKinds = ['restaurant', 'shop'] as const
export const businessLocations = registrationLocations
export const businessPhotoLimit = 1000000
export const businessUploadLimit = businessPhotoLimit * 5 + 16000

export const businessKindLabels: Record<(typeof businessKinds)[number], string> = {
  restaurant: 'Restaurant',
  shop: 'Shop',
}
