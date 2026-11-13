import { useState } from 'react'
import type { Hotel } from '../types'
import OfferPrice from './OfferPrice'
import { hotelNightlyPrice } from '../services/hotelService'

export default function HotelRates({ hotel, meals, onChange }: { hotel: Hotel; meals?: { breakfast: boolean; dinner: boolean }; onChange?: (breakfast: boolean, dinner: boolean, price: number) => void }) {
  const [localBreakfast, setBreakfast] = useState(false)
  const [localDinner, setDinner] = useState(false)
  const breakfast = meals?.breakfast ?? localBreakfast
  const dinner = meals?.dinner ?? localDinner
  const basePrice = hotel.roomOnlyPrice ?? hotel.price
  const mealPrice = (hotel.price - basePrice) / 2
  const breakfastPrice = hotel.breakfastPrice ?? mealPrice
  const dinnerPrice = hotel.dinnerPrice ?? mealPrice
  const price = hotelNightlyPrice(hotel, breakfast, dinner)

  function updateMeals(nextBreakfast: boolean, nextDinner: boolean) {
    setBreakfast(nextBreakfast)
    setDinner(nextDinner)
    onChange?.(nextBreakfast, nextDinner, hotelNightlyPrice(hotel, nextBreakfast, nextDinner))
  }

  if (hotel.registeredHotelId && hotel.breakfastPrice === undefined) return <div className="hotel-rates">
    <span className="hotel-rate-basis">{hotel.rateBasis}</span>
    <div><strong>₹{hotel.price.toLocaleString('en-IN')}</strong><span>{hotel.mealPlan}</span></div>
    <span>{hotel.taxDetails}</span>
  </div>

  return <div className="hotel-rates">
    <span className="hotel-rate-basis">{hotel.rateBasis ?? 'per night'}</span>
    {!hotel.registeredHotelId && <OfferPrice price={price} />}
    <div><strong role="status">{hotel.registeredHotelId ? 'INR ' : '₹'}{price.toLocaleString('en-IN')}</strong><span>{breakfast && dinner ? 'Breakfast and dinner included' : breakfast ? 'Breakfast included; dinner excluded' : dinner ? 'Dinner included; breakfast excluded' : 'Without breakfast and dinner'}</span></div>
    {hotel.taxDetails && <span>{hotel.taxDetails}</span>}
    {hotel.roomOnlyPrice !== undefined && <fieldset className="hotel-meal-options">
      <legend>Meals</legend>
      <label><input type="checkbox" checked={breakfast} onChange={(event) => updateMeals(event.target.checked, dinner)} /> Breakfast <span>+INR {breakfastPrice.toLocaleString('en-IN')}</span></label>
      <label><input type="checkbox" checked={dinner} onChange={(event) => updateMeals(breakfast, event.target.checked)} /> Dinner <span>+INR {dinnerPrice.toLocaleString('en-IN')}</span></label>
    </fieldset>}
  </div>
}