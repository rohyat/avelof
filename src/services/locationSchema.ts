import { z } from 'zod'

export const coordinateFields = {
  latitude: z.number().finite().min(-90).max(90).nullable().optional(),
  longitude: z.number().finite().min(-180).max(180).nullable().optional(),
}

export function coordinatesPaired(value: { latitude?: number | null; longitude?: number | null }) {
  return value.latitude === undefined && value.longitude === undefined
    || value.latitude === null && value.longitude === null
    || typeof value.latitude === 'number' && typeof value.longitude === 'number'
}

export const coordinatePairError = 'Supply both latitude and longitude, or clear both.'
