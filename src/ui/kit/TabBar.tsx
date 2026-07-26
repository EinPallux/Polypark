"use client";

/**
 * Dark skewed tab bar with gold active fill (UI_UX §3, Example_UI_4/6-10).
 * Keyboard: ← → move the active tab.
 */
export function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === active),
  );

  return (
    <div
      role="tablist"
      aria-label="Sections"
      className="flex items-stretch gap-1 bg-ink-900 px-3 py-2"
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          const delta = event.key === "ArrowRight" ? 1 : -1;
          const next = tabs[(activeIndex + delta + tabs.length) % tabs.length];
          if (next) {
            onChange(next.id);
          }
        }
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={`skew-ui cursor-pointer px-4 py-1.5 font-ui text-sm font-bold tracking-[0.06em] uppercase transition-colors duration-100 ${
              isActive ? "bg-gold-400 text-ink-900" : "text-frost-300 hover:bg-white/10"
            }`}
          >
            <span className="unskew-ui inline-block">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
