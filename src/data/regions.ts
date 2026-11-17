export const regions = ['Jammu', 'Kashmir', 'Ladakh'] as const
export type Region = (typeof regions)[number]

export const hotelLocationsByRegion = {
  Kashmir: ['Srinagar', 'Gulmarg', 'Pahalgam', 'Sonamarg', 'Doodhpathri', 'Yusmarg', 'Gurez'],
  Ladakh: ['Leh', 'Nubra Valley', 'Hunder', 'Diskit', 'Turtuk', 'Pangong', 'Kargil', 'Lamayuru', 'Hanle', 'Tso Moriri'],
  Jammu: ['Jammu', 'Katra', 'Patnitop', 'Udhampur', 'Reasi', 'Bhaderwah', 'Kishtwar', 'Rajouri', 'Poonch', 'Kathua', 'Samba', 'Ramban'],
} as const satisfies Record<Region, readonly string[]>

export const driverLocationsByRegion = {
  Kashmir: ['Anantnag', 'Bandipora', 'Baramulla', 'Budgam', 'Ganderbal', 'Kulgam', 'Kupwara', 'Pulwama', 'Shopian', 'Srinagar'],
  Ladakh: ['Kargil', 'Leh'],
  Jammu: ['Doda', 'Jammu', 'Kathua', 'Kishtwar', 'Poonch', 'Rajouri', 'Ramban', 'Reasi', 'Samba', 'Udhampur'],
} as const satisfies Record<Region, readonly string[]>

export function listingRegion(listing: { region?: Region; location: string }): Region {
  if (listing.region) return listing.region
  if ([...hotelLocationsByRegion.Ladakh, ...driverLocationsByRegion.Ladakh].some((place) => place === listing.location)) return 'Ladakh'
  if ([...hotelLocationsByRegion.Jammu, ...driverLocationsByRegion.Jammu].some((place) => place === listing.location)) return 'Jammu'
  return 'Kashmir'
}

export function regionFromPath(path: string): Region {
  if (/^\/ladakh(?:\/|$)/.test(path)) return 'Ladakh'
  if (/^\/jammu(?:\/|$)/.test(path)) return 'Jammu'
  return 'Kashmir'
}

export const regionBasePath = (region: Region) => region === 'Kashmir' ? '' : `/${region.toLowerCase()}`
export const regionHomePath = (region: Region) => region === 'Jammu' ? '/jammu/hotels' : regionBasePath(region) || '/'
