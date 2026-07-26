import { type ReactNode } from "react";

/** Small dark key square (UI_UX §3): `ESC`, `Q`, `MMB` — every ref's bottom-right. */
export function Keycap({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-6 items-center justify-center rounded-[var(--radius)] bg-ink-900 px-1.5 py-0.5 font-ui text-xs font-bold text-white uppercase">
      {children}
    </kbd>
  );
}
