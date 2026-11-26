import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { arrivalDay, changeArrivalPlan, changeItineraryMeals, createItineraryDraft, destinationDay, destinationImages, eligibleStayHotels, itineraryMealChoice, itineraryPackageDetails, itineraryPdfFilename, itineraryStays, overnightOptions, resizeItinerary, selectedStayHotels, stayDisplayName, synchronizeItinerary, updateDayPlan } from '../src/data/itineraryBuilder.ts'
import { destinations, rentalCars } from '../src/data/catalog.ts'
import { itineraryContact } from '../src/config.ts'
import { itineraryDraftSchema } from '../src/services/itineraryBuilderSchema.ts'
import { buildEditableItineraryPdf } from '../src/services/builderItineraryPdf.ts'
import { formatItineraryRouteLeg, itineraryRouteLegs, routeEstimate } from '../src/data/itineraryRoutes.ts'

const hotel = (id, location, category, propertyType = 'Hotel') => ({
  id, kind: 'hotel', registeredHotelId: 'AVELOF_HTL_10001SRG', location, category, propertyType,
  name: `${location} ${category}`, price: 2500, facilities: ['Wi-Fi'], gallery: ['/images/destinations/kashmir-room-inspiration-01.jpg'],
  image: '/images/destinations/kashmir-room-inspiration-01.jpg',
})
const hotels = [
  hotel('10000000-0000-4000-8000-000000000001', 'Sonamarg', 'Premium'),
  hotel('10000000-0000-4000-8000-000000000002', 'Sonamarg', 'Deluxe'),
  hotel('10000000-0000-4000-8000-000000000003', 'Srinagar', 'Luxury Houseboat', 'Houseboat'),
  hotel('10000000-0000-4000-8000-000000000004', 'Srinagar', 'Premium Houseboat', 'Houseboat'),
  hotel('10000000-0000-4000-8000-000000000005', 'Srinagar', 'Deluxe Houseboat', 'Houseboat'),
]
const fresh = (tier = 'premium') => ({ ...createItineraryDraft(tier), guestName: 'Aisha Khan', roomsPerNight: 1, roomTypes: ['Double'], roomExtraBeds: [false] })

test('builder starts fresh for every tier with no guest, preset route, package price or template', () => {
  for (const tier of ['premium', 'deluxe', 'luxury']) {
    const draft = createItineraryDraft(tier)
    assert.equal(draft.guestName, '')
    assert.equal(itineraryDraftSchema.safeParse(draft).success, false, 'guest name required')
    assert.equal(draft.pricePerPerson, 0)
    assert.equal(draft.days.length, 2)
    assert.equal(itineraryStays(draft).reduce((sum, stay) => sum + stay.nights, 0), 1)
    assert.equal(draft.days.at(-1).overnight, '')
  }
  for (const count of [2, 6, 11, 12, 15]) {
    const resized = resizeItinerary(fresh(), count)
    assert.ok(itineraryDraftSchema.safeParse(resized).success)
    assert.equal(resized.days.length, count)
    assert.equal(itineraryStays(resized).reduce((sum, stay) => sum + stay.nights, 0), count - 1)
    assert.equal(resized.days.at(-1).overnight, '')
  }
})

test('destinations refresh real photos/highlights and overnight hotels match tier and place', () => {
  let draft = resizeItinerary(fresh(), 9)
  assert.equal(draft.days.length, 9)
  assert.equal(itineraryStays(draft).reduce((sum, stay) => sum + stay.nights, 0), 8)
  const sonamarg = destinationDay('Sonamarg', 1)
  assert.ok(sonamarg.image.includes('snowy-peaks'))
  assert.ok(sonamarg.bullets.includes('Sind River'))
  draft.days[1] = sonamarg
  assert.equal(itineraryStays(draft).find(stay => stay.location === 'Sonamarg').nights, 1)
  assert.deepEqual(eligibleStayHotels(draft, hotels, 'Sonamarg').map(h => h.category), ['Premium'])
  draft.tier = 'deluxe'
  assert.deepEqual(eligibleStayHotels(draft, hotels, 'Sonamarg').map(h => h.category), ['Deluxe'])
  assert.deepEqual(eligibleStayHotels(draft, hotels, 'Gulmarg'), [])
  draft.hotelChoices.Sonamarg = []
  assert.deepEqual(selectedStayHotels(draft, hotels, 'Sonamarg'), [])
  draft = resizeItinerary(draft, 3)
  assert.equal(draft.days.length, 3)
  assert.equal(draft.days.at(-1).overnight, '')
  assert.equal(itineraryStays(draft).reduce((sum, stay) => sum + stay.nights, 0), 2)
})

