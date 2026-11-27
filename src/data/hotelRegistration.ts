import { hotelLocationsByRegion } from './regions.ts'

export const registrationLocations = [...hotelLocationsByRegion.Kashmir, ...hotelLocationsByRegion.Ladakh, ...hotelLocationsByRegion.Jammu] as const
export const propertyTypes = ['Hotel', 'Houseboat'] as const
export type PropertyType = (typeof propertyTypes)[number]
export const propertyTypeOf = (stay: { propertyType?: string }): PropertyType => stay.propertyType === 'Houseboat' ? 'Houseboat' : 'Hotel'
export const houseboatLocations = ['Srinagar'] as const
export const houseboatAreas = ['Dal Lake', 'Nigeen Lake', 'Jhelum River'] as const
export function hotelAreaOptions(destination: string, propertyType: PropertyType = 'Hotel'): string[] {
  if (propertyType === 'Houseboat') return destination === 'Srinagar' ? [...houseboatAreas] : []
  if (destination === 'Gulmarg') return ['Main Gulmarg', 'Tangmarg']
  if (destination === 'Pahalgam') return ['Main Pahalgam', 'Rafting Point']
  if (destination === 'Srinagar') return ['Dal Lake', 'Near Dal Lake', 'Near Airport', 'Main Srinagar']
  if (destination === 'Leh') return ['Main Leh', 'Changspa', 'Choglamsar']
  if (destination === 'Nubra Valley') return ['Hunder', 'Diskit', 'Sumur', 'Panamik']
  if (destination === 'Pangong') return ['Spangmik', 'Man', 'Merak']
  if (destination === 'Jammu') return ['Main Jammu', 'Near Jammu Tawi railway station', 'Near Jammu Airport']
  if (destination === 'Katra') return ['Katra town (Vaishno Devi base)', 'Near Katra railway station']
  return registrationLocations.some((location) => location === destination) ? [`Main ${destination}`] : []
}
export function hotelLocationLabel(hotel: { location: string; exactLocation?: string }) {
  return hotel.exactLocation ? `${hotel.exactLocation}, ${hotel.location}` : hotel.location
}
export const hotelLocationCodes: Record<(typeof registrationLocations)[number], string> = {
  Srinagar: 'SRG',
  Gulmarg: 'GLM',
  Pahalgam: 'PHL',
  Sonamarg: 'SNG',
  Doodhpathri: 'DDP',
  Yusmarg: 'YSM',
  Gurez: 'GRZ',
  Leh: 'LEH', 'Nubra Valley': 'NBR', Hunder: 'HND', Diskit: 'DSK', Turtuk: 'TRT', Pangong: 'PNG',
  Kargil: 'KGL', Lamayuru: 'LMY', Hanle: 'HNL', 'Tso Moriri': 'TSM',
  Jammu: 'JMU', Katra: 'KTR', Patnitop: 'PTP', Udhampur: 'UDH', Reasi: 'RSI', Bhaderwah: 'BHD',
  Kishtwar: 'KSW', Rajouri: 'RJR', Poonch: 'PNC', Kathua: 'KTH', Samba: 'SMB', Ramban: 'RMB',
}
export const hotelIdPattern = /^AVELOF_(?:HTL|HB)_[0-9]{5,10}[A-Z]{3}$/
export const hotelLookupIdPattern = /^(?:AVELOF_(?:HTL|HB)_[0-9]{5,10}[A-Z]{3}|AVELOF_HTL_[A-F0-9]{32})$/
export const stayIdPrefix = (propertyType: PropertyType) => propertyType === 'Houseboat' ? 'AVELOF_HB_' : 'AVELOF_HTL_'
export const hotelCategories = ['Deluxe', 'Premium', 'Premium Plus', 'Diamond', 'Luxury'] as const
export const houseboatCategories = ['Standard Houseboat', 'Deluxe Houseboat', 'Premium Houseboat', 'Luxury Houseboat'] as const
export const stayCategories = [...hotelCategories, ...houseboatCategories] as const
export const categoriesFor = (propertyType: PropertyType): readonly string[] => propertyType === 'Houseboat' ? houseboatCategories : hotelCategories
export const hotelPriceRanges = Array.from({ length: 9 }, (_, index) => {
  const minimum = 1500 + index * 1000
  const maximum = minimum + 1000
  return { value: `${minimum}-${maximum}`, minimum, maximum, label: `₹${minimum.toLocaleString('en-IN')}–₹${maximum.toLocaleString('en-IN')}` }
})
export const hotelCategoryLabels = {
  Deluxe: 'Deluxe - 2-star',
  Premium: 'Premium - 3-star',
  'Premium Plus': 'Premium Plus - 3-star Plus',
  Diamond: 'Diamond - 4-star',
  Luxury: 'Luxury - 5-star',
  'Standard Houseboat': 'Standard Houseboat',
  'Deluxe Houseboat': 'Deluxe Houseboat',
  'Premium Houseboat': 'Premium Houseboat',
  'Luxury Houseboat': 'Luxury Houseboat',
} satisfies Record<(typeof stayCategories)[number], string>
export function hotelCategoryLabel(category: string) {
  const tier = stayCategories.find((value) => value === category)
  return tier ? hotelCategoryLabels[tier] : category
}
export const registrationRoomTypes = ['Deluxe', 'Premium', 'Family', 'Suite', 'Dal view'] as const
export const hotelRoomTypes = ['Standard', ...registrationRoomTypes] as const
export function roomTypesFor(exactLocation?: string): readonly (typeof registrationRoomTypes)[number][] {
  const isDalLake = exactLocation === 'Dal Lake' || exactLocation === 'Near Dal Lake'
  return isDalLake ? registrationRoomTypes : registrationRoomTypes.filter((rt) => rt !== 'Dal view') as unknown as (typeof registrationRoomTypes)[number][]
}
export const hotelRoomOccupancy = (roomType?: string) => roomType === 'Family' ? 4 : roomType === 'Dal view' ? 2 : 2
export const hotelRoomMealMultiplier = (roomType?: string) => roomType === 'Family' ? 2 : 1
export const hotelRoomRateBasis = (roomType?: string) => `per room per night for ${hotelRoomOccupancy(roomType)} people`
export const minimumHotelRooms = (people: number, roomType?: string) => Math.max(1, Math.ceil(people / hotelRoomOccupancy(roomType)))
const roomComfortHighlights = ['Private attached bathrooms', 'In-room tea & coffee facilities'] as const
export const hotelHighlightOptions = ['Mountain views', 'Near the market', 'Near local attractions', 'Garden or outdoor space', 'On-site restaurant', 'Room service', 'Family-friendly stay', 'Centralised heating', ...roomComfortHighlights, 'On-site cafe'] as const
export const houseboatHighlightOptions = ['Lake views', 'Traditional walnut-wood interiors', 'Near the Boulevard', 'Family-friendly stay', 'Home-cooked Kashmiri meals', 'Peaceful location', ...roomComfortHighlights] as const
export const highlightOptionsFor = (propertyType: PropertyType): readonly string[] => propertyType === 'Houseboat' ? houseboatHighlightOptions : hotelHighlightOptions
export const houseboatOnlyAmenities = ['Shikara pick-up & drop', 'Lake-view sundeck', 'Whole-boat booking'] as const
const hotelOnlyAmenities = ['Lift', 'Wheelchair access', 'Restaurant', 'On-site cafe'] as const
export const premiumAmenities = ['Gym', 'Swimming pool', 'Jacuzzi'] as const
export const hotelAmenities = ['Wi-Fi', 'Parking', 'Restaurant', 'Room service', 'Hot water', 'Power backup', 'Lift', 'Wheelchair access', 'Air conditioning', 'Private attached bathroom', 'Shower', 'Bathtub', 'Towels', 'Toiletries', 'Hair dryer', 'Electric kettle', 'Tea/coffee maker', 'Tea & coffee supplies', 'On-site cafe', ...premiumAmenities, ...houseboatOnlyAmenities] as const
const basicAmenities = ['Private attached bathroom', 'Shower', 'Towels', 'Toiletries'] as const
export const amenitiesFor = (propertyType: PropertyType): readonly (typeof hotelAmenities)[number][] => hotelAmenities.filter((amenity) =>
  !basicAmenities.some((value) => value === amenity)
  && (propertyType === 'Houseboat'
    ? !hotelOnlyAmenities.some((value) => value === amenity)
    : !houseboatOnlyAmenities.some((value) => value === amenity)))
export const heatingOptions = ['Centralised heating', 'Hot & cold AC', 'Room heaters', 'No heating'] as const
export const hotelMealPlans = ['Room only', 'Breakfast included', 'Breakfast and dinner included', 'All meals included'] as const
export const hotelTaxLabel = 'Rates exclude GST'
export const hotelTaxOptions = [hotelTaxLabel, 'All taxes included', 'Taxes included', 'Taxes extra'] as const
export const hotelStatusLabels = { pending: 'Awaiting approval', approved: 'Approved', rejected: 'Rejected' }
export const hotelPhotoCount = 5
export const hotelPhotoDimension = 1920
export const hotelPhotoLimit = 1000000
export const hotelUploadLimit = hotelPhotoCount * hotelPhotoLimit + 32000
