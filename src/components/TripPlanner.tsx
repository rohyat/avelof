import { Children, useEffect, useRef, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, MapPin, MoonStar } from 'lucide-react'
import { Link } from 'react-router-dom'
import { rentalCars } from '../data/catalog'
import { combinedExcursionId, destinationOptionId, destinationOptions } from '../data/destinationOptions'
import { clearSavedTripPlan, tripPlanStorageKey, tripReturnStorageKey } from '../services/tripPlanStorage'
import { hotelNightlyPrice, includedHotelMeals, selectedHotelRoom, useRegisteredHotels } from '../services/hotelService'
import type { Hotel, PreparedRequest } from '../types'
import HotelRates from './HotelRates'
import OfferPrice from './OfferPrice'
import DestinationPhotos from './DestinationPhotos'
import RotatingPhotos from './RotatingPhotos'
import TripPlannerSteps from './TripPlannerSteps'
import { hotelRoomRateBasis, minimumHotelRooms } from '../data/hotelRegistration'
import NumberStepper from './NumberStepper'
import { EnquiryForm } from './BookingModal'
import { enquiryPath } from '../services/bookingService'

interface DayPlan {
  routeTo?: string
  stayAt?: string
  hotelId?: string
  breakfast?: boolean
  dinner?: boolean
  roomType?: string
  roomCount?: string
}

interface SavedTripPlan {
  savedAt: number
  startDate: string
  endDate: string
  plans: DayPlan[]
  vehicleId?: string
  placeIds?: string[]
  step?: number
  adults?: string
  children?: string
}

interface TripPlannerProps {
  sectionId?: string
}

const plannerStops = destinationOptions
const defaultPlaceIds = ['srinagar', 'gulmarg', 'pahalgam']
const srinagarExcursions = new Set(['sonamarg', 'doodhpathri', 'yusmarg', combinedExcursionId, 'manasbal', 'dachigam', 'wular'])
const overnightStops = new Set(['gulmarg', 'pahalgam', 'sonamarg', 'gurez'])
const tripPlanLifetime = 24 * 60 * 60 * 1000

function placeDays(id: string) {
  return id === 'gurez' ? 3 : 1
}

function itineraryStops(ids: string[]) {
  return ['srinagar', ...plannerStops.filter((place) => ids.includes(place.id)).flatMap((place) => place.id === 'gurez' ? ['gurez', 'gurez', 'srinagar'] : [place.id])]
}

function localDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function todayDateValue() {
  return localDateValue(new Date())
}

function validDateValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00`)
  return Number.isFinite(date.getTime()) && localDateValue(date) === value
}

function readTripPlan(sectionId: string): SavedTripPlan {
  const emptyPlan = { savedAt: Date.now(), startDate: '', endDate: '', plans: [] }
  try {
    const storageKey = tripPlanStorageKey(sectionId)
    const returnSection = sessionStorage.getItem(tripReturnStorageKey)
    if (returnSection !== sectionId) {
      sessionStorage.removeItem(storageKey)
      return emptyPlan
    }
    sessionStorage.removeItem(tripReturnStorageKey)
    const saved = sessionStorage.getItem(storageKey)
    if (!saved) return emptyPlan
    if (saved.length > 32768) {
      sessionStorage.removeItem(storageKey)
      return emptyPlan
    }
    const parsed = JSON.parse(saved) as Partial<SavedTripPlan>
    if (!parsed || typeof parsed !== 'object' || typeof parsed.savedAt !== 'number' || !Number.isFinite(parsed.savedAt) || parsed.savedAt > Date.now() || Date.now() - parsed.savedAt > tripPlanLifetime || typeof parsed.startDate !== 'string' || typeof parsed.endDate !== 'string' || !Array.isArray(parsed.plans) || parsed.plans.length > 31) {
      sessionStorage.removeItem(storageKey)
      return emptyPlan
    }
    const today = todayDateValue()
    const dateDifference = parsed.startDate && parsed.endDate
      ? Math.round((new Date(`${parsed.endDate}T12:00:00`).getTime() - new Date(`${parsed.startDate}T12:00:00`).getTime()) / 86400000)
      : 0
    if ((parsed.startDate || parsed.endDate) && (!validDateValue(parsed.startDate) || !validDateValue(parsed.endDate) || parsed.startDate < today || parsed.endDate <= parsed.startDate || dateDifference > 30)) {
      sessionStorage.removeItem(storageKey)
      return emptyPlan
    }
    const plans = parsed.plans.map((plan): DayPlan => {
      if (!plan || typeof plan !== 'object') return {}
      const saved = plan as DayPlan
      return {
        routeTo: plannerStops.some((place) => place.id === saved.routeTo) ? saved.routeTo : undefined,
        stayAt: plannerStops.some((place) => place.id === saved.stayAt) ? saved.stayAt : undefined,
        hotelId: typeof saved.hotelId === 'string' && /^[a-f0-9-]{36}$/.test(saved.hotelId) ? saved.hotelId : undefined,
        breakfast: saved.breakfast === true,
        dinner: saved.dinner === true,
        roomType: typeof saved.roomType === 'string' && saved.roomType.length <= 100 ? saved.roomType : undefined,
        roomCount: typeof saved.roomCount === 'string' && /^[1-9]\d?$|^100$/.test(saved.roomCount) ? saved.roomCount : undefined,
      }
    })
    const placeIds = Array.isArray(parsed.placeIds) ? [...new Set(parsed.placeIds.filter((id): id is string => typeof id === 'string').map(destinationOptionId).filter((id) => plannerStops.some((place) => place.id === id)))] : []
    return { savedAt: parsed.savedAt, startDate: parsed.startDate, endDate: parsed.endDate, plans, placeIds, adults: typeof parsed.adults === 'string' && /^(?:[1-9]\d?|100)$/.test(parsed.adults) ? parsed.adults : '2', children: typeof parsed.children === 'string' && /^(?:0|[1-9]\d?|100)$/.test(parsed.children) ? parsed.children : '0', step: parsed.step === 1 || parsed.step === 2 ? parsed.step : 0, vehicleId: rentalCars.some((car) => car.id === parsed.vehicleId) || typeof parsed.vehicleId === 'string' && /^[a-f0-9-]{36}$/.test(parsed.vehicleId) ? parsed.vehicleId : undefined }
  } catch {
    clearSavedTripPlan(sectionId)
    return emptyPlan
  }
}

function saveTripPlan(sectionId: string, plan: Omit<SavedTripPlan, 'savedAt'>) {
  sessionStorage.setItem(tripPlanStorageKey(sectionId), JSON.stringify({ ...plan, savedAt: Date.now() }))
}

function addDays(date: string, days: number) {
  const next = new Date(`${date}T12:00:00`)
  next.setDate(next.getDate() + days)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`))
}

