import type { jsPDF as JsPDFDocument } from 'jspdf'
import { business } from '../config.ts'
import { brandPromises } from '../data/brandPromises.ts'
import { kashmirPhotosForPdf } from '../data/kashmirPhotoGallery.ts'
import { unionCabRefundNote } from '../data/unionCabs.ts'
import type { TourPackage } from '../types.ts'

export interface ItineraryPdfDay {
  label: string
  title: string
  detail: string
}

export interface ItineraryPdfData {
  title: string
  subtitle: string
  dates?: string
  guests?: string
  overview?: string[]
  days: ItineraryPdfDay[]
  stays?: string[]
  vehicle?: string
  activities?: string[]
  unionCabs?: string[]
  estimate?: string
  inclusions: string[]
  exclusions: string[]
  notes?: string[]
}

const pageWidth = 210
const pageHeight = 297
const margin = 14
const contentBottom = 266
const forest = [24, 89, 78] as const
const deepForest = [18, 62, 57] as const
const copper = [178, 113, 85] as const
const ink = [32, 58, 58] as const
const muted = [91, 112, 108] as const
const paper = [249, 248, 243] as const
const pale = [237, 243, 238] as const
const promiseIconColor = [178, 113, 85] as const
const planningNote = 'This PDF is a planning guide, not your final itinerary or a confirmed booking. AVELOF will help refine your choices and arrange the final trip.'

function setPdfTextColor(pdf: JsPDFDocument, color: readonly number[]) {
  pdf.setTextColor(color[0], color[1], color[2])
}

function drawPromiseIcon(pdf: JsPDFDocument, index: number, x: number, y: number) {
  const left = x + 1
  const top = y + 1
  pdf.setDrawColor(...promiseIconColor)
  pdf.setLineWidth(0.7)
  if (index === 0) {
    pdf.circle(x + 4, y + 4, 3.2, 'S')
    pdf.line(left + 1.2, top + 3.1, left + 2.5, top + 4.4)
    pdf.line(left + 2.5, top + 4.4, left + 5.1, top + 1.7)
  } else if (index === 1) {
    pdf.roundedRect(x + 1.7, y + 0.6, 4.6, 6.8, 0.8, 0.8, 'S')
    pdf.line(x + 3, y + 1.6, x + 5, y + 1.6)
    pdf.circle(x + 4, y + 6.2, 0.25, 'S')
  } else if (index === 2) {
    pdf.line(x + 4, y + 0.5, x + 7, y + 1.6)
    pdf.line(x + 7, y + 1.6, x + 6.5, y + 4.4)
    pdf.line(x + 6.5, y + 4.4, x + 4, y + 7)
    pdf.line(x + 4, y + 7, x + 1.5, y + 4.4)
    pdf.line(x + 1.5, y + 4.4, x + 1, y + 1.6)
    pdf.line(x + 1, y + 1.6, x + 4, y + 0.5)
    pdf.line(x + 2.5, y + 3.7, x + 3.6, y + 4.8)
    pdf.line(x + 3.6, y + 4.8, x + 5.6, y + 2.7)
  } else {
    pdf.roundedRect(x + 0.6, y + 1, 6.8, 5.8, 0.8, 0.8, 'S')
    pdf.line(x + 1, y + 2.8, x + 7, y + 2.8)
    pdf.line(x + 1.7, y + 5.2, x + 3.5, y + 5.2)
  }
}

function printable(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, (character) => ({
      '’': "'",
      '‘': "'",
      '“': '"',
      '”': '"',
      '–': '-',
      '—': '-',
      '·': '-',
      '₹': 'INR ',
      '×': 'x',
      '…': '...',
    }[character] ?? ''))
}

