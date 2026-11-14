import { useCallback, useId, useState } from 'react'
import type { ComponentProps, FocusEvent, FormEvent, SubmitEvent } from 'react'
import { createPortal } from 'react-dom'
import { z } from 'zod'
import { indianPhoneNumber } from '../services/phoneNumbers'
import { driverVehicleNumberSchema } from '../services/driverSchema'
import { RegistrationValidationContext } from './registrationValidationContext'

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
const emailSchema = z.email()

export default function RegistrationForm({ children, className = '', onSubmit, ...props }: ComponentProps<'form'>) {
  const [errors, setErrors] = useState<Record<string, { message: string; field: Field }>>({})
  const prefix = useId()
  const validate = useCallback((target: EventTarget | null) => {
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return
    let field: Field = target
    if (!field.name || field.closest('[aria-hidden=true]') || field.matches(':disabled')) return
    if (field.name === 'highlights' && field instanceof HTMLInputElement && field.form) {
      const options = Array.from(field.form.querySelectorAll<HTMLInputElement>('input[name=highlights]'))
      const count = options.filter((option) => option.checked).length
      field = options[0]
      field.setCustomValidity(count < 1 ? 'Select at least one major highlight.' : count > 8 ? 'Choose no more than eight major highlights.' : '')
    }
    if (field.name.startsWith('roomCount_') && field instanceof HTMLInputElement && field.form) {
      const counts = Array.from(field.form.querySelectorAll<HTMLInputElement>('input[name^=roomCount_]'))
      const total = counts.reduce((sum, input) => sum + Number(input.value), 0)
      counts[0].setCustomValidity(total < 1 ? 'Offer at least one room across the room types.' : '')
      if (total < 1 || errors[counts[0].name]?.message === 'Offer at least one room across the room types.') field = counts[0]
    }
    let message = field.validationMessage
    if (!message && field.required && !field.value.trim()) message = 'This field is required.'
    if (!message && field instanceof HTMLInputElement && field.minLength > 0 && field.value.trim().length < field.minLength) message = `Enter at least ${field.minLength} characters.`
    if (!message && field.value && field instanceof HTMLInputElement && field.type === 'tel' && !indianPhoneNumber(field.value)) message = 'Enter a valid 10-digit Indian phone number.'
    if (!message && field.value && field instanceof HTMLInputElement && field.type === 'email' && !emailSchema.safeParse(field.value.trim()).success) message = 'Enter a valid email address.'
    if (!message && field.name === 'vehicleNumber' && !driverVehicleNumberSchema.safeParse(field.value).success) message = 'Enter a complete registration number, for example JK13J7748.'
    if (!message && field.value && field instanceof HTMLInputElement && field.type === 'url') {
      try {
        const url = new URL(field.value)
        if (url.protocol !== 'https:' || url.username || url.password) message = 'Use a full https:// website address without embedded credentials.'
      } catch { message = 'Enter a valid https:// website address.' }
    }
    if (!message && field instanceof HTMLTextAreaElement && field.minLength > 0 && field.value.trim().length < field.minLength) message = `Enter at least ${field.minLength} characters.`
    const id = `${prefix}-${field.name}`
    const descriptions = (field.getAttribute('aria-describedby') ?? '').split(' ').filter((value) => value && value !== id)
    if (message) descriptions.push(id)
    if (descriptions.length) field.setAttribute('aria-describedby', descriptions.join(' '))
    else field.removeAttribute('aria-describedby')
    field.setAttribute('aria-invalid', String(Boolean(message)))
    setErrors((current) => current[field.name]?.message === message && current[field.name]?.field === field ? current : { ...current, [field.name]: { message, field } })
    return message
  }, [errors, prefix])
  function blur(event: FocusEvent<HTMLFormElement>) { validate(event.target) }
  function input(event: FormEvent<HTMLFormElement>) {
    const target = event.target
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
      if (target.name in errors) validate(target)
    }
  }
  function submit(event: SubmitEvent<HTMLFormElement>) {
    const invalid = Array.from(event.currentTarget.querySelectorAll('input, select, textarea')).map(validate).some(Boolean)
    if (invalid) {
      event.preventDefault()
      event.currentTarget.querySelector<HTMLElement>('[aria-invalid=true]')?.focus()
    } else onSubmit?.(event)
  }
  const revalidateNumber = useCallback((field: HTMLInputElement) => {
    if (field.name in errors) validate(field)
  }, [errors, validate])
  return <form {...props} className={`${className} validated-registration`} onSubmit={submit} onBlur={blur} onChange={input} onInvalidCapture={(event) => validate(event.target)}>
    <p className="registration-required-note">Fields marked <span aria-hidden="true">*</span> are required.</p>
    <RegistrationValidationContext.Provider value={revalidateNumber}>{children}</RegistrationValidationContext.Provider>
    {Object.entries(errors).filter(([, error]) => error.message && error.field.isConnected).map(([name, { message, field }]) => createPortal(<span className="enquiry-error registration-field-error" id={`${prefix}-${name}`} role="alert">{message}</span>, field.closest('label') ?? field.parentElement!, name))}
  </form>
}
