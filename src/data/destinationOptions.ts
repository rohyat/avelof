import { destinations } from './catalog'

export const combinedExcursionId = 'aharbal-peer-ki-gali'

export function destinationOptionId(id: string) {
  return id === 'aharbal' || id === 'peer-ki-gali' ? combinedExcursionId : id
}

const aharbal = destinations.find((place) => place.id === 'aharbal')!
const peerKiGali = destinations.find((place) => place.id === 'peer-ki-gali')!

export const destinationOptions = destinations.filter((place) => place.id !== 'aharbal').map((place) => place.id === 'peer-ki-gali' ? {
  ...aharbal,
  id: combinedExcursionId,
  name: 'Aharbal Waterfall and Peer Ki Gali',
  aliases: [aharbal.name, ...aharbal.aliases, peerKiGali.name, ...peerKiGali.aliases],
  count: 'Waterfall & mountain pass',
  distance: `${aharbal.distance} to Aharbal; ${peerKiGali.distance} to Peer Ki Gali`,
  travelTime: `${aharbal.travelTime} to Aharbal; ${peerKiGali.travelTime} to Peer Ki Gali`,
  maxDriveHours: peerKiGali.maxDriveHours,
  detail: 'A combined day from Srinagar, visiting Aharbal Waterfall and the mountain pass and shrine at Peer Ki Gali before returning to Srinagar. The route is subject to road access, weather and a local feasibility check.',
  suggestedVisit: '1 full day, starting and ending in Srinagar',
  season: peerKiGali.season,
  accessNote: `${aharbal.accessNote} ${peerKiGali.accessNote}`,
  attractions: [...aharbal.attractions, ...peerKiGali.attractions],
  includedPlaces: [aharbal, peerKiGali],
} : { ...place, includedPlaces: [place] })