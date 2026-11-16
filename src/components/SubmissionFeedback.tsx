import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { CircleCheck, LoaderCircle } from 'lucide-react'

function SubmissionDialog({ title, children, pending = false }: { title: string; children: ReactNode; pending?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  return <dialog ref={dialog} tabIndex={-1} className={`booking-modal confirmation-modal ${pending ? 'registration-progress' : 'registration-success'}`} aria-labelledby={titleId} aria-describedby={descriptionId} onKeyDown={(event) => {
    event.stopPropagation()
    if (pending && event.key === 'Tab') {
      event.preventDefault()
      dialog.current?.focus()
    }
  }} onCancel={pending ? (event) => event.preventDefault() : undefined}>
    {pending ? <LoaderCircle className="registration-spinner" size={40} aria-hidden="true" /> : <span className="success-mark"><CircleCheck size={24} aria-hidden="true" /></span>}
    <div role={pending ? 'status' : undefined} aria-live={pending ? 'polite' : undefined}>
      <h2 id={titleId}>{title}</h2>
      <div id={descriptionId}>{children}</div>
    </div>
    {!pending && <button className="button button-dark" type="button" autoFocus onClick={() => dialog.current?.close()}>View submission details</button>}
  </dialog>
}

export default function SubmissionProgress({ title = 'Saving your submission', children = 'Please keep this page open until your submission has been saved.' }: { title?: string; children?: ReactNode }) {
  return <SubmissionDialog title={title} pending>{children}</SubmissionDialog>
}

export function SubmissionSuccess({ title, children }: { title: string; children: ReactNode }) {
  return <SubmissionDialog title={title}>{children}</SubmissionDialog>
}