test('draft validation rejects untrusted photo URLs, invalid nights, totals and oversized days', () => {
  const draft = fresh()
  for (const photo of ['https://evil.test/image.jpg', '/images/../private.jpg', 'data:image/png;base64,abc']) {
    const next = structuredClone(draft)
    next.days[0].image = photo
    assert.equal(itineraryDraftSchema.safeParse(next).success, false)
  }
  assert.equal(itineraryDraftSchema.safeParse({ ...draft, travellers: 0 }).success, false)
  for (const roomsPerNight of [null, 0, 1.5, 101]) assert.equal(itineraryDraftSchema.safeParse({ ...draft, roomsPerNight }).success, false)
  assert.equal(itineraryDraftSchema.safeParse({ ...draft, roomExtraBeds: [] }).success, false, 'each room needs an extra-bed selection')
  assert.equal(itineraryDraftSchema.safeParse({ ...draft, roomExtraBeds: [true, false] }).success, false)
  assert.equal(itineraryDraftSchema.safeParse({ ...draft, roomTypes: [] }).success, false, 'each room needs a room type')
  assert.equal(itineraryDraftSchema.safeParse({ ...draft, roomTypes: ['Suite'] }).success, false)
  assert.equal(itineraryDraftSchema.safeParse({ ...draft, roomTypes: ['Triple'], roomExtraBeds: [true] }).success, false, 'extra beds are only for Double rooms')
  assert.equal(itineraryDraftSchema.safeParse({ ...draft, roomTypes: ['Family'] }).success, true)
  const { roomTypes: _omitted, ...legacy } = { ...draft, roomExtraBeds: [true] }
  assert.deepEqual(itineraryDraftSchema.parse(legacy).roomTypes, ['Double'], 'older drafts default to Double rooms')
  const excluded = { ...draft, roomsPerNight: null, roomTypes: [], roomExtraBeds: [], packageItems: draft.packageItems.map(item => item.id === 'accommodation' ? { ...item, included: false } : item) }
  assert.equal(itineraryDraftSchema.safeParse(excluded).success, true, 'rooms are optional when accommodation is excluded')
  assert.equal(itineraryDraftSchema.safeParse({ ...draft, pricePerPerson: -1 }).success, false)
  assert.throws(() => resizeItinerary(draft, 16))
  assert.equal(itineraryDraftSchema.safeParse({ ...draft, days: Array.from({ length: 16 }, () => draft.days[0]) }).success, false)
  draft.days[0].overnight = ''
  assert.equal(itineraryDraftSchema.safeParse(draft).success, false)
})

test('arrival includes Katra while departure remains Srinagar or Jammu; houseboats are Srinagar only', () => {
  const draft = fresh()
  for (const start of ['Jammu', 'Srinagar', 'Katra']) for (const finish of ['Jammu', 'Srinagar']) {
    draft.arrivalLocation = start
    draft.days = [arrivalDay(start), destinationDay(finish, 1, true)]
    assert.ok(itineraryDraftSchema.safeParse(draft).success)
    assert.equal(draft.days[0].destination, start)
    assert.equal(draft.days[1].destination, finish)
  }
  draft.days[0] = destinationDay('Pahalgam', 0)
  assert.equal(itineraryDraftSchema.safeParse(draft).success, false)
  draft.arrivalSightseeing = true
  assert.ok(itineraryDraftSchema.safeParse(draft).success, 'first day can visit Pahalgam after arrival')
  draft.days[0] = destinationDay('Srinagar', 0)
  draft.days[0].overnightType = 'Houseboat'
  assert.ok(itineraryDraftSchema.safeParse(draft).success)
  for (const tier of ['deluxe', 'premium', 'luxury']) {
    draft.tier = tier
    const candidates = eligibleStayHotels(draft, hotels, 'Srinagar', 'Houseboat')
    assert.equal(candidates.length, 1)
    assert.equal(candidates[0].category.toLowerCase(), `${tier} houseboat`)
    assert.deepEqual(eligibleStayHotels(draft, hotels, 'Sonamarg', 'Houseboat'), [])
  }
  draft.days[0].overnight = 'Sonamarg'
  assert.equal(itineraryDraftSchema.safeParse(draft).success, false)
  assert.equal(itineraryPdfFilename(' Aisha Khan '), 'AVELOF-Aisha-Khan-Itinerary.pdf')
  assert.equal(itineraryPdfFilename('../Aisha / Khan'), 'AVELOF-Aisha-Khan-Itinerary.pdf')
})

