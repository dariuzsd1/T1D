'use client'

import { useI18n } from '@/lib/i18n'

/**
 * "How many are in the box" — held as `number | ''` so the field can be fully
 * cleared mid-edit.
 *
 * The obvious `parseInt(value) || 1` forced the value back to 1 the instant the
 * field went empty, which trapped the leading digit: clearing "10" to type "40"
 * snapped to "1" and left the user with "140" or a stuck "1". A user hit exactly
 * that on a 40-count reservoir box. Empty is therefore a legal intermediate
 * state, and only becomes 1 when they leave the field.
 */
export type QuantityValue = number | ''

/** The value the field should hold after a keystroke. */
export function nextQuantity(raw: string): QuantityValue {
  if (raw === '') return ''
  const parsed = parseInt(raw, 10)
  // A box always holds at least one; NaN falls back rather than showing "NaN".
  return Math.max(1, Number.isNaN(parsed) ? 1 : parsed)
}

/** The value to settle on when the field loses focus. */
export function quantityOnBlur(current: QuantityValue): number {
  return current === '' ? 1 : current
}

interface QuantityFieldProps {
  /** Unique per confirm step; the label is bound to it. */
  id: string
  value: QuantityValue
  onChange: (next: QuantityValue) => void
}

export function QuantityField({ id, value, onChange }: QuantityFieldProps) {
  const { t } = useI18n()
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2"
      >
        {t('scan.quantity')}
      </label>
      <input
        id={id}
        type="number"
        min="1"
        value={value}
        onChange={(e) => onChange(nextQuantity(e.target.value))}
        onBlur={() => onChange(quantityOnBlur(value))}
        className="w-full bg-surface border border-line rounded-xl p-3.5 font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
      />
    </div>
  )
}
