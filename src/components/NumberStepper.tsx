import { useEffect, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'

export default function NumberStepper({ label, name, min = 0, max = 1000000, step = 1, defaultValue = '', currency = false, value: controlledValue, onChange }: {
  label: string; name: string; min?: number; max?: number; step?: number; defaultValue?: string | number; currency?: boolean; value?: string | number; onChange?: (value: string) => void
}) {
  const [localValue, setLocalValue] = useState(String(defaultValue))
  const value = String(controlledValue ?? localValue)
  function setValue(next: string) { setLocalValue(next); onChange?.(next) }
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.setCustomValidity(value === '' || Number(value) < min || Number(value) > max ? `Enter a number from ${min} to ${max}.` : '') }, [value, min, max])
  function change(direction: number) {
    const next = Math.min(max, Math.max(min, (Number(value) || min) + direction * step))
    setValue(String(Math.round(next * 100) / 100))
  }
  return <label className="number-stepper-field"><span className="number-stepper-label">{label}</span><span className="number-stepper">
    <button type="button" aria-label={`Decrease ${label}`} disabled={value !== '' && Number(value) <= min} onClick={() => change(-1)}><Minus size={16} /></button>
    {currency && <span className="number-currency">INR</span>}
    <input ref={inputRef} name={name} aria-label={label} type="text" inputMode={currency ? 'decimal' : 'numeric'} value={value} required
      pattern={currency ? '[0-9]+(\\.[0-9]{1,2})?' : '[0-9]+'}
      onChange={(event) => { const next = event.target.value; if ((currency ? /^\d*(\.\d{0,2})?$/ : /^\d*$/).test(next)) setValue(next) }} />
    <button type="button" aria-label={`Increase ${label}`} disabled={value !== '' && Number(value) >= max} onClick={() => change(1)}><Plus size={16} /></button>
  </span></label>
}
