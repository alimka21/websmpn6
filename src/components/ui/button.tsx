import * as React from "react"
import { cn } from "../../lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * - `default` / `primary` — tombol utama (blue-600, rounded-xl)
   * - `secondary` — aksi teal
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
          "inline-flex items-center justify-center whitespace-nowrap font-bold transition-all active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-primary text-white hover:bg-primary-container shadow-md hover:shadow-lg hover:-translate-y-0.5 rounded-xl":
              isPrimary,
            "bg-secondary text-white hover:bg-secondary/90 rounded-xl":
              variant === "secondary",
            "border border-outline-variant bg-surface-container-lowest text-on-surface hover:border-primary/40 hover:bg-primary/5 hover:text-primary rounded-xl":
              variant === "outline",
            "bg-transparent text-primary hover:bg-primary/5 rounded-xl":
              variant === "ghost",
            "bg-error text-white hover:bg-error/90 shadow-md hover:shadow-lg hover:-translate-y-0.5 rounded-xl":
              variant === "destructive",
            "h-10 px-6 py-2.5 text-sm": size === "default",
            "h-8 px-3 text-xs":         size === "sm",
            "h-11 px-8 text-sm":        size === "lg",
            "h-9 w-9 px-0":             size === "icon",
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
