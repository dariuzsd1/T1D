import * as React from "react"
import { cn } from "@/lib/utils"

/** Standard text input. Calm Clinical styling + visible focus ring (a11y). */
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "w-full min-h-[44px] rounded-xl border border-line bg-surface px-4 py-2.5 text-ink placeholder:text-faint transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary disabled:opacity-50",
      className
    )}
    {...props}
  />
))
Input.displayName = "Input"
