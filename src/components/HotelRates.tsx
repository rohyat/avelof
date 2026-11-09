import { useState } from 'react'
import type { Hotel } from '../types'
import OfferPrice from './OfferPrice'

export default function HotelRates({ hotel, meals, onChange }: { hotel: Hotel; meals?: { breakfast: boolean; dinner: boolean }; onChange?: (breakfast: boolean, dinner: boolean, price: number) => void }) {
  const [localBreakfast, setBreakfast] = useState(false)
  const [localDinner, setDinner] = useState(false)
  const breakfast = meals?.breakfast ?? localBreakfast
  const dinner = meals?.dinner ?? localDinner
  const basePrice = hotel.roomOnlyPrice ?? hotel.price
  const mealPrice = (hotel.price - basePrice) / 2
  const price = basePrice + (breakfast ? mealPrice : 0) + (dinner ? mealPrice : 0)

  function updateMeals(nextBreakfast: boolean, nextDinner: boolean) {
    setBreakfast(nextBreakfast)
    setDinner(nextDinner)
    onChange?.(nextBreakfast, nextDinner, basePrice + (nextBreakfast ? mealPrice : 0) + (nextDinner ? mealPrice : 0))
  }

  return <div className="hotel-rates">
    <span className="hotel-rate-basis">{hotel.rateBasis ?? 'per night'}</span>
    <OfferPrice price={price} />
    <div><strong role="status">₹{price.toLocaleString('en-IN')}</strong><span>{breakfast && dinner ? 'Breakfast and dinner included' : breakfast ? 'Breakfast included; dinner excluded' : dinner ? 'Dinner included; breakfast excluded' : 'Without breakfast and dinner'}</span></div>
    {hotel.roomOnlyPrice !== undefined && <fieldset className="hotel-meal-options">
      <legend>Meals</legend>
      <label><input type="checkbox" checked={breakfast} onChange={(event) => updateMeals(event.target.checked, dinner)} /> Breakfast <span>+₹{mealPrice.toLocaleString('en-IN')}</span></label>
      <label><input type="checkbox" checked={dinner} onChange={(event) => updateMeals(breakfast, event.target.checked)} /> Dinner <span>+₹{mealPrice.toLocaleString('en-IN')}</span></label>
    </fieldset>}
  </div>
}