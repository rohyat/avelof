export const activityDestinations = ['Srinagar', 'Gulmarg', 'Sonamarg', 'Pahalgam'] as const
export type ActivityDestination = typeof activityDestinations[number]
export const activityCategories = ['Water', 'Snow', 'Adventure', 'Nature', 'Culture'] as const
export type ActivityCategory = typeof activityCategories[number]

export interface Activity {
  id: string
  destination: ActivityDestination
  name: string
  category: ActivityCategory
  season: string
  description: string
  note: string
  operatorCheck?: boolean
}

export const activitySources = [
  { destination: 'Srinagar', title: 'Srinagar district: Dal Lake', url: 'https://srinagar.nic.in/tourist-place/dal-lake/' },
  { destination: 'Srinagar', title: 'Incredible India: Srinagar', url: 'https://www.incredibleindia.gov.in/en/jammu-and-kashmir/srinagar' },
  { destination: 'Gulmarg', title: 'Baramulla district: Gulmarg', url: 'https://baramulla.nic.in/tourist-place/gulmarg/' },
  { destination: 'Gulmarg', title: 'Incredible India: Gulmarg', url: 'https://www.incredibleindia.gov.in/en/jammu-and-kashmir/gulmarg' },
  { destination: 'Sonamarg', title: 'Ganderbal district: Sonamarg', url: 'https://ganderbal.nic.in/tourist-place/sonamarg/' },
  { destination: 'Pahalgam', title: 'Incredible India: Pahalgam', url: 'https://www.incredibleindia.gov.in/en/jammu-and-kashmir/pahalgam' },
]

export const activityAvailabilityNote = 'Activity choices are requests only, not bookings. Availability, opening, weather, snow, safety restrictions, permits and operator schedules must be checked for your dates. Activity fees, equipment, guides and local transfers are not included in the trip estimate.'

