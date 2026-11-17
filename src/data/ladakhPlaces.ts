export const ladakhPlaceCategories = ['All places', 'Towns & culture', 'Valleys & villages', 'Lakes & night skies'] as const
export type LadakhPlaceCategory = typeof ladakhPlaceCategories[number]
export type LadakhPlace = {
  id: string
  name: string
  category: Exclude<LadakhPlaceCategory, 'All places'>
  tagline: string
  description: string
  highlights: string
  nearby: string
  planning: string
  season: string
  route: string
  visitNotes: string[]
  source: string
  photo?: { src: string; alt: string; position?: string }
  gallery?: { src: string; alt: string; caption: string }[]
}

export const ladakhPlaces: LadakhPlace[] = [
  {
    id: 'pangong-lake', name: 'Pangong Lake', category: 'Lakes & night skies',
    tagline: 'A thousand shades of blue.',
    description: 'Bare mountains, an immense sky and water that shifts colour with the light. Pangong is a place to slow down at a permitted viewpoint, rather than rush through a photo stop.',
    highlights: 'Changing lake colours, mountain reflections and wide shoreline views around the accessible Indian side.',
    nearby: 'Spangmik and other permitted lakeside villages; the approach via Durbuk and Tangtse is part of the landscape.',
    planning: 'A very high-altitude excursion after acclimatisation. Discuss a return journey versus an overnight according to medical advice and suitability.',
    season: 'Usually planned in the warmer months; cold, wind and road closures remain possible.',
    route: 'Often paired with Nubra or approached from Leh, only after current road and access checks.',
    visitNotes: ['Use designated access and parking; do not drive onto the shore or enter the lake.', 'Keep your distance from nesting birds and take all litter back.', 'The colourful photo props in the supplied pictures are sightseeing backdrops, not bike rentals or included activities.'],
    source: 'https://leh.nic.in/tourist-place/pangong/',
    photo: { src: '/images/destinations/ladakh-pangong-user.jpg', alt: 'Blue lake water and barren mountain slopes at Pangong Lake', position: 'center 65%' },
    gallery: [
      { src: '/images/destinations/ladakh-pangong-shore-user.jpg', alt: 'Colourful parked scooter photo props beside Pangong Lake', caption: 'Lakeside colour and familiar photo backdrops.' },
      { src: '/images/destinations/ladakh-pangong-lakeside-user.jpg', alt: 'A yellow scooter photo prop and colourful seats with Pangong Lake behind', caption: 'A different view of the lakeshore. Props and access may change.' },
    ],
  },
  {
    id: 'nubra-valley', name: 'Nubra Valley', category: 'Valleys & villages',
    tagline: 'Dunes, orchards and mountain roads.',
    description: 'Nubra brings together river valleys, high-desert dunes and settled villages. Give the valley time: Diskit, Hunder and the road towards Turtuk offer very different sides of the same journey.',
    highlights: 'Diskit monastery and its Maitreya Buddha statue, Hunder dunes and the meeting of desert and mountain scenery.',
    nearby: 'Sumur and Panamik can form a separate side of the valley; Turtuk is a further extension, not a quick stop beside Hunder.',
    planning: 'Crossing a high pass requires acclimatisation and local checks. Do not treat every village or border-area road as automatically accessible.',
    season: 'Warmer-month circuits are common; pass conditions decide the actual travel day.',
    route: 'Leh to Nubra via an open, authorised route, with time in the valley before continuing.',
    visitNotes: ['Ask before photographing residents, homes or ceremonies.', 'Any camel ride or other paid activity needs a separate operator, welfare and price check.', 'The supplied signpost is a road-scene photograph, not a precise route map or access guarantee.'],
    source: 'https://leh.nic.in/tourist-place/nubra-valley/',
    photo: { src: '/images/destinations/ladakh-nubra-signpost-user.jpg', alt: 'A mountain-road signpost pointing towards Turtuk, Hunder, Leh and other Ladakh destinations', position: 'center 42%' },
  },
  {
    id: 'zanskar-phuktal', name: 'Zanskar & Phuktal', category: 'Valleys & villages',
    tagline: 'For a journey beyond the familiar.',
    description: 'Around Padum, Zanskar opens into a world of river valleys and monastery villages. Phuktal, also written Phugtal, is the dramatic cave monastery above the Lungnak valley river in your supplied photograph.',
    highlights: 'Phuktal monastery and its cliffside setting; Karsha and Stongde offer other perspectives on Zanskar monastic life.',
    nearby: 'Padum is a planning base for the region. Sani and Bardan are additional monastery visits to discuss locally.',
    planning: 'Plan Zanskar as its own extension with extra days. Phuktal involves walking; the trailhead, trail condition and overnight arrangements need a local check.',
    season: 'Seasonal road and walking access; snow, river conditions and closures can change the plan.',
    route: 'A separate Zanskar itinerary, not an automatic addition to a short Leh–Nubra–Pangong circuit.',
    visitNotes: ['Check walking suitability and arrange local guidance before setting out for Phuktal.', 'Respect monastery visiting hours, dress requirements and photography restrictions.', 'The winter frozen-river trek is not part of this summer guide or an activity offered here.'],
    source: 'https://kargil.nic.in/tourist-place/zanskar/',
    photo: { src: '/images/destinations/ladakh-phuktal-user.jpg', alt: 'Phuktal monastery built beneath a cave above a turquoise river in Zanskar', position: 'center 38%' },
  },
  {
    id: 'leh', name: 'Leh & the Indus Valley', category: 'Towns & culture',
    tagline: 'Begin gently. Discover slowly.',
    description: 'Leh is more than an arrival point. Its old lanes, palace skyline, markets and surrounding monastery settlements provide a cultural introduction before a longer mountain circuit.',
    highlights: 'Leh Palace and the old town, local markets and Shanti Stupa views when you are comfortable with the altitude.',
    nearby: 'Shey, Thiksey and Hemis can be discussed as an Indus Valley cultural outing after rest.',
    planning: 'Allow at least 48 hours in Leh before higher areas. Keep arrival days restful; stairs and hilltop visits are not an acclimatisation requirement.',
    season: 'Summer is the usual touring season; winter is a separate cold-weather journey with different facilities.',
    route: 'The starting and finishing base for most fly-in routes.',
    visitNotes: ['Choose short, gentle outings only when comfortable; do not push through symptoms.', 'Check monastery visiting times and ask before taking indoor photographs.', 'Try local food with a little time to spare rather than squeezing every stop into arrival day.'],
    source: 'https://leh.nic.in/tourist-place/shanti-stupa/',
  },
  {
    id: 'turtuk', name: 'Turtuk', category: 'Valleys & villages',
    tagline: 'A village best discovered on foot.',
    description: 'Stone-lined lanes, orchards and Balti heritage make Turtuk a rewarding extension from Nubra. The experience is in walking respectfully through a living village, not ticking off a sightseeing complex.',
    highlights: 'Village lanes, orchard landscapes and locally shared stories of Balti food and culture.',
    nearby: 'The journey follows the Shyok valley beyond the Hunder side of Nubra; keep time for the return drive.',
    planning: 'Confirm current permissions and visitor access. Nearby border-area places must not be assumed open because Turtuk is on the itinerary.',
    season: 'Orchard scenery changes with the season; blossom and harvest dates are not guaranteed.',
    route: 'An additional excursion or stay within a slower Nubra itinerary.',
    visitNotes: ['Seek permission before entering orchards or photographing residents.', 'Use a local guide where available to understand village etiquette and heritage.', 'Meals, guided walks and homestays depend on current local availability.'],
    source: 'https://leh.nic.in/tourist-place/nubra-valley/',
  },
  {
    id: 'sham-lamayuru', name: 'Sham Valley & Lamayuru', category: 'Towns & culture',
    tagline: 'Monastery trails and moonlike hills.',
    description: 'The western approach to Leh links Indus-side villages and monastery visits with the eroded, pale slopes around Lamayuru. Choose a few meaningful stops instead of treating the whole corridor as one short outing.',
    highlights: 'Lamayuru monastery and its moonscape viewpoints; Alchi and Likir are cultural stops to consider along the wider corridor.',
    nearby: 'The Indus–Zanskar confluence near Nimmu and Basgo can be discussed when the route and time allow.',
    planning: 'Alchi, Likir and Lamayuru are separate stops. Ask for realistic driving time and check monastery opening and photography rules.',
    season: 'Often explored during warmer-month road journeys; winter arrangements require separate checks.',
    route: 'A Leh-area western excursion or a staged part of the Kargil–Leh approach.',
    visitNotes: ['Stay on established viewpoints rather than walking onto unstable slopes.', 'Respect fragile artwork and any restrictions on indoor photography.', 'Entry fees and a guide are not included simply because a place appears here.'],
    source: 'https://leh.nic.in/tourist-place/lamayuru/',
  },
  {
    id: 'kargil-suru', name: 'Kargil & Suru Valley', category: 'Valleys & villages',
    tagline: 'Make the western journey a destination.',
    description: 'Kargil can be a thoughtful overnight on the Srinagar approach, while Suru Valley deserves time of its own for villages, mountain views and the changing scenery towards Rangdum.',
    highlights: 'Sankoo and Panikhar landscapes, Nun–Kun mountain views when clear, and Parkachik glacier viewpoints from safe public areas.',
    nearby: 'Rangdum monastery lies further along the Zanskar approach; Drass and its memorial are separate stops on the Srinagar side.',
    planning: 'Suru and Rangdum add driving time. Check road conditions and do not approach glacier ice or river edges without appropriate guidance.',
    season: 'Mountain views depend on weather; seasonal road access limits longer extensions.',
    route: 'Srinagar–Kargil–Leh with a separate Suru extension if you have additional days.',
    visitNotes: ['Allow a genuine rest stop rather than planning a continuous Srinagar-to-Leh rush.', 'Check memorial visiting rules before making a Drass detour.', 'Treks, rafting and mountaineering require specialist operators and are not included activities.'],
    source: 'https://kargil.nic.in/tourist-place/suru-valley/',
  },
  {
    id: 'tso-moriri', name: 'Tso Moriri & Korzok', category: 'Lakes & night skies',
    tagline: 'A quieter, higher lake journey.',
    description: 'Tso Moriri offers a different Changthang landscape from Pangong: a remote lake basin, the settlement of Korzok and expansive high-altitude scenery. It needs its own considered plan.',
    highlights: 'Permitted lakeside viewpoints, Korzok village and distant mountain reflections.',
    nearby: 'The approach crosses remote Changthang terrain; additional stops depend on the authorised route.',
    planning: 'This is a very high-altitude, remote extension. Confirm medical suitability, permits, fuel, communications and accommodation before travelling.',
    season: 'A warmer-month extension with cold nights; access and operating stays must be checked.',
    route: 'A separate extension from Leh, not a casual same-day addition to Pangong.',
    visitNotes: ['Protect the wetland: keep away from nesting areas and do not enter or drive onto the lakeshore.', 'Do not assume reliable mobile coverage, heating or fuel along the way.', 'Allow flexibility for rest and a change of route if conditions are unsuitable.'],
    source: 'https://leh.nic.in/tourist-place/tsomoriri-lake/',
  },
  {
    id: 'hanle', name: 'Hanle', category: 'Lakes & night skies',
    tagline: 'Stay for the landscape. Look up for the sky.',
    description: 'Hanle is a remote Changthang village associated with the Indian Astronomical Observatory and exceptionally dark surroundings. A quiet night under clear skies can be a highlight, but the weather has the final say.',
    highlights: 'High-plateau scenery, village surroundings and stargazing when conditions allow.',
    nearby: 'Hanle monastery and permitted local viewpoints; observatory access requires separate confirmation.',
    planning: 'Confirm current nationality-specific access, high-altitude suitability and local stay arrangements. Do not assume telescope entry or a guided astronomy session.',
    season: 'Night-sky visibility depends on cloud, moonlight and weather; warm clothing is essential.',
    route: 'A dedicated remote-area extension with extra time, not part of the standard first-time circuit.',
    visitNotes: ['Keep artificial lighting low and follow local dark-sky guidance.', 'Guided astronomy experiences depend on local availability and separate arrangements.', 'Nearby high-pass or border-road excursions require their own permissions and suitability checks.'],
    source: 'https://leh.nic.in/tourist-place/hanle/',
  },
]
