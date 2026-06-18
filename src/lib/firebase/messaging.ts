'use client'

/**
 * Client-side Firebase Cloud Messaging (FCM) helpers.
 *
 * All entry points are browser-guarded: on the server, in an unsupported
 * browser, or without service-worker/Notification support they no-op (return
 * null / a no-op unsubscribe) rather than throwing. `firebase/messaging` is
 * loaded with a dynamic import *inside* these functions so its runtime code is
 * never evaluated during server-side rendering — only the erased `import type`
 * appears at module scope.
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import type { Messaging } from 'firebase/messaging'
import { firebaseConfig, VAPID_KEY } from './config'

function firebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig)
}

/** True only in a browser that can actually do web push. */
export async function isPushSupported(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return false
  try {
    const { isSupported } = await import('firebase/messaging')
    return await isSupported()
  } catch {
    return false
  }
}

async function messagingIfSupported(): Promise<Messaging | null> {
  if (!(await isPushSupported())) return null
  const { getMessaging } = await import('firebase/messaging')
  return getMessaging(firebaseApp())
}

/**
 * Ask permission, register the background service worker, and return an FCM
 * device token — or null if the user declined or the browser can't do push.
 */
export async function registerAndGetToken(): Promise<string | null> {
  const messaging = await messagingIfSupported()
  if (!messaging) return null

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  // Register our SW explicitly so getToken binds to the right registration.
  const registration = await navigator.serviceWorker.register(
    '/firebase-messaging-sw.js'
  )

  const { getToken } = await import('firebase/messaging')
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  })
  return token || null
}

/**
 * Subscribe to messages that arrive while the app is in the foreground (the SW
 * only fires for background messages). Returns an unsubscribe function.
 */
export async function onForegroundMessage(
  handler: (title: string, body: string) => void
): Promise<() => void> {
  const messaging = await messagingIfSupported()
  if (!messaging) return () => {}
  const { onMessage } = await import('firebase/messaging')
  return onMessage(messaging, (payload) => {
    handler(payload.notification?.title ?? 'T1D Hub', payload.notification?.body ?? '')
  })
}
