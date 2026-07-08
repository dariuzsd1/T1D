'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

type ToastVariant = 'success' | 'caution' | 'info'

interface Toast {
  id: string
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  /** Show an accessible toast. Defaults to the neutral "info" variant. */
  showToast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

/** Accessible replacement for window.alert(). Announces via role="status"
 *  (aria-live), is keyboard-dismissable, and respects prefers-reduced-motion. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = Math.random().toString(36).slice(2)
      setToasts((prev) => [...prev, { id, message, variant }])
      // Auto-dismiss after 6s; the user can also dismiss manually.
      setTimeout(() => dismiss(id), 6000)
    },
    [dismiss]
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="fixed bottom-24 right-4 z-50 flex flex-col gap-3 sm:bottom-6"
        aria-live="polite"
        aria-atomic="false"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

const VARIANTS: Record<
  ToastVariant,
  { icon: React.ReactNode; ring: string; iconColor: string }
> = {
  success: {
    icon: <CheckCircle2 className="w-5 h-5" />,
    ring: 'border-success/30',
    iconColor: 'text-success',
  },
  caution: {
    icon: <AlertTriangle className="w-5 h-5" />,
    ring: 'border-caution/30',
    iconColor: 'text-caution',
  },
  info: {
    icon: <Info className="w-5 h-5" />,
    ring: 'border-line',
    iconColor: 'text-primary',
  },
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast
  onDismiss: (id: string) => void
}) {
  const { t } = useI18n()
  const v = VARIANTS[toast.variant]
  return (
    <motion.div
      role="status"
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.18 }}
      className={`flex items-start gap-3 max-w-sm rounded-2xl border ${v.ring} bg-surface px-4 py-3 shadow-lg shadow-ink/10`}
    >
      <span className={`mt-0.5 shrink-0 ${v.iconColor}`}>{v.icon}</span>
      <p className="flex-1 text-sm font-medium leading-snug text-ink">
        {toast.message}
      </p>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label={t('common.dismissNotification')}
        className="shrink-0 rounded-lg p-1 text-faint transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx
}
