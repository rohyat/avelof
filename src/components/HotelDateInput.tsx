import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import DateInput from './DateInput'
import { hotelDateValue, hotelRoomPriceForDate, hotelSeasonNotice } from '../services/hotelPricing'

const dayMilliseconds = 86400000
const dateValue = (date: Date) => date.toISOString().slice(0, 10)
const longDate = (date: string) => new Date(hotelDateValue(date)).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
function calendarDate(year: number, month: number, day: number) {
  const date = new Date(0)
  date.setUTCFullYear(year, month, day)
  return date
}

export default function HotelDateInput({ label, name, value, min, roomRate, onChange, checkout = false }: {
  label: string; name: string; value: string; min?: string; roomRate?: number; onChange: (date: string) => void; checkout?: boolean
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [focusedDate, setFocusedDate] = useState(() => value || min || dateValue(new Date()))
  const wrapper = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const monthDate = new Date(`${focusedDate}T00:00:00Z`)
  const year = monthDate.getUTCFullYear(), month = monthDate.getUTCMonth()
  const first = calendarDate(year, month, 1)
  const dayCount = calendarDate(year, month + 1, 0).getUTCDate()
  const monthLabel = first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })

  useEffect(() => {
    if (!open) return
    wrapper.current?.querySelector<HTMLButtonElement>(`[data-date="${focusedDate}"]`)?.focus()
  }, [open, focusedDate])
  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => { if (event.target instanceof Node && !wrapper.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])

  function close() { setOpen(false); trigger.current?.focus() }
  function openCalendar() {
    if (!checkout && roomRate === undefined) return
    if (open) { close(); return }
    const initial = value || min || dateValue(new Date())
    setFocusedDate(min && initial < min ? min : initial); setOpen(true)
  }
  function moveMonth(offset: number) {
    const next = calendarDate(year, month + offset, 1)
    if (next.getUTCFullYear() < 0 || next.getUTCFullYear() > 9999) return
    const nextValue = dateValue(next)
    setFocusedDate(min && nextValue < min ? min : nextValue)
  }
  function keyDown(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    const offset = offsets[event.key]
    if (offset !== undefined) {
      event.preventDefault()
      const nextDay = new Date(hotelDateValue(date) + offset * dayMilliseconds)
      if (nextDay.getUTCFullYear() < 0 || nextDay.getUTCFullYear() > 9999) return
      const next = dateValue(nextDay)
      setFocusedDate(min && next < min ? min : next)
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault(); moveMonth(event.key === 'PageUp' ? -1 : 1)
    }
  }
  return <div ref={wrapper} className={`hotel-date-field${open ? ' is-open' : ''}`}>
    <label htmlFor={id}>{label}</label>
    <DateInput id={id} name={name} value={value} min={min} required onChange={(event) => onChange(event.target.value)} onOpenCalendar={openCalendar} calendarLabel={`Open ${label.toLowerCase()}${checkout ? '' : ' price'} calendar`} onKeyDown={(event) => {
      if (event.altKey && event.key === 'ArrowDown') { event.preventDefault(); openCalendar() }
    }} />
    <button ref={trigger} className="text-link hotel-calendar-trigger" type="button" aria-expanded={open} aria-controls={`${id}-calendar`} disabled={!checkout && roomRate === undefined} onClick={openCalendar}>View {checkout ? 'check-out calendar' : 'check-in calendar prices'}</button>
    {open && (checkout || roomRate !== undefined) && <div id={`${id}-calendar`} className="hotel-price-calendar" role="dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-help`} onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
    }}>
      <div className="hotel-calendar-heading">
        <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)} disabled={Boolean(min && focusedDate.slice(0, 7) <= min.slice(0, 7))}><ChevronLeft size={18} /></button>
        <strong id={`${id}-title`} aria-live="polite">{monthLabel}</strong>
        <button type="button" aria-label="Next month" onClick={() => moveMonth(1)}><ChevronRight size={18} /></button>
        <button type="button" aria-label={checkout ? 'Close check-out calendar' : 'Close price calendar'} onClick={close}><X size={18} /></button>
      </div>
      <p id={`${id}-help`}>{checkout ? 'Select your check-out date. Your check-out date is not charged.' : 'Room-only price per room for the night of each date. Meals extra. Select your check-in date.'}</p>
      <div className="hotel-calendar-weekdays" aria-hidden="true">{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="hotel-calendar-days" role="group" aria-label={`${label} dates`}>
        {Array.from({ length: first.getUTCDay() }, (_, index) => <span key={`blank-${index}`} />)}
        {Array.from({ length: dayCount }, (_, index) => {
          const date = dateValue(calendarDate(year, month, index + 1))
          const price = !checkout && roomRate !== undefined ? hotelRoomPriceForDate(roomRate, date) : undefined
          return <button key={date} type="button" data-date={date} tabIndex={date === focusedDate ? 0 : -1} disabled={Boolean(min && date < min)} aria-pressed={date === value} aria-label={`${longDate(date)}${price !== undefined ? `, ₹${price.toLocaleString('en-IN')} per room for this night` : ''}`} onKeyDown={(event) => keyDown(event, date)} onClick={() => { onChange(date); close() }}>
            <span>{index + 1}</span>{price !== undefined && <small>₹{price.toLocaleString('en-IN')}</small>}
          </button>
        })}
      </div>
      {!checkout && <p>{hotelSeasonNotice}</p>}
    </div>}
  </div>
}
