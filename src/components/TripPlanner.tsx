import { useEffect, useState } from 'react'
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
        <h2>Your Kashmir journey<br /><em>starts here.</em></h2>
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
                <label className="planner-field"><span>What would you like to explore?</span><select value={day.routeTo} onChange={(event) => {
                  const routeTo = event.target.value
                  const options = stayOptions(routeTo)
                  const selectedStay = plans[index]?.stayAt
                  const stayAt = options.includes(selectedStay ?? '') ? selectedStay! : options.includes(routeTo) ? routeTo : 'srinagar'
                  updatePlan(index, { routeTo, stayAt })
                }}>
                  {plannerStops.map((place) => <option key={place.id} value={place.id}>{place.id === day.origin ? `Explore ${place.name} locally` : `${stopName(day.origin)} to ${place.name}`}</option>)}
                </select></label>
                {index < tripDays - 1 && <>
                  <label className="planner-field overnight-field"><span><MoonStar size={15} /> Where would you like to stay?</span><select value={day.stayAt} onChange={(event) => updatePlan(index, { routeTo: day.routeTo, stayAt: event.target.value })}>
                    {stayOptions(day.routeTo).map((id) => <option key={id} value={id}>Stay in {stopName(id)}</option>)}
                  </select></label>
                  <label className="planner-field overnight-field"><span>Which hotel in {stopName(day.stayAt)}?</span><select value={day.hotelId ?? ''} onChange={(event) => updatePlan(index, { routeTo: day.routeTo, stayAt: day.stayAt, hotelId: event.target.value || undefined })}>
                    <option value="">Please recommend a stay</option>
                    {hotelsAt(day.stayAt).map((hotel) => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}
                  </select></label>
                  <Link
                    className="planner-hotel-link"
                    to={{ pathname: '/hotels', search: `?location=${encodeURIComponent(stopName(day.stayAt))}` }}
                    state={{ tripReturn: { sectionId, returnPath: sectionId === 'package-planner' ? '/tour-packages' : '/' } }}
                    onClick={preservePlanForHotelReturn}
                  >View hotels in {stopName(day.stayAt)} <ArrowRight size={14} /></Link>
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