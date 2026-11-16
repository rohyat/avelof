import { useState } from 'react'
import type { Hotel } from '../types'
import OfferPrice from './OfferPrice'
import { hotelMealPrices, hotelNightlyPrice, hotelPriceBreakdown, hotelTaxStatus, selectedHotelRoom } from '../services/hotelService'
import { hotelRoomOccupancy, hotelRoomRateBasis, minimumHotelRooms } from '../data/hotelRegistration'
import NumberStepper from './NumberStepper'
import DiscountLabel from './DiscountLabel'

export default function HotelRates({ hotel, meals, roomType, showRooms = false, compact = false, onChange, people, rooms, onRoomsChange }: { hotel: Hotel; meals?: { breakfast: boolean; dinner: boolean }; roomType?: string; showRooms?: boolean; compact?: boolean; onChange?: (breakfast: boolean, dinner: boolean, price: number, roomType?: string) => void; people?: number; rooms?: string; onRoomsChange?: (value: string) => void }) {
  const [localBreakfast, setBreakfast] = useState(false)
  const [localDinner, setDinner] = useState(false)
  const [localRoom, setRoom] = useState('')
  const selectedRoom = selectedHotelRoom(hotel, showRooms ? roomType ?? localRoom : undefined)
  const breakfast = meals?.breakfast ?? localBreakfast
  const dinner = meals?.dinner ?? localDinner
  const { breakfast: breakfastPrice, dinner: dinnerPrice } = hotelMealPrices(hotel, selectedRoom?.roomType)
  const rateBasis = hotel.registeredHotelId || selectedRoom ? hotelRoomRateBasis(selectedRoom?.roomType) : hotel.rateBasis ?? 'per night'
  const breakdown = hotelPriceBreakdown(hotel, breakfast, dinner, selectedRoom?.roomType)
  const price = breakdown.total
  const originalPrice = selectedRoom?.originalPrice ?? hotel.originalPrice
  const roomPrice = breakdown.room
  const comparison = originalPrice !== undefined && originalPrice > roomPrice
    ? <span className="original-price hotel-discount-price">Regular room rate before GST <s aria-label={`Regular room rate INR ${originalPrice.toLocaleString('en-IN')}`}>INR {originalPrice.toLocaleString('en-IN')}</s><DiscountLabel price={roomPrice} originalPrice={originalPrice} /></span> : null
  const minimum = minimumHotelRooms(people ?? 2, selectedRoom?.roomType)
  const roomQuantity = rooms === undefined ? minimum : Number(rooms)
  const mealPeople = hotelRoomOccupancy(selectedRoom?.roomType)
  const validRooms = Number.isInteger(roomQuantity) && roomQuantity >= minimum && roomQuantity <= 100
  const taxNote = <span className="hotel-tax-status">{hotelTaxStatus(hotel)}</span>
  const gstLine = breakdown.gst === null ? null : <span className="hotel-gst-line">GST ({hotel.gstPercent}%): INR {breakdown.gst.toLocaleString('en-IN')}</span>
  const roomControls = onRoomsChange && <><NumberStepper label="Number of rooms" name="roomCount" min={minimum} max={100} value={rooms ?? minimum} onChange={onRoomsChange} /><small>Minimum {minimum} for {people ?? 2} people, including children. Availability on confirmation.</small>{validRooms && <strong className="hotel-rooms-total">Rooms {breakdown.gst === null ? 'subtotal before GST' : 'total including GST'}: INR {(Math.round(price * roomQuantity * 100) / 100).toLocaleString('en-IN')} per night</strong>}</>

  function updateMeals(nextBreakfast: boolean, nextDinner: boolean) {
    setBreakfast(nextBreakfast)
    setDinner(nextDinner)
    onChange?.(nextBreakfast, nextDinner, hotelNightlyPrice(hotel, nextBreakfast, nextDinner, selectedRoom?.roomType), selectedRoom?.roomType)
  }

  if (compact) return <div className="hotel-rates hotel-rates-compact">
    {selectedRoom && <span className="hotel-rate-from">{selectedRoom.roomType} room</span>}
    {comparison}
    <strong>INR {price.toLocaleString('en-IN')}</strong>
    <span className="hotel-rate-basis">{breakdown.gst === null ? 'Subtotal before GST · ' : ''}{rateBasis}</span>
    <span className="hotel-meal-summary">{hotel.breakfastPrice === undefined ? hotel.mealPlan : 'Room only · Meals optional'}</span>
    {breakdown.gst === null ? taxNote : <span className="hotel-gst-line">GST ({hotel.gstPercent}%): INR {breakdown.gst.toLocaleString('en-IN')} included in total</span>}
  </div>

  if (hotel.registeredHotelId && hotel.breakfastPrice === undefined && !hotel.roomRates) return <div className="hotel-rates">
    <span className="hotel-rate-basis">{rateBasis}</span>
    {comparison}
    <div><strong>INR {price.toLocaleString('en-IN')}</strong><span>{breakdown.gst === null ? 'Subtotal before GST' : 'Total including GST'} · {hotel.mealPlan}</span></div>
    {gstLine}
    {taxNote}
    {roomControls}
  </div>

  return <div className="hotel-rates">
    {hotel.roomRates && (showRooms ? <label className="hotel-room-select">Room type<select aria-label="Room type" value={selectedRoom?.roomType} onChange={(event) => {
      setRoom(event.target.value)
      onChange?.(breakfast, dinner, hotelNightlyPrice(hotel, breakfast, dinner, event.target.value), event.target.value)
    }}>{hotel.roomRates.map((room) => <option key={room.roomType} value={room.roomType}>{room.roomType}</option>)}</select></label> : <span className="hotel-rate-from">From · lowest available room rate</span>)}
    <span className="hotel-rate-basis">{rateBasis}</span>
    {comparison}
    {!hotel.registeredHotelId && <OfferPrice price={price} />}
    <div><strong role="status">{hotel.registeredHotelId ? 'INR ' : '₹'}{price.toLocaleString('en-IN')}</strong><span>{breakdown.gst === null ? 'Subtotal before GST' : 'Total including GST'}</span></div>
    <span>{hotel.registeredHotelId && hotel.breakfastPrice === undefined ? hotel.mealPlan : breakfast && dinner ? 'Breakfast and dinner included' : breakfast ? 'Breakfast included; dinner excluded' : dinner ? 'Dinner included; breakfast excluded' : 'Without breakfast and dinner'}</span>
    <div className="hotel-tax-breakdown">
      <span>Room after discount, before GST: INR {breakdown.room.toLocaleString('en-IN')}</span>
      {(breakfast || dinner) && <span>Selected meals before GST: INR {breakdown.meals.toLocaleString('en-IN')}</span>}
      {gstLine}
      {taxNote}
    </div>
    {hotel.roomOnlyPrice !== undefined && <fieldset className="hotel-meal-options">
      <legend>Meals</legend>
      <label><input type="checkbox" checked={breakfast} onChange={(event) => updateMeals(event.target.checked, dinner)} /> Breakfast for {mealPeople} people per room <span>+INR {breakfastPrice.toLocaleString('en-IN')} before GST</span></label>
      <label><input type="checkbox" checked={dinner} onChange={(event) => updateMeals(breakfast, event.target.checked)} /> Dinner for {mealPeople} people per room <span>+INR {dinnerPrice.toLocaleString('en-IN')} before GST</span></label>
      {(breakfast || dinner) && <p className="hotel-meal-coverage" role="status">Selected {breakfast && dinner ? 'breakfast and dinner' : breakfast ? 'breakfast' : 'dinner'} for {mealPeople} people per room per day{onRoomsChange && validRooms ? `; ${roomQuantity} rooms cover ${mealPeople * roomQuantity} people` : ''}.</p>}
    </fieldset>}
    {roomControls}
  </div>
}