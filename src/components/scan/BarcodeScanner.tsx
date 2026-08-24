'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { X, ScanBarcode, CameraOff, Loader2, Flashlight, FlashlightOff } from 'lucide-react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat } from '@zxing/library'
import { barcodeHints, type ScanMode } from '@/lib/barcode'
import { decodeMatrixFromImageData } from '@/lib/zxingWasm'
import { cn } from '@/lib/utils'
import { useDialog } from '@/lib/useDialog'
import { useI18n } from '@/lib/i18n'
import type { TKey } from '@/lib/i18n/dictionaries'

interface BarcodeScannerProps {
  /** Fires once with the decoded value when a barcode is read. */
  onDetected: (rawValue: string, format: string) => void
  onClose: () => void
  /** Called when the device/browser can't scan, so the parent can offer manual
   *  entry instead of a dead end. */
  onUnsupported?: () => void
}

type Phase = 'checking' | 'starting' | 'scanning' | 'unsupported' | 'denied' | 'error'

/**
 * Camera constraints to try in order. A laptop has no rear camera, and some
 * setups (external webcams, virtual cameras, locked-down machines) reject a
 * facingMode or a 1080p request outright. Degrading to "any camera at a usable
 * resolution", then to "whatever the browser will give us", means a desktop opens
 * its webcam instead of reporting that no camera exists.
 */
