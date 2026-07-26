"use client";

import { type ReactNode } from "react";
import { RibbonTag } from "./RibbonTag";

/**
 * The flat color-block card with sunburst header and frost slab footer
 * (UI_UX §3, straight from Example_UI_1/2). `accent` takes a kit color token.
 */
export function KitCard({
  accent,
  icon,
  eyebrow,
  title,
  blurb,
  ribbon,
  disabled = false,
  selected = false,
  onSelect,
  testId,
}: {
  /** CSS color value — use a kit token, e.g. `var(--kit-rails)`. */
  accent: string;
  icon: ReactNode;
  eyebrow?: string;
  title: string;
  blurb?: string;
  ribbon?: { variant: "new" | "locked" | "info"; label: string };
  disabled?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={selected}
      className={`group relative flex w-56 flex-col text-left shadow-[var(--elev-slab)] transition-transform duration-100 ${
        disabled ? "cursor-not-allowed opacity-60 saturate-50" : "cursor-pointer hover:-translate-y-0.5"
      } ${selected ? "ring-2 ring-gold-400" : ""}`}
    >
      {ribbon ? (
        <span className="absolute -top-2 -left-2 z-10">
          <RibbonTag variant={ribbon.variant}>{ribbon.label}</RibbonTag>
        </span>
      ) : null}
      <span
        className="sunburst flex h-32 items-center justify-center text-white"
        style={{ backgroundColor: accent }}
        aria-hidden
      >
        <span className="text-5xl drop-shadow-[0_2px_0_rgba(16,21,31,0.25)]">{icon}</span>
      </span>
      <span className="flex flex-1 flex-col gap-0.5 bg-frost-100 px-4 py-3">
        {eyebrow ? (
          <span className="font-ui text-xs font-semibold tracking-[0.08em] text-sky-500 uppercase">
            {eyebrow}
          </span>
        ) : null}
        <span className="skew-ui font-ui text-xl font-bold tracking-tight text-ink-700 uppercase">
          {title}
        </span>
        {blurb ? <span className="font-body text-xs text-ink-500">{blurb}</span> : null}
      </span>
      <span
        className={`h-1 w-full ${selected ? "bg-gold-400" : "bg-transparent group-hover:bg-white/70"}`}
        aria-hidden
      />
    </button>
  );
}