test('Day 1 arrival and onward visits use destination photos and highlights, not pickup attractions', () => {
  for (const start of ['Jammu', 'Srinagar', 'Katra']) {
    let draft = changeArrivalPlan(fresh(), start)
    assert.ok(itineraryDraftSchema.safeParse(draft).success)
    assert.equal(draft.days[0].destination, start)
    assert.equal(draft.days[0].bullets.includes('Dal Lake'), false, 'transfer-only arrival has no sightseeing')
    draft = changeArrivalPlan(draft, start, 'Sonamarg')
    assert.ok(itineraryDraftSchema.safeParse(draft).success)
    assert.equal(draft.arrivalLocation, start)
    assert.equal(draft.days[0].destination, 'Sonamarg')
    assert.equal(draft.days[0].overnight, 'Sonamarg')
    assert.equal(draft.days[0].title, `${start} to Sonamarg`)
    assert.ok(draft.days[0].bullets.includes('Sind River'))
    assert.equal(draft.days[0].bullets.includes('Dal Lake'), false)
    assert.equal(draft.days[0].image, destinationDay('Sonamarg', 0).image)
    draft = changeArrivalPlan(draft, start, 'Srinagar')
    assert.ok(draft.days[0].bullets.includes('Dal Lake'), 'returning to Srinagar refreshes its own attractions')
    assert.equal(draft.days[0].bullets.includes('Sind River'), false)
  }
})

test('Katra supports Jammu arrivals, pilgrimage leisure, overnight stays and onward travel', async () => {
  let draft = resizeItinerary(fresh(), 4)
  draft = changeArrivalPlan(draft, 'Jammu', 'Katra')
  assert.equal(draft.days[0].title, 'Jammu to Katra')
  assert.match(draft.days[0].detail, /Mata Vaishno Devi/)
  assert.ok(draft.days[0].bullets.includes('Mata Vaishno Devi darshan'))
  assert.equal(draft.days[0].overnight, 'Katra')
  draft = updateDayPlan(draft, 1, { dayType: 'Leisure' })
  assert.equal(draft.days[1].overnight, 'Katra')
  assert.match(draft.days[1].detail, /Mata Vaishno Devi/)
  assert.equal(itineraryStays(draft).find(stay => stay.location === 'Katra').nights, 2)
  draft = updateDayPlan(draft, 2, { destination: 'Srinagar', overnight: 'Srinagar' })
  assert.equal(draft.days[2].title, 'Katra to Srinagar')
  assert.ok(itineraryDraftSchema.safeParse(draft).success)
  assert.equal(eligibleStayHotels(draft, [hotel('10000000-0000-4000-8000-000000000006', 'Katra', 'Premium')], 'Katra').length, 1)
  const nativeFetch = globalThis.fetch
  globalThis.fetch = async path => new Response(await readFile(new URL(`../public${path}`, import.meta.url)))
  try {
    const pdf = await buildEditableItineraryPdf(draft, [])
    const text = pdf.internal.pages.slice(1).flatMap(page => [...page.join('\n').matchAll(/\((.*?)\) Tj/g)].map(match => match[1])).join(' ')
    for (const expected of ['Jammu to Katra', '45-50 km', 'Mata Vaishno Devi', 'Katra to Srinagar', 'distance and driving time to be confirmed', 'KATRA / 2 NIGHTS', 'ILLUSTRATIVE KASHMIR SCENERY']) assert.ok(text.includes(expected), expected)
  } finally { globalThis.fetch = nativeFetch }
  const katraStart = changeArrivalPlan(fresh(), 'Katra')
  assert.equal(katraStart.days[0].dayType, 'Leisure')
  assert.match(katraStart.days[0].detail, /Mata Vaishno Devi/)
  const onward = changeArrivalPlan(katraStart, 'Katra', 'Srinagar')
  assert.equal(onward.days[0].title, 'Katra to Srinagar')
  assert.ok(itineraryDraftSchema.safeParse(onward).success)
})

