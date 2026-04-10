import { cn } from "@/lib/utils";
import { Shield, ShieldAlert, ShieldCheck } from "lucide-react";

interface ConfidenceBadgeProps {
  score: number;
  className?: string;
}

export function ConfidenceBadge({ score, className }: ConfidenceBadgeProps) {
  let status: "high" | "med" | "low" = "low";
  if (score >= 85) status = "high";
  else if (score >= 60) status = "med";

  const variants = {
    high: {
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
      text: "High Confidence",
    },
    med: {
      color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      icon: <Shield className="w-3.5 h-3.5" />,
      text: "Manual Check Req.",
    },
    low: {
      color: "text-red-400 bg-red-500/10 border-red-500/20",
      icon: <ShieldAlert className="w-3.5 h-3.5" />,
      text: "Uncertain Data",
    },
  };

  const current = variants[status];

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
      current.color,
      className
    )}>
      {current.icon}
      {current.text} ({score}%)
    </div>
  );
}
