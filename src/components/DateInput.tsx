import type { ComponentProps } from 'react'
import { CalendarDays } from 'lucide-react'

export default function DateInput({ onOpenCalendar, calendarLabel, ...props }: Omit<ComponentProps<'input'>, 'type'> & { onOpenCalendar?: () => void; calendarLabel?: string }) {
  return <span className={`date-input-control${onOpenCalendar ? ' has-price-calendar' : ''}`}>
    <input {...props} className={`date-input${props.className ? ` ${props.className}` : ''}`} type="date" />
    {onOpenCalendar ? <button className="date-price-picker" type="button" onClick={onOpenCalendar} aria-label={calendarLabel} disabled={props.disabled}><CalendarDays size={20} aria-hidden="true" /></button> : <CalendarDays className="date-input-icon" size={20} aria-hidden="true" />}
  </span>
}
