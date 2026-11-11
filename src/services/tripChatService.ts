import { destinations, hotels, rentalCars, tourPackages } from '../data/catalog.ts'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const availablePackages = tourPackages.filter((item) => !item.underDevelopment)
const money = (amount: number) => `₹${Math.round(amount).toLocaleString('en-IN')}`
const normalize = (text: string) => text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim()
const hasAny = (text: string, terms: string[]) => terms.some((term) => text.includes(term))

function packageReply(item: (typeof availablePackages)[number], question: string) {
  const query = normalize(question)
  const parts = [`${item.name}: ${item.duration}, from ${money(item.price)} per person.`, item.description, `Stays: ${item.stay}`]
  if (hasAny(query, ['itinerary', 'plan', 'day by day', '5-day', '5 day', 'five-day', 'five day'])) {
    parts.push(item.itinerary.map((day) => `${day.day}: ${day.title} — ${day.detail}`).join('\n'))
  }
  if (hasAny(query, ['include', 'meal', 'breakfast', 'dinner', 'what do i get'])) {
    parts.push(`Includes: ${item.inclusions.slice(0, 5).join(', ')}.`)
  }
  parts.push('Rates are guide prices; confirm dates, availability, and the final quote with AVELOF.')
  return parts.join('\n')
}

function hotelReply(question: string) {
  const query = normalize(question)
  const namedHotel = hotels.find((hotel) => query.includes(normalize(hotel.name)))
  const location = [...new Set(hotels.map((hotel) => hotel.location))].find((name) => query.includes(normalize(name)))
  const packageId = hasAny(query, ['deluxe']) ? 'deluxe' : hasAny(query, ['premium']) ? 'premium' : null
  const matches = namedHotel ? [namedHotel] : hotels.filter((hotel) =>
    (!location || hotel.location === location) && (!packageId || hotel.packageId === packageId))
  if (!matches.length) return 'I couldn’t match that stay to our published list. Ask for hotels in Srinagar, Gulmarg, or Pahalgam.'
  const rows = matches.slice(0, namedHotel ? 1 : 5).map((hotel) => {
    const meal = hotel.mealPlan ? `; ${hotel.mealPlan.toLowerCase()}` : ''
    return `${hotel.name} (${hotel.location}) — ${money(hotel.price)} ${hotel.rateBasis ?? 'per night'}${meal}.`
  })
  if (!namedHotel && matches.length > rows.length) rows.push(`Ask AVELOF about the other ${matches.length - rows.length} listed stays.`)
  rows.push('Rates and availability depend on your dates; confirm before booking.')
  return rows.join('\n')
}

function vehicleReply() {
  const rows = rentalCars.map((vehicle) => `${vehicle.name} — ${vehicle.seats} seats, from ${money(vehicle.price)} per day.`)
  return `${rows.join('\n')}\nConfirm the route, dates, luggage, and final fare with AVELOF.`
}

function destinationReply(destination: (typeof destinations)[number]) {
  const highlights = destination.attractions.slice(0, 3).map((item) => item.name).join(', ')
  return `${destination.name}: ${destination.detail}\nFrom Srinagar: ${destination.distance}, usually ${destination.travelTime}. Suggested visit: ${destination.suggestedVisit}. Best season: ${destination.season}.\nPlaces to see: ${highlights}. ${destination.accessNote} Conditions and access can change; confirm before travel.`
}

export function getTripChatReply(question: string) {
  const query = normalize(question)
  if (!query) return 'Ask about AVELOF packages, hotel stays, vehicles, or a Kashmir destination.'
  if (/^(hi|hello|hey|salaam|assalamu alaikum)\b/.test(query)) {
    return 'Hello! I can help with AVELOF packages, hotel stays, vehicles, and Kashmir destinations. Try asking about Pahalgam, hotels in Srinagar, or a 5-day trip.'
  }

  const asksHotels = hasAny(query, ['hotel', 'hotels', 'stay', 'stays', 'accommodation', 'room', 'resort'])
  if (asksHotels) return hotelReply(query)
  if (hasAny(query, ['cab', 'taxi', 'car', 'vehicle', 'transfer', 'driver', 'seater'])) return vehicleReply()

  const destination = destinations.find((place) => [place.name, ...place.aliases].some((name) => query.includes(normalize(name))))
  if (destination) return destinationReply(destination)

  const luxury = tourPackages.find((item) => item.underDevelopment && query.includes(normalize(item.name)))
  if (luxury) return `${luxury.name} is still in development. The currently listed packages are ${availablePackages.map((item) => item.name).join(' and ')}.`

  const selectedPackage = availablePackages.find((item) => query.includes(normalize(item.name)))
  if (selectedPackage) return packageReply(selectedPackage, query)

  if (hasAny(query, ['5-day', '5 day', 'five-day', 'five day']) && hasAny(query, ['suggest', 'recommend', 'plan', 'trip', 'itinerary'])) {
    const fiveDayPackage = availablePackages.find((item) => item.duration.includes('5 days'))
    if (fiveDayPackage) return packageReply(fiveDayPackage, 'itinerary')
  }

  if (hasAny(query, ['package', 'packages', 'tour', 'itinerary', 'trip', 'holiday', 'compare', 'five day', '5 day'])) {
    return availablePackages.map((item) => `${item.name}: ${item.duration}, from ${money(item.price)} per person. ${item.description}`).join('\n\n') + '\n\nTell me which package you want to explore.'
  }

  if (hasAny(query, ['book', 'booking', 'enquire', 'enquiry', 'contact', 'availability', 'quote', 'price', 'cost', 'service'])) {
    return 'AVELOF helps arrange Kashmir tour packages, hotel stays, private vehicles, and custom itineraries. I can share published catalog details, but can’t check live availability or confirm a booking. Use Enquire Now to ask the team about your dates and final quote.'
  }

  return 'I can answer from AVELOF’s published catalog. Try asking about Deluxe or Premium packages, hotels in Srinagar, car options, or places such as Gulmarg, Sonamarg, and Pahalgam.'
}