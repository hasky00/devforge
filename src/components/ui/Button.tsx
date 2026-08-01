"use client";

import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-hover disabled:opacity-50 shadow-sm",
  secondary:
    "bg-surface-2 text-text border border-border hover:bg-surface-3 disabled:opacity-50",
  ghost: "text-text-muted hover:bg-surface-2 hover:text-text disabled:opacity-50",
  danger:
    "bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 disabled:opacity-50",
  success:
    "bg-success/15 text-success border border-success/30 hover:bg-success/25 disabled:opacity-50",
};

const sizes: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs gap-1 rounded-md",
  md: "h-9 px-3 text-sm gap-1.5 rounded-lg",
  icon: "h-8 w-8 p-0 rounded-md inline-flex items-center justify-center",
};

export function Button({
  className,
  variant = "secondary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
