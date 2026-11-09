import { Children, useEffect, useRef, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { ArrowRight, CalendarDays, MapPin, MoonStar } from 'lucide-react'
import { Link } from 'react-router-dom'
import { destinations, hotels, rentalCars } from '../data/catalog'
import { clearSavedTripPlan, tripPlanStorageKey, tripReturnStorageKey } from '../services/tripPlanStorage'
import HotelRates from './HotelRates'

interface DayPlan {
  routeTo?: string
  stayAt?: string
  hotelId?: string
  breakfast?: boolean
  dinner?: boolean
}

interface SavedTripPlan {
  savedAt: number
  startDate: string
  endDate: string
  plans: DayPlan[]
  vehicleId?: string
  placeIds?: string[]
}

interface TripPlannerProps {
  onContinue: (fields: Record<string, string>) => void
  sectionId?: string
}

const plannerStops = destinations
const overnightStops = new Set(['gulmarg', 'pahalgam', 'sonamarg', 'gurez'])
const tripPlanLifetime = 24 * 60 * 60 * 1000
const plannerVehicles = rentalCars.filter((car) => car.category !== 'Tempo Traveller' || car.id === 'tempo-traveller')

function placeDays(id: string) {
  return id === 'gurez' ? 3 : 1
}

function fitPlaces(ids: string[], budget: number) {
  let used = 0
  return ids.filter((id) => {
    used += placeDays(id)
    return used <= budget
  })
}

function localDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function todayDateValue() {
  return localDateValue(new Date())
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
    const parsed = JSON.parse(saved) as Partial<SavedTripPlan>
    if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > tripPlanLifetime || typeof parsed.startDate !== 'string' || typeof parsed.endDate !== 'string' || !Array.isArray(parsed.plans)) {
      sessionStorage.removeItem(storageKey)
      return emptyPlan
    }
    const today = todayDateValue()
    const dateDifference = parsed.startDate && parsed.endDate
      ? Math.round((new Date(`${parsed.endDate}T12:00:00`).getTime() - new Date(`${parsed.startDate}T12:00:00`).getTime()) / 86400000)
      : 0
    if (parsed.startDate && (parsed.startDate < today || parsed.endDate <= parsed.startDate || dateDifference > 30)) {
      sessionStorage.removeItem(storageKey)
      return emptyPlan
    }
    const plans = parsed.plans.map((plan): DayPlan => {
      if (!plan || typeof plan !== 'object') return {}
      const saved = plan as DayPlan
      return {
        routeTo: plannerStops.some((place) => place.id === saved.routeTo) ? saved.routeTo : undefined,
        stayAt: plannerStops.some((place) => place.id === saved.stayAt) ? saved.stayAt : undefined,
        hotelId: hotels.some((hotel) => hotel.id === saved.hotelId) ? saved.hotelId : undefined,
        breakfast: saved.breakfast === true,
        dinner: saved.dinner === true,
      }
    })
    const placeIds = Array.isArray(parsed.placeIds) ? [...new Set(parsed.placeIds.filter((id) => destinations.some((place) => place.id === id)))] : []
    return { savedAt: parsed.savedAt, startDate: parsed.startDate, endDate: parsed.endDate, plans, placeIds: fitPlaces(placeIds, dateDifference), vehicleId: rentalCars.some((car) => car.id === parsed.vehicleId) ? parsed.vehicleId : undefined }
  } catch {
    return emptyPlan
  }
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

function stayOptions(destinationId: string) {
  return overnightStops.has(destinationId) ? ['srinagar', destinationId] : ['srinagar']
}

