export interface MapCoordinates {
  latitude: number
  longitude: number
}

export function mapCoordinates(value: { latitude?: number | null; longitude?: number | null }): MapCoordinates | undefined {
  return typeof value.latitude === 'number' && Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90
    && typeof value.longitude === 'number' && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180
    ? { latitude: value.latitude, longitude: value.longitude } : undefined
}

export function locationFields(value: MapCoordinates | undefined) {
  return value ?? { latitude: null, longitude: null }
}

export function googleMapsLocationUrl(value: MapCoordinates) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${value.latitude},${value.longitude}`)}`
}
