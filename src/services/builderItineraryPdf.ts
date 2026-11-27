import { business, itineraryContact } from '../config.ts'
import { kashmirPhotoGallery as gallery } from '../data/kashmirPhotoGallery.ts'
import { itineraryTerms } from '../data/itineraryTerms.ts'
import { itineraryPackageDetails, itineraryStays, selectedStayHotels, stayDisplayName } from '../data/itineraryBuilder.ts'
import { formatItineraryRouteLeg, itineraryRouteLegs } from '../data/itineraryRoutes.ts'
import { itineraryDraftSchema } from './itineraryBuilderSchema.ts'
import type { ItineraryDraft } from './itineraryBuilderSchema.ts'
import type { Hotel } from '../types.ts'
import { tourPackages } from '../data/catalog.ts'
import { unionCabRefundNote } from '../data/unionCabs.ts'
import qrcode from 'qrcode-generator'

const colors = {
  forest: [24, 73, 61], deep: [16, 49, 43], gold: [176, 128, 69], ink: [40, 54, 49],
  muted: [99, 112, 105], paper: [249, 248, 243], pale: [234, 241, 234],
  red: [157, 69, 53], blush: [250, 239, 234], white: [255, 255, 255], yellow: [222, 188, 123],
}
const ascii = (value: string) => value.normalize('NFKD').replace(/₹/g, 'INR ').replace(/[·–—]/g, '-').replace(/[’‘]/g, "'").replace(/[^\x20-\x7e\n]/g, '')
const money = (value: number) => `INR ${value.toLocaleString('en-IN')}`
const imageCache = new Map<string, Uint8Array>()

