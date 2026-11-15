import type { ComponentProps } from 'react'
import { CalendarDays } from 'lucide-react'

export default function DateInput(props: Omit<ComponentProps<'input'>, 'type'>) {
  return <span className="date-input-control">
    <input {...props} className={`date-input${props.className ? ` ${props.className}` : ''}`} type="date" />
    <CalendarDays className="date-input-icon" size={20} aria-hidden="true" />
  </span>
}
