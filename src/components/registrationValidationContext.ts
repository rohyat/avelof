import { createContext } from 'react'

export const RegistrationValidationContext = createContext<((field: HTMLInputElement) => void) | null>(null)
