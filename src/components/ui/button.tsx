import * as React from "react"
import { cn } from "../../lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * - `default` / `primary` — tombol utama (dark blue, pill)
   * - `secondary` — aksi teal (success / progress)
   * - `outline` — neutral outline, untuk Batal/Tutup
   * - `ghost` — text-only, untuk action ringan di dalam card
   * - `destructive` — error (red), untuk Hapus
   */
  variant?: "default" | "primary" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const isPrimary = variant === "default" || variant === "primary";
    return (
      <button
        ref={ref}
        className={cn(
          // Base: label typography (uppercase, tracking), tegas, active press effect
          "inline-flex items-center justify-center whitespace-nowrap font-bold uppercase tracking-wider text-label-md transition-all active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50",
          {
            // Primary — pill, deep blue
            "bg-primary text-white hover:bg-primary/90 shadow-sm rounded-full":
              isPrimary,
            "bg-secondary text-white hover:bg-secondary/90 rounded-lg":
              variant === "secondary",
            "border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low rounded-lg":
              variant === "outline",
            "bg-transparent text-primary hover:bg-primary-container/10 rounded-lg":
              variant === "ghost",
            "bg-error text-white hover:bg-error/90 shadow-sm rounded-lg":
              variant === "destructive",
            // Sizing (pill primary → wider px; sisanya tetap proporsional)
            "h-10 px-8 py-2.5": size === "default" && isPrimary,
            "h-9 px-4 py-2": size === "default" && !isPrimary,
            "h-8 px-3 text-label-sm": size === "sm",
            "h-11 px-10 text-label-md": size === "lg",
            "h-9 w-9 px-0": size === "icon",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