function hotelsAt(locationId: string) {
  const locationName = stopName(locationId).toLowerCase()
  return hotels.filter((hotel) => hotel.location.toLowerCase().includes(locationName))
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

export default function TripPlanner({ onContinue, sectionId = 'custom-trip' }: TripPlannerProps) {
  const [savedPlan] = useState(() => readTripPlan(sectionId))
  const [startDate, setStartDate] = useState(savedPlan.startDate)
  const [endDate, setEndDate] = useState(savedPlan.endDate)
  const [plans, setPlans] = useState<DayPlan[]>(savedPlan.plans)
  const [vehicleId, setVehicleId] = useState(savedPlan.vehicleId ?? rentalCars[0].id)
  const [placeIds, setPlaceIds] = useState<string[]>(savedPlan.placeIds ?? [])
  const [placeNotice, setPlaceNotice] = useState('')
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
  const usedPlaceDays = placeIds.reduce((total, id) => total + placeDays(id), 0)
  const dayPlans = Array.from({ length: tripDays }).reduce<Array<DayPlan & { origin: string; routeTo: string; stayAt: string; routeOptions: string[] }>>((days, _, index) => {
    const origin = index === 0 ? 'srinagar' : days[index - 1].stayAt
    const saved = plans[index] ?? {}
    const visited = new Set(days.map((day) => day.routeTo))
    const gurezDays = days.filter((day) => day.routeTo === 'gurez').length
    const returningFromGurez = origin === 'gurez' && gurezDays >= 2
    const continuingGurez = origin === 'gurez' && gurezDays === 1
    const remaining = placeIds.filter((id) => !visited.has(id) && (id !== 'gurez' || index <= tripDays - 4))
    const routeOptions = index === tripDays - 1 || returningFromGurez ? ['srinagar'] : continuingGurez ? ['gurez'] : [...new Set([...remaining, 'srinagar', origin])]
    const routeTo = routeOptions.includes(saved.routeTo ?? '') ? saved.routeTo! : routeOptions[0]
    const options = stayOptions(routeTo)
    const stayAt = routeTo === 'gurez' ? 'gurez' : options.includes(saved.stayAt ?? '') ? saved.stayAt! : options.includes(routeTo) ? routeTo : 'srinagar'
    const validHotel = hotelsAt(stayAt).some((hotel) => hotel.id === saved.hotelId)
    days.push({ origin, routeTo, stayAt, routeOptions, hotelId: validHotel ? saved.hotelId : undefined, breakfast: validHotel && saved.breakfast, dinner: validHotel && saved.dinner })
    return days
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem(tripPlanStorageKey(sectionId), JSON.stringify({ savedAt: Date.now(), startDate, endDate, plans, vehicleId, placeIds }))
    } catch {
      return
    }
  }, [endDate, plans, sectionId, startDate, vehicleId, placeIds])

  useEffect(() => () => {
    try {
      if (sessionStorage.getItem(tripReturnStorageKey) !== sectionId) clearSavedTripPlan(sectionId)
    } catch {
      return
    }
  }, [sectionId])

  function preservePlanForHotelReturn() {
    try {
      sessionStorage.setItem(tripPlanStorageKey(sectionId), JSON.stringify({ savedAt: Date.now(), startDate, endDate, plans, vehicleId, placeIds }))
      sessionStorage.setItem(tripReturnStorageKey, sectionId)
    } catch {
      return
    }
  }

  function updatePlan(index: number, next: DayPlan) {
    setPlans((current) => [...current.slice(0, index), next])
  }

  function resizePlaces(nextStart: string, nextEnd: string) {
    const budget = nextStart && nextEnd ? Math.max(0, Math.round((Date.parse(nextEnd) - Date.parse(nextStart)) / 86400000)) : 0
    const fitting = fitPlaces(placeIds, budget)
    setPlaceIds(fitting)
    setPlaceNotice(fitting.length < placeIds.length ? 'Your dates changed. Places that no longer fit have been removed. Increase the number of days above to add them again.' : '')
  }

  function toggleDestination(id: string) {
    if (placeIds.includes(id)) {
      setPlaceIds(placeIds.filter((placeId) => placeId !== id))
      setPlaceNotice('')
      setPlans([])
      return
    }
    if (usedPlaceDays + placeDays(id) > nights) {
      setPlaceNotice('As per the number of days, this is the maximum number of places you can select. Please increase the number of days at the top. Gurez requires 3 days and 2 nights.')
      return
    }
    setPlaceIds([...placeIds, id])
    setPlaceNotice('')
    setPlans([])
  }

  function changeStartDate(value: string) {
    if (value && value < minDate) return
    if (!value) {
      setStartDate('')
      setEndDate('')
      setPlans([])
      resizePlaces('', '')
      return
    }
    setStartDate(value)
    setPlans([])
    const nextEnd = !endDate || endDate <= value || endDate > addDays(value, 30) ? addDays(value, 4) : endDate
    setEndDate(nextEnd)
    resizePlaces(value, nextEnd)
  }

  function changeEndDate(value: string) {
    if (!value) {
      setEndDate('')
      setPlans([])
      resizePlaces('', '')
      return
    }
    if (!startDate || value <= startDate || value > addDays(startDate, 30)) return
    setEndDate(value)
    setPlans([])
    resizePlaces(startDate, value)
  }

  function continueToEnquiry() {
    const itinerary = dayPlans.map((day, index) => {
      const date = formatDate(addDays(startDate, index))
      const route = day.origin === day.routeTo
        ? `Explore ${stopName(day.origin)} locally`
        : `${stopName(day.origin)} to ${stopName(day.routeTo)}`
      const overnight = index < dayPlans.length - 1 ? `; stay overnight in ${stopName(day.stayAt)}` : '; departure day'
      const selectedHotel = day.hotelId ? hotels.find((hotel) => hotel.id === day.hotelId) : undefined
      const basePrice = selectedHotel?.roomOnlyPrice ?? selectedHotel?.price ?? 0
      const rate = basePrice + ((selectedHotel?.price ?? basePrice) - basePrice) / 2 * (Number(Boolean(day.breakfast)) + Number(Boolean(day.dinner)))
      const mealNote = selectedHotel ? `; breakfast: ${day.breakfast ? 'included' : 'not included'}; dinner: ${day.dinner ? 'included' : 'not included'}; hotel rate: ₹${rate.toLocaleString('en-IN')} per couple per night` : ''
      const hotelNote = index < dayPlans.length - 1 ? `; hotel: ${selectedHotel?.name ?? 'please recommend a stay'}${mealNote}` : ''
      return `Day ${index + 1} (${date}): ${route}${overnight}${hotelNote}.`
    }).join('\n')

    onContinue({
      arrivalDate: startDate,
      departureDate: endDate,
      tripDays: String(tripDays),
      tripNights: String(nights),
      carRental: selectedVehicle.name,
      vehicleDailyRate: `₹${selectedVehicle.price.toLocaleString('en-IN')}`,
      vehicleRentalEstimate: `₹${vehicleTotal.toLocaleString('en-IN')} for ${tripDays} days; excludes hotel costs and optional extras`,
      placesToVisit: itinerary,
      selectedDestinations: placeIds.map(stopName).join(', '),
      planningNote: 'Destination day allocations are provisional. Please confirm route order, travel times, access and destination-specific charges.',
    })
  }

  return <section className="custom-trip-section" id={sectionId}>
    <div className="page-width custom-trip-inner">
      <div className="custom-trip-intro">
        <p className="eyebrow">Customise your trip</p>
        <h2>Plan your trip,<br /><em>your way.</em></h2>
        <p>Choose your dates and places. We’ll shape a thoughtful itinerary around your interests, pace and stay preferences.</p>
      </div>

      <div className="trip-planner" aria-label="Customise your Kashmir journey">
        <div className="planner-heading">
          <div><span className="planner-kicker">CUSTOMIZE YOUR TRIP</span><h3>Build your trip.</h3></div>
          <span className="planner-local"><MapPin size={15} /> Planned with local care</span>
        </div>
        <div className="trip-dates">
          <label><span><CalendarDays size={15} /> Start date</span><input type="date" min={minDate} value={startDate} onChange={(event) => changeStartDate(event.target.value)} /></label>
          <label className={!startDate ? 'trip-date-disabled' : undefined}><span><CalendarDays size={15} /> End date</span><input type="date" min={startDate ? addDays(startDate, 1) : addDays(minDate, 1)} max={startDate ? addDays(startDate, 30) : undefined} value={endDate} disabled={!startDate} onChange={(event) => changeEndDate(event.target.value)} /></label>
          <div className="trip-length" aria-live="polite"><strong>{tripDays || '—'}</strong><span>{tripDays ? `${tripDays === 1 ? 'day' : 'days'} · ${nights} ${nights === 1 ? 'night' : 'nights'}` : 'Trip length'}</span></div>
        </div>

        {tripDays > 0 && <div className="planner-selection-sections">
        <fieldset className="planner-destination-picker">
          <legend>Choose your places to visit</legend>
          <p className="planner-place-summary" role="status">{placeIds.length} places selected · {usedPlaceDays} of {nights} sightseeing days allocated · 1 departure day reserved. {usedPlaceDays === nights ? 'Maximum reached. Please increase the number of days at the top to select more places.' : `${nights - usedPlaceDays} sightseeing days remaining.`} Gurez requires 3 days and 2 nights.</p>
          {placeNotice && <p className="planner-place-notice" role="alert">{placeNotice}</p>}
          <div className="planner-destination-grid">{destinations.map((place) => <article className={`planner-place-card${placeIds.includes(place.id) ? ' is-selected' : ''}`} key={place.id}>
            <div className="destination-photo-frame">
              <img src={place.image} alt={place.photoCredit ? place.name : `${place.name}, illustrative landscape`} loading="lazy" />
              {place.photoCredit && <small className="destination-photo-credit"><a href={place.photoCredit.source} target="_blank" rel="noreferrer">{place.photoCredit.author}</a> · <a href={place.photoCredit.licenseUrl} target="_blank" rel="noreferrer">CC BY-SA 4.0</a></small>}
            </div>
            <label><input type="checkbox" checked={placeIds.includes(place.id)} onChange={() => toggleDestination(place.id)} />
              <strong>{place.name}</strong>
              <span>{placeDays(place.id)} {placeDays(place.id) === 1 ? 'day' : 'days · 2 nights'}</span>
              <span>Price on enquiry</span>
            </label>
            <Link to={`/destinations?place=${encodeURIComponent(place.name)}`} state={{ tripReturn: { sectionId, returnPath: sectionId === 'package-planner' ? '/tour-packages' : '/' } }} onClick={preservePlanForHotelReturn}>View this place <ArrowRight size={13} /></Link>
          </article>)}</div>
        </fieldset>
        <div className="planner-vehicle-section">
          <fieldset className="planner-vehicle-picker"><legend>Choose your vehicle</legend>
            <div className="planner-vehicle-grid">{plannerVehicles.map((vehicle) => {
              const isTraveller = vehicle.category === 'Tempo Traveller'
              const selected = isTraveller ? selectedVehicle.category === 'Tempo Traveller' : selectedVehicle.id === vehicle.id
              const displayed = selected ? selectedVehicle : vehicle
              return <div key={vehicle.id} className={`planner-vehicle-choice${selected ? ' is-selected' : ''}`}>
                <label><input type="radio" name={`${sectionId}-vehicle`} checked={selected} onChange={() => setVehicleId(vehicle.id)} />
                  <img src={vehicle.image} alt={vehicle.name} loading="lazy" />
                  <strong>{isTraveller ? 'Tempo Traveller' : vehicle.name}</strong>
                  <span>₹{displayed.price.toLocaleString('en-IN')} per day</span>
                </label>
                {isTraveller && <label className="planner-vehicle-size">Seats<select aria-label="Traveller seating capacity" value={selectedVehicle.category === 'Tempo Traveller' ? selectedVehicle.id : vehicle.id} onChange={(event) => setVehicleId(event.target.value)}>{rentalCars.filter((car) => car.category === 'Tempo Traveller').map((car) => <option key={car.id} value={car.id}>{car.seats}-seater</option>)}</select></label>}
              </div>
            })}</div>
          </fieldset>
          <p className="planner-vehicle-total" role="status"><strong>Vehicle rental estimate: ₹{vehicleTotal.toLocaleString('en-IN')}</strong><span>₹{selectedVehicle.price.toLocaleString('en-IN')} × {tripDays} days · vehicle only, not the full package price</span></p>
        </div>
        </div>}
        {tripDays > 0 ? <div className="day-plans">
          {dayPlans.map((day, index) => {
            const routeLabel = day.origin === day.routeTo
              ? `Explore ${stopName(day.origin)} locally`
              : `${stopName(day.origin)} to ${stopName(day.routeTo)}`
            const date = formatDate(addDays(startDate, index))
            return <article className="day-plan" key={`${startDate}-${index}`}>
              <div className="day-marker"><span>{String(index + 1).padStart(2, '0')}</span><i /></div>
              <div className="day-plan-fields">
                <div className="day-plan-title"><div><span>DAY {index + 1}</span><h4>{date}</h4></div>{index === tripDays - 1 && <span className="departure-label">Departure day</span>}</div>
                <fieldset className="planner-route-picker">
                  <legend>Day {index + 1} · Choose your route from {stopName(day.origin)}</legend>
                  <div className="planner-daily-route-options">{day.routeOptions.map((id) => <button key={id} type="button" className={`planner-route-tile${day.routeTo === id ? ' is-selected' : ''}`} aria-pressed={day.routeTo === id} onClick={() => updatePlan(index, { routeTo: id, stayAt: id === 'gurez' ? 'gurez' : 'srinagar' })}>
                    {id === day.origin ? `Explore ${stopName(id)} locally` : `${stopName(day.origin)} to ${stopName(id)}`}
                  </button>)}</div>
                </fieldset>
                {day.routeTo === 'gurez' && <p className="planner-assigned-route">Gurez visit: 3 days and 2 nights reserved.</p>}
                {index < tripDays - 1 && <>
                  <fieldset className="planner-stay-picker overnight-field">
                    <legend><MoonStar size={15} /> Day {index + 1} · Where would you like to stay?</legend>
                    <div className="planner-stay-tiles">
                      {(day.routeTo === 'gurez' ? ['gurez'] : stayOptions(day.routeTo)).map((id) => <button
                        className={`planner-stay-tile${day.stayAt === id ? ' is-selected' : ''}`}
                        type="button"
                        key={id}
                        aria-pressed={day.stayAt === id}
                        onClick={() => updatePlan(index, { routeTo: day.routeTo, stayAt: id, hotelId: undefined })}
                      >Stay in {stopName(id)}</button>)}
                    </div>
                  </fieldset>
                  <div className="planner-field overnight-field">
                    <span>Day {index + 1} · Choose a hotel in {stopName(day.stayAt)} <small className="planner-swipe-hint">Swipe for hotels</small></span>
                    <SwipeRail label={`Day ${index + 1} hotels in ${stopName(day.stayAt)}`} className="planner-hotel-rail">
                      {hotelsAt(day.stayAt).map((hotel) => <article className={`planner-hotel-card${day.hotelId === hotel.id ? ' is-selected' : ''}`} key={hotel.id}>
                        <button
                          className="planner-hotel-tile"
                          type="button"
                          aria-pressed={day.hotelId === hotel.id}
                          onClick={() => updatePlan(index, { routeTo: day.routeTo, stayAt: day.stayAt, hotelId: hotel.id })}
                        >
                          <span className="planner-hotel-category">{hotel.category}</span>
                          <strong>{hotel.name}</strong>
                          <img className="planner-hotel-photo" src={hotel.image} alt={`${hotel.name}, illustrative hotel photo`} loading="lazy" />
                        </button>
                        <HotelRates hotel={hotel} meals={{ breakfast: day.hotelId === hotel.id && Boolean(day.breakfast), dinner: day.hotelId === hotel.id && Boolean(day.dinner) }} onChange={(breakfast, dinner) => setPlans((current) => {
                          const next = [...current]
                          next[index] = { routeTo: day.routeTo, stayAt: day.stayAt, hotelId: hotel.id, breakfast, dinner }
                          return next
                        })} />
                        <Link
                          className="planner-hotel-view-link"
                          to={`/hotels/${hotel.id}`}
                          state={{ tripReturn: { sectionId, returnPath: sectionId === 'package-planner' ? '/tour-packages' : '/' } }}
                          onClick={preservePlanForHotelReturn}
                        >View hotel <ArrowRight size={13} /></Link>
                      </article>)}
                      <article className={`planner-hotel-card planner-hotel-recommend-card${!day.hotelId ? ' is-selected' : ''}`}>
                        <button
                          className="planner-hotel-tile planner-hotel-recommend"
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
        </div> : <p className="planner-empty">Choose your start and end dates to build your day-by-day plan.</p>}

        <div className="planner-footer"><p>Your route is a starting point. Our local team will help check travel times, access and availability.</p><button className="button button-dark" type="button" disabled={!tripDays} onClick={continueToEnquiry}>Continue with this plan <ArrowRight size={16} /></button></div>
      </div>
    </div>
  </section>
}