import * as React from "react"
import { cn } from "@/lib/utils"

type Variant = "primary" | "secondary" | "ghost" | "danger"
type Size = "sm" | "md" | "lg"

const variants: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-deep focus-visible:ring-primary",
  secondary: "bg-surface-2 text-ink border border-line hover:bg-line focus-visible:ring-primary",
  ghost: "text-ink hover:bg-surface-2 focus-visible:ring-primary",
  danger: "bg-urgent text-white hover:opacity-90 focus-visible:ring-urgent",
}

// All sizes meet the 44px touch-target minimum at md+ (WCAG 2.5.5 / app a11y rules).
const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm min-h-[36px]",
  md: "px-4 py-2.5 text-sm min-h-[44px]",
  lg: "px-6 py-3 text-base min-h-[48px]",
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

/** Standard action button. Honors the Calm Clinical palette + a11y focus ring. */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
)
Button.displayName = "Button"
