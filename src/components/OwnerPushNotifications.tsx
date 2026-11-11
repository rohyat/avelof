import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { loadPushSettings, PushNotificationError, removePushSubscription, savePushSubscription } from '../services/pushNotifications'

type NotificationState = 'loading' | 'unavailable' | 'install-required' | 'permission-denied' | 'ready' | 'enabled' | 'error'

function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function isAppleMobile() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function applicationServerKey(value: string) {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes.buffer
}

export default function OwnerPushNotifications() {
  const [state, setState] = useState<NotificationState>('loading')
  const [message, setMessage] = useState('')
  const [publicKey, setPublicKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    let active = true
    async function initialize() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setState('unavailable')
        setMessage('This browser does not support push notifications.')
        return
      }
      if (isAppleMobile() && !isInstalled()) {
        setState('install-required')
        setMessage('Add AVELOF to your Home Screen, then open the installed app to enable alerts.')
        return
      }
      try {
        const settings = await loadPushSettings()
        if (!active) return
        if (!settings.available || !settings.publicKey) {
          setState('unavailable')
          setMessage('Mobile notifications are not configured yet.')
          return
        }
        setPublicKey(settings.publicKey)
        const worker = await navigator.serviceWorker.getRegistration('/')
        if (!active) return
        if (!worker) {
          setState(Notification.permission === 'denied' ? 'permission-denied' : 'ready')
          setMessage(Notification.permission === 'denied' ? 'Notifications are blocked in this browser’s settings.' : 'Get alerts for new bookings and guest reviews.')
          return
        }
        setRegistration(worker)
        const subscription = await worker.pushManager.getSubscription()
        if (subscription) {
          await savePushSubscription(subscription)
          if (active) { setState('enabled'); setMessage('Alerts are enabled on this device.') }
        } else if (Notification.permission === 'denied') {
          setState('permission-denied')
          setMessage('Notifications are blocked in this browser’s settings.')
        } else {
          setState('ready')
          setMessage('Get alerts for new bookings and guest reviews.')
        }
      } catch (error) {
        if (!active) return
        setState('error')
        setMessage(error instanceof PushNotificationError && error.status === 401 ? 'Sign in again to manage device alerts.' : 'Notification settings could not be loaded.')
      }
    }
    void initialize()
    return () => { active = false }
  }, [])

  async function enable() {
    if (busy || !publicKey) return
    setBusy(true)
    setMessage('')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState('permission-denied')
        setMessage('Allow notifications in your browser settings to receive booking and review alerts.')
        return
      }
      const worker = registration ?? await navigator.serviceWorker.register('/sw.js')
      setRegistration(worker)
      const subscription = await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(publicKey) })
      await savePushSubscription(subscription)
      setState('enabled')
      setMessage('Alerts are enabled on this device.')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Notifications could not be enabled on this device.')
    } finally { setBusy(false) }
  }

  async function disable() {
    if (busy || !registration) return
    setBusy(true)
    setMessage('')
    try {
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await removePushSubscription(subscription.endpoint)
        await subscription.unsubscribe()
      }
      setState('ready')
      setMessage('Alerts are disabled on this device.')
    } catch {
      setState('error')
      setMessage('Notifications could not be disabled. Please try again.')
    } finally { setBusy(false) }
  }

  return <section className="admin-push-notifications" aria-label="Mobile notifications">
    <div className="admin-push-copy"><Bell size={18} /><div><strong>Mobile notifications</strong><p role="status">{busy ? 'Updating this device...' : message}</p></div></div>
    {state === 'enabled'
      ? <button className="button button-outline" type="button" disabled={busy} onClick={disable}><BellOff size={16} /> Disable on this device</button>
      : state === 'ready' && <button className="button button-dark" type="button" disabled={busy} onClick={enable}><Bell size={16} /> Enable on this device</button>}
  </section>
}