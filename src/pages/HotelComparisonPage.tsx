import { useState } from 'react'
import type { ReactNode } from 'react'
import { BedDouble, ChevronDown } from 'lucide-react'
import { Link, useLocation, useOutletContext, useSearchParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import HotelFeature from '../components/HotelFeature'
import { hotelCategoryLabel, hotelLocationLabel, hotelRoomRateBasis, propertyTypeOf } from '../data/hotelRegistration'
import { regionBasePath, regionFromPath } from '../data/regions'
import type { Region } from '../data/regions'
import { hotelExtraBedPrice, hotelNightlyPrice, hotelSelectionValue, selectedHotelRoom, useRegisteredHotels } from '../services/hotelService'
import { hotelPackagePriceInclusions } from '../services/pricing'
import type { SiteContext } from '../components/SiteLayout'
import type { Hotel } from '../types'

const money = (price: number) => `₹${price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

function ComparisonPhotos({ hotel }: { hotel: Hotel }) {
  const [selected, setSelected] = useState(0)
  const photos = hotel.gallery.length ? hotel.gallery : [hotel.image]
  return <div className="hotel-compare-photos">
    <img className="hotel-compare-main-photo" src={photos[selected]} alt={`${hotel.name}, property-provided photo ${selected + 1}`} />
    <div className="hotel-compare-thumbnails" role="group" aria-label={`${hotel.name} photos`}>{photos.map((photo, index) => <button key={`${photo}-${index}`} type="button" aria-label={`Show ${hotel.name} photo ${index + 1}`} aria-pressed={selected === index} onClick={() => setSelected(index)}><img src={photo} alt="" loading="lazy" /></button>)}</div>
  </div>
}

function HotelSelector({ side, hotels, value, other, disabled = false, onChange }: { side: string; hotels: Hotel[]; value: string; other: string; disabled?: boolean; onChange: (id: string) => void }) {
  const selected = hotels.find((hotel) => hotel.id === value)
  const options = hotels.filter((hotel) => hotel.id !== other).sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base', numeric: true }) || a.id.localeCompare(b.id))
  return <div className="hotel-compare-selector">
    <div className="hotel-selector-title"><span aria-hidden="true">{side === 'first' ? '01' : '02'}</span><strong>{side === 'first' ? 'Your first stay' : 'Compare with'}</strong></div>
    <label>{side === 'first' ? 'First' : 'Second'} hotel<span className={`hotel-selector-dropdown${disabled ? ' is-disabled' : ''}`}><select title={selected?.name} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      <option value="">{disabled ? other ? 'No other hotels' : 'Select first hotel' : 'Select a hotel'}</option>
      {value && !selected && <option value={value} disabled>Selected property unavailable</option>}
      {options.map((hotel) => <option key={hotel.id} value={hotel.id}>{hotel.name} — {hotelLocationLabel(hotel)}</option>)}
    </select><ChevronDown size={18} aria-hidden="true" /></span></label>
    <p className="hotel-selector-feedback" role="status">{disabled ? other ? 'No other stays in this location.' : 'Select your first stay to begin.' : `${options.length} ${options.length === 1 ? 'stay' : 'stays'} to choose from.`}</p>
    <div className={`hotel-selector-preview${selected ? ' is-selected' : ''}`}>
      {selected ? <><img src={selected.image} alt="" /><div><strong>{selected.name}</strong><span>{hotelLocationLabel(selected)}</span></div></> : <><BedDouble size={22} aria-hidden="true" /><span>No hotel selected yet</span></>}
    </div>
  </div>
}

export default function HotelComparisonPage() {
  const region = regionFromPath(useLocation().pathname)
  const [params] = useSearchParams()
  return <section className="section page-width hotel-comparison-page">
    <div className="breadcrumb"><BackButton /><Link to={`${regionBasePath(region)}/hotels`}>Hotels</Link><span>/</span><span>Compare</span></div>
    <h1>Compare hotels</h1>
    <HotelComparison key={`${region}:${params}`} region={region} initialLeft={params.get('left') ?? ''} initialRight={params.get('right') ?? ''} />
  </section>
}

export function HotelComparison({ region, initialLeft = '', initialRight = '', onClose }: { region: Region; initialLeft?: string; initialRight?: string; onClose?: () => void }) {
  const directory = `${regionBasePath(region)}/hotels`
  const { hotels, loading, error, reload } = useRegisteredHotels(true, undefined, region)
  const { openBooking } = useOutletContext<SiteContext>()
  const [ids, setIds] = useState([initialLeft, initialRight === initialLeft ? '' : initialRight])
  const first = hotels.find((hotel) => hotel.id === ids[0])
  const sameLocation = (left: Hotel, right: Hotel) => left.location.trim().toLocaleLowerCase() === right.location.trim().toLocaleLowerCase()
  const alternatives = first ? hotels.filter((hotel) => hotel.id !== first.id && sameLocation(first, hotel)) : []
  const second = alternatives.find((hotel) => hotel.id === ids[1])
  const selected = [first, second]
  const update = (index: number, value: string) => setIds((current) => {
    if (index === 1) return [current[0], value]
    const nextFirst = hotels.find((hotel) => hotel.id === value)
    const currentSecond = hotels.find((hotel) => hotel.id === current[1])
    return [value, nextFirst && currentSecond && nextFirst.id !== currentSecond.id && sameLocation(nextFirst, currentSecond) ? current[1] : '']
  })
  const rows: { label: string; render: (hotel: Hotel) => ReactNode }[] = [
    { label: 'Photos', render: (hotel) => <ComparisonPhotos key={hotel.id} hotel={hotel} /> },
    { label: 'Location & category', render: (hotel) => <><p>{hotelLocationLabel(hotel)}</p><p>{propertyTypeOf(hotel)} · {hotelCategoryLabel(hotel.category)}</p></> },
    { label: 'Starting room rate', render: (hotel) => <><strong className="comparison-price">{money(hotelNightlyPrice(hotel, false, false))}</strong><p>{hotelRoomRateBasis(selectedHotelRoom(hotel)?.roomType)}</p><small>{hotel.breakfastPrice === undefined ? hotel.mealPlan : 'Room only · Meals optional'}</small><small>{hotelPackagePriceInclusions}</small></> },
    { label: 'Room types & rates', render: (hotel) => hotel.roomRates?.length ? <ul>{hotel.roomRates.map((room) => <li key={room.roomType}><strong>{room.roomType}: {money(room.price)}</strong><br />{hotelRoomRateBasis(room.roomType)}</li>)}</ul> : <ul>{hotel.roomTypes.map((room) => <li key={room}>{room}</li>)}</ul> },
    { label: 'Meals', render: (hotel) => {
      if (hotel.breakfastPrice === undefined) return <p>{hotel.mealPlan ?? 'Ask about meal options'}</p>
      return <><p>Breakfast: {money(hotel.breakfastPrice)}</p><p>Dinner: {hotel.dinnerPrice === undefined ? 'Ask about dinner' : money(hotel.dinnerPrice)}</p><small>For 2 people per room/night. Family rooms cover 4 people at twice these meal charges.</small></>
    } },
    { label: 'Extra bed', render: (hotel) => hotelExtraBedPrice(hotel) > 0 ? <><p>{money(hotelExtraBedPrice(hotel))} per room/night without meals.</p><small>Selected breakfast or dinner adds meals for one extra guest. Subject to availability.</small></> : <p>Not offered</p> },
    { label: 'Amenities', render: (hotel) => hotel.facilities.length ? <ul>{hotel.facilities.map((facility) => <li key={facility}><HotelFeature label={facility} /></li>)}</ul> : <p>Not listed</p> },
    { label: 'Highlights', render: (hotel) => hotel.highlights.length ? <ul>{hotel.highlights.map((highlight) => <li key={highlight}><HotelFeature label={highlight} /></li>)}</ul> : <p>Not listed</p> },
    { label: 'Check-in & check-out', render: (hotel) => <><p>Check-in: {hotel.checkIn}</p><p>Check-out: {hotel.checkOut}</p></> },
    { label: 'Explore or enquire', render: (hotel) => <div className="hotel-compare-actions"><Link className="button button-outline" to={`${directory}/${hotel.id}`} onClick={onClose}>View details</Link><button type="button" className="button button-dark" onClick={() => { onClose?.(); openBooking('hotel', hotelSelectionValue(hotel)) }}>Book Now</button></div> },
  ]
  return <div className="hotel-comparison-content">
    {loading && <p role="status">Loading hotels to compare...</p>}
    {error && <p className="enquiry-error" role="alert">{error} <button type="button" className="text-link" onClick={reload}>Retry loading hotels</button></p>}
    {!loading && !error && <>
      {!hotels.length ? <div className="empty-state"><h2>No approved properties to compare yet</h2><Link to={directory}>Back to hotels</Link></div> : <>
        {hotels.length === 1 && <p role="status">Only one property is currently listed. A second property is needed for comparison.</p>}
        {ids.some((id) => id && !hotels.some((hotel) => hotel.id === id)) && <p className="enquiry-error" role="alert">A selected property is no longer available. Choose another property below.</p>}
        {ids[0] && ids[0] === ids[1] && <p className="enquiry-error" role="alert">Choose two different properties to compare.</p>}
        <div className="hotel-compare-columns hotel-compare-selectors"><HotelSelector side="first" hotels={hotels} value={ids[0]} other={second?.id ?? ''} onChange={(id) => update(0, id)} /><HotelSelector key={first?.location.trim().toLocaleLowerCase() ?? ''} side="second" hotels={alternatives} value={second?.id ?? ''} other={ids[0]} disabled={!first || !alternatives.length} onChange={(id) => update(1, id)} /></div>
        {first && <p className="privacy-note" role="status">{alternatives.length ? `Compare with another property in ${first.location}.` : `No other properties in ${first.location} are currently available to compare.`}</p>}
        <div className="hotel-compare-columns hotel-compare-names">{selected.map((hotel, index) => <h2 key={index}>{hotel?.name ?? `Choose the ${index === 0 ? 'first' : 'second'} property`}</h2>)}</div>
        {rows.map((row) => <section key={row.label} className="hotel-compare-row" aria-label={row.label}><h2>{row.label}</h2><div className="hotel-compare-columns">{selected.map((hotel, index) => <div className="hotel-compare-cell" key={index} aria-label={`${hotel?.name ?? (index === 0 ? 'First property' : 'Second property')}: ${row.label}`}>{hotel ? row.render(hotel) : <p>Select a property above.</p>}</div>)}</div></section>)}
      </>}
    </>}
  </div>
}
