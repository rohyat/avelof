import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Sparkles, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getTripChatReply } from '../services/tripChatService'
import type { ChatMessage } from '../services/tripChatService'

const starter: ChatMessage = {
  role: 'assistant',
  content: 'Hi, I can help with AVELOF packages, stays, vehicles, and Kashmir places. What would you like to know?',
}
const prompts = ['Compare packages', 'Suggest a 5-day trip', 'Places to visit in Pahalgam']

export default function AskAIWidget({ hidden = false }: { hidden?: boolean }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([starter])
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messages, open])

  function sendMessage(value = draft) {
    const content = value.trim()
    if (!content || content.length > 900) return
    const next = [...messages, { role: 'user' as const, content }].slice(-8)
    setMessages([...next, { role: 'assistant' as const, content: getTripChatReply(content) }].slice(-9))
    setDraft('')
  }

  if (hidden) return null

  return <>
    <button className="button floating-trip-chat" type="button" aria-expanded={open} aria-controls="trip-chat-panel" onClick={() => setOpen((value) => !value)}>
      {open ? <X size={18} /> : <Sparkles size={18} />} Ask AVELOF
    </button>
    {open && <section id="trip-chat-panel" className="trip-chat-panel" role="dialog" aria-modal="false" aria-labelledby="trip-chat-title">
      <header className="trip-chat-header"><div><p className="eyebrow">Kashmir trip assistant</p><h2 id="trip-chat-title">Trip chat</h2></div><button className="icon-button" type="button" aria-label="Close trip chat" onClick={() => setOpen(false)}><X size={19} /></button></header>
      <p className="trip-chat-notice">Free trip guidance from AVELOF’s published catalog, answered in your browser. Messages aren’t sent to an AI provider or saved by AVELOF. I can’t check live availability or confirm bookings. Don’t enter personal, payment, or booking details.</p>
      <div className="trip-chat-messages" role="log" aria-label="Trip chat conversation" aria-live="polite">
        {messages.map((message, index) => <p key={`${index}-${message.role}`} className={`trip-chat-message is-${message.role}`}>{message.content}</p>)}
        <div ref={endRef} />
      </div>
      {messages.length === 1 && <div className="trip-chat-prompts" aria-label="Suggested questions">{prompts.map((prompt) => <button key={prompt} type="button" onClick={() => sendMessage(prompt)}>{prompt}</button>)}</div>}
      <form className="trip-chat-form" onSubmit={(event) => { event.preventDefault(); sendMessage() }}>
        <label className="sr-only" htmlFor="trip-chat-input">Your question</label>
        <textarea id="trip-chat-input" value={draft} maxLength={900} rows={2} placeholder="Ask about packages, hotels or places…" onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage() } }} />
        <button className="button button-dark" type="submit" disabled={!draft.trim()} aria-label="Send question"><ArrowUp size={18} /></button>
      </form>
      <p className="trip-chat-help">Need specific help or information? <Link to="/contact">Contact us</Link></p>
    </section>}
  </>
}