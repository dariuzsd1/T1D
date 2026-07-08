'use client'

/**
 * Optional, per-device "app lock" using the browser's built-in WebAuthn
 * platform authenticator (Face ID, Windows Hello, Android/Touch fingerprint).
 *
 * Scope, deliberately: this is a PRIVACY SCREEN on top of an already-signed-in
 * Supabase session, not a new authentication factor. There is no server round
 * trip and nothing here is verified by the backend — we only check whether
 * `navigator.credentials.get()` resolves, which the OS/browser's secure
 * enclave already gates on the correct biometric. The app's real security
 * boundary remains Supabase auth + Row-Level Security, exactly as documented
 * in CLAUDE.md §3. This exists to stop someone who picks up an
 * already-unlocked device from casually seeing PHI, not to replace real auth.
 *
 * Off by default, and per-device by nature: enabling it on one device (laptop)
 * does not enable it on another (phone) — each device's platform authenticator
 * is a separate secure enclave, so each needs its own one-time registration.
 */

const CREDENTIAL_ID_KEY = 't1d-biometric-credential-id'

export function isBiometricLockSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
  )
}

/** Whether THIS device actually has a usable platform authenticator (Face ID,
 *  Windows Hello, fingerprint reader), not just API support. */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isBiometricLockSupported()) return false
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

export function isBiometricLockEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return !!localStorage.getItem(CREDENTIAL_ID_KEY)
  } catch {
    return false
  }
}

// Cast to BufferSource at the call site: newer TS DOM lib types are stricter
// about Uint8Array's backing buffer than WebAuthn's BufferSource actually
// requires (a plain, non-shared ArrayBuffer, which crypto.getRandomValues
// always produces here) — this is a type-level mismatch only, not a runtime
// concern.
function randomChallenge(): BufferSource {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return bytes as BufferSource
}

function bufferToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

function base64ToBuffer(b64: string): ArrayBuffer {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer
}

/**
 * Registers a new platform-authenticator credential on THIS device and
 * remembers its id locally (device-only — nothing is sent to the server).
 * Returns false on any failure (unsupported, user declined, no biometric
 * enrolled on the OS) rather than throwing, so the caller can show a plain
 * "couldn't enable" message.
 */
export async function registerBiometricLock(userId: string, userLabel: string): Promise<boolean> {
  if (!isBiometricLockSupported()) return false
  try {
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: randomChallenge(),
        rp: { name: 'T1D Supply Hub' },
        user: {
          id: new TextEncoder().encode(userId).slice(0, 64),
          name: userLabel,
          displayName: userLabel,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null
    if (!credential) return false
    localStorage.setItem(CREDENTIAL_ID_KEY, bufferToBase64(credential.rawId))
    return true
  } catch {
    return false
  }
}

/**
 * Prompts this device's biometric check against the stored credential.
 * Resolves true only if the platform authenticator itself confirms it's the
 * enrolled user — we never see or verify a raw signature, matching this
 * feature's local-only scope (see module doc).
 */
export async function verifyBiometricLock(): Promise<boolean> {
  const stored = typeof window !== 'undefined' ? localStorage.getItem(CREDENTIAL_ID_KEY) : null
  if (!stored) return false
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomChallenge(),
        allowCredentials: [{ id: base64ToBuffer(stored), type: 'public-key' }],
        userVerification: 'required',
        timeout: 60_000,
      },
    })
    return !!assertion
  } catch {
    return false
  }
}

/** Turns the lock off on this device. Does not (and cannot, via WebAuthn)
 *  delete the OS-level enrolled biometric — only stops this app from
 *  requiring it, same as disabling an app-specific Face ID toggle on iOS. */
export function disableBiometricLock(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(CREDENTIAL_ID_KEY)
  } catch {
    /* ignore */
  }
}
