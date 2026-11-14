import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { CircleCheck } from 'lucide-react'

export default function RegistrationReceipt({ kind, reference, accessCode, children }: {
  kind: 'Hotel' | 'Driver' | 'Business'
  reference: string
  accessCode?: string
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const receipt = useRef<HTMLElement>(null)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  return <>
    <section ref={receipt} className="review-ready" role="status" tabIndex={-1}>{children}</section>
    <dialog ref={dialog} className="booking-modal confirmation-modal registration-success" aria-labelledby="registration-success-title" aria-describedby="registration-success-description" onClose={() => receipt.current?.focus()}>
      <span className="success-mark"><CircleCheck size={24} aria-hidden="true" /></span>
      <h2 id="registration-success-title">{kind} registration saved</h2>
      <p id="registration-success-description">{kind === 'Business' ? 'Thank you. Your registration and photos have been saved. AVELOF reviews business details before publication. This does not confirm an order, booking or discount.' : 'Thank you. Your registration and photos have been saved and are awaiting AVELOF approval. This is not a confirmed listing or booking.'}</p>
      <dl><dt>{kind} ID</dt><dd>{reference}</dd>{accessCode && <><dt>Status access code</dt><dd>{accessCode}</dd></>}</dl>
      {accessCode && <p>Keep these details to check your registration status.</p>}
      <button type="button" className="button button-dark" autoFocus onClick={() => dialog.current?.close()}>View registration details</button>
    </dialog>
  </>
}
