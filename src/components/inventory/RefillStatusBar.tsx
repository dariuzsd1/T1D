import { cn } from "@/lib/utils";
import { Clock, AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import { stockStatus, DEFAULT_SAFETY_BUFFER_DAYS, type DisplayStatus } from "@/lib/depletion";
import { useI18n } from "@/lib/i18n";
import type { TKey } from "@/lib/i18n/dictionaries";

interface RefillStatusBarProps {
  daysRemaining: number;
  /** The user's reserve. Status is measured against this, not against zero. */
  bufferDays?: number;
  totalDays?: number;
  /** True when the runway rests on the fallback rate, not a user-entered one. */
  estimated?: boolean;
  /** Pass the caller's displayStatus so 'unset' renders neutral (an estimate
   *  never alarms). Falls back to raw stockStatus when not provided. */
  status?: DisplayStatus;
}

export function RefillStatusBar({
  daysRemaining,
  bufferDays = DEFAULT_SAFETY_BUFFER_DAYS,
  totalDays = 30,
  estimated = false,
  status,
}: RefillStatusBarProps) {
  const { t } = useI18n()
  const percentage = Math.min(100, Math.max(0, (daysRemaining / totalDays) * 100));

  const current = variants[status ?? stockStatus(daysRemaining, bufferDays)];

  return (
    <div className="space-y-2.5">
      <div className="flex justify-between items-end">
        <div className={cn("flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest", current.text)}>
          {current.icon}
          {t(current.labelKey)}
        </div>
        <div className="text-right">
          <span className="text-2xl font-black tabular-nums text-ink">{estimated ? '~' : ''}{daysRemaining}</span>
          <span className="text-[10px] font-semibold text-muted uppercase ml-1">{estimated ? t('product.estDaysLeft') : t('product.daysLeftLabel')}</span>
        </div>
      </div>

      <div className="h-2 w-full bg-surface-2 rounded-full overflow-hidden border border-line">
        <div
          className={cn("h-full transition-all duration-1000 ease-out rounded-full", current.bar)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// Semantic color: red only for a true stockout; routine low stock is amber;
// an unknown usage rate is neutral (never an alarm built on the fallback guess).
const variants: Record<DisplayStatus, { bar: string; text: string; icon: React.ReactNode; labelKey: TKey }> = {
  out: {
    bar: "bg-urgent",
    text: "text-urgent",
    icon: <AlertTriangle className="w-4 h-4" />,
    labelKey: "product.barOut",
  },
  low: {
    bar: "bg-caution",
    text: "text-caution",
    icon: <Clock className="w-4 h-4" />,
    labelKey: "product.barLow",
  },
  ok: {
    bar: "bg-success",
    text: "text-success",
    icon: <CheckCircle2 className="w-4 h-4" />,
    labelKey: "row.wellStocked",
  },
  unset: {
    bar: "bg-faint",
    text: "text-muted",
    icon: <HelpCircle className="w-4 h-4" />,
    labelKey: "product.barUnset",
  },
};
