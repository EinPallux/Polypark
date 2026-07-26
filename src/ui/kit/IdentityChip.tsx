import { t } from "@/ui/i18n/t";

/**
 * Top-right player identity (UI_UX §3). M0 shows the stub profile; the real
 * profile (name prompt, tickets) arrives with the Hub in M5.
 */
export function IdentityChip({ name, tickets }: { name?: string; tickets?: number }) {
  return (
    <div className="flex items-center gap-3 bg-ink-900/85 py-1.5 pr-4 pl-1.5 text-white shadow-[var(--elev-slab)]">
      <span
        aria-hidden
        className="flex h-8 w-8 items-center justify-center bg-sun-500 font-display text-base text-ink-900"
      >
        {(name ?? t("identity.defaultName")).charAt(0).toUpperCase()}
      </span>
      <span className="font-ui text-sm font-bold tracking-[0.04em] uppercase">
        {name ?? t("identity.defaultName")}
      </span>
      <span
        className="flex items-center gap-1 font-numeral text-sm font-semibold text-gold-400 tabular-nums"
        title={t("identity.tickets")}
      >
        <span aria-hidden>🎟</span>
        {tickets ?? 0}
      </span>
    </div>
  );
}