test('Patnitop can be an overnight stay and Shiv Khori returns to the starting stay', () => {
  for (const start of ['Jammu', 'Katra', 'Patnitop']) {
    let draft = resizeItinerary(fresh(), 4)
    if (start === 'Patnitop') draft = changeArrivalPlan(draft, 'Jammu', 'Patnitop')
    else draft = changeArrivalPlan(draft, start)
    draft = updateDayPlan(draft, 1, { destination: 'Shiv Khori', overnight: 'Shiv Khori' })
    assert.equal(draft.days[1].overnight, start)
    assert.deepEqual(overnightOptions(draft, 1), [start])
    assert.match(draft.days[1].title, new RegExp(`${start} to Shiv Khori - Return to ${start}`))
    assert.match(draft.days[1].detail, /Shiv Khori cave shrine/)
    assert.ok(itineraryDraftSchema.safeParse(draft).success)
    const invalid = structuredClone(draft)
    invalid.days[1].overnight = 'Shiv Khori'
    assert.equal(itineraryDraftSchema.safeParse(invalid).success, false)
    invalid.days[1].overnight = 'Srinagar'
    assert.equal(itineraryDraftSchema.safeParse(invalid).success, false)
    assert.equal(itineraryStays(draft).some(stay => stay.location === 'Shiv Khori'), false)
  }
})

test('travel estimates use known route data, handle returns and do not invent unsupported routes', () => {
  for (const [from, to] of [['Jammu', 'Patnitop'], ['Jammu', 'Katra'], ['Jammu', 'Shiv Khori'], ['Jammu', 'Srinagar'], ['Katra', 'Patnitop'], ['Katra', 'Shiv Khori'], ['Patnitop', 'Shiv Khori']]) {
    assert.ok(routeEstimate(from, to), `${from} to ${to}`)
    assert.deepEqual(routeEstimate(from, to), routeEstimate(to, from))
  }
  assert.deepEqual(routeEstimate('Srinagar', 'Sonamarg'), { distance: '80-85 km', time: '2-3 hours' })
  assert.deepEqual(routeEstimate('Pahalgam', 'Srinagar'), { distance: '90-100 km', time: '2.5-3.5 hours' })
  const legs = itineraryRouteLegs('Katra', 'Shiv Khori', 'Katra', 'Travel')
  assert.equal(legs.length, 2)
  assert.match(formatItineraryRouteLeg(legs[0]), /Katra to Shiv Khori: approx\..*km/)
  assert.match(formatItineraryRouteLeg(legs[1]), /Shiv Khori to Katra: approx\..*km/)
  assert.deepEqual(itineraryRouteLegs('Katra', 'Katra', 'Katra', 'Leisure'), [])
  assert.match(formatItineraryRouteLeg(itineraryRouteLegs('Gulmarg', 'Pahalgam', 'Pahalgam', 'Travel')[0]), /to be confirmed/)
})

