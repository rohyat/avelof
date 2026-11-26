import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeftRight, X } from 'lucide-react'
import { HotelComparison } from '../pages/HotelComparisonPage'
import type { Region } from '../data/regions'

export default function HotelCompareLink({ region = 'Kashmir', hotelId }: { region?: Region; hotelId?: string }) {
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const element = dialog.current
    const button = trigger.current
    const previousOverflow = document.body.style.overflow
    element?.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      element?.close()
      document.body.style.overflow = previousOverflow
      button?.focus()
    }
  }, [open])
  return <>
    <button ref={trigger} type="button" className="button button-outline hotel-compare-link" aria-haspopup="dialog" onClick={() => setOpen(true)}><ArrowLeftRight size={16} aria-hidden="true" />Compare</button>
    {open && createPortal(<dialog ref={dialog} className="hotel-comparison-dialog hotel-comparison-page" aria-label="Compare hotels" onCancel={() => setOpen(false)} onClose={() => setOpen(false)} onClick={(event) => {
      if (event.target !== event.currentTarget) return
      const bounds = event.currentTarget.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setOpen(false)
    }}>
      <header className="comparison-heading"><div className="hotel-comparison-title"><span><ArrowLeftRight size={22} aria-hidden="true" /></span><h2>Compare hotels</h2></div><button type="button" className="icon-button" aria-label="Close hotel comparison" autoFocus onClick={() => setOpen(false)}><X size={22} /></button></header>
      <HotelComparison region={region} initialLeft={hotelId} onClose={() => setOpen(false)} />
    </dialog>, document.body)}
  </>
}
