export const hotelPackageDiscountPercent = 23
export const hotelPackagePriceInclusions = 'All taxes and charges included'
export const discountedHotelPackagePrice = (price: number, discountPercent = hotelPackageDiscountPercent) => Math.round(price * (10000 - Math.round(discountPercent * 100)) / 100) / 100
export const discountedHotelRoomPrice = (price: number, discountPercent = hotelPackageDiscountPercent) => Math.round(discountedHotelPackagePrice(price, discountPercent))
export const applyPackageDiscount = (packages: TourPackage[], discountPercent: number): TourPackage[] => packages.map(item => {
  if (item.underDevelopment) return item
  const originalPrice = item.originalPrice ?? item.price
  return { ...item, originalPrice, price: discountedHotelPackagePrice(originalPrice, discountPercent), discountPercent }
})
export const packagePriceForNights = (price: number, standardNights: number, selectedNights: number, arrivalDate?: string) => {
  if (!Number.isInteger(standardNights) || standardNights < 1 || !Number.isInteger(selectedNights) || selectedNights < 1) throw new RangeError('Package nights must be positive whole numbers.')
  if (arrivalDate) {
    const timestamp = Date.parse(`${arrivalDate}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(arrivalDate) || !Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== arrivalDate) throw new RangeError('Choose a valid package arrival date.')
  }
  return Math.round(price * selectedNights / standardNights * 100) / 100
}
import type { TourPackage } from '../types.ts'
