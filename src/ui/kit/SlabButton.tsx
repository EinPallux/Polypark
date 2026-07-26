"use client";

import { type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger";
type Size = "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary: "bg-sun-500 text-ink-900 hover:bg-sun-600 active:bg-sun-600",
  secondary:
    "bg-frost-100 text-ink-700 border border-ink-700/20 hover:bg-white active:bg-frost-300",
  danger: "bg-danger-500 text-white hover:brightness-95",
};

const sizeClasses: Record<Size, string> = {
  md: "px-5 py-2 text-sm",
  lg: "px-8 py-3 text-base",
};

/** Skewed rectangular action button (UI_UX §3) — the FIND GROUP energy. */
export function SlabButton({
  variant = "primary",
  size = "md",
  children,
  className = "",
  ...rest
}: {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`skew-ui inline-block cursor-pointer font-ui font-bold tracking-[0.06em] uppercase shadow-[var(--elev-slab)] transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-45 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      <span className="unskew-ui inline-block">{children}</span>
    </button>
  );
}
