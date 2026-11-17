import { hotelLocationsByRegion } from './regions.ts'

export const businessKinds = ['restaurant', 'shop', 'handicraft'] as const
export const businessLocations = hotelLocationsByRegion.Kashmir
export const businessPhotoLimit = 1000000
export const businessUploadLimit = businessPhotoLimit * 25 + 100000

export const businessKindLabels: Record<(typeof businessKinds)[number], string> = {
  restaurant: 'Restaurant',
  shop: 'Shop',
  handicraft: 'Handicraft Business',
}
