import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, Download, Plus, RefreshCw, Share2, Trash2 } from 'lucide-react'
import { z } from 'zod'
import { destinations, rentalCars } from '../data/catalog'
import { itineraryTerms } from '../data/itineraryTerms'
import { changeArrivalPlan, changeItineraryMeals, createItineraryDraft, dayStart, destinationImages, eligibleStayHotels, itineraryMealChoice, itineraryPackageDetails, itineraryPdfFilename, itineraryStays, overnightOptions, resizeItinerary, selectedStayHotels, stayDisplayName, synchronizeItinerary, updateDayPlan } from '../data/itineraryBuilder'
import { formatItineraryRouteLeg, itineraryRouteLegs } from '../data/itineraryRoutes'
import { itineraryDraftSchema, itineraryRoomTypes } from '../services/itineraryBuilderSchema'
import type { BuilderDay, ItineraryDraft, ItineraryRoomType } from '../services/itineraryBuilderSchema'
import { HotelError, hotelErrorText, loadPublicHotels, requestHotel, toCatalogHotel } from '../services/hotelService'
import type { Hotel } from '../types'
import ItineraryTemplates from '../components/ItineraryTemplates'
import { canSharePdf, pdfFile, sharePdf } from '../services/pdfSharing'
import './itineraryBuilder.css'

const textLines = (value: string) => value.split('\n').map(line => line.trim()).filter(Boolean)

