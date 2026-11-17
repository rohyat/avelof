export const ladakhEnquiryPreferences = {
  package: 'Ladakh package planning',
  bike: 'Ladakh bike trip planning',
  car: 'Ladakh cab or transfer',
  contact: 'General Ladakh travel enquiry',
} as const

export const ladakhPackages = [
  { name: 'Ladakh Essentials', duration: '6 nights / 7 days', start: 'Leh', label: 'A first look at Ladakh', stops: ['Leh', 'Nubra', 'Pangong', 'Leh'], description: 'A proposed first-time circuit with acclimatisation in Leh before the higher passes and lake.', outline: [
    { days: 'Days 1-2', detail: 'Arrive in Leh and acclimatise for at least 48 hours. Only gentle nearby visits if comfortable.' },
    { days: 'Days 3-5', detail: 'A proposed Nubra and Pangong circuit, returning to Leh. Higher-area travel depends on suitability and open roads.' },
    { days: 'Days 6-7', detail: 'Flexible Leh-area time, then departure. Keep room for rest and route changes.' },
  ] },
  { name: 'Ladakh Explorer', duration: '7 nights / 8 days', start: 'Leh', label: 'More time to explore', stops: ['Leh', 'Nubra', 'Turtuk', 'Pangong', 'Leh'], description: 'More time for Nubra villages and a Turtuk excursion, subject to access and route checks.', outline: [
    { days: 'Days 1-2', detail: 'Arrive in Leh and allow at least 48 hours of acclimatisation before higher areas.' },
    { days: 'Days 3-5', detail: 'Continue to Nubra, with additional time for villages and a possible Turtuk excursion.' },
    { days: 'Days 6-8', detail: 'Proposed Pangong visit and return to Leh before departure, with routing and overnight suitability checked locally.' },
  ] },
  { name: 'Kashmir to Ladakh Journey', duration: '8 nights / 9 days', start: 'Srinagar', label: 'From the valley to the passes', stops: ['Srinagar', 'Kargil', 'Leh', 'Nubra', 'Pangong', 'Leh'], description: 'A proposed road-entry journey via Kargil, with rest in Leh before the higher circuit.', outline: [
    { days: 'Days 1-2', detail: 'Travel from Srinagar via Kargil to Leh, subject to road openings. Road arrival does not eliminate altitude risk.' },
    { days: 'Days 3-4', detail: 'Rest and acclimatise in Leh. Allow at least 48 hours from arrival before higher areas.' },
    { days: 'Days 5-9', detail: 'Proposed Nubra and Pangong circuit, returning to Leh with flexible time before departure.' },
  ] },
]

export const ladakhFaqs = [
  { question: 'Can I book a Ladakh departure now?', answer: 'Not yet. This is a summer 2027 planning preview. You can send an enquiry about your requirements; suppliers, prices and departure availability still need confirmation. Enquiries are not bookings, and no payment is taken here.' },
  { question: 'Should I start in Leh or Srinagar?', answer: 'Leh suits a fly-in starting point. Srinagar adds a road approach via Kargil, subject to openings and local arrangements. Both need an appropriate acclimatisation plan; driving in does not remove altitude risk.' },
  { question: 'Are bike rental and riding support included?', answer: 'No. Bike departures are not open yet. Bikes, licences, deposits, insurance, fuel, protective equipment, ride leaders, breakdown support and emergency arrangements must be checked and agreed separately.' },
  { question: 'Can we change the pace or avoid a lake overnight?', answer: 'Discuss a slower private route with our team. A Pangong overnight is not compulsory, and changing the stops may require extra days. Suitability, travel time and accommodation must be checked before confirming an itinerary.' },
]

export const ladakhPlaces = [
  { name: 'Leh', description: 'Your arrival and acclimatisation base, with gentle nearby cultural visits when comfortable.' },
  { name: 'Nubra Valley', description: 'Diskit monastery, Hunder landscapes and village stays beyond Khardung La.' },
  { name: 'Pangong Lake', description: 'High-altitude lake scenery; overnight stays depend on suitability, season and availability.' },
  { name: 'Turtuk', description: 'Village walks and local culture on an optional extension from Nubra.' },
  { name: 'Sham Valley & Lamayuru', description: 'Monasteries and dramatic landscapes along the western approach to Leh.' },
  { name: 'Kargil', description: 'A possible overnight stop on the Srinagar approach, rather than rushing straight to Leh.' },
]
export const ladakhPages = {
  packages: { title: 'Find your Ladakh journey.', copy: 'Explore proposed routes from Leh or Srinagar, with room for acclimatisation and a pace that suits you.' },
  'bike-trips': { title: 'Ladakh Bike Trips', copy: 'Motorcycle journeys with their own planning, rider checks and local operating arrangements.' },
  'car-rentals': { title: 'Ladakh cabs & transfers.', copy: 'Discuss private circuits, airport pickups and the Srinagar approach with our team.' },
  places: { title: 'Places to explore in Ladakh.', copy: 'Discover the towns, valleys, monasteries and landscapes along your journey.' },
  contact: { title: 'Talk to AVELOF.', copy: 'Get help with your Ladakh dates, route, stays and transport. Send an enquiry or give us a call.' },
  'travel-guide': { title: 'Your Ladakh travel guide.', copy: 'Prepare for altitude, changing mountain roads and remote stays before making plans.' },
  experiences: { title: 'Ladakh, beyond the road.', copy: 'Cultural visits and outdoor experiences, subject to seasonal and local operator checks.' },
} as const
export type LadakhSection = 'home' | keyof typeof ladakhPages
