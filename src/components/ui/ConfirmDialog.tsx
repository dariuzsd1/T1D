'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import { useDialog } from '@/lib/useDialog'
import { useI18n } from '@/lib/i18n'

interface ConfirmOptions {
  /** Already-translated heading, e.g. t('confirm.deleteTitle', { name }). */
  title: string
  /** Already-translated explanation of what happens and that it can't be undone. */
  body: string
  /** Already-translated confirm-button label, e.g. t('confirm.deleteBtn'). */
  confirmLabel: string
  /** Optional confirm label; defaults to common.cancel. */
  cancelLabel?: string
  /** 'danger' paints the confirm button red (destructive); 'default' uses primary. */
  tone?: 'danger' | 'default'
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void
}

interface ConfirmContextValue {
  /** Ask the user to confirm. Resolves true if they confirm, false otherwise. */
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

/**
 * Promise-based confirmation dialog, mounted once at the app root (sibling of
 * ToastProvider). Any component calls `const confirm = useConfirm()` then
 * `if (await confirm({...})) { ...destructive action... }`. Keeps each delete
 * site free of its own pending-state bookkeeping. Accessible (alertdialog role,
 * focus trap via useDialog, Escape/backdrop cancel, initial focus on Cancel so a
 * stray Enter never destroys data).
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...options, resolve })
      }),
    []
  )

  const settle = useCallback(
    (confirmed: boolean) => {
      setPending((prev) => {
        prev?.resolve(confirmed)
        return null
      })
    },
    []
  )

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {pending && <ConfirmModal pending={pending} onSettle={settle} />}
    </ConfirmContext.Provider>
  )
}

function ConfirmModal({
  pending,
  onSettle,
}: {
  pending: PendingConfirm
  onSettle: (confirmed: boolean) => void
}) {
  const { t } = useI18n()
  // Escape and backdrop both cancel (resolve false).
  const dialogRef = useDialog<HTMLDivElement>(() => onSettle(false))
  const cancelRef = useRef<HTMLButtonElement>(null)
  const danger = pending.tone !== 'default'

  // Focus Cancel on open: for a destructive prompt the safe option should hold
  // focus, so an accidental Enter dismisses rather than deletes.
  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div aria-hidden="true" onClick={() => onSettle(false)} className="absolute inset-0 bg-ink/40" />

      <motion.div
        ref={dialogRef}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        className="relative w-full max-w-sm bg-surface border border-line rounded-3xl p-6 shadow-lg"
      >
        <div className="flex gap-4">
          {danger && (
            <div className="w-10 h-10 rounded-2xl bg-urgent-soft flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-urgent" />
            </div>
          )}
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-lg font-bold text-ink leading-tight">
              {pending.title}
            </h2>
            <p id="confirm-body" className="mt-1.5 text-sm text-muted leading-relaxed">
              {pending.body}
            </p>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => onSettle(true)}
            className={`flex-1 py-3 rounded-xl font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
              danger
                ? 'bg-urgent hover:bg-urgent/90 focus-visible:ring-urgent'
                : 'bg-primary hover:bg-primary-deep focus-visible:ring-primary'
            }`}
          >
            {pending.confirmLabel}
          </button>
          <button
            ref={cancelRef}
            onClick={() => onSettle(false)}
            className="px-5 py-3 rounded-xl font-semibold text-muted hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {pending.cancelLabel ?? t('common.cancel')}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  const ctx = useContext(ConfirmContext)
  if (!ctx) {
    throw new Error('useConfirm must be used within a ConfirmProvider')
  }
  return ctx.confirm
}