function safeFileName(value: string) {
  return printable(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'kashmir-itinerary'
}

export function tourPackagePdfData(item: TourPackage): ItineraryPdfData {
  const includesUnionCabs = item.inclusions.some((entry) => /union cab/i.test(entry))
  const excludesUnionCabs = item.exclusions.some((entry) => /union cab/i.test(entry))
  return {
    title: `${item.name} Kashmir Tour Package`,
    subtitle: item.description,
    dates: item.duration,
    guests: 'Package price is per person; travel dates and availability are confirmed with AVELOF.',
    overview: [
      `Current displayed package rate: INR ${item.price.toLocaleString('en-IN')} per person${item.originalPrice && item.originalPrice > item.price ? ` (regular rate INR ${item.originalPrice.toLocaleString('en-IN')})` : ''}. Final price depends on dates and confirmed availability.`,
      `Route: ${item.location}.`,
      `Hotel category: ${item.hotelStandard}.`,
      `Tour guide: ${item.tourGuide}`,
      item.transport,
      ...item.stays.map((stay) => `${stay.location}: ${stay.nights} ${stay.nights === 1 ? 'night' : 'nights'} - ${stay.hotel}.`),
      ...item.experiences.map((experience) => `Experience: ${experience}.`),
    ],
    days: item.itinerary.map((day) => ({ label: day.day, title: day.title, detail: day.detail })),
    inclusions: item.inclusions,
    exclusions: item.exclusions,
    notes: [
      'Optional activities, tickets and access are subject to availability, local rules, weather and operator confirmation.',
      ...(includesUnionCabs || excludesUnionCabs ? [`Union-cab charges and usage depend on the package and confirmation. ${unionCabRefundNote}`] : []),
    ],
  }
}

export async function buildBrandedItineraryPdf(data: ItineraryPdfData) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: false })
  const photoImages = await Promise.all(kashmirPhotosForPdf.map(async (photo) => {
    const response = await fetch(photo.image)
    if (!response.ok) throw new Error(`Unable to load PDF photo ${photo.image}: ${response.status} ${response.statusText}`)
    return new Uint8Array(await response.arrayBuffer())
  }))
  pdf.setProperties({ title: `${printable(data.title)} | AVELOF`, author: business.name, subject: 'Kashmir travel itinerary' })
  let y = 0

  const writeWrapped = (text: string, x: number, top: number, width: number, fontSize = 10, color: readonly number[] = ink) => {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(fontSize)
    setPdfTextColor(pdf, color)
    const lines = pdf.splitTextToSize(printable(text), width) as string[]
    pdf.text(lines, x, top)
    return lines.length * fontSize * 0.42
  }

  const drawHeader = () => {
    setPdfTextColor(pdf, forest)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.text(business.name, margin, 13)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    setPdfTextColor(pdf, muted)
    pdf.text('BEYOND EXPECTATIONS', margin, 18)
    const website = business.website.replace(/^https?:\/\/(www\.)?/, '')
    pdf.textWithLink(website, pageWidth - margin - pdf.getTextWidth(website), 14, { url: business.website })
    pdf.setDrawColor(...pale)
    pdf.setLineWidth(0.5)
    pdf.line(margin, 22, pageWidth - margin, 22)
  }

  const drawWatermark = () => {
    pdf.setTextColor(243, 246, 242)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(34)
    pdf.text(business.name, pageWidth / 2, pageHeight / 2, { align: 'center', angle: -32 })
  }

  const startContentPage = () => {
    pdf.addPage()
    drawWatermark()
    y = 32
  }

  const sectionHeading = (title: string) => {
    if (y + 13 > contentBottom) startContentPage()
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(15)
    setPdfTextColor(pdf, forest)
    pdf.text(printable(title), margin, y)
    pdf.setDrawColor(...copper)
    pdf.setLineWidth(0.8)
    pdf.line(margin, y + 3, margin + 18, y + 3)
    y += 11
  }

  const paragraph = (text: string, indent = 0) => {
    const lines = pdf.splitTextToSize(printable(text), pageWidth - margin * 2 - indent) as string[]
    const height = lines.length * 5
    if (y + height > contentBottom) startContentPage()
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9.5)
    setPdfTextColor(pdf, ink)
    pdf.text(lines, margin + indent, y)
    y += height + 3
  }

  const bulletList = (items: string[]) => {
    for (const item of items) {
      const lines = pdf.splitTextToSize(printable(item), pageWidth - margin * 2 - 11) as string[]
      const height = Math.max(5, lines.length * 4.8)
      if (y + height > contentBottom) startContentPage()
      pdf.setFillColor(...copper)
      pdf.circle(margin + 2, y - 1.1, 0.8, 'F')
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9.5)
      setPdfTextColor(pdf, ink)
      pdf.text(lines, margin + 7, y)
      y += height + 2
    }
    y += 2
  }

  const drawFooter = (onDark = false) => {
    const footerTop = 272
    const labelColor = onDark ? [215, 232, 223] : muted
    const linkColor = onDark ? [255, 255, 255] : forest
    pdf.setDrawColor(...pale)
    pdf.setLineWidth(0.5)
    pdf.line(margin, footerTop, pageWidth - margin, footerTop)
    const contacts = [
      { label: 'CALL', value: business.phone, url: `tel:${business.phone.replace(/[^\d+]/g, '')}`, x: margin },
      { label: 'EMAIL', value: business.email, url: `mailto:${business.email}`, x: 59 },
      { label: 'WEBSITE', value: 'avelof.in', url: business.website, x: 111 },
      { label: 'INSTAGRAM', value: business.instagramHandle, url: business.instagram, x: 158 },
    ]
    for (const contact of contacts) {
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(6)
      setPdfTextColor(pdf, labelColor)
      pdf.text(contact.label, contact.x, footerTop + 6)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7.5)
      setPdfTextColor(pdf, linkColor)
      pdf.textWithLink(printable(contact.value), contact.x, footerTop + 12, { url: contact.url })
    }
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    setPdfTextColor(pdf, onDark ? [215, 232, 223] : muted)
    pdf.text('Kashmir, India', margin, 291)
    pdf.text(`${pdf.getCurrentPageInfo().pageNumber}`, pageWidth - margin, 291, { align: 'right' })
  }

  const drawCover = () => {
    pdf.setFillColor(...deepForest)
    pdf.rect(0, 0, pageWidth, pageHeight, 'F')
    pdf.setFillColor(...forest)
    pdf.circle(pageWidth - 10, 20, 54, 'F')
    pdf.setFillColor(...copper)
    pdf.rect(margin, 31, 24, 1.4, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(34)
    pdf.text(business.name, margin, 56)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.setCharSpace(2)
    pdf.text('BEYOND EXPECTATIONS', margin + 0.5, 65)
    pdf.setCharSpace(0)
    pdf.setTextColor(225, 238, 230)
    pdf.setFontSize(11)
    pdf.text('Your Kashmir journey, thoughtfully brought together.', margin, 84)
    pdf.setTextColor(255, 255, 255)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(22)
    const titleLines = pdf.splitTextToSize(printable(data.title), pageWidth - margin * 2) as string[]
    pdf.text(titleLines, margin, 113)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.setTextColor(225, 238, 230)
    const subtitleLines = pdf.splitTextToSize(printable(data.subtitle), pageWidth - margin * 2) as string[]
    pdf.text(subtitleLines, margin, 113 + titleLines.length * 10 + 3)

    const cardTop = 151
    const cardWidth = (pageWidth - margin * 2 - 8) / 2
    const cardHeight = 22
    const cardGap = 6
    brandPromises.forEach((promise, index) => {
      const x = margin + (index % 2) * (cardWidth + 8)
      const top = cardTop + Math.floor(index / 2) * (cardHeight + cardGap)
      pdf.setFillColor(255, 255, 255)
      pdf.setDrawColor(85, 130, 115)
      pdf.setLineWidth(0.5)
      pdf.roundedRect(x, top, cardWidth, cardHeight, 3, 3, 'FD')
      drawPromiseIcon(pdf, index, x + 5, top + (cardHeight - 8) / 2)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8.5)
      setPdfTextColor(pdf, deepForest)
      const lines = pdf.splitTextToSize(printable(promise), cardWidth - 22) as string[]
      const textHeight = pdf.getTextDimensions(printable(promise), { maxWidth: cardWidth - 22 }).h
      pdf.text(lines, x + 16, top + (cardHeight - textHeight) / 2, { baseline: 'top' })
    })

    const summary = [data.dates, data.guests].filter(Boolean).join('  |  ')
    const cardsBottom = cardTop + Math.ceil(brandPromises.length / 2) * (cardHeight + cardGap) - cardGap
    let summaryBottom = cardsBottom
    if (summary) {
      const summaryTop = cardsBottom + 9
      summaryBottom = summaryTop + writeWrapped(summary, margin, summaryTop, pageWidth - margin * 2, 8.5, [225, 238, 230])
    }
    const noteTop = Math.max(231, summaryBottom + 6)
    pdf.setFillColor(255, 255, 255)
    pdf.setDrawColor(85, 130, 115)
    pdf.setLineWidth(0.5)
    pdf.roundedRect(margin, noteTop, pageWidth - margin * 2, 30, 3, 3, 'FD')
    writeWrapped(planningNote, margin + 6, noteTop + 9, pageWidth - margin * 2 - 12, 8, deepForest)
    pdf.setDrawColor(85, 130, 115)
    pdf.line(margin, 263, pageWidth - margin, 263)
    drawFooter(true)
  }

  drawCover()
  startContentPage()
  sectionHeading('Your journey at a glance')
  if (data.dates) paragraph(`Travel dates: ${data.dates}`)
  if (data.guests) paragraph(`Travellers: ${data.guests}`)
  for (const item of data.overview ?? []) paragraph(item)
  if (data.vehicle) paragraph(`Vehicle: ${data.vehicle}`)
  if (data.estimate) paragraph(data.estimate)

  sectionHeading('Day-by-day itinerary')
  for (const [index, day] of data.days.entries()) {
    const title = `${day.label}  |  ${day.title}`
    const titleLines = pdf.splitTextToSize(printable(title), pageWidth - margin * 2 - 12) as string[]
    const detailLines = pdf.splitTextToSize(printable(day.detail), pageWidth - margin * 2 - 12) as string[]
    const cardHeight = 12 + titleLines.length * 4.7 + detailLines.length * 4.6
    if (y + cardHeight > contentBottom) startContentPage()
    const cardColor = index % 2 === 0 ? paper : pale
    pdf.setFillColor(cardColor[0], cardColor[1], cardColor[2])
    pdf.roundedRect(margin, y - 5, pageWidth - margin * 2, cardHeight, 2, 2, 'F')
    pdf.setFillColor(...copper)
    pdf.circle(margin + 5, y, 1.4, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9.5)
    setPdfTextColor(pdf, forest)
    pdf.text(titleLines, margin + 10, y + 1)
    y += titleLines.length * 4.7 + 4
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8.8)
    setPdfTextColor(pdf, ink)
    pdf.text(detailLines, margin + 10, y)
    y += detailLines.length * 4.6 + 8
  }

  if (data.stays?.length) {
    sectionHeading('Selected stays')
    bulletList(data.stays)
  }
  if (data.activities?.length) {
    sectionHeading('Activities requested')
    bulletList(data.activities)
  }
  if (data.unionCabs?.length) {
    sectionHeading('Union cabs requested')
    bulletList(data.unionCabs)
    paragraph(`Union-cab charges are separate unless expressly included in your package. ${unionCabRefundNote}`)
  }
  if (data.notes?.length) {
    sectionHeading('Helpful notes')
    bulletList(data.notes)
  }

  for (let firstPhoto = 0; firstPhoto < kashmirPhotosForPdf.length; firstPhoto += 6) {
    startContentPage()
    const photosOnPage = Math.min(6, kashmirPhotosForPdf.length - firstPhoto)
    const imageHeight = photosOnPage <= 4 ? 82 : 56
    const rowHeight = photosOnPage <= 4 ? 98 : 70
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(15)
    setPdfTextColor(pdf, forest)
    pdf.text('A glimpse of Kashmir', margin, y)
    pdf.setDrawColor(...copper)
    pdf.setLineWidth(0.8)
    pdf.line(margin, y + 3, margin + 18, y + 3)
    y += 11
    writeWrapped('Illustrative travel and stay imagery; scenes and accommodation may vary by season and availability.', margin, y, pageWidth - margin * 2, 8, muted)
    const imageWidth = (pageWidth - margin * 2 - 8) / 2
    for (let index = firstPhoto; index < firstPhoto + photosOnPage; index += 1) {
      const position = index - firstPhoto
      const x = margin + (position % 2) * (imageWidth + 8)
      const imageTop = y + 8 + Math.floor(position / 2) * rowHeight
      pdf.setFillColor(...paper)
      pdf.roundedRect(x, imageTop, imageWidth, imageHeight, 2, 2, 'F')
      const imageProperties = pdf.getImageProperties(photoImages[index])
      const scale = Math.min((imageWidth - 2) / imageProperties.width, (imageHeight - 2) / imageProperties.height)
      const renderedWidth = imageProperties.width * scale
      const renderedHeight = imageProperties.height * scale
      pdf.addImage(
        photoImages[index],
        'JPEG',
        x + (imageWidth - renderedWidth) / 2,
        imageTop + (imageHeight - renderedHeight) / 2,
        renderedWidth,
        renderedHeight,
        `kashmir-photo-${index}`,
        'FAST',
      )
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7.5)
      setPdfTextColor(pdf, ink)
      pdf.text(printable(kashmirPhotosForPdf[index].caption), x, imageTop + imageHeight + 5)
    }
  }

  startContentPage()
  sectionHeading('Inclusions')
  bulletList(data.inclusions)
  sectionHeading('Exclusions')
  bulletList(data.exclusions)
  paragraph(`Availability, final pricing, route access and included services are confirmed with AVELOF before booking. ${planningNote}`)

  pdf.addPage()
  drawWatermark()
  drawHeader()
  pdf.setFillColor(...pale)
  pdf.roundedRect(margin, 77, pageWidth - margin * 2, 115, 8, 8, 'F')
  setPdfTextColor(pdf, copper)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text('YOUR KASHMIR JOURNEY STARTS HERE', pageWidth / 2, 112, { align: 'center' })
  setPdfTextColor(pdf, forest)
  pdf.setFontSize(28)
  pdf.text('Thank you.', pageWidth / 2, 135, { align: 'center' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)
  setPdfTextColor(pdf, ink)
  pdf.text('We look forward to helping you experience Kashmir.', pageWidth / 2, 148, { align: 'center' })
  pdf.setFontSize(9)
  setPdfTextColor(pdf, muted)
  pdf.text('Your stay. Your journey. Your Kashmir experience.', pageWidth / 2, 164, { align: 'center' })

  for (let pageNumber = 2; pageNumber <= pdf.getNumberOfPages(); pageNumber += 1) {
    pdf.setPage(pageNumber)
    drawHeader()
    drawFooter()
  }
  return pdf
}

export async function downloadBrandedItineraryPdf(data: ItineraryPdfData) {
  const pdf = await buildBrandedItineraryPdf(data)
  pdf.save(`${safeFileName(data.title)}.pdf`)
}
