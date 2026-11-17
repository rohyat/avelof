import { ladakhEnquiryPreferences, ladakhPackages } from './ladakh.ts'
import { ladakhPhotoPreview } from './ladakhPhotos.ts'

export type LadakhJourneySection = 'packages' | 'bike-trips' | 'car-rentals'
export interface LadakhJourney {
  id: string
  section: LadakhJourneySection
  name: string
  label: string
  duration: string
  start: string
  stops: string[]
  description: string
  photo: (typeof ladakhPhotoPreview)[number]
  itinerary: { day: string; title: string; detail: string }[]
  preference: string
  checks: string[]
}

export const ladakhAltitudeNote = 'Allow at least 48 hours in Leh before higher areas such as Khardung La and Pangong. Road arrival does not remove altitude risk. Travel only if suitable and in line with current local advice; add rest days or change the route when needed.'
export const ladakhPlanningNote = 'Summer 2027 planning preview. Suggested routes only, not confirmed departures. Prices, suppliers, stays, transport, permits and road access require confirmation. An enquiry is not a booking.'
const stayChecks = ['Hotel or guesthouse category, room type and facilities', 'Meals, drinking water and any dietary requirements', 'Local transport, driver, fuel, tolls and parking', 'Permits, entry fees, taxes and cancellation terms']
const riderChecks = ['Valid licence, riding experience and high-altitude suitability', 'Bike model, condition, collection and return arrangements', 'Helmet, protective gear, fuel, deposits and insurance', 'Ride leader, support vehicle, breakdown and emergency arrangements']
const days = (entries: [string, string][]) => entries.map(([title, detail], index) => ({ day: `Day ${String(index + 1).padStart(2, '0')}`, title, detail }))
const arrival: [string, string] = ['Arrive in Leh', 'Settle into your proposed Leh stay and rest. Begin at least 48 hours of acclimatisation; do not head straight to the higher passes.']
const rest: [string, string] = ['Rest & acclimatise in Leh', 'Keep the day restful. Only gentle nearby visits if comfortable and locally advised; avoid exertion and higher-area excursions.']
const nubra: [string, string] = ['Leh to Nubra Valley', 'Only after at least 48 hours in Leh, and if suitable, discuss travel via Khardung La to Nubra. Diskit and Hunder stops depend on conditions. Proposed Nubra stay to be confirmed.']
const valley: [string, string] = ['Nubra villages & valley time', 'Allow a slower day around Diskit and Hunder, with village visits and landscape stops as appropriate. Paid activities are optional and not included.']
const turtuk: [string, string] = ['Turtuk excursion', 'A proposed excursion from Nubra to Turtuk, subject to access, permits and a suitable day plan. Return to your Nubra base; village visits should respect local customs.']
const lake: [string, string] = ['Nubra towards Pangong', 'Proposed travel to Pangong only if the connecting road is open and the journey is suitable. A high-altitude lake overnight is not compulsory: the team must check suitability and alternatives, which may need extra days.']
const returnLeh: [string, string] = ['Return to Leh', 'Return from the proposed lake circuit when roads and conditions permit. Keep time for rest and disruption; sightseeing is optional, not guaranteed.']
const departure: [string, string] = ['Departure from Leh', 'Plan your onward transfer after the final Leh night. Allow additional buffer days where possible; weather and road disruption can change the schedule.']
const itineraries = [
  days([arrival, rest, nubra, valley, lake, returnLeh, departure]),
  days([arrival, rest, nubra, turtuk, valley, lake, returnLeh, departure]),
  days([
    ['Srinagar to Kargil', 'Proposed road approach through the Sonamarg and Zoji La corridor, only when open. Confirm transport and a Kargil overnight; no fixed driving time or opening date is guaranteed.'],
    ['Kargil to Leh', 'Continue towards Leh with suitable breaks and locally confirmed stops. Road arrival does not remove altitude risk. Start the Leh acclimatisation period on arrival.'],
    rest,
    ['Another rest day in Leh', 'Allow at least 48 hours from arrival in Leh before travelling higher. Keep the day flexible and avoid exertion; add rest days when needed.'],
    nubra, valley, lake, returnLeh, departure,
  ]),
]

export const ladakhPackageJourneys: LadakhJourney[] = ladakhPackages.map((trip, index) => ({
  ...trip, id: ['ladakh-essentials', 'ladakh-explorer', 'kashmir-to-ladakh'][index], section: 'packages',
  photo: ladakhPhotoPreview[index], itinerary: itineraries[index], preference: trip.name, checks: stayChecks,
}))

export const ladakhBikeJourneys: LadakhJourney[] = [ladakhPackageJourneys[0], ladakhPackageJourneys[2]].map((trip, index) => ({
  ...trip, id: index === 0 ? 'leh-riding-circuit' : 'srinagar-entry-ride', section: 'bike-trips',
  name: index === 0 ? 'Leh-based Riding Circuit' : 'Srinagar-entry Expedition',
  label: 'Proposed motorcycle journey',
  description: index === 0 ? 'A proposed Leh, Nubra and Pangong riding circuit, with rest before the higher roads.' : 'A longer proposed road-entry ride via Kargil, followed by rest in Leh before Nubra and Pangong.',
  preference: ladakhEnquiryPreferences.bike, checks: riderChecks,
}))

export const ladakhCabJourneys: LadakhJourney[] = [
  { id: 'leh-airport-transfer', section: 'car-rentals', name: 'Leh Airport Transfer', label: 'Airport pickup or drop-off', duration: 'One-way transfer', start: 'Leh', stops: ['Leh airport', 'Leh stay'], description: 'Discuss a private transfer between Leh airport and your local stay, with vehicle size suited to your group and luggage.', photo: ladakhPhotoPreview[1],
    itinerary: [{ day: 'Transfer', title: 'Airport & local stay', detail: 'Share your flight details, arrival or departure time, stay address, group size and luggage. Pickup arrangements, waiting time, vehicle and fare must be confirmed. Rest and acclimatise after arrival.' }],
    preference: ladakhEnquiryPreferences.car, checks: ['Vehicle type, passenger seats and luggage capacity', 'Flight timing, meeting point and waiting charges', 'Driver, fare, taxes and cancellation terms'] },
  { ...ladakhPackageJourneys[0], id: 'private-ladakh-circuit', section: 'car-rentals', name: 'Private Ladakh Circuit Cab', label: 'Multi-day transport planning', description: 'Plan private transport for a proposed Leh, Nubra and Pangong circuit. Accommodation and activities are separate unless included in a written quote.', preference: ladakhEnquiryPreferences.car, checks: ['Local vehicle permissions and any vehicle changes', 'Driver, vehicle size, luggage capacity and daily route', 'Fuel, tolls, parking, permits and driver allowances', 'Accommodation, meals and activities quoted separately'] },
  { ...ladakhPackageJourneys[2], id: 'srinagar-leh-transfer', section: 'car-rentals', name: 'Srinagar - Kargil - Leh Transfer', label: 'Road-entry transport', duration: '2 travel days + Leh rest time', stops: ['Srinagar', 'Kargil', 'Leh'], description: 'Discuss a road approach via Kargil, subject to seasonal openings, local transport arrangements and time to acclimatise in Leh.', itinerary: itineraries[2].slice(0, 4), preference: ladakhEnquiryPreferences.car, checks: ['Road openings, vehicle changes and local transport rules', 'Kargil stop, stay costs and suitable breaks', 'Driver allowance, fuel, tolls, parking and disruption terms'] },
]

export const ladakhJourneys = [...ladakhPackageJourneys, ...ladakhBikeJourneys, ...ladakhCabJourneys]
