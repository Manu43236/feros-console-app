import { initializeApp, getApps } from 'firebase/app'
import { getMessaging, getToken, deleteToken, onMessage, type Messaging } from 'firebase/messaging'

const firebaseConfig = {
  apiKey:            'AIzaSyCdSvv97TTnn3lcZUs5OcG1Z3tCssZh_x0',
  authDomain:        'feros-552b2.firebaseapp.com',
  projectId:         'feros-552b2',
  storageBucket:     'feros-552b2.firebasestorage.app',
  messagingSenderId: '206785700779',
  appId:             '1:206785700779:web:ce5ed114dead74049768ee',
}

const VAPID_KEY = 'BLEThp81u2iXeaR8STupnu-YIN4uhLwx61a20b0KcKrLBofOPPPwL2VUzbPWVPDYZXge4Xk1EZfEMqPUXsa8KWA'

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)

// Lazy + guarded: getMessaging() throws on insecure origins (HTTP/IP) and
// unsupported browsers. Never let that crash app startup — push just stays off.
let messaging: Messaging | null = null
let messagingTried = false
function getMessagingSafe(): Messaging | null {
  if (messagingTried) return messaging
  messagingTried = true
  try { messaging = getMessaging(app) } catch { messaging = null }
  return messaging
}

export async function getWebFcmToken(): Promise<string | null> {
  try {
    const m = getMessagingSafe()
    if (!m) return null
    if (!('Notification' in window)) return null
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null
    const sw = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    return await getToken(m, { vapidKey: VAPID_KEY, serviceWorkerRegistration: sw })
  } catch {
    return null
  }
}

export async function deleteWebFcmToken(): Promise<void> {
  try {
    const m = getMessagingSafe()
    if (m) await deleteToken(m)
  } catch { /* best-effort */ }
}

export function listenForegroundMessages(onNotification: (title: string, body: string) => void) {
  const m = getMessagingSafe()
  if (!m) return () => {}
  return onMessage(m, (payload) => {
    const title = payload.notification?.title ?? 'FEROS'
    const body  = payload.notification?.body  ?? ''
    onNotification(title, body)
  })
}
