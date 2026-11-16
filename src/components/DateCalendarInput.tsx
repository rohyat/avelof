import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import DateInput from './DateInput'

const dayMilliseconds = 86400000
const dateValue = (date: Date) => date.toISOString().slice(0, 10)
const longDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
function calendarDate(year: number, month: number, day: number) {
  const date = new Date(0)
  date.setUTCFullYear(year, month, day)
  return date
}

export default function DateCalendarInput({ label, name, value, min, onChange, defaultOpen = false, disabled = false, priceForDate, priceSuffix = '', helpText, notice, triggerLabel, closeLabel = 'Close calendar' }: {
  label: string; name: string; value: string; min?: string; onChange: (date: string) => void; defaultOpen?: boolean; disabled?: boolean
  priceForDate?: (date: string) => number; priceSuffix?: string; helpText: string; notice?: string; triggerLabel?: string; closeLabel?: string
}) {
  const id = useId()
  const [open, setOpen] = useState(defaultOpen)
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
    const dismiss = (event: MouseEvent) => { if (event.target instanceof Node && !wrapper.current?.contains(event.target)) setOpen(false) }
    // Let the click that opens the booking form finish before listening outside.
    const timer = window.setTimeout(() => document.addEventListener('click', dismiss), 0)
    return () => { window.clearTimeout(timer); document.removeEventListener('click', dismiss) }
  }, [open])

  function close() { setOpen(false); trigger.current?.focus() }
  function openCalendar() {
    if (disabled) return
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
      const nextDay = new Date(Date.parse(`${date}T00:00:00Z`) + offset * dayMilliseconds)
      if (nextDay.getUTCFullYear() < 0 || nextDay.getUTCFullYear() > 9999) return
      const next = dateValue(nextDay)
      setFocusedDate(min && next < min ? min : next)
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault(); moveMonth(event.key === 'PageUp' ? -1 : 1)
    }
  }
  return <div ref={wrapper} className={`hotel-date-field${open ? ' is-open' : ''}`}>
    <label htmlFor={id}>{label}</label>
    <DateInput id={id} name={name} value={value} min={min} required onChange={(event) => onChange(event.target.value)} onOpenCalendar={openCalendar} calendarLabel={`Open ${label.toLowerCase()}${priceForDate ? ' price' : ''} calendar`} onKeyDown={(event) => {
      if (event.altKey && event.key === 'ArrowDown') { event.preventDefault(); openCalendar() }
    }} />
    <button ref={trigger} className="text-link hotel-calendar-trigger" type="button" aria-expanded={open} aria-controls={`${id}-calendar`} disabled={disabled} onClick={openCalendar}>{triggerLabel ?? `View ${label.toLowerCase()} calendar`}</button>
    {open && !disabled && <div id={`${id}-calendar`} className="hotel-price-calendar" role="dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-help`} onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
    }}>
      <div className="hotel-calendar-heading">
        <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)} disabled={Boolean(min && focusedDate.slice(0, 7) <= min.slice(0, 7))}><ChevronLeft size={18} /></button>
        <strong id={`${id}-title`} aria-live="polite">{monthLabel}</strong>
        <button type="button" aria-label="Next month" onClick={() => moveMonth(1)}><ChevronRight size={18} /></button>
        <button type="button" aria-label={closeLabel} onClick={close}><X size={18} /></button>
      </div>
      <p id={`${id}-help`}>{helpText}</p>
      <div className="hotel-calendar-weekdays" aria-hidden="true">{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="hotel-calendar-days" role="group" aria-label={`${label} dates`}>
        {Array.from({ length: first.getUTCDay() }, (_, index) => <span key={`blank-${index}`} />)}
        {Array.from({ length: dayCount }, (_, index) => {
          const date = dateValue(calendarDate(year, month, index + 1))
          const price = priceForDate?.(date)
          return <button key={date} type="button" data-date={date} tabIndex={date === focusedDate ? 0 : -1} disabled={Boolean(min && date < min)} aria-pressed={date === value} aria-label={`${longDate(date)}${price !== undefined ? `, ₹${price.toLocaleString('en-IN')}${priceSuffix}` : ''}`} onKeyDown={(event) => keyDown(event, date)} onClick={() => { onChange(date); close() }}>
            <span>{index + 1}</span>{price !== undefined && <small>₹{price.toLocaleString('en-IN')}</small>}
          </button>
        })}
      </div>
      {notice && <p>{notice}</p>}
    </div>}
  </div>
}
