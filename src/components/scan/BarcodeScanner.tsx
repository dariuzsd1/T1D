'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { X, ScanBarcode, CameraOff, Loader2 } from 'lucide-react'

interface BarcodeScannerProps {
  /** Fires once with the decoded value when a barcode is read. */
  onDetected: (rawValue: string, format: string) => void
  onClose: () => void
  /** Called when the device/browser can't scan, so the parent can offer manual
   *  entry instead of a dead end. */
  onUnsupported?: () => void
}

// Symbologies worth attempting on diabetes-supply boxes and pharmacy labels.
// The browser only uses the subset it actually supports.
const WANTED_FORMATS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'itf',
  'data_matrix',
  'qr_code',
]

type Phase = 'checking' | 'starting' | 'scanning' | 'unsupported' | 'denied' | 'error'

/**
 * Camera barcode scanner built on the browser's native Barcode Detection API
 * (zero npm dependencies). Supported on Chrome (Android/desktop) and Safari; on
 * anything else it shows an honest "not supported here" state and hands back to
 * manual entry. Always stops the camera track on close/unmount.
 */
export function BarcodeScanner({ onDetected, onClose, onUnsupported }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const detectedRef = useRef(false)
  const [phase, setPhase] = useState<Phase>('checking')
  const [message, setMessage] = useState<string | null>(null)

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const handleClose = useCallback(() => {
    stopCamera()
    onClose()
  }, [stopCamera, onClose])

  useEffect(() => {
    let cancelled = false

    async function start() {
      // 1. Feature-detect the native API.
      if (typeof window === 'undefined' || !('BarcodeDetector' in window)) {
        if (cancelled) return
        setPhase('unsupported')
        onUnsupported?.()
        return
      }

      // 2. Build a detector limited to the formats this device supports.
      let detector: BarcodeDetector
      try {
        const supported = await BarcodeDetector.getSupportedFormats()
        const formats = WANTED_FORMATS.filter((f) => supported.includes(f))
        detector = new BarcodeDetector(formats.length ? { formats } : undefined)
      } catch {
        if (cancelled) return
        setPhase('unsupported')
        onUnsupported?.()
        return
      }

      // 3. Open the rear camera.
      setPhase('starting')
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        setPhase('scanning')
      } catch (err: unknown) {
        if (cancelled) return
        const name = (err as { name?: string })?.name
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setPhase('denied')
          setMessage('Camera access was blocked. Allow it in your browser, or enter the supply manually.')
        } else {
          setPhase('error')
          setMessage('Could not start the camera. You can still add the supply manually.')
        }
        return
      }

      // 4. Detection loop. Throttled to ~5fps; stops on the first read.
      let last = 0
      const tick = async (now: number) => {
        if (cancelled || detectedRef.current) return
        const video = videoRef.current
        if (video && video.readyState >= 2 && now - last > 200) {
          last = now
          try {
            const codes = await detector.detect(video)
            if (codes.length > 0 && !detectedRef.current) {
              detectedRef.current = true
              stopCamera()
              onDetected(codes[0].rawValue, codes[0].format)
              return
            }
          } catch {
            // Per-frame detect can throw transiently (e.g. video not ready yet);
            // ignore and try the next frame.
          }
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    start()
    return () => {
      cancelled = true
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button aria-label="Close scanner" onClick={handleClose} className="absolute inset-0 bg-ink/60" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="scanner-title"
        className="relative w-full max-w-md bg-surface border border-line rounded-3xl p-6 shadow-lg"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <ScanBarcode className="w-5 h-5 text-primary" />
            <h2 id="scanner-title" className="text-lg font-bold text-ink">Scan a barcode</h2>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close scanner"
            className="rounded-lg p-1.5 text-faint hover:bg-surface-2 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera viewport */}
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-ink/90">
          <video
            ref={videoRef}
            playsInline
            muted
            className={
              phase === 'scanning' ? 'h-full w-full object-cover' : 'hidden'
            }
          />

          {/* Aiming frame */}
          {phase === 'scanning' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-28 w-3/4 rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
          )}

          {(phase === 'checking' || phase === 'starting') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/90">
              <Loader2 className="w-7 h-7 animate-spin" />
              <p className="text-sm font-medium">Starting camera…</p>
            </div>
          )}

          {(phase === 'unsupported' || phase === 'denied' || phase === 'error') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-white/90">
              <CameraOff className="w-8 h-8" />
              <p className="text-sm font-medium leading-relaxed">
                {phase === 'unsupported'
                  ? "This browser can't scan barcodes. Try Chrome or Safari, or enter the supply by hand."
                  : message}
              </p>
            </div>
          )}
        </div>

        {phase === 'scanning' && (
          <p className="mt-4 text-center text-sm text-muted">
            Hold the barcode on the box or pharmacy label inside the frame.
          </p>
        )}

        <button
          onClick={handleClose}
          className="mt-4 w-full rounded-xl bg-surface-2 py-3 font-semibold text-muted hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {phase === 'unsupported' || phase === 'denied' || phase === 'error'
            ? 'Enter manually instead'
            : 'Cancel'}
        </button>
      </motion.div>
    </div>
  )
}