export default function ItineraryBuilderPage() {
  const [draft, setDraft] = useState<ItineraryDraft>(() => createItineraryDraft())
  const [dayCountInput, setDayCountInput] = useState(() => String(draft.days.length))
  const [numberInputs, setNumberInputs] = useState(() => ({ travellers: String(draft.travellers), roomsPerNight: '', pricePerPerson: String(draft.pricePerPerson), advancePercent: String(draft.advancePercent) }))
  const [initialFingerprint, setInitialFingerprint] = useState(() => JSON.stringify(draft))
  const [downloadedFingerprint, setDownloadedFingerprint] = useState('')
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [preview, setPreview] = useState<{ url: string; file: File; fingerprint: string; hotels: Hotel[] } | null>(null)
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState('')
  const [previewError, setPreviewError] = useState('')
  const [rendering, setRendering] = useState(false)
  const fingerprint = JSON.stringify(draft)
  const dirty = initialFingerprint !== fingerprint && downloadedFingerprint !== fingerprint
  const validation = itineraryDraftSchema.safeParse(draft)
  const packageDetails = itineraryPackageDetails(draft)
  const validationError = Number(dayCountInput) !== draft.days.length ? 'Enter a whole number of days between 2 and 15.' : [numberInputs.travellers, numberInputs.pricePerPerson, numberInputs.advancePercent].some(value => !value.trim()) ? 'Enter the number of guests, price per person and advance payment before downloading.' : validation.success ? '' : validation.error.issues[0]?.message ?? 'Check itinerary details.'

  useEffect(() => {
    const controller = new AbortController()
    requestHotel('/api/itineraries', 'GET', undefined, controller.signal).then(async response => {
      if (controller.signal.aborted) return
      z.object({ authorized: z.literal(true), storage: z.literal(false) }).parse(response)
      setAuthorized(true)
      const [kashmirHotels, jammuHotels] = await Promise.all([
        loadPublicHotels(controller.signal), loadPublicHotels(controller.signal, undefined, 'Jammu'),
      ])
      if (controller.signal.aborted) return
      setHotels([...kashmirHotels, ...jammuHotels].map(toCatalogHotel)); setLoaded(true)
    }).catch((failure: unknown) => {
      if (controller.signal.aborted) return
      if (failure instanceof HotelError && failure.status === 401) setAuthorized(false)
      else { console.error('Itinerary builder loading failed', failure); setError(hotelErrorText(failure)) }
    })
    return () => controller.abort()
  }, [revision])

  useEffect(() => {
    if (!authorized || !loaded || validationError) return
    const controller = new AbortController()
    let url = ''
    const timer = window.setTimeout(async () => {
      setRendering(true); setPreviewError('')
      try {
        const { buildEditableItineraryPdf } = await import('../services/builderItineraryPdf')
        const pdf = await buildEditableItineraryPdf(draft, hotels, controller.signal)
        if (controller.signal.aborted) return
        const file = pdfFile(pdf.output('blob'), itineraryPdfFilename(draft.guestName))
        url = URL.createObjectURL(file)
        setPreview({ url, file, fingerprint, hotels })
      } catch (failure) {
        if (!controller.signal.aborted) {
          console.error('Itinerary preview failed', failure)
          setPreviewError(failure instanceof Error ? failure.message : 'Could not build the itinerary preview. Please retry.')
        }
      } finally { if (!controller.signal.aborted) setRendering(false) }
    }, 750)
    return () => { window.clearTimeout(timer); controller.abort(); if (url) URL.revokeObjectURL(url) }
  }, [draft, fingerprint, hotels, authorized, loaded, validationError, revision])

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function edit(next: ItineraryDraft) {
    if (next.days.length !== draft.days.length) setDayCountInput(String(next.days.length))
    setDraft(next)
  }
  function changeDay(index: number, patch: Partial<BuilderDay>) {
    edit(updateDayPlan(draft, index, patch))
  }
  function changeNumber(key: keyof typeof numberInputs, value: string) {
    setNumberInputs(current => ({ ...current, [key]: value }))
    if (key === 'roomsPerNight') {
      const count = value.trim() ? Number(value) : null
      const valid = count !== null && Number.isInteger(count) && count >= 1 && count <= 100
      const roomExtraBeds = count === null ? [] : valid
        ? Array.from({ length: count }, (_, index) => draft.roomExtraBeds[index] ?? false)
        : draft.roomExtraBeds
      const roomTypes = count === null ? [] : valid
        ? Array.from({ length: count }, (_, index) => draft.roomTypes[index] ?? 'Double')
        : draft.roomTypes
      edit({ ...draft, roomsPerNight: count, roomTypes, roomExtraBeds })
    } else if (value.trim()) edit({ ...draft, [key]: Number(value) })
  }
  function normalizeNumber(key: keyof typeof numberInputs) {
    const value = numberInputs[key]
    if (value.trim() && Number.isFinite(Number(value))) setNumberInputs(current => ({ ...current, [key]: String(Number(value)) }))
  }
  function moveDay(index: number, offset: number) {
    const days = [...draft.days]
    ;[days[index], days[index + offset]] = [days[index + offset], days[index]]
    edit(synchronizeItinerary({ ...draft, days }, draft))
  }
  function startFresh() {
    if (dirty && !window.confirm('Start fresh? Download your current PDF or save a template first if you need it. Unsaved changes will be lost.')) return
    openDraft(createItineraryDraft(draft.tier))
  }
  function openDraft(next: ItineraryDraft) {
    setDraft(next); setDayCountInput(String(next.days.length)); setDownloadedFingerprint('')
    setNumberInputs({ travellers: String(next.travellers), roomsPerNight: next.roomsPerNight === null ? '' : String(next.roomsPerNight), pricePerPerson: String(next.pricePerPerson), advancePercent: String(next.advancePercent) })
    setInitialFingerprint(JSON.stringify(next))
  }
  const previewCurrent = preview?.fingerprint === fingerprint && preview.hotels === hotels && loaded && !rendering && !previewError && !validationError
  async function shareItinerary() {
    if (!previewCurrent || !preview || sharing) return
    setSharing(true); setShareError('')
    try { if (await sharePdf(preview.file)) setDownloadedFingerprint(preview.fingerprint) }
    catch (failure) {
      console.error('Itinerary sharing failed', failure)
      setShareError(failure instanceof Error ? failure.message : 'Could not share the itinerary PDF. Try Download instead.')
    } finally { setSharing(false) }
  }

  return <section className="page-width itinerary-builder itinerary-workspace">
    <p className="eyebrow">AVELOF owner access</p><h1>Itinerary builder</h1>
    <nav className="admin-section-nav" aria-label="Owner sections"><Link to="/admin/panel">Enquiries</Link><Link to="/admin/panel/reviews">Reviews</Link><Link to="/admin/panel/hotels">Hotels</Link><Link to="/admin/panel/drivers">Drivers</Link><Link to="/admin/panel/businesses">Businesses</Link><span aria-current="page">Itineraries</span><Link to="/admin/panel/payments">Payments</Link></nav>
    {error && <p className="enquiry-error" role="alert">{error}</p>}
    {authorized === null && !error && <p role="status">Checking owner access...</p>}
    {authorized === false && <p>Sign in through <Link to="/admin/panel">Owner sign-in</Link>, then return to the itinerary builder. Itineraries are created only in your browser.</p>}
    {(!loaded || error) && <button className="button button-outline" onClick={() => { setError(''); setRevision(value => value + 1) }}><RefreshCw size={16} /> Retry loading</button>}
    {authorized && <>
      <p>Build a fresh journey or open a local template, update the guest details and download the AVELOF PDF. Only explicitly saved templates use this browser's local storage; nothing is saved to the database. Create receipts in <Link to="/admin/panel/payments">Payments</Link>.</p>
      <div className="itinerary-builder-toolbar">
        <button className="button button-outline" onClick={startFresh}><Plus size={16} /> Start fresh</button>
        <div className="itinerary-workspace-summary"><span>{draft.days.length} days / {draft.days.length - 1} nights</span><span>{draft.travellers} guests</span><span>{draft.tier}</span></div>
      </div>
      <nav className="itinerary-editor-shortcuts" aria-label="Itinerary editor sections"><a href="#itinerary-guest">Guest</a><a href="#itinerary-overview">Trip overview</a><a href="#itinerary-days">Day-by-day journey</a><a href="#itinerary-preview">PDF preview</a></nav>
      <div className="itinerary-builder-layout">
        <fieldset className="itinerary-builder-editor">
          <legend className="sr-only">Edit itinerary</legend>
          <ItineraryTemplates draft={draft} inputError={Number(dayCountInput) !== draft.days.length ? 'Enter a whole number of days between 2 and 15.' : [numberInputs.travellers, numberInputs.pricePerPerson, numberInputs.advancePercent].some(value => !value.trim()) ? 'Enter the number of guests, price per person and advance payment before saving a template.' : ''} onOpen={next => {
            if (dirty && !window.confirm('Open this template? Unsaved itinerary changes will be lost.')) return
            openDraft(next)
          }} />
          <section className="itinerary-editor-section" id="itinerary-guest">
            <h2>Guest details</h2>
            <label>Guest name<input autoComplete="off" maxLength={60} value={draft.guestName} onChange={event => edit({ ...draft, guestName: event.target.value })} placeholder="Enter guest name first" /></label>
            <p>The guest name appears on the PDF and in its filename. It is not sent to the server.</p>
          </section>
          <section className="itinerary-editor-section" id="itinerary-overview">
            <h2>Trip overview</h2>
            <div className="itinerary-fields">
              <label>Package tier<select value={draft.tier} onChange={event => {
                const tier = event.target.value as ItineraryDraft['tier']
                edit({ ...draft, tier, hotelChoices: {}, hotelPhotos: {} })
              }}><option value="deluxe">Deluxe</option><option value="premium">Premium</option><option value="luxury">Luxury</option></select></label>
              <label>Package title<input maxLength={80} value={draft.title} onChange={event => edit({ ...draft, title: event.target.value })} /></label>
              <label>Number of days<input type="number" min={2} max={15} value={dayCountInput} onBlur={() => { if (dayCountInput.trim() && Number.isFinite(Number(dayCountInput))) setDayCountInput(String(Number(dayCountInput))) }} onChange={event => { setDayCountInput(event.target.value); const count = Number(event.target.value); if (Number.isInteger(count) && count >= 2 && count <= 15) edit(resizeItinerary(draft, count)) }} /></label>
              <label>Number of guests<input type="number" min={1} max={100} value={numberInputs.travellers} onBlur={() => normalizeNumber('travellers')} onChange={event => changeNumber('travellers', event.target.value)} /></label>
              <label>Rooms per night<input type="number" min={1} max={100} step={1} value={numberInputs.roomsPerNight} onBlur={() => normalizeNumber('roomsPerNight')} onChange={event => changeNumber('roomsPerNight', event.target.value)} /></label>
              <p>One room count applies to every overnight stay. Required when accommodation is included.</p>
              <label>Price per person (INR)<input type="number" min={0} max={10000000} step="0.01" value={numberInputs.pricePerPerson} onBlur={() => normalizeNumber('pricePerPerson')} onChange={event => changeNumber('pricePerPerson', event.target.value)} /></label>
              <label>Arrival date (optional)<input type="date" value={draft.travelDate} onChange={event => edit({ ...draft, travelDate: event.target.value })} /></label>
              <label>Advance payment (%)<input type="number" min={0} max={100} value={numberInputs.advancePercent} onBlur={() => normalizeNumber('advancePercent')} onChange={event => changeNumber('advancePercent', event.target.value)} /></label>
              <label>Transport<select value={draft.transport} onChange={event => edit({ ...draft, transport: event.target.value })}>{rentalCars.map(vehicle => <option key={vehicle.id} value={vehicle.name}>{vehicle.category === 'Sedan' ? `Sedan (${vehicle.name})` : vehicle.name}</option>)}</select></label>
              <label>Meal plan<select aria-label="Meal plan" value={itineraryMealChoice(draft)} onChange={event => edit(changeItineraryMeals(draft, event.target.value))}><option value="both">Breakfast &amp; dinner</option><option value="breakfast">Breakfast only</option><option value="dinner">Dinner only</option><option value="none">Meals not included</option></select></label>
              <p>Meal summary: {packageDetails.mealPlan}. Breakfast, dinner and optional lunch stay synchronized with the checklist below.</p>
              <label>Price wording<textarea value={draft.priceNote} maxLength={120} onChange={event => edit({ ...draft, priceNote: event.target.value })} /></label>
            </div>
            {draft.roomTypes.length > 0 && <fieldset className="itinerary-room-options">
              <legend>Room type for each room</legend>
              <p>Choose Double, Triple or Family for each room. Double rooms can add one extra bed. This arrangement applies to every overnight stay.</p>
              <div className="itinerary-room-list">{draft.roomTypes.map((roomType, index) => <div className="itinerary-room-choice" key={index}>
                <label>Room {index + 1} type<select aria-label={`Room ${index + 1} type`} value={roomType} onChange={event => {
                  const nextType = event.target.value as ItineraryRoomType
                  edit({ ...draft, roomTypes: draft.roomTypes.map((value, room) => room === index ? nextType : value), roomExtraBeds: draft.roomExtraBeds.map((value, room) => room === index ? nextType === 'Double' && value : value) })
                }}>{itineraryRoomTypes.map(type => <option key={type} value={type}>{type} room</option>)}</select></label>
                {roomType === 'Double' && <label className="itinerary-room-extra"><input type="checkbox" checked={draft.roomExtraBeds[index] ?? false} onChange={event => edit({ ...draft, roomExtraBeds: draft.roomExtraBeds.map((value, room) => room === index ? event.target.checked : value) })} />
                  Room {index + 1}: extra bed</label>}
              </div>)}</div>
            </fieldset>}
            <strong>{draft.days.length} days / {draft.days.length - 1} nights · Total INR {(draft.pricePerPerson * draft.travellers).toLocaleString('en-IN')} · {100 - draft.advancePercent}% after the trip</strong>
          </section>
          <section className="itinerary-editor-section" id="itinerary-days"><h2>Day-by-day journey</h2><p>Choose Travel to visit another place, or Leisure to stay where the previous night ended. Shiv Khori is a day trip returning to the starting location. Jammu, Katra, Patnitop and Shiv Khori use illustrative Kashmir journey photos.</p>
            {draft.days.map((day, index) => <fieldset key={day.id} className="itinerary-day-editor"><legend>Day {index + 1}</legend>
              <label>Day {index + 1} type<select value={day.dayType} disabled={index === draft.days.length - 1} onChange={event => changeDay(index, { dayType: event.target.value === 'Leisure' ? 'Leisure' : 'Travel' })}><option>Travel</option><option>Leisure</option></select></label>
              <p>{index === draft.days.length - 1 ? 'Departure day · travel to your departure point.' : `Starts in ${dayStart(draft, index)}${day.dayType === 'Leisure' ? ' · no outstation travel' : ''}`}</p>
              {itineraryRouteLegs(dayStart(draft, index), day.destination, day.overnight, day.dayType).map(leg =>
                <p key={`${leg.from}-${leg.to}`}>{formatItineraryRouteLeg(leg)}. Estimates vary with route, traffic and weather; excludes sightseeing and stops.</p>)}
              <div className="itinerary-fields">
                {index === 0 && <label>Arrival location<select value={draft.arrivalLocation} onChange={event => {
                  const location = event.target.value === 'Jammu' ? 'Jammu' : event.target.value === 'Katra' ? 'Katra' : 'Srinagar'
                  edit(changeArrivalPlan(draft, location, day.dayType === 'Travel' ? day.destination : undefined))
                }}><option>Srinagar</option><option>Jammu</option><option>Katra</option></select></label>}
                <label>{index === draft.days.length - 1 ? 'Departure location' : `Day ${index + 1} destination`}<select value={day.destination} disabled={day.dayType === 'Leisure'} onChange={event => changeDay(index, { destination: event.target.value, overnight: index === draft.days.length - 1 ? '' : event.target.value, overnightType: 'Hotel' })}>{(index === draft.days.length - 1 ? ['Srinagar', 'Jammu'] : [...destinations.map(place => place.name), 'Jammu', 'Katra', 'Patnitop', 'Shiv Khori']).map(name => <option key={name}>{name}</option>)}</select></label>
                <label>Day {index + 1} overnight<select value={day.overnight} disabled={index === draft.days.length - 1 || day.dayType === 'Leisure'} onChange={event => changeDay(index, { overnight: event.target.value })}>{index === draft.days.length - 1 && <option value="">No overnight stay</option>}{overnightOptions(draft, index).map(name => <option key={name}>{name}</option>)}</select></label>
                {index < draft.days.length - 1 && <label>Day {index + 1} stay type<select value={day.overnightType} onChange={event => changeDay(index, { overnightType: event.target.value === 'Houseboat' ? 'Houseboat' : 'Hotel' })}><option>Hotel</option>{day.overnight === 'Srinagar' && <option>Houseboat</option>}</select></label>}
                <label>Day {index + 1} title<input value={day.title} maxLength={160} onChange={event => changeDay(index, { title: event.target.value })} /></label>
                <label>Day {index + 1} photo<select value={day.image} onChange={event => changeDay(index, { image: event.target.value })}>{[...new Set([day.image, ...destinationImages(day.destination)])].map((image, i) => <option key={image} value={image}>Website photo {i + 1}</option>)}</select></label>
              </div>
              <img src={day.image} alt={`${day.destination} itinerary illustration`} className="itinerary-photo-thumb" />
              <p>Choose from all available destination photos and the Kashmir scenery gallery (at least eight options). Gallery scenery is illustrative, not a photograph of every stop.</p>
              <label>Day {index + 1} description<textarea value={day.detail} maxLength={800} onChange={event => changeDay(index, { detail: event.target.value })} /></label>
              <label>Day {index + 1} sightseeing (one per line, up to 5)<textarea value={day.bullets.join('\n')} onChange={event => changeDay(index, { bullets: event.target.value.split('\n').slice(0, 5) })} /></label>
              <div className="itinerary-inline-actions">
                <button type="button" className="button button-outline" aria-label={`Move day ${index + 1} up`} disabled={index <= 1 || index === draft.days.length - 1} onClick={() => moveDay(index, -1)}><ArrowUp size={16} /></button>
                <button type="button" className="button button-outline" aria-label={`Move day ${index + 1} down`} disabled={index === 0 || index >= draft.days.length - 2} onClick={() => moveDay(index, 1)}><ArrowDown size={16} /></button>
                <button type="button" className="button button-outline" disabled={draft.days.length <= 2 || index === 0 || index === draft.days.length - 1} onClick={() => {
                  const next = { ...draft, days: draft.days.filter((_, i) => i !== index) }
                  edit(synchronizeItinerary(resizeItinerary(next, next.days.length), draft))
                }}><Trash2 size={16} /> Remove day {index + 1}</button>
              </div>
            </fieldset>)}
          </section>
          <section className="itinerary-editor-section"><h2>Hotel stays</h2><p>Hotel and houseboat fields follow each night's stay type above. Use the package category by default, enter a property name, or choose up to three website properties. Named stays remain subject to availability.</p>
            {!loaded && <p role="status">Loading website hotels...</p>}
            {itineraryStays(draft).map(stay => {
              const eligible = eligibleStayHotels(draft, hotels, stay.location, stay.propertyType)
              const selected = selectedStayHotels(draft, hotels, stay.location, stay.propertyType)
              const naming = draft.hotelNames[stay.key] ?? { useCategory: true, name: '' }
              return <fieldset key={stay.key} className="itinerary-day-editor"><legend>{stay.key} · {stay.nights} {stay.nights === 1 ? 'night' : 'nights'}</legend>
                <label className="itinerary-checkbox"><input type="checkbox" checked={naming.useCategory} onChange={event => edit({ ...draft, hotelNames: { ...draft.hotelNames, [stay.key]: { ...naming, useCategory: event.target.checked } } })} />{stay.key}: use package category by default</label>
                <strong>{stayDisplayName(draft, stay.location, stay.propertyType)}</strong>
                <label>{stay.location} {stay.propertyType.toLowerCase()} name (optional)<input maxLength={120} value={naming.name} onChange={event => edit({ ...draft, hotelNames: { ...draft.hotelNames, [stay.key]: { useCategory: !event.target.value.trim(), name: event.target.value } } })} placeholder={stayDisplayName({ ...draft, hotelNames: {} }, stay.location, stay.propertyType)} /></label>
                <p>{naming.useCategory ? 'The PDF shows the package category. Choose website hotels below to include their photographs as examples.' : naming.name.trim() ? 'The PDF shows this name instead of unrelated website hotel photos.' : 'Selected website hotel photographs appear in the PDF; overnight stays show the package category.'}</p>
                {selected.length > 0 && <p>{selected.length} website {selected.length === 1 ? 'hotel photograph' : 'hotel photographs'} included in the PDF.</p>}
                <details><summary>Choose from website {stay.propertyType === 'Houseboat' ? 'houseboats' : 'hotels'}</summary>
                {!eligible.length && <p>No matching website hotels yet. The PDF uses the package category or your optional hotel name.</p>}
                {eligible.map(hotel => {
                  const checked = selected.some(value => value.id === hotel.id)
                  return <div key={hotel.id} className="itinerary-hotel-option">
                    <label className="itinerary-checkbox"><input type="checkbox" checked={checked} disabled={!checked && selected.length >= 3} onChange={() => edit({ ...draft, hotelNames: { ...draft.hotelNames, [stay.key]: { useCategory: false, name: '' } }, hotelChoices: { ...draft.hotelChoices, [stay.key]: checked ? selected.filter(value => value.id !== hotel.id).map(value => value.id) : [...selected.map(value => value.id), hotel.id] } })} />{hotel.name} · {hotel.category}</label>
                    {checked && <><img className="itinerary-photo-thumb" src={draft.hotelPhotos[hotel.id] ?? hotel.image} alt={`${hotel.name} selected photograph`} /><label>{hotel.name} photograph<select value={draft.hotelPhotos[hotel.id] ?? hotel.image} onChange={event => edit({ ...draft, hotelPhotos: { ...draft.hotelPhotos, [hotel.id]: event.target.value } })}>{hotel.gallery.map((photo, i) => <option key={photo} value={photo}>Photo {i + 1}</option>)}</select></label></>}
                  </div>
                })}</details>
              </fieldset>
            })}
            <button type="button" className="button button-outline" onClick={() => { setLoaded(false); setRevision(value => value + 1) }}><RefreshCw size={16} /> Refresh website hotels</button>
          </section>
          <section className="itinerary-editor-section"><h2>Inclusions & exclusions</h2>
            <p>Checked = included. Unchecked = excluded. Edit any item's wording or add your own.</p>
            <details className="itinerary-package-checklist">
              <summary>Choose package inclusions & exclusions ({packageDetails.inclusions.length} included / {packageDetails.exclusions.length} excluded)</summary>
              <div className="itinerary-package-items">{draft.packageItems.map((item, index) => <div key={item.id} className="itinerary-package-item">
                <label className="itinerary-checkbox"><input type="checkbox" checked={item.included} onChange={event => edit({ ...draft, packageItems: draft.packageItems.map(value => value.id === item.id ? { ...value, included: event.target.checked } : value) })} />{item.label || `Item ${index + 1}`}</label>
                <label className="sr-only" htmlFor={`package-item-${item.id}`}>Edit item {index + 1} wording</label>
                <input id={`package-item-${item.id}`} maxLength={160} value={item.label} onChange={event => edit({ ...draft, packageItems: draft.packageItems.map(value => value.id === item.id ? { ...value, label: event.target.value } : value) })} />
                <span>{item.included ? 'Included' : 'Excluded'}</span>
                <button type="button" className="button button-outline" aria-label={`Remove item ${index + 1}`} disabled={draft.packageItems.length <= 1} onClick={() => edit({ ...draft, packageItems: draft.packageItems.filter(value => value.id !== item.id) })}><Trash2 size={16} /></button>
              </div>)}</div>
              <button type="button" className="button button-outline" disabled={draft.packageItems.length >= 40} onClick={() => edit({ ...draft, packageItems: [...draft.packageItems, { id: crypto.randomUUID(), label: 'Custom package item', included: false }] })}><Plus size={16} /> Add package item</button>
            </details>
            <button type="button" className="button button-outline" onClick={() => edit({ ...draft, days: draft.days.map(day => ({ ...day, bullets: textLines(day.bullets.join('\n')) })) })}>Remove blank sightseeing lines</button>
          </section>
          <section className="itinerary-editor-section"><h2>Before you travel</h2>{draft.tips.map((tip, index) => <div key={index} className="itinerary-day-editor"><label>Tip {index + 1} heading<input value={tip.title} maxLength={160} onChange={event => edit({ ...draft, tips: draft.tips.map((value, i) => i === index ? { ...value, title: event.target.value } : value) })} /></label><label>Tip {index + 1} advice<textarea value={tip.detail} maxLength={250} onChange={event => edit({ ...draft, tips: draft.tips.map((value, i) => i === index ? { ...value, detail: event.target.value } : value) })} /></label><button type="button" className="button button-outline" onClick={() => edit({ ...draft, tips: draft.tips.filter((_, i) => i !== index) })}>Remove tip</button></div>)}
            <button type="button" className="button button-outline" disabled={draft.tips.length >= 8} onClick={() => edit({ ...draft, tips: [...draft.tips, { title: 'Travel tip', detail: 'Add your advice here.' }] })}>Add travel tip</button>
            <h3>Terms and conditions</h3>
            <p>These terms are included in every itinerary PDF, even if all travel tips are removed.</p>
            {itineraryTerms.map(term => <div key={term.title}><strong>{term.title}</strong><p>{term.detail}</p></div>)}
          </section>
        </fieldset>
        <aside className="itinerary-builder-preview" id="itinerary-preview" aria-label="PDF preview">
          <h2>Live PDF preview</h2>
          <p>Same forest-green and gold design. Pages expand automatically for longer journeys and more hotel destinations.</p>
          {validationError && <p className="enquiry-error" role="alert">{validationError}</p>}
          {previewError && <p className="enquiry-error" role="alert">{previewError} <button type="button" onClick={() => setRevision(value => value + 1)}>Retry preview</button></p>}
          {(!previewCurrent || rendering) && !validationError && !previewError && <p role="status">{loaded ? 'Updating PDF preview...' : 'Waiting for hotel data...'}</p>}
          {previewCurrent && preview && <>
            <a className="button button-dark" href={preview.url} download={itineraryPdfFilename(draft.guestName)} onClick={() => setDownloadedFingerprint(fingerprint)}><Download size={16} /> Download itinerary PDF</a>
            <button type="button" className="button button-outline" disabled={sharing} onClick={shareItinerary}><Share2 size={16} /> {sharing ? 'Sharing...' : 'Share itinerary PDF'}</button>
            {!canSharePdf(preview.file) && <p>This browser has no PDF share menu. Open this page in a supported mobile browser to share without downloading. Tap Share for details.</p>}
            {shareError && <p className="enquiry-error" role="alert">{shareError}</p>}
            <a className="text-link" href={preview.url} target="_blank" rel="noreferrer">Open full-size PDF</a>
            <iframe src={preview.url} title="Itinerary PDF preview" />
          </>}
        </aside>
      </div>
    </>}
  </section>
}