/** Builds the actual document used by both admin preview and download. */
export async function buildEditableItineraryPdf(input: ItineraryDraft, hotels: Hotel[], signal?: AbortSignal) {
  const data = itineraryDraftSchema.parse(input)
  const { inclusions, exclusions, mealPlan } = itineraryPackageDetails(data)
  const accommodationIncluded = data.packageItems.some(item => item.id === 'accommodation' && item.included)
  const cabIncluded = data.packageItems.some(item => item.id === 'private-cab' && item.included)
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const { forest, deep, gold, ink, muted, paper, pale, red, blush, white, yellow } = colors
  const stays = itineraryStays(data)
  const hotelGroups = stays.map(stay => ({ ...stay, hotels: selectedStayHotels(data, hotels, stay.location, stay.propertyType) }))
  const paths = new Set([gallery.valleyRiver.image, gallery.houseboat.image, ...data.days.map(day => day.image),
    ...hotelGroups.flatMap(group => group.hotels.map(hotel => data.hotelPhotos[hotel.id] ?? hotel.image))])
  await Promise.all([...paths].map(async path => {
    if (imageCache.has(path)) return
    const response = await fetch(path, { signal })
    if (!response.ok) throw new Error(`Could not load itinerary photograph (${response.status}): ${path}`)
    const bytes = new Uint8Array(await response.arrayBuffer())
    pdf.getImageProperties(bytes)
    if (imageCache.size > 200) imageCache.clear()
    imageCache.set(path, bytes)
  }))
  signal?.throwIfAborted()
  pdf.setProperties({ title: `${business.name} | ${data.guestName} | ${data.title}`, author: business.name, subject: 'Customizable travel itinerary; not a booking confirmation' })
  type TextOptions = { size?: number; color?: number[]; bold?: boolean; width?: number; serif?: boolean; align?: 'left' | 'center' | 'right' }
  function lines(value: string, width: number, size: number, bold = false, serif = false): string[] {
    pdf.setFont(serif ? 'times' : 'helvetica', bold ? 'bold' : 'normal')
    pdf.setFontSize(size)
    return pdf.splitTextToSize(ascii(value), width)
  }
  function text(value: string, x: number, y: number, options: TextOptions = {}) {
    const { size = 10, color = ink, bold = false, width, serif = false, align = 'left' } = options
    const rows = width ? lines(value, width, size, bold, serif) : [ascii(value)]
    pdf.setFont(serif ? 'times' : 'helvetica', bold ? 'bold' : 'normal')
    pdf.setFontSize(size)
    pdf.setTextColor(color[0], color[1], color[2])
    pdf.text(rows, x, y, { align, lineHeightFactor: 1.3 })
    return rows.length * size * 0.3528 * 1.3
  }
  function box(x: number, y: number, w: number, h: number, color: number[], radius = 0) {
    pdf.setFillColor(color[0], color[1], color[2])
    pdf.roundedRect(x, y, w, h, radius, radius, 'F')
  }
  function rule(x: number, y: number, width: number, color = gold) {
    pdf.setDrawColor(color[0], color[1], color[2]); pdf.setLineWidth(0.6); pdf.line(x, y, x + width, y)
  }
  function image(path: string, x: number, y: number, w: number, h: number) {
    const bytes = imageCache.get(path)
    if (!bytes) throw new Error(`Itinerary photograph is unavailable: ${path}`)
    const props = pdf.getImageProperties(bytes)
    const scale = Math.max(w / props.width, h / props.height)
    pdf.saveGraphicsState()
    pdf.rect(x, y, w, h, null); pdf.clip(); pdf.discardPath()
    pdf.addImage(bytes, props.fileType, x + (w - props.width * scale) / 2, y + (h - props.height * scale) / 2, props.width * scale, props.height * scale, path, 'FAST')
    pdf.restoreGraphicsState()
  }
  function link(label: string, url: string, x: number, y: number, width: number, color = forest, size = 9) {
    text(label, x, y, { size, color, bold: true })
    rule(x, y + 1.5, Math.min(width, pdf.getTextWidth(ascii(label))), color)
    pdf.link(x, y - 5, width, 10, { url })
  }
  function page(kicker: string, title: string, subtitle: string) {
    pdf.addPage(); box(0, 0, 210, 297, paper)
    text(business.name, 14, 18, { size: 17, bold: true, color: forest })
    text('BEYOND EXPECTATIONS', 196, 17, { size: 7.5, color: muted, align: 'right' })
    rule(14, 24, 182, pale)
    text(kicker, 14, 36, { size: 8, bold: true, color: gold })
    text(title, 14, 49, { size: 26, serif: true, color: forest })
    text(subtitle, 14, 58, { size: 9, color: muted, width: 182 })
  }
  function check(x: number, y: number, excluded = false) {
    const color = excluded ? red : forest
    pdf.setDrawColor(color[0], color[1], color[2]); pdf.setLineWidth(0.65)
    if (excluded) { pdf.line(x, y, x + 2.4, y + 2.4); pdf.line(x + 2.4, y, x, y + 2.4) }
    else { pdf.line(x, y + 1.2, x + 1, y + 2.3); pdf.line(x + 1, y + 2.3, x + 3.2, y - 0.6) }
  }
  const nights = data.days.length - 1
  const roomCounts = new Map<string, number>()
  data.roomTypes.forEach((type, index) => {
    const label = type === 'Double' && data.roomExtraBeds[index] ? 'Double + extra bed' : type
    roomCounts.set(label, (roomCounts.get(label) ?? 0) + 1)
  })
  const roomArrangement = [...roomCounts].map(([label, count]) => `${count} ${label}`).join(', ')
  const roomSummary = data.roomsPerNight !== null
    ? `${data.roomsPerNight} ${data.roomsPerNight === 1 ? 'ROOM' : 'ROOMS'} PER NIGHT / ${roomArrangement.toUpperCase()}`
    : ''
  box(0, 0, 210, 297, paper)
  box(0, 0, 210, 39, deep)
  text(business.name, 14, 15, { size: 25, bold: true, color: white })
  text('BEYOND EXPECTATIONS', 15, 21, { size: 6.5, color: yellow })
  text('PREPARED ESPECIALLY FOR', 15, 27, { size: 6.5, color: yellow })
  let guestSize = 21
  while (lines(data.guestName, 178, guestSize, true).length > 1 && guestSize > 8) guestSize -= 0.5
  text(data.guestName, 15, 35, { size: guestSize, bold: true, color: white, width: 178 })
  text(`${data.days.length} DAYS / ${nights} NIGHTS`, 196, 12, { size: 10, color: white, align: 'right' })
  text(`${data.travellers} GUESTS${data.travelDate ? ` / ${data.travelDate}` : ''}`, 196, 21, { size: 8, color: yellow, align: 'right' })
  box(14, 43, 182, 31, yellow, 1)
  text('Your itinerary. Fully customizable.', 20, 52, { size: 18, serif: true, color: deep })
  text('Tell us how you would like to travel.', 20, 59, { size: 10, color: deep })
  link('CLICK HERE TO CUSTOMIZE YOUR TRIP >', `${business.website}/#custom-trip`, 20, 68, 91, deep, 9.5)
  contactIcon('phone', 143, 64, deep)
  link(itineraryContact.phone, `tel:${business.phone.replace(/[^\d+]/g, '')}`, 152, 68, 38, deep, 10)
  text(itineraryContact.name, 143, 59, { size: 8, bold: true, color: deep })
  text('Why choose AVELOF?', 14, 84, { size: 16, serif: true, color: forest })
  const promises = [
    ['No hidden charges', 'Clear inclusions, with no hidden charges'],
    ['24/7 support', 'Always with you'],
    ['Your safety first', 'Your safety and care, our priority'],
    [`${data.advancePercent}% advance`, `${100 - data.advancePercent}% after the trip.`],
  ]
  promises.forEach(([heading, detail], i) => {
    const x = 14 + i % 2 * 93; const y = 89 + Math.floor(i / 2) * 24
    box(x, y, 89, 21, pale, 1); box(x, y, 1.4, 21, gold)
    text(`0${i + 1}`, x + 4, y + 7, { size: 8, bold: true, color: gold })
    text(heading, x + 12, y + 8, { size: 11, bold: true, color: forest })
    text(detail, x + 5, y + 15, { size: 8, width: 80 })
  })
  image(data.days[0].image, 0, 140, 210, 53)
  box(14, 145, 76, 33, deep)
  text(data.tier.toUpperCase(), 20, 153, { size: 8, bold: true, color: yellow })
  let coverTitleSize = 20
  while (coverTitleSize > 8 && lines(data.title, 66, coverTitleSize, false, true).length * coverTitleSize * 0.45864 > 21) coverTitleSize -= 0.5
  if (lines(data.title, 66, coverTitleSize, false, true).length * coverTitleSize * 0.45864 > 21) throw new Error('Shorten the package title so it fits the cover.')
  text(data.title, 19, 163, { size: coverTitleSize, serif: true, color: white, width: 66 })
  box(94, 164, 102, 49, yellow)
  text('YOUR JOURNEY AT A GLANCE', 100, 172, { size: 7.5, bold: true, color: deep })
  text(`${data.days.length} days / ${nights} nights`, 100, 183, { size: 18, serif: true, color: deep })
  text(`${data.travellers} ${data.travellers === 1 ? 'guest' : 'guests'}${accommodationIncluded && data.roomsPerNight !== null ? ` / ${data.roomsPerNight} ${data.roomsPerNight === 1 ? 'room' : 'rooms'} per night` : ''}`, 101, 191, { size: 10, bold: true, color: deep, width: 89 })
  text('Package price and inclusions are on the Know Your Package page.', 101, 198, { size: 8.5, width: 89, color: deep })
  text(`${data.advancePercent}% advance`, 14, 202, { size: 16, serif: true, color: forest })
  text(`${100 - data.advancePercent}% after the trip`, 14, 211, { size: 14, serif: true, color: forest })
  const category = tourPackages.find(trip => trip.id === data.tier)!.hotelStandard
  ;[['HOTEL CATEGORY', accommodationIncluded ? category : 'Accommodation not included'], ['MEAL PLAN', mealPlan], ['SELECTED VEHICLE', `${data.transport}${cabIncluded ? '' : ' (not included)'}`]].forEach(([label, value], i) => {
    const x = 14 + i * 62
    rule(x, 220, 55)
    text(label, x, 227, { size: 7.5, bold: true, color: muted })
    text(value, x, 234, { size: 8.2, bold: true, color: forest, width: 56 })
  })
  box(14, 246, 182, 21, pale)
  const route = [data.arrivalLocation, ...data.days.map(day => day.destination)].filter((place, i, places) => i === 0 || place !== places[i - 1]).join(' - ')
  const routeRows = lines(route, 171, 8.5, true)
  text(routeRows.length <= 2 ? route : `${data.arrivalLocation} - ${data.days.length} days of discovery - ${data.days.at(-1)!.destination}`, 20, 253, { size: 8.5, bold: true, width: 171, color: forest })
  text(`${nights} overnight ${nights === 1 ? 'stay' : 'stays'} / ${stays.length} overnight destinations`, 20, 264, { size: 8.5, color: muted })

  let y = 0
  let cardOnPage = 0
  for (const [index, day] of data.days.entries()) {
    const titleHeight = lines(day.title, 95, 16, false, true).length * 7.34
    const start = index === 0 ? data.arrivalLocation : data.days[index - 1].overnight
    const routeDetails = itineraryRouteLegs(start, day.destination, day.overnight, day.dayType).map(formatItineraryRouteLeg)
    const routeHeight = routeDetails.reduce((sum, detail) => sum + lines(detail, 95, 8.5, true).length * 3.9 + 1, 0)
    const detailHeight = lines(day.detail, 95, 11.5).length * 5.28
    const bulletHeights = day.bullets.map(point => lines(`- ${point}`, 95, 10).length * 4.59)
    const roomLabel = accommodationIncluded && data.roomsPerNight !== null ? ` / ${roomSummary}` : ''
    const overnightLabel = day.overnight ? `OVERNIGHT / ${day.overnight} / ${stayDisplayName(data, day.overnight, day.overnightType)}${roomLabel}` : 'DEPARTURE / NO OVERNIGHT STAY'
    const overnightRows = lines(overnightLabel, 95, 9, true).length
    const cardHeight = Math.max(68, 29 + titleHeight + routeHeight + detailHeight + bulletHeights.reduce((a, b) => a + b, 0) + (overnightRows - 1) * 4.5)
    if (cardHeight > 196) throw new Error(`Day ${index + 1} has too much text for one page. Shorten its description or highlights.`)
    if (!cardOnPage || cardOnPage === 3 || y + cardHeight > 261) {
      page('YOUR DAY-BY-DAY JOURNEY', 'Arrive. Explore. Unwind.', 'A journey built around your chosen places.')
      text('Driving estimates vary with route, traffic and weather; sightseeing and stops are extra time. Activities and entry fees are extra unless included.', 14, 267, { size: 7, width: 182, color: muted })
      y = 69; cardOnPage = 0
    }
    const photoX = cardOnPage === 1 ? 14 : 121
    const textX = cardOnPage === 1 ? 95 : 19
    box(14, y, 182, cardHeight, white)
    image(day.image, photoX, y, 75, cardHeight)
    if (['Jammu', 'Katra', 'Patnitop', 'Shiv Khori'].includes(day.destination)) {
      box(photoX, y + cardHeight - 7, 75, 7, deep)
      text('ILLUSTRATIVE KASHMIR SCENERY', photoX + 3, y + cardHeight - 2.3, { size: 6, bold: true, color: white })
    }
    box(photoX + 4, y + 4, 16, 13, deep)
    text(String(index + 1).padStart(2, '0'), photoX + 12, y + 13, { size: 17, serif: true, color: white, align: 'center' })
    text(`DAY ${String(index + 1).padStart(2, '0')} / ${day.dayType.toUpperCase()} DAY`, textX, y + 6, { size: 8, bold: true, color: gold })
    let cursor = y + 14
    cursor += text(day.title, textX, cursor, { size: 16, serif: true, color: forest, width: 95 }) + 2
    for (const routeDetail of routeDetails) cursor += text(routeDetail, textX, cursor, { size: 8.5, bold: true, color: forest, width: 95 }) + 1
    cursor += text(day.detail, textX, cursor, { size: 11.5, width: 95, color: deep }) + 2
    for (const point of day.bullets) cursor += text(`- ${point}`, textX, cursor, { size: 10, width: 95 })
    text(overnightLabel, textX, y + cardHeight - 4 - (overnightRows - 1) * 4.5, { size: 9, bold: true, color: forest, width: 95 })
    y += cardHeight + 4; cardOnPage++
  }
  y = 300
  for (const group of hotelGroups) {
    const rooms = accommodationIncluded && data.roomsPerNight !== null ? ` / ${roomSummary}` : ''
    const heading = `${group.key.toUpperCase()} / ${group.nights} ${group.nights === 1 ? 'NIGHT' : 'NIGHTS'}${rooms} / ONE OPTION`
    const headingHeight = lines(heading, 182, 9, true).length * 4.2 + 3
    const nameHeight = Math.max(0, ...group.hotels.map(hotel => lines(hotel.name, 52, 12, false, true).length * 5.51))
    const stayLabel = stayDisplayName(data, group.location, group.propertyType)
    const stayLabelHeight = lines(stayLabel, 170, 17, false, true).length * 7.8
    const height = group.hotels.length ? headingHeight + 30 + 3 + nameHeight + 9 : headingHeight + stayLabelHeight + 25
    if (y + height > 266) {
      page('YOUR HOTEL STAYS', accommodationIncluded ? 'These hotels or similar stays.' : 'Optional hotel stays.', accommodationIncluded ? 'The hotels shown or similar alternatives will be provided, subject to availability.' : 'Accommodation is excluded from this quote. These stays are suggestions only.')
      text(accommodationIncluded ? 'Final hotels will be confirmed at booking.' : 'Contact AVELOF to add accommodation.', 14, 65, { size: 9, color: muted })
      y = 74
    }
    const top = y
    text(heading, 14, top, { size: 9, bold: true, width: 182, color: gold })
    if (!group.hotels.length) {
      box(14, top + headingHeight, 182, height - headingHeight, pale)
      text(stayLabel, 20, top + headingHeight + 11, { size: 17, serif: true, color: forest, width: 170 })
      text('Exact or similar stay, subject to availability. Final property confirmed at booking.', 20, top + headingHeight + stayLabelHeight + 15, { size: 9, color: muted, width: 170 })
    }
    group.hotels.forEach((hotel, i) => {
      const x = 14 + i * 62
      const photoY = top + headingHeight
      box(x, photoY, 58, height - headingHeight, white)
      image(data.hotelPhotos[hotel.id] ?? hotel.image, x, photoY, 58, 30)
      text(hotel.name, x + 3, photoY + 36, { size: 12, serif: true, width: 52, color: forest })
      text(hotel.category ?? '', x + 3, photoY + 36 + nameHeight, { size: 8, color: muted })
      pdf.link(x, photoY, 58, height - headingHeight, { url: `${business.website}/hotels/${hotel.id}` })
    })
    y += height + 6
  }
  page('KNOW YOUR PACKAGE', 'Clearly included. Clearly extra.', `${data.title} / ${data.days.length} days, ${nights} nights`)
  y = 65
  const checklistHeadings = () => {
    for (const [index, label] of ['Included.', 'Not included.'].entries()) {
      const x = 14 + index * 93
      box(x, y, 89, 13, index ? red : forest)
      text(label, x + 5, y + 9, { size: 18, serif: true, color: white })
    }
    y += 13
  }
  checklistHeadings()
  if (!inclusions.length) text('No listed services included.', 19, y + 7, { size: 9, width: 75, color: muted })
  if (!exclusions.length) text('No listed exclusions.', 112, y + 7, { size: 9, width: 75, color: muted })
  for (let index = 0; index < Math.max(inclusions.length, exclusions.length); index++) {
    const pair = [inclusions[index], exclusions[index]]
    const height = Math.max(9, ...pair.map(item => item ? lines(item, 75, 9).length * 4.13 + 5 : 0))
    if (y + height > 258) {
      page('KNOW YOUR PACKAGE', 'Package checklist.', 'Your inclusions and exclusions, continued.')
      y = 65; checklistHeadings()
    }
    pair.forEach((item, column) => {
      const x = 14 + column * 93
      if (!(column ? exclusions : inclusions).length) return
      box(x, y, 89, height, column ? blush : pale)
      if (!item) return
      check(x + 4, y + 3, !!column)
      text(item, x + 11, y + 6, { size: 9, width: 75, color: column ? red : forest })
    })
    y += height
  }
  y += 6
  const roomLine = accommodationIncluded && data.roomsPerNight !== null ? `Rooms per night: ${roomArrangement}` : ''
  const noteHeight = data.priceNote ? lines(data.priceNote, 100, 8.5).length * 3.9 : 0
  const roomHeight = roomLine ? lines(roomLine, 100, 8.5, true).length * 3.9 + 1 : 0
  const priceHeight = Math.max(48, 30 + noteHeight + roomHeight + 4)
  if (y + priceHeight > 266) {
    page('KNOW YOUR PACKAGE', 'Your package price.', `${data.title} / ${data.days.length} days, ${nights} nights`)
    y = 65
  }
  box(14, y, 182, priceHeight, deep, 2)
  box(14, y, 182, 1.6, gold)
  text('YOUR PACKAGE PRICE', 20, y + 9, { size: 8, bold: true, color: yellow })
  text(money(data.pricePerPerson), 20, y + 22, { size: 24, bold: true, color: white })
  text(`per person / ${data.travellers} ${data.travellers === 1 ? 'guest' : 'guests'}`, 20, y + 29, { size: 9, color: white })
  let priceCursor = y + 36
  if (roomLine) priceCursor += text(roomLine, 20, priceCursor, { size: 8.5, bold: true, color: yellow, width: 100 }) + 1
  if (data.priceNote) text(data.priceNote, 20, priceCursor, { size: 8.5, color: white, width: 100 })
  box(130, y + 7, 60, priceHeight - 14, yellow, 2)
  text('TOTAL PACKAGE', 135, y + 16, { size: 7.5, bold: true, color: deep })
  const totalLabel = money(Math.round(data.pricePerPerson * data.travellers * 100) / 100)
  let totalSize = 15
  while (totalSize > 9 && lines(totalLabel, 52, totalSize, true).length > 1) totalSize -= 0.5
  text(totalLabel, 135, y + 27, { size: totalSize, bold: true, color: deep, width: 52 })
  text(`${data.advancePercent}% advance / ${100 - data.advancePercent}% after the trip`, 135, y + 35, { size: 7.5, color: deep, width: 52 })
  y += priceHeight + 6
  const practicalNotes = [
    { value: 'Want anything else included? Please let us know - we are open to adding it to your package.', bold: true, size: 10 },
    { value: unionCabRefundNote, bold: false, size: 8 },
  ]
  for (const note of practicalNotes) {
    const height = lines(note.value, 182, note.size, note.bold).length * note.size * 0.45864 + 4
    if (y + height > 266) { page('YOUR PACKAGE', 'A few useful details.', ''); y = 72 }
    y += text(note.value, 14, y, { size: note.size, bold: note.bold, width: 182, color: note.bold ? forest : muted }) + 4
  }
  {
    page('A FEW SIMPLE ESSENTIALS', 'Before you travel.', 'Travel guidance and terms for your journey.')
    y = 70
    const pairs = Array.from({ length: Math.ceil(data.tips.length / 2) }, (_, index) => data.tips.slice(index * 2, index * 2 + 2))
    const termsHeight = 14 + itineraryTerms.reduce((sum, term) =>
      sum + 8 + lines(term.detail, 168, 9).length * 9 * 0.45864 + 3, 0)
    const heights = () => pairs.map(pair => Math.max(...pair.map(tip =>
      18 + lines(tip.title, 79, 12, true).length * 5.51 + lines(tip.detail, 79, detailSize).length * detailSize * 0.45864)))
    let detailSize = 10
    const tipsSpace = () => heights().reduce((sum, height) => sum + height, 0) + Math.max(0, pairs.length - 1) * 5
    const availableHeight = 263 - y
    while (tipsSpace() + (pairs.length ? 7 : 0) + termsHeight > availableHeight && detailSize > 9) detailSize -= 0.5
    const together = tipsSpace() + (pairs.length ? 7 : 0) + termsHeight <= availableHeight
    if (!together) {
      while (tipsSpace() > availableHeight && detailSize > 7) detailSize -= 0.5
      if (tipsSpace() > availableHeight) throw new Error('Shorten the travel tips so they fit on one page.')
    }
    const minimumHeights = heights()
    pairs.forEach((pair, row) => {
      const height = minimumHeights[row]
      pair.forEach((tip, index) => {
        const x = 14 + index * 93
        box(x, y, 89, height, pale, 1); box(x, y, 1.4, height, gold)
        const headingHeight = text(tip.title, x + 5, y + 10, { size: 12, bold: true, width: 79, color: forest })
        text(tip.detail, x + 5, y + 13 + headingHeight, { size: detailSize, width: 79 })
      })
      y += height + 5
    })
    if (!together) {
      page('BEFORE YOU TRAVEL', 'Terms and conditions.', 'Please review these terms for your journey.')
      y = 70
    } else {
      if (pairs.length) y += 2
      text('Terms and conditions.', 14, y + 7, { size: 18, serif: true, color: forest })
      y += 14
    }
    for (const term of itineraryTerms) {
      text(term.title, 19, y + 4, { size: 9.5, bold: true, color: forest })
      y += 8
      y += text(term.detail, 19, y, { size: 9, width: 168, color: deep }) + 3
    }
  }
  pdf.addPage(); box(0, 0, 210, 297, deep)
  image(gallery.houseboat.image, 0, 0, 210, 108)
  box(14, 14, 65, 29, deep)
  text(business.name, 19, 28, { size: 25, bold: true, color: white })
  text('BEYOND EXPECTATIONS', 20, 36, { size: 7, color: yellow })
  text('Your next chapter?', 13, 137, { size: 36, serif: true, color: white })
  text('Make it Kashmir.', 13, 154, { size: 36, serif: true, color: yellow })
  text('Thank you for choosing to explore with AVELOF.', 14, 166, { size: 12, color: white })
  function contactIcon(kind: 'phone' | 'email' | 'website' | 'instagram', x: number, y: number, color = yellow) {
    pdf.setDrawColor(color[0], color[1], color[2]); pdf.setLineWidth(0.45)
    if (kind === 'email') {
      pdf.roundedRect(x, y, 5.5, 4, 0.4, 0.4)
      pdf.line(x, y, x + 2.75, y + 2.4); pdf.line(x + 2.75, y + 2.4, x + 5.5, y)
    } else if (kind === 'website') {
      pdf.circle(x + 2.5, y + 2, 2.5); pdf.ellipse(x + 2.5, y + 2, 1.1, 2.5)
      pdf.line(x, y + 2, x + 5, y + 2)
    } else if (kind === 'instagram') {
      pdf.roundedRect(x, y - 0.5, 5, 5, 1.2, 1.2); pdf.circle(x + 2.5, y + 2, 1.15)
      pdf.circle(x + 3.8, y + 0.7, 0.2)
    } else {
      pdf.lines([[1, 1.4], [-0.8, 0.9], [1.8, 1.8], [0.9, -0.8], [1.4, 1], [-0.6, 1.1], [-1.6, 0], [-3, -3], [0, -1.6], [0.9, -0.6]], x, y, [1, 1], 'S', true)
    }
  }
  box(14, 177, 182, 40, forest, 2)
  const contacts = [
    { kind: 'phone', label: itineraryContact.phone, url: `tel:${business.phone.replace(/[^\d+]/g, '')}` },
    { kind: 'email', label: business.email, url: `mailto:${business.email}` },
    { kind: 'website', label: 'avelof.in', url: business.website },
    { kind: 'instagram', label: business.instagramHandle, url: business.instagram },
  ] as const
  contacts.forEach((contact, index) => {
    const x = 20 + index % 2 * 91, y = 189 + Math.floor(index / 2) * 18
    if (contact.kind === 'phone') text(itineraryContact.name, x + 9, y - 6, { size: 8, bold: true, color: yellow })
    contactIcon(contact.kind, x, y - 3.5)
    link(contact.label, contact.url, x + 9, y, 70, white, 10.5)
  })
  box(14, 225, 182, 38, forest, 2)
  text('A LITTLE EXTRA FOR YOUR JOURNEY', 20, 233, { size: 7.5, bold: true, color: yellow })
  text('Follow us. Get extra 3% off.', 20, 244, { size: 19, serif: true, color: white })
  link(`Instagram: ${business.instagramHandle}`, business.instagram, 20, 254, 118, yellow, 10)
  text('SCAN TO FOLLOW', 173, 223, { size: 7, bold: true, color: yellow, align: 'center' })
  const qr = qrcode(0, 'M')
  qr.addData(business.instagram); qr.make()
  const moduleSize = 34 / (qr.getModuleCount() + 8)
  box(156, 227, 34, 34, white)
  pdf.setFillColor(deep[0], deep[1], deep[2])
  for (let row = 0; row < qr.getModuleCount(); row++) for (let col = 0; col < qr.getModuleCount(); col++) {
    if (qr.isDark(row, col)) pdf.rect(156 + (col + 4) * moduleSize, 227 + (row + 4) * moduleSize, moduleSize, moduleSize, 'F')
  }
  pdf.link(156, 227, 34, 34, { url: business.instagram })
  link('Let us customize your Kashmir journey >', `${business.website}/#custom-trip`, 14, 269, 182, white, 10)
  const pageCount = pdf.getNumberOfPages()
  for (let n = 1; n <= pageCount; n++) {
    pdf.setPage(n)
    const color = n === pageCount ? white : muted
    rule(14, 274, 182, n === pageCount ? gold : pale)
    text(itineraryContact.name, 22, 280, { size: 7, bold: true, color })
    contacts.forEach((contact, index) => {
      const x = [14, 64, 117, 157][index]
      contactIcon(contact.kind, x, 282, color)
      link(contact.label, contact.url, x + 8, 286, [40, 43, 30, 31][index], color, 8)
    })
    text(`${n} / ${pageCount}`, 196, 294, { size: 7, color, align: 'right' })
  }
  return pdf
}
