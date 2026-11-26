import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { loadPushSettings, PushNotificationError, removePushSubscription, savePushSubscription, sendTestNotification } from '../services/pushNotifications'
import { isAppInstalled, isAppleMobile } from '../services/appInstallation'

type NotificationState = 'loading' | 'unavailable' | 'install-required' | 'permission-denied' | 'ready' | 'enabled' | 'error'

function applicationServerKey(value: string) {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes.buffer
}

function subscriptionUsesKey(subscription: PushSubscription, key: ArrayBuffer) {
  const existingKey = subscription.options.applicationServerKey
  if (!existingKey) return false
  const expected = new Uint8Array(key)
  const existing = new Uint8Array(existingKey)
  return existing.length === expected.length && existing.every((value, index) => value === expected[index])
}

async function readyWorker() {
  await navigator.serviceWorker.register('/sw.js')
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('App setup timed out. Reload and retry notification setup.')), 15000) }),
    ])
  } finally { clearTimeout(timer) }
}

export default function OwnerPushNotifications() {
  const [state, setState] = useState<NotificationState>('loading')
  const [message, setMessage] = useState('')
  const [publicKey, setPublicKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    const recheck = () => { if (!busy && document.visibilityState === 'visible') setRefresh((value) => value + 1) }
    window.addEventListener('focus', recheck)
    document.addEventListener('visibilitychange', recheck)
    return () => {
      window.removeEventListener('focus', recheck)
      document.removeEventListener('visibilitychange', recheck)
    }
  }, [busy])

  useEffect(() => {
    let active = true
    async function initialize() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setState(isAppleMobile() && !isAppInstalled() ? 'install-required' : 'unavailable')
        setMessage(isAppleMobile() ? 'On iPhone/iPad, add AVELOF to your Home Screen and open that app. Alerts require iOS/iPadOS 16.4 or later.' : 'This browser does not support push notifications. Try an updated Chrome or Edge browser.')
        return
      }
      if (isAppleMobile() && !isAppInstalled()) {
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
        const worker = await readyWorker()
        if (!active) return
        if (Notification.permission === 'denied') {
          setState('permission-denied')
          setMessage('Notifications are blocked. Allow them in your browser and phone settings, then recheck below.')
          return
        }
        setRegistration(worker)
        const subscription = await worker.pushManager.getSubscription()
        if (!active) return
        if (subscription && Notification.permission === 'granted' && subscriptionUsesKey(subscription, applicationServerKey(settings.publicKey))) {
          await savePushSubscription(subscription)
          if (active) { setState('enabled'); setMessage('Alerts are enabled on this device.') }
        } else {
          setState('ready')
          setMessage('Get alerts for booking enquiries, guest reviews and hotel, driver or business registrations.')
        }
      } catch (error) {
        if (!active) return
        setState('error')
        setMessage(error instanceof PushNotificationError && error.status === 401 ? 'Sign in again to manage device alerts.' : 'Notification settings could not be loaded.')
      }
    }
    void initialize()
    return () => { active = false }
  }, [refresh])

  async function enable() {
    if (busy || !publicKey) return
    setBusy(true)
    setMessage('')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'permission-denied' : 'ready')
        setMessage(permission === 'denied' ? 'Allow notifications in your browser and phone settings, then recheck below.' : 'Permission was not granted. Tap Enable on this device when you are ready.')
        return
      }
      const worker = await readyWorker()
      setRegistration(worker)
      const key = applicationServerKey(publicKey)
      let subscription = await worker.pushManager.getSubscription()
      if (subscription && !subscriptionUsesKey(subscription, key)) {
        await removePushSubscription(subscription.endpoint)
        if (!await subscription.unsubscribe()) throw new Error('The old device subscription could not be reset. Please retry.')
        subscription = null
      }
      subscription ??= await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
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
        if (!await subscription.unsubscribe()) throw new Error('Device subscription could not be removed.')
      }
      setState('ready')
      setMessage('Alerts are disabled on this device.')
    } catch {
      setState('error')
      setMessage('Notifications could not be disabled. Please try again.')
    } finally { setBusy(false) }
  }

  async function testNotification() {
    if (busy || !registration) return
    setBusy(true)
    try {
      const subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        setState('ready')
        setMessage('This device needs to be enabled again.')
        return
      }
      await sendTestNotification(subscription.endpoint)
      setMessage('Test sent to this device. Check your notifications; if it does not appear, check the settings below.')
    } catch (error) {
      if (error instanceof PushNotificationError && error.status === 409) setState('ready')
      setMessage(error instanceof Error ? error.message : 'The test notification could not be sent. Please retry.')
    } finally { setBusy(false) }
  }

  return <section className="admin-push-notifications" aria-label="Mobile notifications">
    <div className="admin-push-copy"><Bell size={18} /><div><strong>Mobile notifications</strong><p role="status">{busy ? 'Updating this device...' : message}</p>
      <details><summary>Phone setup &amp; troubleshooting</summary>
        <ol>
          <li>On each phone, open AVELOF, sign in to the admin panel and tap <strong>Enable on this device</strong>. Reinstalling the app may require enabling it again.</li>
          <li>Android Chrome: open AVELOF's site settings and allow Notifications. In phone Settings, allow notifications for Chrome and AVELOF, if listed.</li>
          <li>iPhone/iPad: open the home-screen app, allow its notification prompt and check Settings &gt; Notifications &gt; AVELOF. Requires iOS/iPadOS 16.4 or later.</li>
          <li>Check Do Not Disturb/Focus and battery restrictions if alerts are delayed. Return here and recheck, then send a test notification.</li>
        </ol>
        <p>Installing the app still opens the homepage. Only tapping an admin notification opens the admin panel. Customer installation does not enable owner alerts.</p>
      </details>
    </div></div>
    {state === 'enabled'
      ? <div className="admin-push-actions"><button className="button button-dark" type="button" disabled={busy} onClick={testNotification}><Bell size={16} /> Send test notification</button><button className="button button-outline" type="button" disabled={busy} onClick={disable}><BellOff size={16} /> Disable on this device</button></div>
      : state === 'ready' && <button className="button button-dark" type="button" disabled={busy} onClick={enable}><Bell size={16} /> Enable on this device</button>}
    {state !== 'loading' && <button className="button button-outline" type="button" disabled={busy} onClick={() => { setState('loading'); setRefresh((value) => value + 1) }}>Recheck notification settings</button>}
  </section>
}