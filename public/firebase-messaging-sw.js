/* Firebase Cloud Messaging background service worker.
 *
 * The browser loads this file from the site root (/firebase-messaging-sw.js).
 * It runs even when the app/tab is closed, which is the whole point of push.
 * It uses the Firebase "compat" builds from the CDN via importScripts (a service
 * worker can't use ES module imports / the bundled SDK), and only the PUBLIC
 * config below — no secrets. If a CDN version ever 404s, bump the version number
 * in both URLs to a current Firebase release.
 */
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyB3wq2GQreZHJhsGcMV7L0-GjRHXOKi-fg',
  authDomain: 't1-diabetes.firebaseapp.com',
  projectId: 't1-diabetes',
  storageBucket: 't1-diabetes.firebasestorage.app',
  messagingSenderId: '265622280187',
  appId: '1:265622280187:web:cd467f755bb746f5eb5d5e',
})

const messaging = firebase.messaging()

// Show a notification for data/background messages. (Messages that already carry
// a `notification` payload are displayed by the browser automatically; this
// handler covers the rest and lets us add a click target.)
messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'T1D Supply Hub'
  const body = (payload.notification && payload.notification.body) || ''
  self.registration.showNotification(title, {
    body,
    tag: 't1d-supply',
    data: { url: '/dashboard' },
  })
})

// Focus/open the app when a notification is clicked.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/dashboard'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
