import { destinations } from './catalog.ts'

type RouteEstimate = { distance: string; time: string }

// Approximate road journeys to town centres (Shiv Khori is measured to Ransoo).
// Sources: J&K Tourism, Reasi district and existing Srinagar destination guides.
const jammuRoutes: Record<string, RouteEstimate> = {
  'Jammu|Katra': { distance: '45-50 km', time: '1.5-2 hours' },
  'Jammu|Patnitop': { distance: '110-115 km', time: '3-4 hours' },
  'Jammu|Shiv Khori': { distance: '80-130 km', time: '3-4.5 hours' },
  'Jammu|Srinagar': { distance: '250-270 km', time: '7-10 hours' },
  'Katra|Patnitop': { distance: '80-95 km', time: '2.5-3.5 hours' },
  'Katra|Shiv Khori': { distance: '65-80 km', time: '2-3 hours' },
  'Patnitop|Shiv Khori': { distance: '140-155 km', time: '4-5 hours' },
}

export function routeEstimate(from: string, to: string): RouteEstimate | null {
  if (from === to) return null
  const key = [from, to].sort().join('|')
  const known = jammuRoutes[key]
  if (known) return known
  const other = from === 'Srinagar' ? to : to === 'Srinagar' ? from : ''
  const place = destinations.find(destination => destination.name === other)
  return place ? { distance: place.distance, time: place.travelTime } : null
}

export function itineraryRouteLegs(start: string, destination: string, overnight: string, dayType: 'Travel' | 'Leisure') {
  if (dayType !== 'Travel') return []
  const legs = [{ from: start, to: destination }]
  if (overnight && overnight !== destination) legs.push({ from: destination, to: overnight })
  return legs.filter(leg => leg.from !== leg.to).map(leg => ({ ...leg, estimate: routeEstimate(leg.from, leg.to) }))
}

export function formatItineraryRouteLeg(leg: ReturnType<typeof itineraryRouteLegs>[number]) {
  return leg.estimate
    ? `${leg.from} to ${leg.to}: approx. ${leg.estimate.distance}, ${leg.estimate.time} driving`
    : `${leg.from} to ${leg.to}: distance and driving time to be confirmed`
}
