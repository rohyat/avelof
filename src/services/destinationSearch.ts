import { destinationOptions } from '../data/destinationOptions.ts'
import { activitiesForPlaces } from '../data/activities.ts'
import { parseRecentSearches, searchSuggestions } from './searchSuggestions.ts'

export interface PlaceSuggestion {
  id: string
  label: string
  destinationId: string
  destinationName: string
  aliases: string[]
  detail?: string
  priority?: boolean
}

const attractionAliases: Record<string, string[]> = {
  'Chandanwari': ['Chand anwari', 'Chandwani', 'Chandan Wari'],
  'Drung Waterfall': ['Drang Waterfall', 'Drung', 'Drang', 'Drunk Waterfall'],
  'Betaab Valley': ['Betab Valley'],
  'Thajiwas area': ['Thajiwas Glacier'],
}

export const placeSuggestions: PlaceSuggestion[] = destinationOptions.flatMap((place) => [
  { id: place.id, label: place.name, destinationId: place.id, destinationName: place.name, aliases: place.aliases, priority: true },
  ...place.attractions.map((attraction) => ({
    id: `${place.id}:${attraction.name}`, label: attraction.name, destinationId: place.id, destinationName: place.name,
    aliases: attractionAliases[attraction.name] ?? [], detail: `In ${place.name}`,
  })),
  ...activitiesForPlaces([place.id]).map((activity) => ({
    id: activity.id, label: activity.name, destinationId: place.id, destinationName: place.name, aliases: [], detail: `In ${place.name}`,
  })),
])

export function searchPlaceSuggestions(value: string) {
  return searchSuggestions(placeSuggestions, value)
}

export const recentPlaceSearchesKey = 'avelof:recent-place-searches'

export function parseRecentPlaceSearches(value: string | null) {
  return parseRecentSearches(value, placeSuggestions)
}
