export const registrationLocations = ['Srinagar', 'Gulmarg', 'Pahalgam', 'Sonamarg', 'Doodhpathri', 'Yusmarg', 'Gurez'] as const
export const hotelLocationCodes: Record<(typeof registrationLocations)[number], string> = {
  Srinagar: 'SRG',
  Gulmarg: 'GLM',
  Pahalgam: 'PHL',
  Sonamarg: 'SNG',
  Doodhpathri: 'DDP',
  Yusmarg: 'YSM',
  Gurez: 'GRZ',
}
export const hotelIdPattern = /^AVELOF_HTL_[0-9]{5,10}[A-Z]{3}$/
export const hotelLookupIdPattern = /^(?:AVELOF_HTL_[0-9]{5,10}[A-Z]{3}|AVELOF_HTL_[A-F0-9]{32})$/
export const hotelCategories = ['Deluxe', 'Premium', 'Luxury'] as const
export const hotelPriceRanges = Array.from({ length: 9 }, (_, index) => {
  const minimum = 1500 + index * 1000
  const maximum = minimum + 1000
  return { value: `${minimum}-${maximum}`, minimum, maximum, label: `₹${minimum.toLocaleString('en-IN')}–₹${maximum.toLocaleString('en-IN')}` }
})
export const hotelCategoryLabels = { Deluxe: 'Deluxe - 2-star', Premium: 'Premium - 3-star', Luxury: 'Luxury - 4-5-star' }
export const hotelRoomTypes = ['Standard', 'Deluxe', 'Premium', 'Family', 'Suite'] as const
export const hotelRoomOccupancy = (roomType?: string) => roomType === 'Family' ? 4 : 2
export const hotelRoomMealMultiplier = (roomType?: string) => roomType === 'Family' ? 1.5 : 1
export const hotelRoomRateBasis = (roomType?: string) => `per room per night for ${hotelRoomOccupancy(roomType)} people`
export const minimumHotelRooms = (people: number, roomType?: string) => Math.max(1, Math.ceil(people / hotelRoomOccupancy(roomType)))
export const hotelHighlightOptions = ['Mountain views', 'Near the market', 'Near local attractions', 'Garden or outdoor space', 'On-site restaurant', 'Room service', 'Family-friendly stay', 'Centralised heating'] as const
export const hotelAmenities = ['Wi-Fi', 'Parking', 'Restaurant', 'Room service', 'Hot water', 'Power backup', 'Lift', 'Wheelchair access', 'Air conditioning'] as const
export const heatingOptions = ['Centralised heating', 'Room heaters', 'No heating'] as const
export const hotelMealPlans = ['Room only', 'Breakfast included', 'Breakfast and dinner included', 'All meals included'] as const
export const hotelTaxOptions = ['Taxes included', 'Taxes extra'] as const
export const hotelStatusLabels = { pending: 'Awaiting approval', approved: 'Approved', rejected: 'Rejected' }
export const hotelPhotoCount = 5
export const hotelPhotoDimension = 1920
export const hotelPhotoLimit = 1000000
export const hotelUploadLimit = hotelPhotoCount * hotelPhotoLimit + 32000