test('vehicle dropdown choices match the website; package items partition once and meals follow separate checks', () => {
  const draft = fresh()
  for (const vehicle of rentalCars) {
    draft.transport = vehicle.name
    assert.ok(itineraryDraftSchema.safeParse(draft).success)
  }
  assert.equal(itineraryDraftSchema.safeParse({ ...draft, transport: 'Unlisted car' }).success, false)
  assert.equal(draft.packageItems[0].id, 'accommodation')
  assert.equal(itineraryPackageDetails(draft).mealPlan, 'Breakfast & dinner')
  for (const id of ['dinner', 'breakfast']) {
    draft.packageItems.find(item => item.id === id).included = false
    assert.ok(itineraryPackageDetails(draft).exclusions.includes(id === 'dinner' ? 'Dinner' : 'Breakfast'))
    assert.equal(itineraryPackageDetails(draft).inclusions.includes(id === 'dinner' ? 'Dinner' : 'Breakfast'), false)
    assert.equal(itineraryPackageDetails(draft).mealPlan, id === 'dinner' ? 'Breakfast only' : 'No meals included')
  }
  for (const item of draft.packageItems) {
    item.included = !item.included
    const details = itineraryPackageDetails(draft)
    assert.equal(details.inclusions.includes(item.label), item.included)
    assert.equal(details.exclusions.includes(item.label), !item.included)
    assert.equal(details.inclusions.length + details.exclusions.length, draft.packageItems.length)
  }
  draft.packageItems.forEach(item => { item.included = false })
  assert.ok(itineraryDraftSchema.safeParse(draft).success, 'all excluded is supported')
  assert.equal(itineraryPackageDetails(draft).inclusions.length, 0)
  draft.packageItems.forEach(item => { item.included = true })
  assert.equal(itineraryPackageDetails(draft).exclusions.length, 0)
  assert.equal(itineraryPackageDetails(draft).mealPlan, 'Breakfast, lunch & dinner')
})

