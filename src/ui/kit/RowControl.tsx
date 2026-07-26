"use client";

import { useId, type ReactNode } from "react";

/**
 * The full-width Options row (UI_UX §3, Example_UI_4): label left, control
 * right, frost bar. Control variants: slider, toggle stepper, or custom.
 */
export function RowControl({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 bg-frost-100 px-4 py-2.5 shadow-[var(--elev-slab)]">
      <span className="font-ui text-sm font-semibold text-ink-700">{label}</span>
      <span className="flex items-center gap-3">{children}</span>
    </div>
  );
}

export function RowSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = "%",
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <RowControl label={label}>
      <input
        id={id}
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-44 cursor-pointer appearance-none rounded-full bg-frost-300 accent-(--sky-500)"
      />
      <output
        htmlFor={id}
        className="w-14 text-right font-numeral text-base font-semibold text-ink-700 tabular-nums"
      >
        {value}
        {unit}
      </output>
    </RowControl>
  );
}

export function RowToggle({
  label,
  value,
  onLabel,
  offLabel,
  onChange,
}: {
  label: string;
  value: boolean;
  onLabel: string;
  offLabel: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <RowControl label={label}>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className={`skew-ui min-w-20 cursor-pointer px-3 py-1 font-ui text-sm font-bold uppercase shadow-[var(--elev-slab)] ${
          value ? "bg-sky-500 text-white" : "bg-frost-300 text-ink-500"
        }`}
      >
        <span className="unskew-ui inline-block">{value ? onLabel : offLabel}</span>
      </button>
    </RowControl>
  );
}
