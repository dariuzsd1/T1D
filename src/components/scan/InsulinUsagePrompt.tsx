'use client'

import { useI18n } from '@/lib/i18n'

/**
 * The insulin usage prompt on the add-a-supply flow, and the reason it is a
 * separate component from the single-field UsagePrompt on that page.
 *
 * A usage rate is CONTAINERS per day. For strips the user's own number already
 * is that ("six a day"). For insulin it is not: they know their dose, and 40
 * typed into the one-field prompt would be stored as 40 vials a day. So this
 * asks the two numbers a dose actually needs and multiplies them out in
 * usageRate.insulinRatePerDay.
 *
 * Until this existed the app never asked about insulin at all: the catalog
 * leaves the rate blank because dosing is per person, no other flow filled it
 * in, and the supply sat at 'unset' forever. That kept the one item where
 * running out is measured in hours off the reorder list, off the calendar and
 * out of the risk banner, while a box of test strips was tracked properly.
 *
 * Optional, like the other prompt: a half-filled or skipped form leaves the
 * runway an honest estimate rather than blocking the add.
 */
export function InsulinUsagePrompt({
  id, dose, container, onDose, onContainer,
}: {
  id: string
  dose: string
  container: string
  onDose: (v: string) => void
  onContainer: (v: string) => void
}) {
  const { t } = useI18n()
  const field = 'w-full rounded-xl border border-line bg-surface p-3 font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary'
  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5 space-y-2">
      <p className="text-xs font-semibold text-ink">{t('scan.insulinPromptLabel')}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${id}-dose`} className="block text-[11px] font-medium text-muted mb-1.5">
            {t('editModal.insulinDoseLabel')}
          </label>
          <input
            id={`${id}-dose`}
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            placeholder={t('editModal.insulinDosePlaceholder')}
            value={dose}
            onChange={(e) => onDose(e.target.value)}
            className={field}
          />
        </div>
        <div>
          <label htmlFor={`${id}-container`} className="block text-[11px] font-medium text-muted mb-1.5">
            {t('editModal.insulinContainerLabel')}
          </label>
          <input
            id={`${id}-container`}
            type="number"
            inputMode="numeric"
            min="0"
            step="100"
            placeholder={t('editModal.insulinContainerPlaceholder')}
            value={container}
            onChange={(e) => onContainer(e.target.value)}
            className={field}
          />
        </div>
      </div>
      <p className="text-[11px] leading-relaxed text-muted">{t('scan.insulinPromptHelp')}</p>
    </div>
  )
}
