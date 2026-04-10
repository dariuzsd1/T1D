import { cn } from "@/lib/utils";
import { Clock, AlertTriangle } from "lucide-react";

interface RefillStatusBarProps {
  daysRemaining: number;
  totalDays?: number;
}

export function RefillStatusBar({ daysRemaining, totalDays = 30 }: RefillStatusBarProps) {
  const percentage = Math.min(100, Math.max(0, (daysRemaining / totalDays) * 100));
  
  let status: "urgent" | "warning" | "stable" = "stable";
  if (daysRemaining <= 3) status = "urgent";
  else if (daysRemaining <= 7) status = "warning";

  const variants = {
    urgent: {
      bar: "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)]",
      text: "text-red-400",
      icon: <AlertTriangle className="w-4 h-4" />,
      label: "Critical: Order Now",
    },
    warning: {
      bar: "bg-amber-500",
      text: "text-amber-400",
      icon: <Clock className="w-4 h-4" />,
      label: "Running Low",
    },
    stable: {
      bar: "bg-blue-600",
      text: "text-blue-400",
      icon: null,
      label: "Inventory Stable",
    },
  };

  const current = variants[status];

  return (
    <div className="space-y-2.5">
      <div className="flex justify-between items-end">
        <div className={cn("flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest", current.text)}>
          {current.icon}
          {current.label}
        </div>
        <div className="text-right">
          <span className="text-2xl font-black tabular-nums">{daysRemaining}</span>
          <span className="text-[10px] font-bold text-gray-500 uppercase ml-1">Days Left</span>
        </div>
      </div>
      
      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
        <div 
          className={cn("h-full transition-all duration-1000 ease-out rounded-full", current.bar)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