function stopName(id: string) {
  return plannerStops.find((place) => place.id === id)?.name ?? id
}

function dayRouteLabel(day: { origin: string; routeTo: string; routeStops: string[] }, index: number, totalDays: number) {
  if (index === 0) return 'Arrival in Srinagar'
  if (index === totalDays - 1) return day.origin === 'srinagar' ? 'Departure from Srinagar' : `${stopName(day.origin)} to Srinagar for departure`
  return day.origin === day.routeTo ? `Explore ${stopName(day.origin)} locally` : day.routeStops.map(stopName).join(' to ')
}

function stayOptions(destinationId: string, nextDestinationId?: string) {
  if (nextDestinationId && srinagarExcursions.has(nextDestinationId)) return ['srinagar']
  return overnightStops.has(destinationId) ? ['srinagar', destinationId] : ['srinagar']
}

function hotelsAt(locationId: string, availableHotels: Hotel[]) {
  const locationName = stopName(locationId).toLowerCase()
  return availableHotels.filter((hotel) => hotel.location.toLowerCase().includes(locationName))
}

function SwipeRail({ label, className, children }: { label: string; className: string; children: ReactNode }) {
  const railRef = useRef<HTMLDivElement>(null)
  const count = Children.count(children)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    let frame = 0
    const syncActiveSlide = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const railBounds = rail.getBoundingClientRect()
        const railCenter = railBounds.left + rail.clientWidth / 2
        const slides = Array.from(rail.children) as HTMLElement[]
        const closestIndex = slides.reduce((closest, slide, index) => {
          const bounds = slide.getBoundingClientRect()
          const distance = Math.abs(bounds.left + bounds.width / 2 - railCenter)
          const closestBounds = slides[closest].getBoundingClientRect()
          const closestDistance = Math.abs(closestBounds.left + closestBounds.width / 2 - railCenter)
          return distance < closestDistance ? index : closest
        }, 0)
        setActiveIndex(closestIndex)
      })
    }
    rail.addEventListener('scroll', syncActiveSlide, { passive: true })
    const resizeObserver = new ResizeObserver(syncActiveSlide)
    resizeObserver.observe(rail)
    syncActiveSlide()
    return () => {
      if (frame) cancelAnimationFrame(frame)
      rail.removeEventListener('scroll', syncActiveSlide)
      resizeObserver.disconnect()
    }
  }, [count])

  function scrollToSlide(index: number) {
    const rail = railRef.current
    const slide = rail?.children[index]
    if (!rail || !(slide instanceof HTMLElement)) return
    const railBounds = rail.getBoundingClientRect()
    const slideBounds = slide.getBoundingClientRect()
    const paddingLeft = Number.parseFloat(getComputedStyle(rail).paddingLeft) || 0
    rail.scrollTo({ left: rail.scrollLeft + slideBounds.left - railBounds.left - paddingLeft, behavior: 'smooth' })
    setActiveIndex(index)
  }

  function handleTileClick(event: MouseEvent<HTMLDivElement>) {
    const rail = railRef.current
    if (!rail) return
    const target = event.target
    if (!(target instanceof Element)) return
    const slide = target.closest('.planner-swipe-slide')
    if (slide?.parentElement === rail) setActiveIndex(Array.from(rail.children).indexOf(slide))
  }

  return <>
    <div ref={railRef} className={`${className} planner-swipe-rail`} role="group" aria-label={label} onClickCapture={handleTileClick}>
      {Children.map(children, (child) => <div className="planner-swipe-slide">{child}</div>)}
    </div>
    <div className="planner-swipe-dots" role="group" aria-label={`${label} pages`}>
      {Array.from({ length: count }, (_, index) => <button
        className={`planner-swipe-dot${activeIndex === index ? ' is-active' : ''}`}
        type="button"
        key={`${label}-${index}`}
        aria-label={`Show ${label.toLowerCase()} ${index + 1} of ${count}`}
        aria-current={activeIndex === index ? 'true' : undefined}
        onClick={() => scrollToSlide(index)}
      />)}
    </div>
  </>
}

