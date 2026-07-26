import { type ReactNode } from "react";

type Variant = "new" | "locked" | "kit" | "info";

const variantClasses: Record<Variant, string> = {
  new: "bg-sun-500 text-ink-900",
  locked: "bg-ink-500 text-white",
  kit: "bg-gold-400 text-ink-900",
  info: "bg-sky-500 text-white",
};

/** Small skewed status chip (UI_UX §3): NEW! / CHANGES DAILY energy. */
export function RibbonTag({
  variant = "info",
  children,
}: {
  variant?: Variant;
  children: ReactNode;
}) {
  return (
    <span
      className={`skew-ui inline-block px-2 py-0.5 font-ui text-xs font-bold tracking-[0.08em] uppercase shadow-[var(--elev-slab)] ${variantClasses[variant]}`}
    >
      <span className="unskew-ui inline-block">{children}</span>
    </span>
  );
}
