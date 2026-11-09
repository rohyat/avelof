import { Children, useEffect, useRef, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { ArrowRight, CalendarDays, MapPin, MoonStar } from 'lucide-react'
import { Link } from 'react-router-dom'
import { destinations, hotels } from '../data/catalog'
import { clearSavedTripPlan, tripPlanStorageKey, tripReturnStorageKey } from '../services/tripPlanStorage'

interface DayPlan {
  routeTo?: string
  stayAt?: string
  hotelId?: string
}

interface SavedTripPlan {
  savedAt: number
  startDate: string
  endDate: string
  plans: DayPlan[]
}

interface TripPlannerProps {
  onContinue: (fields: Record<string, string>) => void
  sectionId?: string
}

const plannerStops = destinations.slice(0, 6)
const overnightStops = new Set(['gulmarg', 'pahalgam', 'sonamarg'])
const tripPlanLifetime = 24 * 60 * 60 * 1000

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
      }
    })
    return { savedAt: parsed.savedAt, startDate: parsed.startDate, endDate: parsed.endDate, plans }
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
  const [minDate] = useState(() => {
    return todayDateValue()
  })
  const dateDifference = startDate && endDate
    ? Math.round((new Date(`${endDate}T12:00:00`).getTime() - new Date(`${startDate}T12:00:00`).getTime()) / 86400000)
    : -1
  const tripDays = dateDifference > 0 && dateDifference <= 30 ? dateDifference + 1 : 0
  const nights = Math.max(0, tripDays - 1)
  const dayPlans = Array.from({ length: tripDays }).reduce<Array<DayPlan & { origin: string; routeTo: string; stayAt: string }>>((days, _, index) => {
    const origin = index === 0 ? 'srinagar' : days[index - 1].stayAt
    const saved = plans[index] ?? {}
    const routeTo = saved.routeTo ?? origin
    const options = stayOptions(routeTo)
    const stayAt = options.includes(saved.stayAt ?? '') ? saved.stayAt! : options.includes(routeTo) ? routeTo : 'srinagar'
    days.push({ origin, routeTo, stayAt, hotelId: saved.hotelId })
    return days
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem(tripPlanStorageKey(sectionId), JSON.stringify({ savedAt: Date.now(), startDate, endDate, plans }))
    } catch {
      return
    }
  }, [endDate, plans, sectionId, startDate])

  useEffect(() => () => {
    try {
      if (sessionStorage.getItem(tripReturnStorageKey) !== sectionId) clearSavedTripPlan(sectionId)
    } catch {
      return
    }
  }, [sectionId])

  function preservePlanForHotelReturn() {
    try {
      sessionStorage.setItem(tripPlanStorageKey(sectionId), JSON.stringify({ savedAt: Date.now(), startDate, endDate, plans }))
      sessionStorage.setItem(tripReturnStorageKey, sectionId)
    } catch {
      return
    }
  }

  function updatePlan(index: number, next: DayPlan) {
    setPlans((current) => [...current.slice(0, index), next])
  }

  function changeStartDate(value: string) {
    if (value && value < minDate) return
    if (!value) {
      setStartDate('')
      setEndDate('')
      setPlans([])
      return
    }
    setStartDate(value)
    setPlans([])
    if (!endDate || endDate <= value || endDate > addDays(value, 30)) setEndDate(addDays(value, 4))
  }

  function changeEndDate(value: string) {
    if (!value) {
      setEndDate('')
      setPlans([])
      return
    }
    if (!startDate || value <= startDate || value > addDays(startDate, 30)) return
    setEndDate(value)
    setPlans([])
  }

  function continueToEnquiry() {
    const itinerary = dayPlans.map((day, index) => {
      const date = formatDate(addDays(startDate, index))
      const route = day.origin === day.routeTo
        ? `Explore ${stopName(day.origin)} locally`
        : `${stopName(day.origin)} to ${stopName(day.routeTo)}`
      const overnight = index < dayPlans.length - 1 ? `; stay overnight in ${stopName(day.stayAt)}` : '; departure day'
      const selectedHotel = day.hotelId ? hotels.find((hotel) => hotel.id === day.hotelId)?.name : undefined
      const hotelNote = index < dayPlans.length - 1 ? `; hotel: ${selectedHotel ?? 'please recommend a stay'}` : ''
      return `Day ${index + 1} (${date}): ${route}${overnight}${hotelNote}.`
    }).join('\n')

    onContinue({
      arrivalDate: startDate,
      departureDate: endDate,
      tripDays: String(tripDays),
      tripNights: String(nights),
      placesToVisit: itinerary,
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
                  <legend><span>Day {index + 1} · Where would you like to explore?</span><small className="planner-swipe-hint">Swipe for routes</small></legend>
                  <SwipeRail label={`Day ${index + 1} route choices`} className="planner-route-tiles">
                    {plannerStops.map((place) => {
                      const selected = day.routeTo === place.id
                      return <button
                        className={`planner-route-tile${selected ? ' is-selected' : ''}`}
                        type="button"
                        key={place.id}
                        aria-pressed={selected}
                        onClick={() => {
                          const options = stayOptions(place.id)
                          const selectedStay = plans[index]?.stayAt
                          const stayAt = options.includes(selectedStay ?? '') ? selectedStay! : options.includes(place.id) ? place.id : 'srinagar'
                          updatePlan(index, { routeTo: place.id, stayAt })
                        }}
                      >
                        <ArrowRight size={14} aria-hidden="true" />
                        <strong>{place.id === day.origin ? `Explore ${stopName(day.origin)} locally` : `${stopName(day.origin)} to ${place.name}`}</strong>
                      </button>
                    })}
                  </SwipeRail>
                </fieldset>
                {index < tripDays - 1 && <>
                  <fieldset className="planner-stay-picker overnight-field">
                    <legend><MoonStar size={15} /> Day {index + 1} · Where would you like to stay?</legend>
                    <div className="planner-stay-tiles">
                      {stayOptions(day.routeTo).map((id) => <button
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
                          <small>From ₹{hotel.price.toLocaleString('en-IN')} / night</small>
                          <small>Breakfast and dinner are included.</small>
                        </button>
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