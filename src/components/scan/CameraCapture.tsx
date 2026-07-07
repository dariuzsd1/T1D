'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Camera, CameraOff, Loader2 } from 'lucide-react'
import { useDialog } from '@/lib/useDialog'
import { useI18n } from '@/lib/i18n'
import type { TKey } from '@/lib/i18n/dictionaries'

type Phase = 'starting' | 'ready' | 'denied' | 'error' | 'unsupported'

/**
 * Take a still photo with the device camera. Unlike a <input capture> (which only
 * opens the camera on phones and silently falls back to a file picker on desktop),
 * this uses getUserMedia, so the camera opens on a laptop/desktop too. The captured
 * frame is handed back as an object URL; the caller then tries to read a barcode
 * from it and/or keeps it as a reference. Always stops the camera on close/unmount.
 */
export function CameraCapture({
  onCapture,
  onClose,
}: {
  onCapture: (url: string) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [phase, setPhase] = useState<Phase>('starting')
  // Store a translation KEY so a mid-error language switch re-renders correctly.
  const [messageKey, setMessageKey] = useState<TKey | null>(null)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const handleClose = useCallback(() => {
    stop()
    onClose()
  }, [stop, onClose])

  const dialogRef = useDialog<HTMLDivElement>(handleClose)

  useEffect(() => {
    let cancelled = false

    async function start() {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) setPhase('unsupported')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play()
        }
        setPhase('ready')
      } catch (err: unknown) {
        if (cancelled) return
        const name = (err as { name?: string })?.name
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setPhase('denied')
          setMessageKey('cameraCapture.denied')
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          setPhase('error')
          setMessageKey('cameraCapture.noCamera')
        } else {
          setPhase('error')
          setMessageKey('cameraCapture.error')
        }
      }
    }

    start()
    return () => {
      cancelled = true
      stop()
    }
  }, [stop])

  const capture = () => {
    const video = videoRef.current
    if (!video || phase !== 'ready') return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        stop()
        onCapture(url)
      },
      'image/jpeg',
      0.92,
    )
  }

  const failed = phase === 'denied' || phase === 'error' || phase === 'unsupported'

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div aria-hidden="true" onClick={handleClose} className="absolute inset-0 bg-ink/60" />

      <motion.div
        ref={dialogRef}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="camera-title"
        className="relative w-full max-w-md bg-surface border border-line rounded-3xl p-6 shadow-lg"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            <h2 id="camera-title" className="text-lg font-bold text-ink">{t('cameraCapture.title')}</h2>
          </div>
          <button
            onClick={handleClose}
            aria-label={t('cameraCapture.closeAria')}
            className="rounded-lg p-1.5 text-faint hover:bg-surface-2 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Always-mounted video (iOS Safari won't play a hidden video). */}
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-ink/90">
          <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-cover" />

          {phase === 'starting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/90">
              <Loader2 className="w-7 h-7 animate-spin" />
              <p className="text-sm font-medium">{t('camera.starting')}</p>
            </div>
          )}

          {failed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-white/90">
              <CameraOff className="w-8 h-8" />
              <p className="text-sm font-medium leading-relaxed">
                {phase === 'unsupported'
                  ? t('cameraCapture.unsupported')
                  : messageKey && t(messageKey)}
              </p>
            </div>
          )}
        </div>

        {phase === 'ready' && (
          <p className="mt-4 text-center text-sm text-muted">
            {t('cameraCapture.hint')}
          </p>
        )}

        <button
          onClick={failed ? handleClose : capture}
          disabled={phase === 'starting'}
          className="mt-4 w-full rounded-xl bg-primary hover:bg-primary-deep disabled:opacity-50 py-3.5 font-semibold text-white transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
        >
          {!failed && <Camera className="w-5 h-5" />}
          {failed ? t('cameraCapture.close') : t('cameraCapture.capture')}
        </button>
      </motion.div>
    </div>
  )
}