export default function TripPlanner({ sectionId = 'custom-trip' }: TripPlannerProps) {
  const registered = useRegisteredHotels(true)
  const availableHotels = registered.hotels
  const plannerVehicles = rentalCars.filter((car) => car.category !== 'Tempo Traveller' || car.id === 'tempo-traveller')
  const [savedPlan] = useState(() => readTripPlan(sectionId))
  const [startDate, setStartDate] = useState(savedPlan.startDate)
  const [endDate, setEndDate] = useState(savedPlan.endDate)
  const [plans, setPlans] = useState<DayPlan[]>(savedPlan.plans)
  const [adults, setAdults] = useState(savedPlan.adults ?? '2')
  const [children, setChildren] = useState(savedPlan.children ?? '0')
  const people = Number(adults) + Number(children)
  const validGuests = /^(?:[1-9]\d?|100)$/.test(adults) && /^(?:0|[1-9]\d?|100)$/.test(children) && people <= 100
  const recommendedVehicle = [...rentalCars].filter((car) => car.seats >= people).sort((a, b) => a.seats - b.seats || a.price - b.price)[0]
  const [vehicleId, setVehicleId] = useState(rentalCars.some((car) => car.id === savedPlan.vehicleId) ? savedPlan.vehicleId! : rentalCars[0].id)
  const [placeIds, setPlaceIds] = useState<string[]>(savedPlan.placeIds ?? defaultPlaceIds)
  const [placeNotice, setPlaceNotice] = useState('')
  const [step, setStep] = useState(savedPlan.step ?? 0)
  const [receipt, setReceipt] = useState<PreparedRequest | null>(null)
  const [enquiryFields, setEnquiryFields] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const plannerRef = useRef<HTMLDivElement>(null)
  const placeNoticeRef = useRef<HTMLParagraphElement>(null)
  const selectedVehicle = rentalCars.find((car) => car.id === vehicleId) ?? rentalCars[0]
  const [minDate] = useState(() => {
    return todayDateValue()
  })
  const dateDifference = startDate && endDate
    ? Math.round((new Date(`${endDate}T12:00:00`).getTime() - new Date(`${startDate}T12:00:00`).getTime()) / 86400000)
    : -1
  const tripDays = dateDifference > 0 && dateDifference <= 30 ? dateDifference + 1 : 0
  const nights = Math.max(0, tripDays - 1)
  const vehicleTotal = selectedVehicle.price * tripDays
  const scheduledStops = itineraryStops(placeIds)
  const usedPlaceDays = scheduledStops.length
  const capacityError = tripDays > 0 && usedPlaceDays > nights
    ? `Not enough days for your selected places. Please increase your trip to at least ${usedPlaceDays + 1} days (${usedPlaceDays} nights), or remove a place. This includes a Srinagar arrival day and a departure day. Gurez needs 3 days with 2 nights in Gurez.`
    : ''
  const selectionError = capacityError || placeNotice
  const dayPlans = Array.from({ length: capacityError ? 0 : tripDays }).reduce<Array<DayPlan & { origin: string; routeTo: string; stayAt: string; routeStops: string[] }>>((days, _, index) => {
    const origin = index === 0 ? 'srinagar' : days[index - 1].stayAt
    const saved = plans[index] ?? {}
    const routeTo = index === tripDays - 1 ? 'srinagar' : scheduledStops[index] ?? 'srinagar'
    const options = stayOptions(routeTo, index + 1 < tripDays - 1 ? scheduledStops[index + 1] : undefined)
    const stayAt = routeTo === 'gurez' ? 'gurez' : options.includes(saved.stayAt ?? '') ? saved.stayAt! : 'srinagar'
    const validHotel = hotelsAt(stayAt, availableHotels).some((hotel) => hotel.id === saved.hotelId)
    days.push({ origin, routeTo, stayAt, routeStops: [origin, routeTo], hotelId: validHotel ? saved.hotelId : undefined, breakfast: validHotel && saved.breakfast, dinner: validHotel && saved.dinner, roomType: validHotel ? saved.roomType : undefined, roomCount: validHotel ? saved.roomCount : undefined })
    return days
  }, [])
  const selectedStays = dayPlans.slice(0, -1).flatMap((day) => {
    const hotel = availableHotels.find((hotel) => hotel.id === day.hotelId)
    return hotel ? [hotelNightlyPrice(hotel, Boolean(day.breakfast), Boolean(day.dinner), day.roomType) * Number(day.roomCount ?? minimumHotelRooms(people, selectedHotelRoom(hotel, day.roomType)?.roomType))] : []
  })
  const invalidRooms = dayPlans.slice(0, -1).some((day) => {
    const hotel = availableHotels.find((hotel) => hotel.id === day.hotelId)
    if (!hotel || day.roomCount === undefined) return false
    return !/^(?:[1-9]\d?|100)$/.test(day.roomCount) || Number(day.roomCount) < minimumHotelRooms(people, selectedHotelRoom(hotel, day.roomType)?.roomType)
  })
  const hotelTotal = selectedStays.reduce((total, rate) => total + rate, 0)
  const pendingNights = nights - selectedStays.length
  const stayOccupancyNote = `Room quantities cover ${people} people, including children: Family rooms cover 4 people; other room types cover 2 people.`
  const estimateSummary = `Vehicle + selected stays estimate: INR ${(vehicleTotal + hotelTotal).toLocaleString('en-IN')}. Vehicle: INR ${vehicleTotal.toLocaleString('en-IN')}; selected stays: INR ${hotelTotal.toLocaleString('en-IN')} for ${selectedStays.length} of ${nights} nights. ${stayOccupancyNote}${pendingNights > 0 ? ` ${pendingNights} unselected hotel nights are not included.` : ''} Excludes optional extras and charges not included in the listed rates. Not a final quote.`

  useEffect(() => {
    try {
      saveTripPlan(sectionId, { startDate, endDate, plans, vehicleId, placeIds, step, adults, children })
    } catch {
      return
    }
  }, [endDate, plans, sectionId, startDate, vehicleId, placeIds, step, adults, children])

  useEffect(() => () => {
    try {
      if (sessionStorage.getItem(tripReturnStorageKey) !== sectionId) clearSavedTripPlan(sectionId)
    } catch {
      return
    }
  }, [sectionId])

  function showPlaceError() {
    requestAnimationFrame(() => {
      placeNoticeRef.current?.focus({ preventScroll: true })
      placeNoticeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  function preservePlanForHotelReturn(event: MouseEvent<HTMLAnchorElement>) {
    if (selectionError) {
      event.preventDefault()
      showPlaceError()
      return
    }
    try {
      saveTripPlan(sectionId, { startDate, endDate, plans, vehicleId, placeIds, step, adults, children })
      sessionStorage.setItem(tripReturnStorageKey, sectionId)
    } catch {
      return
    }
  }

  function updatePlan(index: number, next: DayPlan) {
    setPlans((current) => {
      const updated = [...current]
      updated[index] = next
      return updated
    })
  }

  function changeGuests(nextAdults: string, nextChildren: string) {
    setAdults(nextAdults)
    setChildren(nextChildren)
    setPlaceNotice('')
    setPlans((current) => current.map((plan) => ({ ...plan, roomCount: undefined })))
    const total = Number(nextAdults) + Number(nextChildren)
    const suggested = [...rentalCars].filter((car) => car.seats >= total).sort((a, b) => a.seats - b.seats || a.price - b.price)[0]
    if (suggested) setVehicleId(suggested.id)
  }

  function toggleDestination(id: string) {
    if (placeIds.includes(id)) {
      setPlaceIds(placeIds.filter((placeId) => placeId !== id))
      setPlaceNotice('')
      setPlans([])
      return
    }
    const nextPlaces = [...placeIds, id]
    const requiredNights = itineraryStops(nextPlaces).length
    if (requiredNights > nights) {
      setPlaceNotice(`${stopName(id)} was not added. Please increase your trip to at least ${requiredNights + 1} days (${requiredNights} nights), or remove another place first.`)
      showPlaceError()
      return
    }
    setPlaceIds(nextPlaces)
    setPlaceNotice('')
    setPlans([])
  }

  function changeStartDate(value: string) {
    if (value && value < minDate) return
    if (!value) {
      setStartDate('')
      setEndDate('')
      setPlans([])
      setPlaceNotice('')
      return
    }
    setStartDate(value)
    setPlans([])
    const nextEnd = !endDate || endDate <= value || endDate > addDays(value, 30) ? addDays(value, 4) : endDate
    setEndDate(nextEnd)
    setPlaceNotice('')
  }

  function changeEndDate(value: string) {
    if (!value) {
      setEndDate('')
      setPlans([])
      setPlaceNotice('')
      return
    }
    if (!startDate || value <= startDate || value > addDays(startDate, 30)) return
    setEndDate(value)
    setPlans([])
    setPlaceNotice('')
  }

  function changeStep(next: number) {
    if (next > step && (!tripDays || capacityError || placeIds.length === 0)) {
      setPlaceNotice(capacityError || 'Choose valid dates and at least one place to visit before continuing.')
      showPlaceError()
      return
    }
    if (next > step && (!validGuests || next > 1 && selectedVehicle.seats < people)) {
      setPlaceNotice(!validGuests ? 'Enter at least one adult and valid child counts, up to 100 people in total.' : 'Choose a vehicle with enough seats for everyone, including children. Contact AVELOF if you need multiple vehicles.')
      return
    }
    setPlaceNotice('')
    setStep(next)
    requestAnimationFrame(() => {
      plannerRef.current?.focus({ preventScroll: true })
      plannerRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
  }

  function continueToEnquiry() {
    if (!tripDays) return
    if (!rentalCars.some((car) => car.id === vehicleId)) { setPlaceNotice('Your selected vehicle is unavailable. Please choose another vehicle.'); return }
    if (capacityError || placeIds.length === 0) {
      setPlaceNotice(capacityError || 'Please select at least one place to visit before continuing.')
      setStep(0)
      showPlaceError()
      return
    }
    if (!validGuests || selectedVehicle.seats < people || invalidRooms) {
      setPlaceNotice('Check your guest counts, vehicle seats and room quantities. Enough seats and rooms are required for everyone, including children.')
      return
    }
    const itinerary = dayPlans.map((day, index) => {
      const date = formatDate(addDays(startDate, index))
      const route = dayRouteLabel(day, index, dayPlans.length)
      const overnight = index < dayPlans.length - 1 ? `; stay overnight in ${stopName(day.stayAt)}` : '; departure day'
      const selectedHotel = day.hotelId ? availableHotels.find((hotel) => hotel.id === day.hotelId) : undefined
      const room = selectedHotel ? selectedHotelRoom(selectedHotel, day.roomType) : undefined
      const rate = selectedHotel ? hotelNightlyPrice(selectedHotel, Boolean(day.breakfast), Boolean(day.dinner), room?.roomType) : 0
      const roomCount = Number(day.roomCount ?? minimumHotelRooms(people, room?.roomType))
      const included = selectedHotel?.registeredHotelId && selectedHotel.breakfastPrice === undefined ? includedHotelMeals(selectedHotel) : { breakfast: day.breakfast, dinner: day.dinner }
      const mealNote = selectedHotel ? `; breakfast: ${included.breakfast ? 'included' : 'not included'}; dinner: ${included.dinner ? 'included' : 'not included'}; ${selectedHotel.taxDetails ?? ''}${selectedHotel.registeredHotelId ? `; hotel ID: ${selectedHotel.registeredHotelId}` : ''}; hotel rate: INR ${rate.toLocaleString('en-IN')} ${hotelRoomRateBasis(room?.roomType)}` : ''
      const hotelNote = index < dayPlans.length - 1 ? `; hotel: ${selectedHotel?.name ?? 'please recommend a stay'}${room ? `; room type: ${room.roomType}` : ''}${selectedHotel ? `; rooms: ${roomCount}; all rooms per night: INR ${(rate * roomCount).toLocaleString('en-IN')}` : ''}${mealNote}` : ''
      return `Day ${index + 1} (${date}): ${route}${overnight}${hotelNote}.`
    }).join('\n')

    setEnquiryFields({
      adults, children,
      arrivalDate: startDate,
      departureDate: endDate,
      tripDays: String(tripDays),
      tripNights: String(nights),
      carRental: selectedVehicle.name,
      vehicleDailyRate: `₹${selectedVehicle.price.toLocaleString('en-IN')}`,
      vehicleRentalEstimate: `₹${vehicleTotal.toLocaleString('en-IN')} for ${tripDays} days; excludes hotel costs and optional extras`,
      placesToVisit: itinerary,
      selectedDestinations: placeIds.map(stopName).join(', '),
      planningNote: `${estimateSummary} Destination day allocations are provisional. Please confirm route order, travel times, access and destination-specific charges.`,
    })
    changeStep(3)
  }

  return <section className="custom-trip-section" id={sectionId}>
    <div className="page-width custom-trip-inner">
      <div className="custom-trip-intro">
        <p className="eyebrow">Customise your trip</p>
        <h2>Plan your trip,<br /><em>your way.</em></h2>
        <p>Choose your dates and places. We’ll shape a thoughtful itinerary around your interests, pace and stay preferences.</p>
      </div>

      <div ref={plannerRef} tabIndex={-1} className="trip-planner" aria-label="Customise your Kashmir journey">
        {registered.loading && <p role="status">Loading registered hotel options...</p>}
        {registered.error && <p className="enquiry-error" role="alert">{registered.error} <button type="button" className="text-link" onClick={registered.reload}>Retry loading hotels</button></p>}
        <div className="planner-heading">
          <div><span className="planner-kicker">CUSTOMIZE YOUR TRIP</span><h3>Build your trip.</h3></div>
          <span className="planner-local"><MapPin size={15} /> Planned with local care</span>
        </div>
        <TripPlannerSteps step={step} />
        {!receipt && step > 0 && <button className="button button-outline planner-back" type="button" disabled={submitting} onClick={() => changeStep(step - 1)}><ArrowLeft size={16} /> {step === 3 ? 'Back to hotels' : 'Back'}</button>}
        {step > 0 && selectionError && <p className="planner-place-notice" role="alert">{selectionError}</p>}
        {step === 0 && <div className="trip-dates">
          <label><span><CalendarDays size={15} /> Start date</span><input type="date" min={minDate} value={startDate} onChange={(event) => changeStartDate(event.target.value)} /></label>
          <label className={!startDate ? 'trip-date-disabled' : undefined}><span><CalendarDays size={15} /> End date</span><input type="date" min={startDate ? addDays(startDate, 1) : addDays(minDate, 1)} max={startDate ? addDays(startDate, 30) : undefined} value={endDate} disabled={!startDate} onChange={(event) => changeEndDate(event.target.value)} /></label>
          <div className="trip-length" aria-live="polite"><strong>{tripDays || '—'}</strong><span>{tripDays ? `${tripDays === 1 ? 'day' : 'days'} · ${nights} ${nights === 1 ? 'night' : 'nights'}` : 'Trip length'}</span></div>
        </div>}
        {step === 0 && <div className="form-grid planner-guests"><NumberStepper label="Adults" name="plannerAdults" min={1} max={100} value={adults} onChange={(value) => changeGuests(value, children)} /><NumberStepper label="Children (5 years+)" name="plannerChildren" min={0} max={99} value={children} onChange={(value) => changeGuests(adults, value)} /><p className="privacy-note">Children below 5 years are complimentary. {validGuests ? `${people} people in total.` : 'Enter valid counts for up to 100 people.'}</p></div>}

        {tripDays > 0 && <div className="planner-selection-sections">
        {step === 0 && <fieldset className="planner-destination-picker">
          <legend>Choose your places to visit</legend>
          <p className="planner-place-summary" role="status">{placeIds.length} places selected · {usedPlaceDays - 1} sightseeing days planned · 1 arrival day and 1 departure day reserved. {Math.max(0, nights - usedPlaceDays)} spare days. Gurez requires 3 days and 2 nights.</p>
          <p ref={placeNoticeRef} className="planner-place-notice" role="alert" tabIndex={-1} hidden={!selectionError}>{selectionError}</p>
          <div className="planner-destination-grid">{plannerStops.map((place) => <article className={`planner-place-card${placeIds.includes(place.id) ? ' is-selected' : ''}`} key={place.id}>
            <DestinationPhotos places={place.includedPlaces} />
            <label><input type="checkbox" checked={placeIds.includes(place.id)} onChange={() => toggleDestination(place.id)} />
              <strong>{place.name}</strong>
              <span>{placeDays(place.id)} {placeDays(place.id) === 1 ? 'day' : 'days · 2 nights'}{place.id === combinedExcursionId ? ' · From Srinagar' : ''}</span>
              <span>Price on enquiry</span>
            </label>
            <Link to={`/destinations?place=${encodeURIComponent(place.name)}`} state={{ tripReturn: { sectionId, returnPath: sectionId === 'package-planner' ? '/tour-packages' : '/' } }} onClick={preservePlanForHotelReturn}>View this place <ArrowRight size={13} /></Link>
          </article>)}</div>
        </fieldset>}
        {step === 1 && <div className="planner-vehicle-section">
          <p className="privacy-note" role="status">{recommendedVehicle ? `Suggested for ${people} people: ${recommendedVehicle.name} (${recommendedVehicle.seats} seats). You can choose a larger vehicle.` : 'No single listed vehicle fits your group. Contact AVELOF to arrange multiple vehicles.'}</p>
          <fieldset className="planner-vehicle-picker"><legend>Choose your vehicle</legend>
            <div className="planner-vehicle-grid">{plannerVehicles.map((vehicle) => {
              const isTraveller = vehicle.category === 'Tempo Traveller'
              const selected = isTraveller ? selectedVehicle.category === 'Tempo Traveller' : selectedVehicle.id === vehicle.id
              const displayed = selected ? selectedVehicle : vehicle
              const suitableTraveller = rentalCars.find((car) => car.category === 'Tempo Traveller' && car.seats >= people)
              const fits = isTraveller ? Boolean(suitableTraveller) : vehicle.seats >= people
              return <div key={vehicle.id} className={`planner-vehicle-choice${selected ? ' is-selected' : ''}`}>
                <label><input type="radio" name={`${sectionId}-vehicle`} checked={selected} disabled={!fits} onChange={() => setVehicleId(isTraveller && suitableTraveller ? suitableTraveller.id : vehicle.id)} />
                  <img src={vehicle.image} alt={vehicle.name} loading="lazy" />
                  <strong>{isTraveller ? 'Tempo Traveller' : vehicle.name}</strong>
                  <OfferPrice price={displayed.price} />
                  <span>₹{displayed.price.toLocaleString('en-IN')} per day</span>
                  <span>{displayed.seats} seats{!fits ? ' · Not enough seats for your group' : ''}</span>
                </label>
                {isTraveller && <label className="planner-vehicle-size">Seats<select aria-label="Traveller seating capacity" value={selectedVehicle.category === 'Tempo Traveller' ? selectedVehicle.id : vehicle.id} onChange={(event) => setVehicleId(event.target.value)}>{rentalCars.filter((car) => car.category === 'Tempo Traveller').map((car) => <option key={car.id} value={car.id} disabled={car.seats < people}>{car.seats}-seater</option>)}</select></label>}
              </div>
            })}</div>
          </fieldset>
          <div className="planner-vehicle-total" role="status"><OfferPrice price={vehicleTotal} /><strong>Vehicle rental estimate: ₹{vehicleTotal.toLocaleString('en-IN')}</strong><span>₹{selectedVehicle.price.toLocaleString('en-IN')} × {tripDays} days · vehicle only, not the full package price</span></div>
        </div>}
        </div>}
        {step === 2 && (tripDays > 0 && !capacityError ? <div className="day-plans">
          {dayPlans.map((day, index) => {
            const routeLabel = dayRouteLabel(day, index, dayPlans.length)
            const date = formatDate(addDays(startDate, index))
            const nextDestination = index + 1 < tripDays - 1 ? dayPlans[index + 1].routeTo : undefined
            const options = stayOptions(day.routeTo, nextDestination)
            return <article className="day-plan" key={`${startDate}-${index}`}>
              <div className="day-marker"><span>{String(index + 1).padStart(2, '0')}</span><i /></div>
              <div className="day-plan-fields">
                <div className="day-plan-title"><div><span>DAY {index + 1}</span><h4>{date}</h4></div>{(index === 0 || index === tripDays - 1) && <span className="departure-label">{index === 0 ? 'Arrival day' : 'Departure day'}</span>}</div>
                <p className="planner-assigned-route"><MapPin size={15} /> {routeLabel}</p>
                {day.routeTo === 'gurez' && <p className="planner-assigned-route">Gurez visit: 3 days and 2 nights reserved.</p>}
                {index < tripDays - 1 && <>
                  {options.length > 1 && day.routeTo !== 'gurez' ? <fieldset className="planner-stay-picker overnight-field">
                    <legend><MoonStar size={15} /> Day {index + 1} · Where would you like to stay?</legend>
                    <div className="planner-stay-tiles">
                      {options.map((id) => <button
                        className={`planner-stay-tile${day.stayAt === id ? ' is-selected' : ''}`}
                        type="button"
                        key={id}
                        aria-pressed={day.stayAt === id}
                        onClick={() => updatePlan(index, { routeTo: day.routeTo, stayAt: id, hotelId: undefined })}
                      >Stay in {stopName(id)}</button>)}
                    </div>
                  </fieldset> : <p className="planner-assigned-route"><MoonStar size={15} /> Stay in {stopName(day.stayAt)}</p>}
                  {nextDestination && srinagarExcursions.has(nextDestination) && <p className="day-route-note">Stay in Srinagar tonight: tomorrow's {stopName(nextDestination)} day trip must start from Srinagar, not Gulmarg or Pahalgam.</p>}
                  <div className="planner-field overnight-field">
                    <span>Day {index + 1} · Choose a hotel in {stopName(day.stayAt)} <small className="planner-swipe-hint">Swipe for hotels</small></span>
                    <SwipeRail label={`Day ${index + 1} hotels in ${stopName(day.stayAt)}`} className="planner-hotel-rail">
                      {hotelsAt(day.stayAt, availableHotels).map((hotel) => <article className={`planner-hotel-card${day.hotelId === hotel.id ? ' is-selected' : ''}`} key={hotel.id}>
                        <button
                          className="planner-hotel-tile"
                          type="button"
                          aria-pressed={day.hotelId === hotel.id}
                          onClick={() => { if (day.hotelId !== hotel.id) updatePlan(index, { routeTo: day.routeTo, stayAt: day.stayAt, hotelId: hotel.id }) }}
                        >
                          <span className="planner-hotel-category">{hotel.category}</span>
                          <strong>{hotel.name}</strong>
                          <RotatingPhotos className="planner-hotel-photo" label={`${hotel.name} hotel photos`} photos={[...new Set([hotel.image, ...hotel.gallery])].map((image) => ({ image, alt: `${hotel.name}, hotel photo` }))} />
                        </button>
                        <HotelRates hotel={hotel} compact={day.hotelId !== hotel.id} showRooms={day.hotelId === hotel.id} people={people} rooms={day.roomCount} onRoomsChange={day.hotelId === hotel.id ? (roomCount) => updatePlan(index, { ...day, roomCount }) : undefined} roomType={day.hotelId === hotel.id ? day.roomType : undefined} meals={{ breakfast: day.hotelId === hotel.id && Boolean(day.breakfast), dinner: day.hotelId === hotel.id && Boolean(day.dinner) }} onChange={(breakfast, dinner, _price, roomType) => setPlans((current) => {
                          const next = [...current]
                          next[index] = { routeTo: day.routeTo, stayAt: day.stayAt, hotelId: hotel.id, breakfast, dinner, roomType, roomCount: selectedHotelRoom(hotel, day.roomType)?.roomType === roomType ? day.roomCount : undefined }
                          return next
                        })} />
                        <Link
                          className="planner-hotel-view-link"
                          to={`/hotels/${hotel.id}`}
                          state={{ tripReturn: { sectionId, returnPath: sectionId === 'package-planner' ? '/tour-packages' : '/' } }}
                          onClick={preservePlanForHotelReturn}
                        >View hotel <ArrowRight size={13} /></Link>
                      </article>)}
                      <article className={`planner-hotel-card${!day.hotelId ? ' is-selected' : ''}`}>
                        <button
                          className="planner-hotel-tile"
                          type="button"
                          aria-pressed={!day.hotelId}
                          onClick={() => updatePlan(index, { routeTo: day.routeTo, stayAt: day.stayAt, hotelId: undefined })}
                        >
                          <span className="planner-hotel-category">AVELOF PICK</span>
                          <strong>Want another option?</strong>
                          <small>Not sure? We’ll help you find your kind of stay.</small>
                        </button>
                      </article>
                    </SwipeRail>
                  </div>
                </>}
                <p className="day-route-note" aria-live="polite">{routeLabel}{index < tripDays - 1 ? ` · Overnight in ${stopName(day.stayAt)}` : ''}</p>
              </div>
            </article>
          })}
        </div> : <p className="planner-empty">{capacityError ? 'Your itinerary will appear once your selected places fit within your dates.' : 'Choose your start and end dates to build your day-by-day plan.'}</p>)}

        {step === 2 && invalidRooms && <p className="enquiry-error" role="alert">Enter a whole number of rooms with enough capacity for everyone, including children.</p>}
        {step === 2 && !invalidRooms && dayPlans.length > 0 && <div className="planner-trip-estimate" role="status"><strong>Vehicle + selected stays: INR {(vehicleTotal + hotelTotal).toLocaleString('en-IN')}</strong><span>Vehicle: INR {vehicleTotal.toLocaleString('en-IN')} · Selected stays: INR {hotelTotal.toLocaleString('en-IN')} ({selectedStays.length}/{nights} nights)</span><span>{stayOccupancyNote} Selected meals are included. {pendingNights > 0 ? `${pendingNights} unselected hotel nights are not included. ` : ''}Optional extras and charges outside the listed rates are excluded. Estimate only; AVELOF will confirm a final quote.</span></div>}
        {step === 3 && (receipt ? <section className="review-ready" role="status"><h3>Thank you for submitting your details.</h3><p>Your enquiry has been saved. This is not a confirmed booking.</p><p>Booking enquiry ID: <strong>{receipt.reference}</strong></p><a className="text-link" href={enquiryPath(receipt)}>View your bookings <ArrowRight size={16} /></a></section> : <><h3>Your details</h3><p>Your selected dates, guests, vehicle and hotel rooms will be included automatically.</p><EnquiryForm kind="package" selectedItem="Custom package" additionalFields={enquiryFields} onSubmittingChange={setSubmitting} onPrepared={(saved) => { setReceipt(saved); requestAnimationFrame(() => { plannerRef.current?.focus(); plannerRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }) }} /></>)}
        {step < 3 && <div className="planner-footer"><p>Your route is a starting point. Our local team will help check travel times, access and availability.</p>{step < 2 ? <button className="button button-dark" type="button" disabled={!tripDays} onClick={() => changeStep(step + 1)}>Next: {step === 0 ? 'vehicle' : 'hotels'} <ArrowRight size={16} /></button> : <button className="button button-dark" type="button" disabled={!tripDays || invalidRooms} onClick={continueToEnquiry}>Continue with this plan <ArrowRight size={16} /></button>}</div>}
      </div>
    </div>
  </section>
}