export const activities: Activity[] = [
  { id: 'srinagar-shikara', destination: 'Srinagar', name: 'Dal Lake shikara ride', category: 'Water', season: 'Weather permitting', description: 'Explore Dal Lake from a traditional shikara, with a route agreed before departure.', note: 'Confirm the boarding ghat, duration, capacity and life jackets with the boat operator.' },
  { id: 'srinagar-floating-market', destination: 'Srinagar', name: 'Floating market visit by shikara', category: 'Culture', season: 'Early morning; confirm market operation', description: 'Request an early-morning visit to the floating vegetable market on Dal Lake.', note: 'Arrange the departure time and route in advance; market activity varies.' },
  { id: 'srinagar-boat-ride', destination: 'Srinagar', name: 'Dal Lake boat ride enquiry', category: 'Water', season: 'Boat type, permitted area and operator check required', description: 'Ask about paid boat-ride options on Dal Lake beyond the standard shikara outing.', note: 'Confirm the boat type, authorised operating area, price and life jackets. Motorised or speedboat rides are not promised; local permissions must be checked.', operatorCheck: true },
  { id: 'gulmarg-gondola', destination: 'Gulmarg', name: 'Gulmarg Gondola ride', category: 'Adventure', season: 'Subject to weather and official operation', description: 'Request time for the cable car, with the phase chosen according to access and tickets.', note: 'Official tickets are separate and subject to availability. Selecting this does not reserve a ticket.' },
  { id: 'gulmarg-skiing', destination: 'Gulmarg', name: 'Skiing lesson', category: 'Snow', season: 'Winter; sufficient snow required', description: 'Request a beginner or experience-appropriate session with a qualified ski instructor.', note: 'Instructor, equipment, slope suitability and operating conditions require confirmation.' },
  { id: 'gulmarg-snowboarding', destination: 'Gulmarg', name: 'Snowboarding session', category: 'Snow', season: 'Winter; sufficient snow required', description: 'Express interest in an instructor-led snowboarding session.', note: 'Confirm instruction, protective equipment and suitable terrain. Not an off-piste booking.' },
  { id: 'gulmarg-snowmobile', destination: 'Gulmarg', name: 'Snowmobile / snow scooter ride', category: 'Snow', season: 'Snow season; permitted routes only', description: 'Request an operator-led snow scooter experience where authorised.', note: 'Confirm local permission, helmet, route, age limits and operator availability.' },
  { id: 'gulmarg-pony', destination: 'Gulmarg', name: 'Pony ride in the meadows', category: 'Nature', season: 'Accessible, permitted routes', description: 'Request a guided pony outing around the meadows or towards Khilanmarg.', note: 'Agree the route, duration and price; choose an appropriate operator and animal.' },
  { id: 'gulmarg-atv', destination: 'Gulmarg', name: 'ATV / motorbike ride enquiry', category: 'Adventure', season: 'Operator, route and local permission check required', description: 'Ask about an ATV, quad-bike or motorbike outing in the Gulmarg / Tangmarg area through one combined request.', note: 'Confirm the vehicle type, authorised provider, permitted route, helmet, eligibility and any licence or insurance requirements. This is not a verified rental or reserved ride.', operatorCheck: true },
  { id: 'sonamarg-pony', destination: 'Sonamarg', name: 'Thajiwas pony ride', category: 'Nature', season: 'Seasonal access; weather permitting', description: 'Request a pony outing towards the accessible Thajiwas area.', note: 'The permitted endpoint varies. Glacier access and snow are not guaranteed.' },
  { id: 'sonamarg-sledging', destination: 'Sonamarg', name: 'Snow sledging enquiry', category: 'Snow', season: 'Only where snow and local permission allow', description: 'Ask about supervised sledging in a permitted snow area near Sonamarg.', note: 'Operator and current snow access are unverified and must be checked for your visit.', operatorCheck: true },
  { id: 'sonamarg-rafting', destination: 'Sonamarg', name: 'Sindh River rafting enquiry', category: 'Water', season: 'River conditions and authorised operation', description: 'Express interest in rafting with an authorised operator on an approved river stretch.', note: 'Tourism sources describe rafting here, not a daily public schedule. Operation, age limits, water levels and safety arrangements must be confirmed.' },
  { id: 'sonamarg-trek', destination: 'Sonamarg', name: 'Guided trekking enquiry', category: 'Adventure', season: 'Usually summer; permits and access vary', description: 'Ask about a suitable guided trek from Sonamarg, including longer alpine-lake routes.', note: 'Long treks need a separate multi-day itinerary, guide and permit checks; they do not fit automatically into a sightseeing day.' },
  { id: 'sonamarg-atv', destination: 'Sonamarg', name: 'ATV / quad-bike ride enquiry', category: 'Adventure', season: 'Operator and local permission check required', description: 'Ask whether an authorised ATV experience is operating near your visit location.', note: 'Not a verified operating listing. Location, route, protective equipment and eligibility must be confirmed.', operatorCheck: true },
  { id: 'pahalgam-pony', destination: 'Pahalgam', name: 'Pony ride / Baisaran enquiry', category: 'Nature', season: 'Subject to route opening and restrictions', description: 'Request a pony outing on an authorised route around Pahalgam.', note: 'Baisaran access must be checked with local authorities; inclusion is not a claim that the route is currently open.', operatorCheck: true },
  { id: 'pahalgam-rafting', destination: 'Pahalgam', name: 'Lidder River rafting enquiry', category: 'Water', season: 'Seasonal river conditions and authorised operation', description: 'Request rafting information for an approved Lidder River stretch.', note: 'Operation depends on water levels and local permission. Confirm trained guides, safety equipment and eligibility.' },
  { id: 'pahalgam-angling', destination: 'Pahalgam', name: 'Trout angling enquiry', category: 'Nature', season: 'Fishing season and permit required', description: 'Ask about permitted angling in designated waters around Pahalgam.', note: 'A valid fisheries permit, approved beat and local rules must be confirmed before fishing.' },
  { id: 'pahalgam-trek', destination: 'Pahalgam', name: 'Guided Aru-area trek enquiry', category: 'Adventure', season: 'Trail access and weather permitting', description: 'Ask for a guided trek matched to your time, fitness and experience.', note: 'Confirm a permitted route and guide; longer treks require extra days, not a standard sightseeing slot.', operatorCheck: true },
  { id: 'pahalgam-zipline', destination: 'Pahalgam', name: 'Zip-line ride enquiry', category: 'Adventure', season: 'Operator, site opening and weather check required', description: 'Request a paid zip-line experience in the Pahalgam area.', note: 'The exact site and current operation require verification. Confirm an authorised operator, equipment checks, supervision, weight and age limits before booking.', operatorCheck: true },
]

export function activitiesForPlaces(placeIds: string[]) {
  return activities.filter((activity) => placeIds.includes(activity.destination.toLowerCase()))
}

export function formatSelectedActivities(ids: string[], placeIds: string[]) {
  return activitiesForPlaces(placeIds).filter((activity) => ids.includes(activity.id))
    .map((activity) => `${activity.destination}: ${activity.name} (${activity.season}${activity.operatorCheck ? '; operator verification required' : ''})`).join('\n')
}