test('dynamic PDF embeds selected hotels and preserves the design, links and edited totals', async () => {
  const nativeFetch = globalThis.fetch
  globalThis.fetch = async path => {
    assert.match(path, /^\/images\//)
    return new Response(await readFile(new URL(`../public${path}`, import.meta.url)))
  }
  try {
    const standardPdf = await buildEditableItineraryPdf(resizeItinerary(fresh(), 6), [])
    assert.ok(standardPdf.getNumberOfPages() >= 6, 'expanded checklist retains branded sections with adaptive pagination')
    assert.ok(standardPdf.output().includes('Aisha Khan'), 'guest name embedded in PDF title')
    const draft = resizeItinerary(fresh(), 9)
    draft.pricePerPerson = 21000; draft.travellers = 4; draft.roomsPerNight = 3; draft.roomTypes = ['Double', 'Family', 'Double']; draft.roomExtraBeds = [false, false, true]
    draft.days[1] = destinationDay('Sonamarg', 1)
    draft.hotelNames.Sonamarg = { useCategory: false, name: '' }
    const pdf = await buildEditableItineraryPdf(draft, hotels)
    const content = Buffer.from(pdf.output('arraybuffer')).toString('latin1')
    assert.ok(content.startsWith('%PDF-'))
    assert.ok(pdf.getNumberOfPages() >= 7)
    const links = pdf.internal.pages.flatMap((_, index) => index ? pdf.getPageInfo(index).pageContext.annotations.filter(annotation => annotation.type === 'link').map(annotation => annotation.options.url) : [])
    for (const expected of ['https://www.avelof.in/#custom-trip', 'mailto:info@avelof.in', 'tel:+919149418161', 'https://www.instagram.com/avelof.in/', `https://www.avelof.in/hotels/${hotels[0].id}`]) assert.ok(links.includes(expected), expected)
    for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
      const urls = pdf.getPageInfo(page).pageContext.annotations.filter(annotation => annotation.type === 'link').map(annotation => annotation.options.url)
      for (const url of ['tel:+919149418161', 'mailto:info@avelof.in', 'https://www.avelof.in', 'https://www.instagram.com/avelof.in/']) assert.ok(urls.includes(url), `page ${page}: ${url}`)
    }
    assert.equal(links.includes(`https://www.avelof.in/hotels/${hotels[1].id}`), false, 'Deluxe hotel excluded from Premium')
    assert.ok(Object.keys(pdf.internal.collections.addImage_images).length >= 3)
    assert.ok(Object.values(pdf.internal.collections.addImage_images).some(image => image.alias === hotels[0].image), 'selected website hotel photograph is embedded')
    const pages = pdf.internal.pages.slice(1).map(page => page.join('\n'))
    const dayPages = pages.filter(page => page.includes('YOUR DAY-BY-DAY JOURNEY'))
    const dayText = dayPages.flatMap(page => [...page.matchAll(/\((.*?)\) Tj/g)].map(match => match[1])).join(' ')
    assert.equal(dayText.split('3 ROOMS PER NIGHT').length - 1, draft.days.length - 1, 'every overnight shows the shared room count')
    assert.equal(dayText.split('1 DOUBLE, 1 FAMILY, 1 DOUBLE + EXTRA BED').length - 1, draft.days.length - 1, 'every overnight shows the room types')
    const hotelText = pages.filter(page => page.includes('YOUR HOTEL STAYS')).flatMap(page => [...page.matchAll(/\((.*?)\) Tj/g)].map(match => match[1])).join(' ')
    assert.ok(hotelText.includes('3 ROOMS PER NIGHT') && hotelText.includes('1 DOUBLE, 1 FAMILY, 1 DOUBLE + EXTRA BED'))
    const pageText = page => [...page.matchAll(/\((.*?)\) Tj/g)].map(match => match[1]).join(' ')
    assert.ok(!pageText(pages[0]).includes('INR 21,000') && !pageText(pages[0]).includes('Total:'), 'cover page has no price')
    assert.ok(pageText(pages[0]).includes('Package price and inclusions are on the Know Your Package page.'))
    const pricePage = pages.find(page => page.includes('YOUR PACKAGE PRICE'))
    assert.ok(pricePage && pricePage.includes('Not included.'), 'price follows the inclusions and exclusions checklist')
    assert.ok(pricePage.indexOf('Not included.') < pricePage.indexOf('YOUR PACKAGE PRICE'))
    for (const expected of ['INR 21,000', 'INR 84,000', 'Rooms per night: 1 Double, 1 Family, 1 Double + extra bed']) assert.ok(pageText(pricePage).includes(expected), expected)
    const checklist = pages.find(page => page.includes('Want anything else included?'))
    assert.ok(checklist)
    assert.ok(checklist.includes('will refund the amount'))
    assert.ok(!pages.some(page => page.includes('Photos are illustrative. Dates and final arrangements')))
    const tipsPages = pages.filter(page => page.includes('Before you travel.'))
    assert.equal(tipsPages.length, 1)
    assert.ok(tipsPages[0].includes('Mobile network') && tipsPages[0].includes('Documents'))
    assert.ok(!tipsPages[0].includes('KNOW YOUR PACKAGE'))
    const noRooms = fresh()
    noRooms.roomsPerNight = null
    noRooms.roomTypes = []
    noRooms.roomExtraBeds = []
    noRooms.packageItems.find(item => item.id === 'accommodation').included = false
    const excludedPdf = await buildEditableItineraryPdf(noRooms, [])
    assert.ok(!excludedPdf.internal.pages.slice(1).some(page => page.join('\n').includes('ROOMS PER NIGHT')))
    for (const [roomTypes, selection, expected] of [[['Double', 'Double', 'Double'], [false, false, false], '3 DOUBLE'], [['Double', 'Double', 'Double'], [true, true, true], '3 DOUBLE + EXTRA BED'], [['Triple', 'Family', 'Triple'], [false, false, false], '2 TRIPLE, 1 FAMILY']]) {
      const arrangementPdf = await buildEditableItineraryPdf({ ...fresh(), roomsPerNight: 3, roomTypes, roomExtraBeds: selection }, [])
      const text = arrangementPdf.internal.pages.slice(1).flatMap(page => [...page.join('\n').matchAll(/\((.*?)\) Tj/g)].map(match => match[1])).join(' ')
      assert.ok(text.includes(expected), expected)
    }
    const longDraft = resizeItinerary(fresh(), 15)
    longDraft.tips = Array.from({ length: 8 }, (_, index) => ({ title: `Travel tip ${index + 1}`, detail: 'Carry your documents and suitable clothing for the weather. '.repeat(4) }))
    const longPdf = await buildEditableItineraryPdf(longDraft, [])
    assert.ok(longPdf.getNumberOfPages() > pdf.getNumberOfPages(), 'long journeys and tips expand pagination')
    const longTipsPages = longPdf.internal.pages.slice(1).map(page => page.join('\n')).filter(page => page.includes('Before you travel.'))
    assert.equal(longTipsPages.length, 1, 'all eight long tips remain on one dedicated page')
    for (let index = 1; index <= 8; index++) assert.ok(longTipsPages[0].includes(`Travel tip ${index}`))
  } finally { globalThis.fetch = nativeFetch }
})

