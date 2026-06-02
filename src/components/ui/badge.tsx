import * as React from "react"
import { cn } from "../../lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        {
          "border-transparent bg-primary text-on-primary hover:bg-primary-container": variant === "default",
          "border-transparent bg-surface-container text-on-surface hover:bg-outline-variant/40": variant === "secondary",
          "border-transparent bg-error text-white hover:bg-error/90": variant === "destructive",
          "border-transparent bg-secondary text-white hover:bg-secondary/90": variant === "success",
          "border-transparent bg-tertiary-fixed text-on-tertiary-fixed hover:bg-tertiary-fixed/80": variant === "warning",
          "text-on-surface": variant === "outline",
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
