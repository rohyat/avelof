import { destinations, rentalCars } from './catalog.ts'
import { kashmirPhotoGallery } from './kashmirPhotoGallery.ts'
import { hotelsForPackageStay } from '../services/packageHotels.ts'
import type { BuilderDay, ItineraryDraft } from '../services/itineraryBuilderSchema.ts'
import type { Hotel } from '../types.ts'

export const itineraryTips = [
  { title: 'Mobile network', detail: 'Outside-J&K prepaid SIMs generally do not work. Postpaid generally works; coverage varies.' },
  { title: 'Carry some cash', detail: 'Keep some cash handy for local purchases and places with limited connectivity.' },
  { title: 'Winter essentials', detail: 'Pack sweaters, warm jackets, gloves and sturdy shoes with good grip.' },
  { title: 'Documents', detail: 'Carry a valid government-issued photo ID for each guest and your travel confirmations.' },
]
export const itineraryPackageItems = [
  { id: 'accommodation', label: 'Hotel stays', included: true },
  { id: 'breakfast', label: 'Breakfast', included: true },
  { id: 'dinner', label: 'Dinner', included: true },
  { id: 'private-cab', label: 'Private vehicle throughout the trip', included: true },
  { id: 'pickup-drop', label: 'Arrival pickup and departure drop', included: true },
  { id: 'sightseeing', label: 'Transfers and sightseeing as per itinerary', included: true },
  { id: 'tolls', label: 'Toll taxes', included: true },
  { id: 'shikara', label: 'Complimentary one-hour Shikara ride', included: false },
  { id: 'pahalgam-union', label: 'Pahalgam union cab for Aru, Betaab and Chandanwari (ABC Valley)', included: false },
  { id: 'chain-vehicle', label: 'Chain vehicle in Gulmarg during bad weather', included: false },
  { id: 'zojila-union', label: 'Sonamarg union cab for Zojila Pass', included: false },
  { id: 'gondola', label: 'Gulmarg Gondola tickets', included: false },
  { id: 'sonamarg-activities', label: 'Optional activities in Sonamarg', included: false },
  { id: 'gulmarg-activities', label: 'Optional activities in Gulmarg', included: false },
  { id: 'pahalgam-activities', label: 'Optional activities in Pahalgam', included: false },
  { id: 'winter-clothing', label: 'Winter boots, jackets and sweaters', included: false },
  { id: 'lunch', label: 'Lunch', included: false },
  { id: 'flights', label: 'Flights and travel insurance', included: false },
]
export function itineraryMealChoice(draft: ItineraryDraft) {
  const included = (id: string) => draft.packageItems.some(item => item.id === id && item.included)
  return included('breakfast') ? included('dinner') ? 'both' : 'breakfast' : included('dinner') ? 'dinner' : 'none'
}
export function changeItineraryMeals(draft: ItineraryDraft, choice: string): ItineraryDraft {
  const items = [...draft.packageItems]
  for (const id of ['breakfast', 'dinner']) {
    const included = choice === 'both' || choice === id
    const index = items.findIndex(item => item.id === id)
    if (index >= 0) items[index] = { ...items[index], included }
    else if (included) items.splice(id === 'breakfast' ? 1 : 2, 0, { ...itineraryPackageItems.find(item => item.id === id)!, included })
  }
  return { ...draft, packageItems: items }
}
export function itineraryPackageDetails(draft: ItineraryDraft) {
  const selected = (id: string) => draft.packageItems.some(item => item.id === id && item.included)
  const meals = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner']].filter(([id]) => selected(id)).map(([, label]) => label)
  return {
    inclusions: draft.packageItems.filter(item => item.included).map(item => item.label),
    exclusions: draft.packageItems.filter(item => !item.included).map(item => item.label),
    mealPlan: meals.length === 3 ? 'Breakfast, lunch & dinner' : meals.length === 2 ? `${meals[0]} & ${meals[1].toLowerCase()}` : meals.length === 1 ? `${meals[0]} only` : 'No meals included',
  }
}
export function destinationByName(name: string) {
  return destinations.find(place => [place.id, place.name, ...place.aliases].some(value => value.toLowerCase() === name.toLowerCase()))
}
export function destinationDay(destination: string, _index: number, departure = false): BuilderDay {
  const place = destination === 'Jammu' ? {
    name: 'Jammu', detail: 'Meet your driver in Jammu and continue along your agreed route. Plan travel time and stops with AVELOF.',
    attractions: [{ name: 'Jammu pickup' }, { name: 'Meet your driver' }, { name: 'Onward road transfer' }],
    image: kashmirPhotoGallery.valleyRiver.image,
  } : destination === 'Katra' ? {
    name: 'Katra', detail: 'Katra is the base for the Mata Vaishno Devi pilgrimage. Plan sufficient time for the journey and darshan, subject to official arrangements and access.',
    attractions: [{ name: 'Mata Vaishno Devi darshan' }, { name: 'Katra town' }, { name: 'Pilgrimage preparations' }],
    image: kashmirPhotoGallery.valleyRiver.image,
  } : destination === 'Patnitop' ? {
    name: 'Patnitop', detail: 'Enjoy the mountain scenery and pine forests around Patnitop. Visit local viewpoints as time, weather and road access allow.',
    attractions: [{ name: 'Patnitop viewpoints' }, { name: 'Pine forests' }, { name: 'Nathatop (subject to access)' }],
    image: kashmirPhotoGallery.valleyRiver.image,
  } : destination === 'Shiv Khori' ? {
    name: 'Shiv Khori', detail: 'Visit the Shiv Khori cave shrine near Ransoo. Allow time for the approach and darshan, subject to official arrangements and access.',
    attractions: [{ name: 'Shiv Khori cave shrine' }, { name: 'Ransoo approach' }, { name: 'Darshan (subject to access)' }],
    image: kashmirPhotoGallery.valleyRiver.image,
  } : destinationByName(destination)
  if (!place) throw new Error(`Unknown itinerary destination: ${destination}`)
  return {
    id: crypto.randomUUID(), dayType: 'Travel', destination: place.name, overnight: departure ? '' : place.name, overnightType: 'Hotel',
    title: departure ? 'Departure' : `Explore ${place.name}`,
    detail: departure ? `Transfer to ${place.name} for your onward journey. Confirm the pickup time with AVELOF.` : place.name === 'Pahalgam'
      ? 'Discover Pahalgam beside the Lidder River, with sightseeing at Aru Valley, Betaab Valley and Chandanwari, subject to time and road access. Local union cabs and entry fees follow your package inclusions.'
      : place.detail,
    bullets: departure ? ['Hotel checkout', 'Meet your driver', 'Onward transfer'] : place.attractions.slice(0, 3).map(attraction => attraction.name),
    image: place.image,
  }
}
export function arrivalDay(arrivalLocation: ItineraryDraft['arrivalLocation'], destination?: string): BuilderDay {
  const day = destinationDay(destination ?? arrivalLocation, 0)
  if (!destination) return {
    ...day, dayType: 'Leisure', title: `Arrive in ${arrivalLocation}`,
    detail: arrivalLocation === 'Katra' ? 'Arrive in Katra and check in. Enjoy time at your own pace; a Mata Vaishno Devi pilgrimage can be planned separately, subject to time and access.' : `Meet your driver in ${arrivalLocation} and transfer to your selected stay. No sightseeing is planned on arrival day.`,
    bullets: arrivalLocation === 'Katra' ? ['Check in at your stay', 'Time at leisure', 'Mata Vaishno Devi pilgrimage (optional)'] : ['Arrival pickup', 'Meet your driver', 'Transfer and check-in'],
  }
  return {
    ...day, title: arrivalLocation === destination ? `Arrival and ${destination} sightseeing` : `${arrivalLocation} to ${destination}`,
    detail: `Arrive in ${arrivalLocation}, meet your driver and continue to ${destination}. ${day.detail}`,
  }
}
export function changeArrivalPlan(draft: ItineraryDraft, arrivalLocation: ItineraryDraft['arrivalLocation'], destination?: string): ItineraryDraft {
  const day = arrivalDay(arrivalLocation, destination)
  return synchronizeItinerary({ ...draft, arrivalLocation, arrivalSightseeing: Boolean(destination), days: [{ ...day, id: draft.days[0].id }, ...draft.days.slice(1)] }, draft)
}
export function dayStart(draft: ItineraryDraft, index: number) {
  return index === 0 ? draft.arrivalLocation : draft.days[index - 1].overnight
}
export function overnightOptions(draft: ItineraryDraft, index: number) {
  const day = draft.days[index]
  if (index === draft.days.length - 1) return []
  if (day.dayType === 'Leisure') return [dayStart(draft, index)]
  if (day.destination === 'Shiv Khori') return [dayStart(draft, index)]
  return [...new Set([day.destination, 'Srinagar', dayStart(draft, index)])]
}
export function synchronizeItinerary(next: ItineraryDraft, previous: ItineraryDraft): ItineraryDraft {
  const days = next.days.map(day => ({ ...day }))
  const result = { ...next, days }
  for (let index = 0; index < days.length; index++) {
    const day = days[index], start = dayStart(result, index)
    const final = index === days.length - 1
    if (final) { day.dayType = 'Travel'; day.overnight = ''; day.overnightType = 'Hotel' }
    else if (day.dayType === 'Leisure') { day.destination = start; day.overnight = start }
    else if (!overnightOptions(result, index).includes(day.overnight)) day.overnight = day.destination === 'Shiv Khori' ? start : day.destination
    if (day.overnight !== 'Srinagar') day.overnightType = 'Hotel'
    const oldIndex = previous.days.findIndex(value => value.id === day.id)
    const old = previous.days[oldIndex]
    if (old && old.dayType === day.dayType && old.destination === day.destination && old.overnight === day.overnight
      && dayStart(previous, oldIndex) === start && (index !== 0 || previous.arrivalSightseeing === result.arrivalSightseeing)) continue
    const content = destinationDay(day.destination, index, final)
    day.image = content.image; day.bullets = content.bullets
    if (final) {
      day.title = start === day.destination ? `Departure from ${day.destination}` : `${start} to ${day.destination} - Departure`
      day.detail = `Check out from your stay in ${start} and transfer to ${day.destination} for your onward journey. Confirm pickup time with AVELOF.`
    } else if (day.dayType === 'Leisure') {
      day.title = index === 0 ? `Arrive in ${start} - Leisure day` : `Leisure day in ${start}`
      day.detail = start === 'Katra'
        ? `${index === 0 ? 'Arrive in Katra and check in. ' : ''}Enjoy time in Katra at your own pace; a Mata Vaishno Devi pilgrimage can be planned separately, subject to time and access.`
        : `${index === 0 ? `Arrive in ${start} and check in. ` : ''}Enjoy a relaxed day in ${start} at your own pace. No outstation travel is planned.`
      day.bullets = start === 'Katra' ? ['Time at leisure', 'Mata Vaishno Devi pilgrimage (optional)', 'Overnight in Katra'] : ['Relax at your stay', 'Explore locally at your own pace', `Overnight in ${start}`]
    } else {
      const returns = day.overnight !== day.destination
      day.title = `${start === day.destination ? `Explore ${day.destination}` : `${start} to ${day.destination}`}${returns ? ` - Return to ${day.overnight}` : ''}`
      day.detail = `${index === 0 ? `Arrive in ${start}, meet your driver and ` : ''}${start === day.destination ? 'Explore' : 'Travel to'} ${day.destination}. ${content.detail}${returns ? ` After the visit, return to ${day.overnight} for the night.` : ` Stay overnight in ${day.overnight}.`}`
    }
  }
  return result
}
export function updateDayPlan(draft: ItineraryDraft, index: number, patch: Partial<BuilderDay>): ItineraryDraft {
  const days = draft.days.map((day, i) => i === index ? { ...day, ...patch } : day)
  return synchronizeItinerary({ ...draft, days, ...(index === 0 ? { arrivalSightseeing: days[0].dayType === 'Travel' } : {}) }, draft)
}
export function createItineraryDraft(tier: ItineraryDraft['tier'] = 'premium'): ItineraryDraft {
  return {
    guestName: '', title: 'Your Kashmir journey', tier, travellers: 2, roomsPerNight: null, roomTypes: [], roomExtraBeds: [], pricePerPerson: 0, travelDate: '',
    arrivalLocation: 'Srinagar', arrivalSightseeing: false,
    advancePercent: 20, priceNote: 'Prices are negotiable. Not a final quote. Open to negotiation.',
    transport: rentalCars[0].name, days: [arrivalDay('Srinagar'), destinationDay('Srinagar', 1, true)],
    hotelChoices: {}, hotelPhotos: {}, hotelNames: {}, packageItems: itineraryPackageItems.map(item => ({ ...item })),
    tips: itineraryTips.map(tip => ({ ...tip })),
  }
}
export function resizeItinerary(draft: ItineraryDraft, count: number): ItineraryDraft {
  if (!Number.isInteger(count) || count < 2 || count > 15) throw new RangeError('Choose between 2 and 15 days.')
  const departure = draft.days.at(-1)!
  const touring = draft.days.slice(0, -1)
  const next = Array.from({ length: count - 1 }, (_, index) => touring[index] ?? destinationDay(touring.at(-1)?.destination ?? 'Srinagar', index))
  const days = [...next, departure]
  return synchronizeItinerary({ ...draft, days }, draft)
}
export const stayChoiceKey = (location: string, propertyType = 'Hotel') => propertyType === 'Hotel' ? location : `${location} (${propertyType})`
export function itineraryStays(draft: ItineraryDraft) {
  const counts = new Map<string, { key: string; location: string; propertyType: 'Hotel' | 'Houseboat'; nights: number; hotel: string }>()
  for (const day of draft.days) if (day.overnight) {
    const key = stayChoiceKey(day.overnight, day.overnightType)
    const existing = counts.get(key)
    if (existing) existing.nights++
    else counts.set(key, { key, location: day.overnight, propertyType: day.overnightType, nights: 1, hotel: '' })
  }
  return [...counts.values()]
}
export function eligibleStayHotels(draft: ItineraryDraft, hotels: Hotel[], location: string, propertyType: 'Hotel' | 'Houseboat' = 'Hotel') {
  if (propertyType === 'Houseboat' && location !== 'Srinagar') return []
  return hotelsForPackageStay(hotels, draft.tier, { location, nights: 1, hotel: '', propertyType }, hotels.length)
}
export function itineraryPdfFilename(guestName: string) {
  return `AVELOF-${guestName.trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'Guest'}-Itinerary.pdf`
}
export function selectedStayHotels(draft: ItineraryDraft, hotels: Hotel[], location: string, propertyType: 'Hotel' | 'Houseboat' = 'Hotel') {
  const naming = draft.hotelNames[stayChoiceKey(location, propertyType)]
  if (naming && !naming.useCategory && naming.name.trim()) return []
  const candidates = eligibleStayHotels(draft, hotels, location, propertyType)
  const choices = draft.hotelChoices[stayChoiceKey(location, propertyType)]
  return choices === undefined ? naming && !naming.useCategory ? candidates.slice(0, 3) : [] : candidates.filter(hotel => choices.includes(hotel.id))
}
export function stayDisplayName(draft: ItineraryDraft, location: string, propertyType: 'Hotel' | 'Houseboat' = 'Hotel') {
  const naming = draft.hotelNames[stayChoiceKey(location, propertyType)]
  return naming && !naming.useCategory && naming.name.trim() ? naming.name.trim()
    : `${draft.tier[0].toUpperCase()}${draft.tier.slice(1)} ${propertyType.toLowerCase()}`
}
export function destinationImages(name: string) {
  const place = destinationByName(name)
  const { roomOne: _roomOne, roomTwo: _roomTwo, ...scenery } = kashmirPhotoGallery
  return [...new Set([place?.image ?? kashmirPhotoGallery.valleyRiver.image, ...(place?.additionalPhotos?.map(photo => photo.image) ?? []), ...Object.values(scenery).map(photo => photo.image)])]
}