const VIDEO_CONSTRAINTS: MediaTrackConstraints[] = [
  { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
  { width: { ideal: 1280 }, height: { ideal: 720 } },
  {},
]

/** A refused permission is never fixed by loosening the video constraints. */
function isPermissionError(err: unknown): boolean {
  const name = (err as { name?: string })?.name
  return name === 'NotAllowedError' || name === 'SecurityError'
}

/**
 * Camera barcode scanner built on ZXing (`@zxing/browser`), which decodes in pure
 * JavaScript and therefore works wherever `getUserMedia` does — iOS Safari and
 * iOS Chrome, desktop Chrome/Edge/Firefox on any OS, and Android. We deliberately
 * do NOT use the native `BarcodeDetector` API: it is absent on iOS entirely and
 * on desktop Chrome outside macOS/ChromeOS, which is why the old build failed on
 * every device. Always stops the camera track on close/unmount.
 */
export function BarcodeScanner({ onDetected, onClose, onUnsupported }: BarcodeScannerProps) {
  const { t } = useI18n()
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  // The 'matrix' (2D) path runs its own getUserMedia stream + decode interval
  // (zxing-wasm), separate from ZXing-js's controls used by the 'all' path.
  const matrixStreamRef = useRef<MediaStream | null>(null)
  const matrixIntervalRef = useRef<number | null>(null)
  const detectedRef = useRef(false)
  const [phase, setPhase] = useState<Phase>('checking')
  // Store a translation KEY, not a resolved string, so a mid-error language
  // switch re-renders in the new language.
  const [messageKey, setMessageKey] = useState<TKey | null>(null)
  // Scan mode: 'all' (default, every symbology) or 'matrix' (focus the decoder
  // on 2D square codes for the small, dense pharmacy DataMatrix). Switching it
  // restarts the camera with the matching decoder hints.
  const [mode, setMode] = useState<ScanMode>('all')
  // Torch (flashlight): only offered when the active camera track reports the
  // capability — it's absent on most laptops and on iOS Safari.
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

  /** The live video track, whichever decode path started the camera. */
  const activeTrack = useCallback((): MediaStreamTrack | null => {
    const stream =
      matrixStreamRef.current ?? (videoRef.current?.srcObject as MediaStream | null)
    return stream?.getVideoTracks?.()[0] ?? null
  }, [])

  const toggleTorch = useCallback(async () => {
    const track = activeTrack()
    if (!track) return
    const next = !torchOn
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] } as unknown as MediaTrackConstraints)
      setTorchOn(next)
    } catch {
      // Some devices advertise torch but refuse mid-stream; keep the UI honest.
      setTorchSupported(false)
    }
  }, [activeTrack, torchOn])

  const stopCamera = useCallback(() => {
    setTorchOn(false)
    setTorchSupported(false)
    // ZXing-js path
    controlsRef.current?.stop()
    controlsRef.current = null
    // zxing-wasm (2D) path: stop the decode loop and release the camera.
    if (matrixIntervalRef.current != null) {
      clearInterval(matrixIntervalRef.current)
      matrixIntervalRef.current = null
    }
    if (matrixStreamRef.current) {
      matrixStreamRef.current.getTracks().forEach((track) => track.stop())
      matrixStreamRef.current = null
    }
    const video = videoRef.current
    if (video && video.srcObject) video.srcObject = null
  }, [])

  const handleClose = useCallback(() => {
    stopCamera()
    onClose()
  }, [stopCamera, onClose])

  // Escape, focus trap, focus restore, and scroll lock for the scanner dialog.
  const dialogRef = useDialog<HTMLDivElement>(handleClose)

  useEffect(() => {
    let cancelled = false

    function handleCamError(err: unknown) {
      if (cancelled) return
      const name = (err as { name?: string })?.name
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setPhase('denied')
        setMessageKey('barcodeScanner.denied')
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setPhase('error')
        setMessageKey('barcodeScanner.noCamera')
      } else {
        setPhase('error')
        setMessageKey('barcodeScanner.error')
      }
    }

    // Offer the torch only if this camera actually reports the capability.
    function detectTorch(stream: MediaStream | null) {
      const track = stream?.getVideoTracks?.()[0]
      const caps = track?.getCapabilities?.() as { torch?: boolean } | undefined
      if (!cancelled && caps?.torch) setTorchSupported(true)
    }

    // Best-effort optical zoom so a small, dense code fills more of the sensor.
    async function applyZoom(stream: MediaStream) {
      const track = stream.getVideoTracks()[0]
      const caps = track?.getCapabilities?.() as { zoom?: { min: number; max: number } } | undefined
      if (track && caps?.zoom) {
        try {
          await track.applyConstraints({
            advanced: [{ zoom: Math.min(caps.zoom.max, Math.max(caps.zoom.min, 2)) }],
          } as unknown as MediaTrackConstraints)
        } catch {
          // Zoom is a nice-to-have; a failure must never break scanning.
        }
      }
    }

    // 1D / 'all' mode: ZXing-js continuous decode (reliable for striped barcodes).
    async function startLinear(video: HTMLVideoElement) {
      detectedRef.current = false
      setPhase('starting')
      // delayBetweenScanAttempts: analyse a frame roughly every 120ms — frequent
      // enough to feel instant, throttled enough that TRY_HARDER doesn't peg the CPU.
      const reader = new BrowserMultiFormatReader(barcodeHints(mode), {
        delayBetweenScanAttempts: 120,
      })
      try {
        let lastError: unknown = null
        for (const videoConstraints of VIDEO_CONSTRAINTS) {
          try {
            const controls = await reader.decodeFromConstraints(
              { video: videoConstraints, audio: false },
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
            detectTorch(video.srcObject as MediaStream | null)
            return
          } catch (err) {
            lastError = err
            if (isPermissionError(err)) break
          }
        }
        throw lastError
      } catch (err) {
        handleCamError(err)
      }
    }

    // 2D / 'matrix' mode: zxing-wasm (C++ engine) on a center-cropped frame — far
    // better at the small, dense pharmacy DataMatrix than ZXing-js.
    async function startMatrix(video: HTMLVideoElement) {
      detectedRef.current = false
      setPhase('starting')
      let stream: MediaStream | null = null
      let lastError: unknown = null
      for (const videoConstraints of VIDEO_CONSTRAINTS) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false })
          break
        } catch (err) {
          lastError = err
          if (isPermissionError(err)) break
        }
      }
      if (!stream) {
        handleCamError(lastError)
        return
      }
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      matrixStreamRef.current = stream
      video.srcObject = stream
      try {
        await video.play()
      } catch {
        // Autoplay can reject; the <video> is muted + playsInline so it recovers.
      }
      if (cancelled) {
        stopCamera()
        return
      }
      setPhase('scanning')
      detectTorch(stream)
      await applyZoom(stream)

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      // Cycle the center-square crop each frame so codes held at different
      // distances all get a turn: 0.8 (near), 0.55 (very close / tiny code),
      // 1.0 (whole frame / code held far). One ROI per tick keeps cost flat.
      const roiFactors = [0.8, 0.55, 1]
      let busy = false
      let tick = 0
      matrixIntervalRef.current = window.setInterval(async () => {
        if (cancelled || detectedRef.current || busy || !ctx) return
        const vw = video.videoWidth
        const vh = video.videoHeight
        if (!vw || !vh) return
        // Center square ROI: cropping preserves the code's native pixels, which is
        // what lets a tiny DataMatrix decode; cycling the size covers more distances.
        const side = Math.floor(Math.min(vw, vh) * roiFactors[tick++ % roiFactors.length])
        canvas.width = side
        canvas.height = side
        ctx.drawImage(video, Math.floor((vw - side) / 2), Math.floor((vh - side) / 2), side, side, 0, 0, side, side)
        let image: ImageData
        try {
          image = ctx.getImageData(0, 0, side, side)
        } catch {
          return
        }
        busy = true
        const res = await decodeMatrixFromImageData(image)
        busy = false
        if (res && !detectedRef.current && !cancelled) {
          detectedRef.current = true
          stopCamera()
          onDetected(res.text, res.format)
        }
      }, 180)
    }

    // getUserMedia needs a secure context (https or localhost) and a camera. If
    // it's missing, scanning truly can't run here — hand back to manual entry.
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPhase('unsupported')
      onUnsupported?.()
    } else {
      const video = videoRef.current
      if (video) {
        if (mode === 'matrix') startMatrix(video)
        else startLinear(video)
      }
    }

    return () => {
      cancelled = true
      stopCamera()
    }
    // Re-run (restart the camera with the mode-appropriate decoder) on mode change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

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
            <h2 id="scanner-title" className="text-lg font-bold text-ink">{t('barcodeScanner.title')}</h2>
          </div>
          <button
            onClick={handleClose}
            aria-label={t('barcodeScanner.closeAria')}
            className="rounded-lg p-1.5 text-faint hover:bg-surface-2 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode toggle: focus the decoder on 1D barcodes or the 2D square code. */}
        <div
          className="mb-4 flex gap-1 rounded-xl bg-surface-2 p-1"
          role="group"
          aria-label={t('barcodeScanner.title')}
        >
          <button
            type="button"
            onClick={() => setMode('all')}
            aria-pressed={mode === 'all'}
            className={cn(
              'flex-1 rounded-lg py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              mode === 'all' ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
            )}
          >
            {t('barcodeScanner.modeBarcode')}
          </button>
          <button
            type="button"
            onClick={() => setMode('matrix')}
            aria-pressed={mode === 'matrix'}
            className={cn(
              'flex-1 rounded-lg py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              mode === 'matrix' ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
            )}
          >
            {t('barcodeScanner.mode2d')}
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
              {/* A square reticle in 2D mode nudges the user to fill it with the
                  dot-grid square; a wide one suits a striped 1D barcode. */}
              <div
                className={cn(
                  'rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]',
                  mode === 'matrix' ? 'aspect-square w-3/5 max-w-56' : 'h-28 w-3/4'
                )}
              />
            </div>
          )}

          {/* Torch toggle — only rendered when the camera reports the capability. */}
          {phase === 'scanning' && torchSupported && (
            <button
              type="button"
              onClick={toggleTorch}
              aria-pressed={torchOn}
              aria-label={t(torchOn ? 'barcodeScanner.torchOff' : 'barcodeScanner.torchOn')}
              className={cn(
                'absolute bottom-3 right-3 rounded-full p-3 shadow-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
                torchOn ? 'bg-white text-ink' : 'bg-ink/60 text-white'
              )}
            >
              {torchOn ? <FlashlightOff className="w-5 h-5" /> : <Flashlight className="w-5 h-5" />}
            </button>
          )}

          {(phase === 'checking' || phase === 'starting') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/90">
              <Loader2 className="w-7 h-7 animate-spin" />
              <p className="text-sm font-medium">{t('camera.starting')}</p>
            </div>
          )}

          {(phase === 'unsupported' || phase === 'denied' || phase === 'error') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-white/90">
              <CameraOff className="w-8 h-8" />
              <p className="text-sm font-medium leading-relaxed">
                {phase === 'unsupported'
                  ? t('barcodeScanner.unsupported')
                  : messageKey && t(messageKey)}
              </p>
            </div>
          )}
        </div>

        {phase === 'scanning' && (
          <p className="mt-4 text-center text-sm text-muted">
            {mode === 'matrix' ? t('barcodeScanner.hint2d') : t('barcodeScanner.hint')}
          </p>
        )}

        <button
          onClick={handleClose}
          className="mt-4 w-full rounded-xl bg-surface-2 py-3 font-semibold text-muted hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {showOverlay && phase !== 'checking' && phase !== 'starting'
            ? t('barcodeScanner.enterManually')
            : t('common.cancel')}
        </button>
      </motion.div>
    </div>
  )
}
