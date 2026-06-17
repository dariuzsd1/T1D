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
      color: "text-success bg-success-soft border-success/20",
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
      text: "High confidence",
    },
    med: {
      color: "text-caution bg-caution-soft border-caution/20",
      icon: <Shield className="w-3.5 h-3.5" />,
      text: "Check manually",
    },
    low: {
      color: "text-urgent bg-urgent-soft border-urgent/20",
      icon: <ShieldAlert className="w-3.5 h-3.5" />,
      text: "Uncertain",
    },
  };

  const current = variants[status];

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide border",
      current.color,
      className
    )}>
      {current.icon}
      {current.text} ({score}%)
    </div>
  );
}
