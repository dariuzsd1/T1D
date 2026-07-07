'use client'

import { Product } from "@/lib/store";
import { RefillStatusBar } from "./RefillStatusBar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Package, Trash2, Edit3, ShoppingCart, Minus, Loader2,
  CalendarClock, ChevronDown, PackagePlus, Pill, Droplet,
} from "lucide-react";
import { rxSupplyStatus, type Prescription } from "@/lib/prescriptions";
import { useToast } from "@/components/ui/Toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  displayStatus,
  reorderByDate,
  daysUntilExpiration,
  inUseDaysRemaining,
  isRateEstimated,
  DEFAULT_SAFETY_BUFFER_DAYS,
} from "@/lib/depletion";
import { reorderTargetFor } from "@/lib/suppliers";
import { logActivity } from "@/lib/activity";
import { format } from "date-fns";
import { useI18n } from "@/lib/i18n";

interface ProductCardProps {
  product: Product;
  bufferDays?: number;
  /** The prescription this supply is linked to (if any) — enables the honest
   *  runway ↔ refills-left reconciliation line. */
  linkedRx?: Prescription | null;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => Promise<void>;
  onUpdate?: (id: string, updates: Partial<Product>) => Promise<void>;
  onOrder?: (name: string) => void;
}

export function ProductCard({
  product,
  bufferDays = DEFAULT_SAFETY_BUFFER_DAYS,
  linkedRx = null,
  onEdit,
  onDelete,
  onUpdate,
  onOrder,
}: ProductCardProps) {
  const { t } = useI18n()
  // Semantic color: red is reserved for a true stockout; routine low stock is
  // amber; an unknown usage rate is neutral 'unset' (an estimate never alarms).
  const status = displayStatus(product, bufferDays)

  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRestocking, setIsRestocking] = useState(false)
  const { showToast } = useToast()
  // Items that need real attention open by default; the rest stay tidy.
  const [expanded, setExpanded] = useState(status === 'out' || status === 'low')

  const tone =
    status === 'out'
      ? { dot: 'bg-urgent', number: 'text-urgent', iconBg: 'bg-urgent-soft border-urgent/30', icon: 'text-urgent', btn: 'bg-urgent text-white' }
      : status === 'low'
      ? { dot: 'bg-caution', number: 'text-caution', iconBg: 'bg-caution-soft border-caution/30', icon: 'text-caution', btn: 'bg-caution text-white' }
      : status === 'unset'
      ? { dot: 'bg-faint', number: 'text-ink', iconBg: 'bg-surface-2 border-line', icon: 'text-muted', btn: 'bg-primary text-white' }
      : { dot: 'bg-success', number: 'text-ink', iconBg: 'bg-primary/10 border-primary/20', icon: 'text-primary', btn: 'bg-primary text-white' }

  const reorderBy = reorderByDate(product.remainingDays, bufferDays)
  const expiryDays = daysUntilExpiration(product.expirationDate)
  const reorder = reorderTargetFor(product)

  // Insulin in-use clock: an opened vial/pen must be tossed after its window
  // even if the printed expiry is later. Shown as its own line + a one-tap
  // "Opened today" reset. Only relevant once a discard window is set.
  const tracksInUse = product.inUseDays != null && product.inUseDays > 0
  const inUseLeft = inUseDaysRemaining(product.openedDate, product.inUseDays)
  const [isMarkingOpened, setIsMarkingOpened] = useState(false)

  const handleMarkOpened = async () => {
    setIsMarkingOpened(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      await onUpdate?.(product.id, { openedDate: today })
      void logActivity('supply_used', product.name)
      showToast(t('product.toastMarkedOpened', { name: product.name }), 'success')
    } catch (err) {
      console.error('Failed to mark opened:', err)
      showToast(t('product.toastMarkOpenedFail', { name: product.name }), 'caution')
    } finally {
      setIsMarkingOpened(false)
    }
  }

  // When the user hasn't set a real daily usage, the runway is a conservative
  // estimate — say so plainly rather than presenting a guess as fact (CLAUDE.md §9).
  const estimated = isRateEstimated(product.usageRatePerDay)

  // Runway ↔ prescription reconciliation ("no refills left and it runs out in
  // 9 days") — the moment to call the prescriber. Null when nothing actionable.
  const rxNote = linkedRx
    ? rxSupplyStatus({
        supplyName: product.name,
        runwayDays: product.remainingDays,
        rateEstimated: estimated,
        prescription: linkedRx,
      })
    : null

  const statusLabel =
    status === 'out' ? t('row.outOfStock')
    : status === 'low' ? t('row.reorderSoon')
    : status === 'unset' ? t('row.unsetLabel')
    : t('row.wellStocked')

  // One honest detail line: stock on hand · runway · when to reorder. An unset
  // item gets no reorder-by date — that date would rest on the guessed rate.
  const daysPhrase = estimated
    ? t('product.daysEstimate', { days: product.remainingDays })
    : t('product.daysExact', { days: product.remainingDays })
  const summary =
    status === 'out'
      ? t('product.summaryOut')
      : status === 'unset'
      ? t('product.summaryUnset', { quantity: product.quantity })
      : t('product.summaryKnown', {
          quantity: product.quantity,
          daysPhrase,
          date: format(reorderBy, 'EEE, MMM d'),
        })

  const handleUseOne = async () => {
    if (product.quantity > 0) {
      setIsUpdating(true)
      try {
        await onUpdate?.(product.id, { quantity: product.quantity - 1 })
        void logActivity('supply_used', product.name)
      } catch (err) {
        console.error('Failed to update:', err)
        showToast(t('product.toastCouldntSave', { name: product.name }), 'caution')
      } finally {
        setIsUpdating(false)
      }
    }
  }

  // "Reorder = re-add": after a box arrives, restock in one tap. We add a full box
  // on top of what's left — the box size comes from the catalog (matched by name),
  // falling back to 1 when the product isn't known rather than guessing a count.
  const handleRestock = async () => {
    setIsRestocking(true)
    try {
      let boxSize = 1
      try {
        const res = await fetch(`/api/scan/lookup?name=${encodeURIComponent(product.name)}`)
        if (res.ok) {
          const cat = await res.json()
          if (cat?.units_per_box && cat.units_per_box > 0) boxSize = cat.units_per_box
        }
      } catch {
        // Lookup is best-effort; a miss just means a box of 1.
      }
      await onUpdate?.(product.id, { quantity: product.quantity + boxSize })
      void logActivity('supply_restocked', product.name)
      showToast(t('product.toastRestocked', { name: product.name, count: boxSize }), 'success')
    } catch (err) {
      console.error('Failed to restock:', err)
      showToast(t('product.toastRestockFail'), 'caution')
    } finally {
      setIsRestocking(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await onDelete?.(product.id)
    } catch (err) {
      console.error('Failed to delete:', err)
      showToast(t('product.toastDeleteFail', { name: product.name }), 'caution')
    } finally {
      setIsDeleting(false)
    }
  }

  const panelId = `supply-detail-${product.id}`

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="bg-surface border-line hover:border-primary/30 transition-colors overflow-hidden">
        <CardContent className="p-0">
          {/* Collapsed glance — name, status, days. Tap to reveal detail + actions.
              The quick "use one" button sits alongside (not inside) the toggle so a
              user can log usage in one tap without opening the card. */}
          <div className="flex items-center">
            <button
              onClick={() => setExpanded((e) => !e)}
              aria-expanded={expanded}
              aria-controls={panelId}
              className="flex-1 min-w-0 flex items-center gap-4 p-5 text-left transition-colors hover:bg-surface-2/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            >
              <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center border shrink-0", tone.iconBg)}>
                <Package className={cn("w-5 h-5", tone.icon)} />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-ink leading-tight truncate">{product.name}</h3>
                <p className="text-sm text-muted truncate">
                  {product.brand ? `${product.brand} · ` : ''}{statusLabel}
                </p>
              </div>

              <div className="text-right shrink-0">
                <div className={cn("text-2xl font-black tabular-nums leading-none", tone.number)}>
                  {estimated ? '~' : ''}{product.remainingDays}
                </div>
                <div className="text-[10px] font-semibold text-muted uppercase tracking-wider mt-0.5">
                  {estimated ? t('product.estDaysLeft') : t('product.daysLeftLabel')}
                </div>
              </div>

              <ChevronDown
                className={cn(
                  "w-5 h-5 text-faint transition-transform shrink-0",
                  expanded && "rotate-180"
                )}
                aria-hidden="true"
              />
            </button>

            {/* One-tap "use one" — log usage without expanding the card first */}
            <button
              onClick={handleUseOne}
              disabled={isUpdating || product.quantity === 0}
              aria-label={t('common.useOneAria', { name: product.name })}
              title={product.quantity === 0 ? t('product.noneOnHandTitle') : t('product.logOneUsedTitle')}
              className="shrink-0 mr-4 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-line bg-surface-2 text-ink transition-colors hover:bg-line active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Minus className="w-4 h-4" />}
            </button>
          </div>

          {/* Expanded detail + actions */}
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                id={panelId}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-5 pt-1 space-y-4 border-t border-line">
                  {/* Usage rate + edit hand-off */}
                  <div className="flex items-center gap-1.5 pt-3 text-xs text-muted">
                    <span
                      className={cn(
                        "inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full",
                        estimated
                          ? "bg-caution-soft text-caution border border-caution/30"
                          : "bg-success-soft text-success border border-success/30"
                      )}
                    >
                      {estimated ? t('product.estimateBadge') : t('product.trackedBadge')}
                    </span>
                    <span>
                      {estimated ? t('product.usageNotSet') : t('product.perDay', { rate: Math.round(product.usageRatePerDay * 10) / 10 })}
                    </span>
                    <span aria-hidden="true">·</span>
                    <button
                      onClick={() => onEdit?.(product.id)}
                      aria-label={t('common.editAria', { name: product.name })}
                      className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
                    >
                      {estimated ? t('product.setRate') : t('common.edit')}
                    </button>
                  </div>

                  {/* Honest one-line summary */}
                  <p className="text-sm text-muted font-medium">{summary}</p>

                  {/* Prescription reconciliation — only when actionable */}
                  {rxNote && (
                    <p className={cn(
                      "flex items-start gap-1.5 text-xs font-medium",
                      rxNote.level === 'act' ? "text-caution" : "text-muted"
                    )}>
                      <Pill className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      {rxNote.message}
                    </p>
                  )}

                  {/* Expiration + FEFO guidance (use oldest first) */}
                  {expiryDays !== null && (
                    <p className={cn(
                      "flex items-center gap-1.5 text-xs font-medium",
                      expiryDays <= 0 ? "text-urgent" : expiryDays <= 30 ? "text-caution" : "text-muted"
                    )}>
                      <CalendarClock className="w-3.5 h-3.5" />
                      {expiryDays <= 0
                        ? t('product.expiredOn', { date: format(new Date(product.expirationDate!), 'MMM d, yyyy') })
                        : t('product.expiresOn', { date: format(new Date(product.expirationDate!), 'MMM d, yyyy') })}
                    </p>
                  )}

                  {/* In-use (opened-vial) clock — insulin's 28-day discard window */}
                  {tracksInUse && (
                    inUseLeft === null ? (
                      <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                        <Droplet className="w-3.5 h-3.5" />
                        {t('product.notOpenedYet', { days: product.inUseDays! })}
                      </p>
                    ) : (
                      <p className={cn(
                        "flex items-center gap-1.5 text-xs font-medium",
                        inUseLeft <= 0 ? "text-urgent" : inUseLeft <= 5 ? "text-caution" : "text-muted"
                      )}>
                        <Droplet className="w-3.5 h-3.5" />
                        {inUseLeft <= 0
                          ? t('product.discardPast', { days: product.inUseDays! })
                          : `${t(product.inUseDays! - inUseLeft === 1 ? 'product.openedDaysAgoOne' : 'product.openedDaysAgoOther', { days: product.inUseDays! - inUseLeft })} · ${t(inUseLeft === 1 ? 'product.discardInOne' : 'product.discardInOther', { days: inUseLeft })}`}
                      </p>
                    )
                  )}

                  <div className="bg-surface-2 rounded-xl p-4 border border-line">
                    <RefillStatusBar daysRemaining={product.remainingDays} bufferDays={bufferDays} estimated={estimated} status={status} />
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleUseOne}
                      disabled={isUpdating || product.quantity === 0}
                      aria-label={t('common.useOneAria', { name: product.name })}
                      className={cn(
                        "flex items-center gap-2 px-4 min-h-[44px] rounded-xl text-xs font-semibold uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary",
                        tone.btn
                      )}
                    >
                      {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Minus className="w-3.5 h-3.5" />}
                      {t('product.useOne')}
                    </button>

                    <button
                      onClick={handleRestock}
                      disabled={isRestocking}
                      aria-label={`${t('product.restock')} ${product.name}`}
                      title={t('product.restockTitle')}
                      className="flex items-center gap-2 px-4 min-h-[44px] rounded-xl text-xs font-semibold uppercase tracking-widest bg-surface-2 hover:bg-line border border-line text-ink transition-colors active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {isRestocking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PackagePlus className="w-3.5 h-3.5" />}
                      {t('product.restock')}
                    </button>

                    {/* One-tap reset of the in-use clock when a new vial/pen is opened */}
                    {tracksInUse && (
                      <button
                        onClick={handleMarkOpened}
                        disabled={isMarkingOpened}
                        aria-label={t('product.openedTodayAria', { name: product.name })}
                        title={t('product.openedTodayTitle')}
                        className="flex items-center gap-2 px-4 min-h-[44px] rounded-xl text-xs font-semibold uppercase tracking-widest bg-surface-2 hover:bg-line border border-line text-ink transition-colors active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        {isMarkingOpened ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Droplet className="w-3.5 h-3.5" />}
                        {t('product.openedToday')}
                      </button>
                    )}

                    <a
                      href={reorder.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => onOrder?.(reorder.label)}
                      className="flex items-center gap-2 px-4 min-h-[44px] rounded-xl text-xs font-semibold uppercase tracking-widest bg-surface-2 hover:bg-line border border-line text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      {t('row.reorder')}
                    </a>

                    <div className="ml-auto flex gap-1">
                      <button
                        onClick={() => onEdit?.(product.id)}
                        className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center hover:bg-surface-2 rounded-lg text-faint hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        aria-label={t('common.editAria', { name: product.name })}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center hover:bg-urgent-soft rounded-lg text-faint hover:text-urgent transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-urgent"
                        aria-label={t('common.deleteAria', { name: product.name })}
                      >
                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}
