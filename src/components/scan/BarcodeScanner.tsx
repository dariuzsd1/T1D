'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { X, ScanBarcode, CameraOff, Loader2 } from 'lucide-react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { useDialog } from '@/lib/useDialog'

interface BarcodeScannerProps {
  /** Fires once with the decoded value when a barcode is read. */
  onDetected: (rawValue: string, format: string) => void
  onClose: () => void
  /** Called when the device/browser can't scan, so the parent can offer manual
   *  entry instead of a dead end. */
  onUnsupported?: () => void
}

// Symbologies worth attempting on diabetes-supply boxes and pharmacy labels.
// Restricting the set makes decoding faster and steadier than "try everything".
const HINTS = new Map([
  [
    DecodeHintType.POSSIBLE_FORMATS,
    [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128, // GS1-128 pharmacy labels
      BarcodeFormat.CODE_39,
      BarcodeFormat.ITF,
      BarcodeFormat.DATA_MATRIX, // GS1 DataMatrix on most modern boxes
      BarcodeFormat.QR_CODE,
    ],
  ],
])

type Phase = 'checking' | 'starting' | 'scanning' | 'unsupported' | 'denied' | 'error'

/**
 * Camera barcode scanner built on ZXing (`@zxing/browser`), which decodes in pure
 * JavaScript and therefore works wherever `getUserMedia` does — iOS Safari and
 * iOS Chrome, desktop Chrome/Edge/Firefox on any OS, and Android. We deliberately
 * do NOT use the native `BarcodeDetector` API: it is absent on iOS entirely and
 * on desktop Chrome outside macOS/ChromeOS, which is why the old build failed on
 * every device. Always stops the camera track on close/unmount.
 */
export function BarcodeScanner({ onDetected, onClose, onUnsupported }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const detectedRef = useRef(false)
  const [phase, setPhase] = useState<Phase>('checking')
  const [message, setMessage] = useState<string | null>(null)

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
  }, [])

  const handleClose = useCallback(() => {
    stopCamera()
    onClose()
  }, [stopCamera, onClose])

  // Escape, focus trap, focus restore, and scroll lock for the scanner dialog.
  const dialogRef = useDialog<HTMLDivElement>(handleClose)

  useEffect(() => {
    let cancelled = false

    async function start() {
      // getUserMedia needs a secure context (https or localhost) and a camera.
      // If it's missing, scanning truly can't run here — hand back to manual entry.
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        if (cancelled) return
        setPhase('unsupported')
        onUnsupported?.()
        return
      }

      const video = videoRef.current
      if (!video) return

      setPhase('starting')
      const reader = new BrowserMultiFormatReader(HINTS)

      try {
        // ZXing opens the rear camera, attaches it to our <video>, and invokes the
        // callback on every analysed frame (a miss throws NotFound — ignored).
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment' }, audio: false },
          video,
          (result) => {
            if (result && !detectedRef.current) {
              detectedRef.current = true
              stopCamera()
              onDetected(result.getText(), BarcodeFormat[result.getBarcodeFormat()])
            }
          }
        )
        if (cancelled) {
          controls.stop()
          return
        }
        controlsRef.current = controls
        setPhase('scanning')
      } catch (err: unknown) {
        if (cancelled) return
        const name = (err as { name?: string })?.name
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setPhase('denied')
          setMessage('Camera access was blocked. Allow it in your browser settings, or enter the supply manually.')
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          setPhase('error')
          setMessage('No camera was found on this device. You can still add the supply manually.')
        } else {
          setPhase('error')
          setMessage('Could not start the camera. You can still add the supply manually.')
        }
      }
    }

    start()
    return () => {
      cancelled = true
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showOverlay = phase !== 'scanning'

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div aria-hidden="true" onClick={handleClose} className="absolute inset-0 bg-ink/60" />

      <motion.div
        ref={dialogRef}
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

        {/* Camera viewport. The <video> is ALWAYS mounted and visible (never
            display:none) because iOS Safari will not play a hidden video; overlays
            sit on top of it until the stream is live. */}
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-ink/90">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="h-full w-full object-cover"
          />

          {/* Aiming frame, shown once the camera is live */}
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
                  ? 'Scanning needs a camera and a secure (https) connection. You can enter the supply by hand instead.'
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
          {showOverlay && phase !== 'checking' && phase !== 'starting'
            ? 'Enter manually instead'
            : 'Cancel'}
        </button>
      </motion.div>
    </div>
  )
}