test('every day offers at least eight real website photos and Pahalgam includes ABC valleys without Sonamarg pass trips', async () => {
  for (const name of [...destinations.map(place => place.name), 'Jammu', 'Katra']) {
    const images = destinationImages(name)
    assert.ok(images.length >= 8, name)
    assert.equal(new Set(images).size, images.length)
    for (const image of images) await readFile(new URL(`../public${image}`, import.meta.url))
  }
  const pahalgam = destinationDay('Pahalgam', 1)
  assert.deepEqual(pahalgam.bullets, ['Aru Valley', 'Betaab Valley', 'Chandanwari'])
  for (const valley of pahalgam.bullets) assert.ok(pahalgam.detail.includes(valley))
  const sonamarg = destinationDay('Sonamarg', 1)
  assert.doesNotMatch([sonamarg.title, sonamarg.detail, ...sonamarg.bullets].join(' '), /zoji\s*la/i)
  assert.deepEqual(itineraryContact, { name: 'Mr. Rohyat Naik', phone: '9149418161' })
})

test('day trips return to Srinagar, leisure follows the previous night and route edits propagate', () => {
  let draft = resizeItinerary(fresh(), 5)
  draft = updateDayPlan(draft, 1, { destination: 'Sonamarg', overnight: 'Sonamarg' })
  assert.deepEqual(overnightOptions(draft, 1), ['Sonamarg', 'Srinagar'])
  draft = updateDayPlan(draft, 1, { overnight: 'Srinagar', overnightType: 'Houseboat' })
  assert.ok(itineraryDraftSchema.safeParse(draft).success)
  assert.equal(draft.days[1].title, 'Srinagar to Sonamarg - Return to Srinagar')
  assert.match(draft.days[1].detail, /return to Srinagar/)
  assert.ok(draft.days[1].bullets.includes('Sind River'))
  assert.equal(draft.days[1].bullets.includes('Dal Lake'), false)
  draft = updateDayPlan(draft, 2, { dayType: 'Leisure' })
  assert.equal(draft.days[2].destination, 'Srinagar')
  assert.deepEqual(overnightOptions(draft, 2), ['Srinagar'])
  draft = updateDayPlan(draft, 1, { overnight: 'Sonamarg' })
  assert.equal(draft.days[1].overnightType, 'Hotel')
  assert.equal(draft.days[2].destination, 'Sonamarg')
  assert.equal(draft.days[2].overnight, 'Sonamarg')
  assert.equal(draft.days[2].title, 'Leisure day in Sonamarg')
  assert.ok(itineraryDraftSchema.safeParse(draft).success)
  draft = updateDayPlan(draft, 2, { dayType: 'Travel', destination: 'Pahalgam', overnight: 'Srinagar' })
  assert.match(draft.days[2].title, /Sonamarg to Pahalgam - Return to Srinagar/)
  assert.equal(draft.days[2].image, destinationDay('Pahalgam', 2).image)
  assert.ok(itineraryDraftSchema.safeParse(draft).success)
})

test('reordering, removing and resizing days preserve overnight continuity and departure routes', () => {
  let draft = resizeItinerary(fresh(), 5)
  draft = updateDayPlan(draft, 1, { destination: 'Sonamarg', overnight: 'Sonamarg' })
  draft = updateDayPlan(draft, 2, { dayType: 'Leisure' })
  draft = updateDayPlan(draft, 3, { destination: 'Pahalgam', overnight: 'Pahalgam' })
  assert.equal(draft.days[4].title, 'Pahalgam to Srinagar - Departure')
  const [arrival, sonamarg, leisure, pahalgam, departure] = draft.days
  const reordered = synchronizeItinerary({ ...draft, days: [arrival, leisure, sonamarg, pahalgam, departure] }, draft)
  assert.equal(reordered.days[1].title, 'Leisure day in Srinagar')
  assert.equal(reordered.days[1].overnight, 'Srinagar')
  const removed = synchronizeItinerary({ ...draft, days: [arrival, leisure, pahalgam, departure] }, draft)
  assert.equal(removed.days[1].destination, 'Srinagar')
  assert.equal(removed.days[2].title, 'Srinagar to Pahalgam')
  const shortened = resizeItinerary(draft, 2)
  assert.equal(shortened.days[1].title, 'Departure from Srinagar')
  const edited = updateDayPlan(draft, 1, { title: 'A guest-specific day title', detail: 'Keep this custom plan.' })
  assert.equal(edited.days[1].title, 'A guest-specific day title')
  assert.equal(edited.days[1].detail, 'Keep this custom plan.')
  for (const route of [reordered, removed, shortened, resizeItinerary(draft, 15), edited]) {
    assert.ok(itineraryDraftSchema.safeParse(route).success)
  }
  const invalid = structuredClone(draft)
  invalid.days[1].overnight = 'Gulmarg'
  assert.equal(itineraryDraftSchema.safeParse(invalid).success, false)
})

