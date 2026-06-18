/**
 * Firebase web config + Web Push (VAPID) public key.
 *
 * These are PUBLIC values by design — Firebase ships them to every browser, and
 * the VAPID public key is meant to be exposed to clients. They are NOT secrets,
 * so hardcoding them here (instead of env vars) is correct and intentional. The
 * sensitive counterpart — the service-account JSON used to SEND messages — lives
 * only server-side (a Supabase Edge Function secret), never in this repo.
 *
 * Project: t1-diabetes
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyB3wq2GQreZHJhsGcMV7L0-GjRHXOKi-fg',
  authDomain: 't1-diabetes.firebaseapp.com',
  projectId: 't1-diabetes',
  storageBucket: 't1-diabetes.firebasestorage.app',
  messagingSenderId: '265622280187',
  appId: '1:265622280187:web:cd467f755bb746f5eb5d5e',
  // measurementId is for Analytics, which we intentionally do NOT initialize —
  // this is a health app, so we avoid loading analytics/tracking. Kept here only
  // for reference/completeness.
  measurementId: 'G-8M54D2D4PR',
} as const

/**
 * Web Push VAPID public key (from Firebase → Cloud Messaging → Web Push
 * certificates). If push ever fails to register, the second generated key is the
 * fallback: BOpaegWLNjV-UZCaNvmgawCsSClaFjK8YeqgVqbTJ3uAlQltXA5uzImZ8laIKSndAcwvf-LQso0MFqoHRbHx6ZE
 */
export const VAPID_KEY =
  'BBNjvX6JQPoVaylCm_dOyL2e-9TqzYE95Rf2wthyKguCbkErwCiSiAQRhb2lQ4Qh8OzExuoVVOBb3o4JCn7Mv0M'
