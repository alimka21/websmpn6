import * as React from "react"
import { cn } from "../../lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
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
          "inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-primary text-white hover:bg-primary-container shadow-sm rounded-lg":
              isPrimary,
            "bg-secondary text-white hover:bg-secondary/90 shadow-sm rounded-lg":
              variant === "secondary",
            "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg":
              variant === "outline",
            "bg-transparent text-primary hover:bg-primary/5 rounded-lg":
              variant === "ghost",
            "bg-error text-white hover:bg-error/90 shadow-sm rounded-lg":
              variant === "destructive",
            "h-9 px-6 py-2 text-sm":  size === "default",
            "h-8 px-3 text-xs":       size === "sm",
            "h-10 px-8 text-sm":      size === "lg",
            "h-9 w-9 px-0":           size === "icon",
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
