import * as React from "react"
import { cn } from "@/lib/utils"

type Tone = "neutral" | "primary" | "success" | "caution" | "urgent"

// Each tone pairs a text + soft-background + border from the Calm Clinical palette.
// All text/background pairs meet 4.5:1 (see globals.css token notes).
const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted border-line",
  primary: "bg-primary/10 text-primary border-primary/30",
  success: "bg-success-soft text-success border-success/30",
  caution: "bg-caution-soft text-caution border-caution/30",
  urgent: "bg-urgent-soft text-urgent border-urgent/30",
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
}

/** Small status pill. Always pair with text (never color-alone) per app a11y rules. */
export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        tones[tone],
        className
      )}
      {...props}
    />
  )
}
