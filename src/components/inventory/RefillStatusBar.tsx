import { cn } from "@/lib/utils";
import { Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { stockStatus, DEFAULT_SAFETY_BUFFER_DAYS } from "@/lib/depletion";

interface RefillStatusBarProps {
  daysRemaining: number;
  /** The user's reserve. Status is measured against this, not against zero. */
  bufferDays?: number;
  totalDays?: number;
}

export function RefillStatusBar({
  daysRemaining,
  bufferDays = DEFAULT_SAFETY_BUFFER_DAYS,
  totalDays = 30,
}: RefillStatusBarProps) {
  const percentage = Math.min(100, Math.max(0, (daysRemaining / totalDays) * 100));

  const status = stockStatus(daysRemaining, bufferDays);

  // Semantic color: red only for a true stockout; routine low stock is amber.
  const variants = {
    out: {
      bar: "bg-urgent",
      text: "text-urgent",
      icon: <AlertTriangle className="w-4 h-4" />,
      label: "Out — reorder now",
    },
    low: {
      bar: "bg-caution",
      text: "text-caution",
      icon: <Clock className="w-4 h-4" />,
      label: "Running low",
    },
    ok: {
      bar: "bg-success",
      text: "text-success",
      icon: <CheckCircle2 className="w-4 h-4" />,
      label: "Well stocked",
    },
  };

  const current = variants[status];

  return (
    <div className="space-y-2.5">
      <div className="flex justify-between items-end">
        <div className={cn("flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest", current.text)}>
          {current.icon}
          {current.label}
        </div>
        <div className="text-right">
          <span className="text-2xl font-black tabular-nums text-ink">{daysRemaining}</span>
          <span className="text-[10px] font-semibold text-muted uppercase ml-1">Days left</span>
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
