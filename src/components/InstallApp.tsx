import { useEffect, useRef, useState } from 'react'
import { Download, X } from 'lucide-react'
import { isAppInstalled, isAppleMobile } from '../services/appInstallation'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallApp() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isAppInstalled)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [workerError, setWorkerError] = useState(false)
  const appleMobile = isAppleMobile()

  useEffect(() => {
    const handlePrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    const handleInstalled = () => {
      setInstalled(true)
      setInstallPrompt(null)
      setMessage('')
    }
    const displayMode = window.matchMedia('(display-mode: standalone)')
    const handleDisplayMode = () => setInstalled(isAppInstalled())
    window.addEventListener('beforeinstallprompt', handlePrompt)
    window.addEventListener('appinstalled', handleInstalled)
    displayMode.addEventListener('change', handleDisplayMode)
    let active = true
    if ('serviceWorker' in navigator && window.isSecureContext) {
      void navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
        console.error('AVELOF app service worker registration failed', error)
        if (active) setWorkerError(true)
      })
    }
    return () => {
      active = false
      window.removeEventListener('beforeinstallprompt', handlePrompt)
      window.removeEventListener('appinstalled', handleInstalled)
      displayMode.removeEventListener('change', handleDisplayMode)
    }
  }, [])

  async function install() {
    if (!installPrompt || busy) return
    setBusy(true)
    setMessage('')
    try {
      await installPrompt.prompt()
      const choice = await installPrompt.userChoice
      setMessage(choice.outcome === 'accepted'
        ? 'Installation requested. Follow your browser prompts to finish.'
        : 'Installation cancelled. You can try again from your browser menu.')
    } catch (error) {
      console.error('AVELOF app installation prompt failed', error)
      setMessage('The install prompt could not open. Use the browser steps below or reload and try again.')
    } finally {
      setInstallPrompt(null)
      setBusy(false)
    }
  }

  return <>
    <button type="button" className="footer-install" onClick={() => dialogRef.current?.showModal()}>{installed ? 'App installed' : 'Install app'}</button>
    <dialog ref={dialogRef} className="install-dialog" aria-labelledby="install-title" onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close() }}>
      <button type="button" className="modal-close icon-button" aria-label="Close app installation" onClick={() => dialogRef.current?.close()}><X /></button>
      <img className="install-logo" src="/app-icon-192.png?v=chinar-1" alt="" width={72} height={72} />
      <h2 id="install-title">{installed ? 'AVELOF is installed' : 'AVELOF on your home screen'}</h2>
      {installed ? <p>Open AVELOF from your home screen or app list.</p> : <>
        <p>Install the website as an app where your browser supports it. No APK download is needed.</p>
        {installPrompt && <button type="button" className="button button-dark" disabled={busy} onClick={() => void install()}><Download size={18} />{busy ? 'Opening install prompt...' : 'Install AVELOF'}</button>}
        {appleMobile ? <ol>
          <li>Open <strong>avelof.in in Safari</strong>, not inside WhatsApp, Instagram or another app.</li>
          <li>Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong> (you may need to scroll).</li>
          <li>If shown, keep <strong>Open as Web App</strong> enabled, then tap <strong>Add</strong>.</li>
        </ol> : <ol>
          <li>Open <strong>avelof.in in Chrome, Edge or Samsung Internet</strong>, not inside another app.</li>
          <li>Open the browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
          <li>Confirm the browser prompt, then open AVELOF from your home screen or app list.</li>
        </ol>}
        <p>If the option is missing, update your browser or try another supported browser. You can still use the full website without installing it. An internet connection is required.</p>
        {workerError && <p role="alert">App setup could not complete. Reload and try again, or use your browser's Add to Home screen option.</p>}
      </>}
      {message && !installed && <p role="status">{message}</p>}
    </dialog>
  </>
}