test('hotel names default to tier categories and custom names never borrow unrelated photos', () => {
  const draft = fresh()
  for (const tier of ['deluxe', 'premium', 'luxury']) {
    draft.tier = tier
    assert.equal(stayDisplayName(draft, 'Srinagar'), `${tier[0].toUpperCase()}${tier.slice(1)} hotel`)
    assert.equal(stayDisplayName(draft, 'Srinagar', 'Houseboat'), `${tier[0].toUpperCase()}${tier.slice(1)} houseboat`)
  }
  assert.deepEqual(selectedStayHotels(draft, hotels, 'Srinagar', 'Houseboat'), [])
  draft.hotelNames['Srinagar (Houseboat)'] = { useCategory: false, name: 'My chosen houseboat' }
  assert.equal(stayDisplayName(draft, 'Srinagar', 'Houseboat'), 'My chosen houseboat')
  assert.deepEqual(selectedStayHotels(draft, hotels, 'Srinagar', 'Houseboat'), [])
  draft.hotelNames['Srinagar (Houseboat)'] = { useCategory: true, name: 'My chosen houseboat' }
  assert.equal(stayDisplayName(draft, 'Srinagar', 'Houseboat'), 'Luxury houseboat')
  draft.hotelNames['Srinagar (Houseboat)'] = { useCategory: false, name: '' }
  assert.equal(selectedStayHotels(draft, hotels, 'Srinagar', 'Houseboat').length, 1)
  draft.hotelChoices['Srinagar (Houseboat)'] = [hotels[2].id]
  draft.hotelNames['Srinagar (Houseboat)'].useCategory = true
  assert.equal(selectedStayHotels(draft, hotels, 'Srinagar', 'Houseboat')[0].id, hotels[2].id, 'explicit website photos remain in category mode')
  assert.equal(stayDisplayName(draft, 'Srinagar', 'Houseboat'), 'Luxury houseboat')
})

test('simplified checklist and meal dropdown remain synchronized without changing lunch or custom wording', () => {
  let draft = fresh()
  assert.equal(draft.packageItems.length, 18)
  assert.equal(draft.packageItems[0].label, 'Hotel stays')
  assert.equal(draft.packageItems.filter(item => /boots|jackets|sweaters/i.test(item.label)).length, 1)
  for (const id of ['heating', 'gulmarg-union', 'personal', 'jackets', 'sweaters']) assert.equal(draft.packageItems.some(item => item.id === id), false)
  draft.packageItems.find(item => item.id === 'lunch').included = true
  draft.packageItems.find(item => item.id === 'breakfast').label = 'Breakfast at the hotel'
  for (const choice of ['both', 'breakfast', 'dinner', 'none']) {
    draft = changeItineraryMeals(draft, choice)
    assert.equal(itineraryMealChoice(draft), choice)
    assert.equal(draft.packageItems.find(item => item.id === 'lunch').included, true)
    assert.equal(draft.packageItems.find(item => item.id === 'breakfast').label, 'Breakfast at the hotel')
    assert.ok(itineraryDraftSchema.safeParse(draft).success)
  }
  draft.packageItems = draft.packageItems.filter(item => !['breakfast', 'dinner'].includes(item.id))
  draft = changeItineraryMeals(draft, 'both')
  assert.equal(itineraryMealChoice(draft), 'both')
  assert.equal(draft.packageItems.filter(item => item.id === 'breakfast').length, 1)
})
