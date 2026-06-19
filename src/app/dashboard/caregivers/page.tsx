'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, UserPlus, Trash2, Database, RefreshCw, Mail, Info,
  ShieldCheck, Eye, Loader2, X, ShoppingCart, Minus,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { isMissingTableError } from '@/lib/prescriptions'
import { stockStatus, isRateEstimated } from '@/lib/depletion'
import { reorderTargetFor } from '@/lib/suppliers'
import { useDialog } from '@/lib/useDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Product } from '@/lib/store'
import {
  type CaregiverShare, type CaregiverRole, type ShareStatus,
  type SharedWithMe, type CaregiverShareRow,
  rowToShare, rowToSharedWithMe, isValidEmail, ROLE_LABEL,
} from '@/lib/caregivers'

const STATUS_STYLE: Record<ShareStatus, { label: string; cls: string }> = {
  invited: { label: 'Invited', cls: 'bg-caution-soft text-caution border-caution/20' },
  accepted: { label: 'Active', cls: 'bg-success-soft text-success border-success/20' },
  revoked: { label: 'Revoked', cls: 'bg-surface-2 text-faint border-line' },
}

export default function CaregiversPage() {
  const supabase = useMemo(() => createClient(), [])
  const { showToast } = useToast()

  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [myShares, setMyShares] = useState<CaregiverShare[]>([])
  const [sharedWithMe, setSharedWithMe] = useState<SharedWithMe[]>([])
  const [loading, setLoading] = useState(true)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<CaregiverRole>('view')
  const [inviting, setInviting] = useState(false)

  // Which patient the caregiver is currently viewing (opens modal)
  const [viewing, setViewing] = useState<SharedWithMe | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user?.id ?? null)
    setUserEmail(user?.email ?? null)

    const { data, error: qErr } = await supabase
      .from('caregiver_shares')
      .select('*')
      .order('created_at', { ascending: false })

    if (qErr) {
      if (isMissingTableError(qErr)) setNeedsMigration(true)
      else setError(qErr.message)
      setLoading(false)
      return
    }

    setNeedsMigration(false)
    const rows = (data ?? []) as CaregiverShareRow[]
    // Split: rows where I am the owner vs rows where I am the caregiver
    setMyShares(rows.filter(r => r.owner_id === user?.id).map(rowToShare))
    setSharedWithMe(rows.filter(r => r.owner_id !== user?.id).map(rowToSharedWithMe))
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const handleInvite = async () => {
    const trimmed = email.trim().toLowerCase()
    if (!isValidEmail(trimmed)) {
      showToast('Please enter a valid email address.', 'caution')
      return
    }
    if (myShares.some(s => s.caregiverEmail.toLowerCase() === trimmed && s.status !== 'revoked')) {
      showToast('That person already has access.', 'info')
      return
    }
    setInviting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      showToast('You are signed out. Please sign in again.', 'caution')
      setInviting(false)
      return
    }
    const { error: iErr } = await supabase.from('caregiver_shares').insert({
      owner_id: user.id,
      owner_email: user.email,   // stored so caregivers can see whose data it is
      caregiver_email: trimmed,
      role,
      status: 'accepted',
    })
    setInviting(false)
    if (iErr) {
      showToast(`Couldn't add caregiver: ${iErr.message}`, 'caution')
      return
    }
    setEmail('')
    setRole('view')
    showToast(`Added ${trimmed}.`, 'success')
    await load()
  }

  const handleRevoke = async (share: CaregiverShare) => {
    const { error: dErr } = await supabase.from('caregiver_shares').delete().eq('id', share.id)
    if (dErr) {
      showToast(`Couldn't revoke: ${dErr.message}`, 'caution')
      return
    }
    setMyShares(prev => prev.filter(s => s.id !== share.id))
    showToast(`Removed ${share.caregiverEmail}.`, 'info')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-10">
      <header>
        <h2 className="text-muted text-xs font-semibold uppercase tracking-[0.2em] mb-2">Caregivers</h2>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Caregiver access</h1>
        <p className="text-muted text-sm mt-2 max-w-prose">
          Share your supplies with a parent, partner, or care team member — and see supplies
          that others have shared with you.
        </p>
      </header>

      {needsMigration && (
        <div className="bg-surface border border-line rounded-3xl p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Database className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-ink">One quick setup step</h3>
          <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">
            Caregiver sharing needs its table created first. Run{' '}
            <span className="font-semibold text-ink">supabase/setup.sql</span>{' '}
            in your Supabase SQL editor, then reload.
          </p>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 bg-surface-2 hover:bg-line text-ink px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> I&apos;ve run it — reload
          </button>
        </div>
      )}

      {!needsMigration && (
        <>
          {/* ── Section 1: People who shared with ME ── */}
          {sharedWithMe.length > 0 && (
            <section className="space-y-3">
              <h3 className="font-semibold text-ink flex items-center gap-2">
                <Eye className="w-5 h-5 text-teal" />
                People I help care for
              </h3>
              <p className="text-xs text-muted -mt-1">
                These people have shared their supplies with you. Click to view their inventory.
              </p>
              {sharedWithMe.map(s => (
                <div
                  key={s.shareId}
                  className="bg-surface border border-line rounded-2xl p-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-ink truncate">
                      {s.ownerEmail ?? `Patient (${s.ownerId.slice(0, 8)}…)`}
                    </p>
                    <p className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {ROLE_LABEL[s.role]}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setViewing(s)}
                  >
                    <Eye className="w-4 h-4" />
                    View supplies
                  </Button>
                </div>
              ))}
            </section>
          )}

          {/* ── Section 2: My caregivers (I am the owner) ── */}
          <section className="bg-surface border border-line rounded-3xl p-6 shadow-sm">
            <h3 className="font-semibold text-ink mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" /> Add a caregiver
            </h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="cg-email" className="block text-[11px] font-semibold uppercase tracking-widest text-muted mb-1.5">Their email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="cg-email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-surface border border-line rounded-xl p-3 pl-9 font-medium text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="cg-role" className="block text-[11px] font-semibold uppercase tracking-widest text-muted mb-1.5">Access level</label>
                <select
                  id="cg-role"
                  value={role}
                  onChange={e => setRole(e.target.value as CaregiverRole)}
                  className="w-full bg-surface border border-line rounded-xl p-3 font-medium text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
                >
                  <option value="view">Can view — see supplies &amp; refill timing</option>
                  <option value="manage">Can view &amp; manage — also log use and edit</option>
                </select>
              </div>
              <Button onClick={handleInvite} disabled={inviting} className="w-full">
                {inviting && <Loader2 className="w-4 h-4 animate-spin" />}
                {inviting ? 'Adding…' : 'Add caregiver'}
              </Button>
            </div>

            <div className="mt-4 flex gap-2.5 rounded-2xl bg-surface-2 border border-line p-3.5 text-xs text-muted leading-relaxed">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-faint" />
              <p>
                Access is live as soon as they sign in with this exact email. We don&apos;t send
                the invite automatically yet — share the app link with them directly.
              </p>
            </div>
          </section>

          {/* ── People with access to MY supplies ── */}
          <section className="space-y-3">
            <h3 className="font-semibold text-ink flex items-center gap-2">
              <Users className="w-5 h-5 text-muted" /> People with access to my supplies
            </h3>

            {loading && (
              <div className="bg-surface border border-line rounded-2xl p-10 text-center">
                <Loader2 className="w-5 h-5 text-muted animate-spin mx-auto" />
              </div>
            )}
            {error && (
              <div className="bg-urgent-soft border border-urgent/30 rounded-2xl p-6">
                <p className="text-urgent font-semibold">Couldn&apos;t load caregivers</p>
                <p className="text-urgent/80 text-sm mt-1">{error}</p>
              </div>
            )}
            {!loading && !error && myShares.length === 0 && (
              <div className="bg-surface border border-line rounded-2xl p-10 text-center">
                <Users className="w-7 h-7 text-faint mx-auto mb-3" />
                <p className="text-muted font-medium">No one has access yet</p>
              </div>
            )}
            {myShares.map(s => {
              const style = STATUS_STYLE[s.status]
              return (
                <div key={s.id} className="bg-surface border border-line rounded-2xl p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink truncate">{s.caregiverEmail}</p>
                    <p className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
                      <ShieldCheck className="w-3.5 h-3.5" /> {ROLE_LABEL[s.role]}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${style.cls}`}>
                      {style.label}
                    </span>
                    <button
                      onClick={() => handleRevoke(s)}
                      aria-label={`Remove ${s.caregiverEmail}`}
                      className="rounded-lg p-2 text-faint hover:bg-urgent-soft hover:text-urgent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-urgent"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </section>
        </>
      )}

      {/* ── View patient's supplies modal ── */}
      <AnimatePresence>
        {viewing && (
          <ViewPatientModal
            shared={viewing}
            onClose={() => setViewing(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

/** Modal that fetches and shows a patient's supplies as their caregiver. */
function ViewPatientModal({
  shared,
  onClose,
}: {
  shared: SharedWithMe
  onClose: () => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const { showToast } = useToast()
  const dialogRef = useDialog<HTMLDivElement>(onClose)
  const [inventory, setInventory] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Optimistic quantities so "Use One" feels instant
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({})

  const displayName = shared.ownerEmail ?? `Patient (${shared.ownerId.slice(0, 8)}…)`

  useEffect(() => {
    fetch(`/api/caregiver/${shared.ownerId}/inventory`)
      .then(r => r.json())
      .then(res => {
        if (res.error) { setError(res.error); setLoading(false); return }
        setInventory(res.data ?? [])
        const initial: Record<string, number> = {}
        for (const p of (res.data ?? [])) initial[p.id] = p.quantity
        setQtyMap(initial)
        setLoading(false)
      })
      .catch(() => { setError('Failed to load inventory.'); setLoading(false) })
  }, [shared.ownerId])

  const handleUseOne = async (product: Product) => {
    const current = qtyMap[product.id] ?? product.quantity
    if (current <= 0) return
    const next = current - 1
    // Optimistic update
    setQtyMap(prev => ({ ...prev, [product.id]: next }))
    const res = await fetch(`/api/caregiver/${shared.ownerId}/inventory`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplyId: product.id, quantity: next }),
    })
    if (!res.ok) {
      // Revert on failure
      setQtyMap(prev => ({ ...prev, [product.id]: current }))
      showToast('Could not update supply.', 'caution')
    } else {
      showToast(`Logged use of ${product.name}.`, 'success')
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-ink/40" />
      <motion.div
        ref={dialogRef}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="view-patient-title"
        className="relative w-full sm:max-w-lg bg-surface border border-line rounded-t-3xl sm:rounded-3xl shadow-xl max-h-[90dvh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-line shrink-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-teal mb-1">
              {shared.role === 'manage' ? 'View & manage' : 'View only'}
            </p>
            <h2 id="view-patient-title" className="text-xl font-bold text-ink">
              {displayName}&apos;s supplies
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-faint hover:bg-surface-2 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          )}
          {error && (
            <div className="bg-urgent-soft rounded-2xl p-4 text-urgent text-sm">{error}</div>
          )}
          {!loading && !error && inventory.length === 0 && (
            <p className="text-center text-muted py-12">No supplies recorded yet.</p>
          )}
          {!loading && !error && inventory.length > 0 && (
            <ul className="divide-y divide-line">
              {inventory.map(product => {
                const qty = qtyMap[product.id] ?? product.quantity
                const estimated = isRateEstimated(product.usageRatePerDay)
                const runway = estimated
                  ? (product.usageRatePerDay > 0 ? Math.round(qty / product.usageRatePerDay) : product.remainingDays)
                  : Math.round(qty / product.usageRatePerDay)
                const status = stockStatus(runway, 14)
                const tone = status === 'out' ? 'urgent' : status === 'low' ? 'caution' : 'success'
                const statusLabel = status === 'out' ? 'Out' : status === 'low' ? 'Reorder soon' : 'Well stocked'
                const reorder = reorderTargetFor(product)
                return (
                  <li key={product.id} className="py-3.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink text-sm truncate">{product.name}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {qty} on hand · {estimated ? '~' : ''}{runway} days
                        {product.brand ? ` · ${product.brand}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge tone={tone}>{statusLabel}</Badge>
                      {/* Use One — only for manage role */}
                      {shared.role === 'manage' && (
                        <button
                          onClick={() => handleUseOne(product)}
                          disabled={qty <= 0}
                          aria-label={`Use one ${product.name}`}
                          className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-faint hover:text-primary hover:bg-surface-2 disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          title="Use one"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      )}
                      {/* Reorder */}
                      <a
                        href={reorder.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Reorder ${product.name}`}
                        className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-faint hover:text-primary hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        title={reorder.isDirect ? `Reorder via ${reorder.label}` : 'Find a supplier'}
                      >
                        <ShoppingCart className="w-4 h-4" />
                      </a>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Footer note for view-only */}
        {shared.role === 'view' && (
          <div className="px-6 py-3 border-t border-line shrink-0">
            <p className="text-xs text-faint text-center">
              You have view-only access. Ask {displayName} to upgrade you to "manage" to log use.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  )
}
