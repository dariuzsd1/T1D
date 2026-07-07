'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import { createClient } from '@/lib/supabase/client'
import { ProductCard } from '@/components/inventory/ProductCard'
import { EditProductModal } from '@/components/inventory/EditProductModal'
import { displayStatus } from '@/lib/depletion'
import { rowToPrescription, type Prescription } from '@/lib/prescriptions'
import { useToast } from '@/components/ui/Toast'
import { BackButton } from '@/components/ui/BackButton'
import { useI18n } from '@/lib/i18n'
import { Plus } from 'lucide-react'

export default function SuppliesPage() {
  const { inventory, setInventory, updateProduct, removeProduct, safetyBufferDays } = useStore()
  const { showToast } = useToast()
  const { t } = useI18n()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])

  const editingProduct = inventory.find((p) => p.id === editingId) ?? null
  const rxById = new Map(prescriptions.map((rx) => [rx.id, rx]))
  const linkedRxFor = (p: { prescriptionId?: string | null }) =>
    p.prescriptionId ? rxById.get(p.prescriptionId) ?? null : null

  const handleOrder = (label: string) =>
    showToast(
      label === 'find a supplier'
        ? t('toast.openingSearch')
        : t('toast.openingSupplier', { label }),
      'info'
    )

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/inventory')
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const result = await response.json()
        setInventory(result.data || [])
        setError(null)
      } catch (err: any) {
        console.error('Failed to fetch inventory:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchInventory()

    // Prescriptions power the runway ↔ refills-left line on each card.
    // Best-effort: a missing table just means no reconciliation lines.
    createClient()
      .from('prescriptions')
      .select('*')
      .then(({ data }) => {
        if (data) setPrescriptions(data.map(rowToPrescription))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Three honest groups: real alarms (out/low on facts), unknown-rate items
  // (calm "set usage" prompt — never an alarm built on the fallback estimate),
  // and the genuinely well stocked.
  const sortedInventory = [...inventory].sort((a, b) => a.remainingDays - b.remainingDays)
  const statusOf = (p: (typeof inventory)[number]) => displayStatus(p, safetyBufferDays)
  const needsAttention = sortedInventory.filter((p) => {
    const s = statusOf(p)
    return s === 'out' || s === 'low'
  })
  const unsetItems = sortedInventory.filter((p) => statusOf(p) === 'unset')
  const stableItems = sortedInventory.filter((p) => statusOf(p) === 'ok')

  return (
    <div className="space-y-10" aria-busy={loading}>
      <BackButton />

      <section className="flex justify-between items-end">
        <div>
          <h2 className="text-muted text-xs font-semibold uppercase tracking-[0.2em] mb-2">{t('supplies.kicker')}</h2>
          <h1 className="text-3xl font-bold tracking-tight text-ink">{t('supplies.title')}</h1>
        </div>
        <Link
          href="/scan"
          className="bg-primary hover:bg-primary-deep text-white px-5 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
        >
          <Plus className="w-5 h-5" />
          {t('supplies.addSupply')}
        </Link>
      </section>

      <p role="status" aria-live="polite" className="sr-only">
        {loading ? t('supplies.loadingSr') : ''}
      </p>

      {loading && (
        <div className="bg-surface border border-line rounded-2xl p-12 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-surface-2 rounded w-32 mx-auto" />
            <div className="h-8 bg-surface-2 rounded w-24 mx-auto" />
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="bg-urgent-soft border border-urgent/30 rounded-2xl p-6">
          <p className="text-urgent font-semibold mb-2">{t('supplies.errorTitle')}</p>
          <p className="text-urgent/80 text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && inventory.length === 0 && (
        <div className="bg-surface border border-line rounded-2xl p-12 text-center space-y-4">
          <p className="text-muted font-medium">{t('supplies.emptyTitle')}</p>
          <Link
            href="/scan"
            className="inline-block bg-primary hover:bg-primary-deep text-white px-6 py-3 rounded-xl font-semibold transition-colors"
          >
            <Plus className="w-4 h-4 inline mr-2" />
            {t('supplies.emptyAdd')}
          </Link>
        </div>
      )}

      {!loading && needsAttention.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-caution rounded-full" />
            <h2 className="text-base font-semibold tracking-wide text-caution">{t('row.reorderSoon')}</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {needsAttention.map((item) => (
              <ProductCard
                key={item.id}
                product={item}
                bufferDays={safetyBufferDays}
                linkedRx={linkedRxFor(item)}
                onUpdate={updateProduct}
                onDelete={removeProduct}
                onOrder={handleOrder}
                onEdit={setEditingId}
              />
            ))}
          </div>
        </section>
      )}

      {!loading && unsetItems.length > 0 && (
        <section className="space-y-6 pt-10 border-t border-line">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-faint rounded-full" />
            <h2 className="text-base font-semibold tracking-wide text-muted">{t('supplies.groupSetUsage')}</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {unsetItems.map((item) => (
              <ProductCard
                key={item.id}
                product={item}
                bufferDays={safetyBufferDays}
                linkedRx={linkedRxFor(item)}
                onUpdate={updateProduct}
                onDelete={removeProduct}
                onOrder={handleOrder}
                onEdit={setEditingId}
              />
            ))}
          </div>
        </section>
      )}

      {!loading && stableItems.length > 0 && (
        <section className="space-y-6 pt-10 border-t border-line">
          <h2 className="text-base font-semibold tracking-wide text-muted">{t('row.wellStocked')}</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {stableItems.map((item) => (
              <ProductCard
                key={item.id}
                product={item}
                bufferDays={safetyBufferDays}
                linkedRx={linkedRxFor(item)}
                onUpdate={updateProduct}
                onDelete={removeProduct}
                onOrder={handleOrder}
                onEdit={setEditingId}
              />
            ))}
          </div>
        </section>
      )}

      <AnimatePresence>
        {editingProduct && (
          <EditProductModal
            product={editingProduct}
            onClose={() => setEditingId(null)}
            onUpdate={updateProduct}
            onSaved={(name) => showToast(t('supplies.updated', { name }), 'success')}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
