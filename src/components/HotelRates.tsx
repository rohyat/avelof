import { useState } from 'react'
import { Check, X } from 'lucide-react'
import type { Hotel } from '../types'
import { hotelExtraBedPrice, hotelExtraBedTotal, hotelMealPrices, hotelNightlyPrice, selectedHotelRoom } from '../services/hotelService'
import { hotelRoomOccupancy, hotelRoomRateBasis, minimumHotelRooms } from '../data/hotelRegistration'
import NumberStepper from './NumberStepper'
import RegularPrice from './RegularPrice'
import { hotelPackagePriceInclusions } from '../services/pricing'
import { hotelRoomPriceForDate, hotelSeasonNotice } from '../services/hotelPricing'

export default function HotelRates({ hotel, meals, roomType, date, showRooms = false, compact = false, showInclusions = false, showSeasonNotice = true, onChange, people, rooms, onRoomsChange }: { hotel: Hotel; meals?: { breakfast: boolean; dinner: boolean; extraBed?: boolean }; roomType?: string; date?: string; showRooms?: boolean; compact?: boolean; showInclusions?: boolean; showSeasonNotice?: boolean; onChange?: (breakfast: boolean, dinner: boolean, price: number, roomType?: string, extraBed?: boolean) => void; people?: number; rooms?: string; onRoomsChange?: (value: string) => void }) {
  const [localBreakfast, setBreakfast] = useState(false)
  const [localDinner, setDinner] = useState(false)
  const [localExtraBed, setExtraBed] = useState(false)
  const [localRoom, setRoom] = useState('')
  const selectedRoom = selectedHotelRoom(hotel, showRooms ? roomType ?? localRoom : undefined)
  const breakfast = meals?.breakfast ?? localBreakfast
  const dinner = meals?.dinner ?? localDinner
  const extraBedPrice = hotelExtraBedPrice(hotel)
  const extraBed = extraBedPrice > 0 && (meals ? Boolean(meals.extraBed) : localExtraBed)
  const { breakfast: breakfastPrice, dinner: dinnerPrice } = hotelMealPrices(hotel, selectedRoom?.roomType)
  const rateBasis = hotel.registeredHotelId || selectedRoom ? hotelRoomRateBasis(selectedRoom?.roomType) : hotel.rateBasis ?? 'per night'
  const price = hotelNightlyPrice(hotel, breakfast, dinner, selectedRoom?.roomType, date, extraBed)
  const originalPrice = selectedRoom?.originalPrice ?? hotel.originalPrice
  const regularPrice = <RegularPrice price={hotelRoomPriceForDate(selectedRoom?.price ?? hotel.roomOnlyPrice ?? hotel.price, date)} originalPrice={originalPrice === undefined ? undefined : hotelRoomPriceForDate(originalPrice, date)} discountPercent={hotel.discountPercent} />
  const seasonalNote = showSeasonNotice && <small className="hotel-season-note">{date ? `Night of ${date}. ` : ''}{compact ? 'Rooms +10% from 6 Dec 2026. Meals unchanged.' : hotelSeasonNotice}</small>
  const acStatus = <span className="hotel-ac-status" role="img" aria-label={`Hot & cold AC ${hotel.hotColdAc ? 'available' : 'not available'}`}>
    {hotel.hotColdAc ? <Check size={15} aria-hidden="true" /> : <X size={15} aria-hidden="true" />}
    <span>Hot &amp; cold AC</span>
  </span>
  const minimum = minimumHotelRooms(people ?? 2, selectedRoom?.roomType)
  const roomQuantity = rooms === undefined ? minimum : Number(rooms)
  const mealPeople = hotelRoomOccupancy(selectedRoom?.roomType)
  const validRooms = Number.isInteger(roomQuantity) && roomQuantity >= minimum && roomQuantity <= 100
  const roomControls = onRoomsChange && <><NumberStepper label="Number of rooms" name="roomCount" min={minimum} max={100} value={rooms ?? minimum} onChange={onRoomsChange} /><small>Availability on confirmation.</small>{validRooms && <strong className="hotel-rooms-total">Rooms total: ₹{(Math.round(price * roomQuantity * 100) / 100).toLocaleString('en-IN')} per night</strong>}</>

  function updateMeals(nextBreakfast: boolean, nextDinner: boolean, nextExtraBed = extraBed) {
    setBreakfast(nextBreakfast)
    setDinner(nextDinner)
    setExtraBed(nextExtraBed)
    onChange?.(nextBreakfast, nextDinner, hotelNightlyPrice(hotel, nextBreakfast, nextDinner, selectedRoom?.roomType, date, nextExtraBed), selectedRoom?.roomType, nextExtraBed)
  }
  const extraBedOption = extraBedPrice > 0 && <fieldset className="hotel-meal-options hotel-extra-bed">
    <legend>Extra bed</legend>
    <label><input type="checkbox" checked={extraBed} onChange={(event) => updateMeals(breakfast, dinner, event.target.checked)} /> Add one extra bed per room <span>+₹{hotelExtraBedTotal(hotel, breakfast, dinner).toLocaleString('en-IN')}</span></label>
    {extraBed && <p className="hotel-meal-coverage" role="status">Extra bed requested in each room{onRoomsChange && validRooms ? ` (${roomQuantity} ${roomQuantity === 1 ? 'bed' : 'beds'})` : ''}, subject to availability. {breakfast || dinner ? `Includes ${breakfast && dinner ? 'breakfast and dinner' : breakfast ? 'breakfast' : 'dinner'} for 1 extra person per room per day.` : 'Without meals.'}</p>}
  </fieldset>

  if (compact) return <div className="hotel-rates hotel-rates-compact">
    {selectedRoom && <span className="hotel-rate-from">{selectedRoom.roomType} room</span>}
    {regularPrice}
    <div className="hotel-compact-price"><strong>₹{price.toLocaleString('en-IN')}</strong><div><span className="hotel-rate-basis">{rateBasis}</span><span className="hotel-meal-summary">{hotel.breakfastPrice === undefined ? hotel.mealPlan : 'Room only · Meals optional'}</span></div></div>
    {seasonalNote}
    {showInclusions && <small className="price-inclusions">{hotelPackagePriceInclusions}</small>}
    {acStatus}
  </div>

  if (hotel.registeredHotelId && hotel.breakfastPrice === undefined && !hotel.roomRates) return <div className="hotel-rates">
    <span className="hotel-rate-basis">{rateBasis}</span>
    {regularPrice}
    <div><strong>₹{price.toLocaleString('en-IN')}</strong><span>{hotel.mealPlan}</span></div>
    {acStatus}
    {seasonalNote}
    {extraBedOption}
    {roomControls}
  </div>

  return <div className="hotel-rates">
    {hotel.roomRates && (showRooms ? <label className="hotel-room-select">Room type<select aria-label="Room type" value={selectedRoom?.roomType} onChange={(event) => {
      setRoom(event.target.value)
      onChange?.(breakfast, dinner, hotelNightlyPrice(hotel, breakfast, dinner, event.target.value, date, extraBed), event.target.value, extraBed)
    }}>{hotel.roomRates.map((room) => <option key={room.roomType} value={room.roomType}>{room.roomType}</option>)}</select></label> : <span className="hotel-rate-from">From · lowest available room rate</span>)}
    <span className="hotel-rate-basis">{rateBasis}</span>
    {regularPrice}
    <div><strong role="status">₹{price.toLocaleString('en-IN')}</strong></div>
    <span>{hotel.registeredHotelId && hotel.breakfastPrice === undefined ? hotel.mealPlan : breakfast && dinner ? 'Breakfast and dinner included' : breakfast ? 'Breakfast included; dinner excluded' : dinner ? 'Dinner included; breakfast excluded' : 'Without breakfast and dinner'}</span>
    {acStatus}
    {seasonalNote}
    {hotel.roomOnlyPrice !== undefined && <fieldset className="hotel-meal-options">
      <legend>Meals</legend>
      <label><input type="checkbox" checked={breakfast} onChange={(event) => updateMeals(event.target.checked, dinner)} /> Breakfast for {mealPeople} people per room <span>+₹{breakfastPrice.toLocaleString('en-IN')}</span></label>
      <label><input type="checkbox" checked={dinner} onChange={(event) => updateMeals(breakfast, event.target.checked)} /> Dinner for {mealPeople} people per room <span>+₹{dinnerPrice.toLocaleString('en-IN')}</span></label>
      {(breakfast || dinner) && <p className="hotel-meal-coverage" role="status">Selected {breakfast && dinner ? 'breakfast and dinner' : breakfast ? 'breakfast' : 'dinner'} for {mealPeople} people per room per day{onRoomsChange && validRooms ? `; ${roomQuantity} rooms cover ${mealPeople * roomQuantity} people` : ''}.</p>}
    </fieldset>}
    {extraBedOption}
    {roomControls}
  </div>
}