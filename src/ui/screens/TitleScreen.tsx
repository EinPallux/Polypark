"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { APP_VERSION } from "@/shared/version";
import { t } from "@/ui/i18n/t";
import { useHasSave } from "@/ui/game/useHasSave";
import { HintRail } from "@/ui/kit/HintRail";
import { IdentityChip } from "@/ui/kit/IdentityChip";

const TitleDiorama = dynamic(() => import("@/render/TitleDiorama"), {
  ssr: false,
  loading: () => null,
});

interface MenuItem {
  readonly id: string;
  readonly label: string;
  readonly href?: string;
  readonly disabled?: boolean;
  readonly disabledHint?: string;
}

export function TitleScreen() {
  const router = useRouter();
  const hasSave = useHasSave();

  const MENU: readonly MenuItem[] = useMemo(
    () => [
      hasSave
        ? { id: "continue", label: t("title.continue"), href: "/play" }
        : {
            id: "continue",
            label: t("title.continue"),
            disabled: true,
            disabledHint: t("title.continue.empty"),
          },
      { id: "play", label: t("title.play"), href: "/hub" },
      { id: "options", label: t("title.options"), href: "/options" },
      { id: "extras", label: t("title.extras"), href: "/extras" },
    ],
    [hasSave],
  );
  // Focus starts on Play — stable whether or not a save exists.
  const [focused, setFocused] = useState(1);

  const activate = useCallback(
    (item: MenuItem) => {
      if (!item.disabled && item.href) {
        router.push(item.href);
      }
    },
    [router],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        setFocused((current) => {
          let next = current;
          for (let i = 0; i < MENU.length; i++) {
            next = (next + delta + MENU.length) % MENU.length;
            if (!MENU[next]?.disabled) break;
          }
          return next;
        });
      } else if (event.key === "Enter") {
        const item = MENU[focused];
        if (item) activate(item);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focused, activate, MENU]);

  return (
    <main className="relative h-dvh overflow-hidden bg-[#bfdcf5]">
      {/* living diorama background (decorative) */}
      <div className="absolute inset-0" aria-hidden>
        <TitleDiorama />
      </div>
      {/* left scrim for menu legibility (UI_UX §2.4) */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-2/3 bg-gradient-to-r from-[rgba(16,21,31,0.62)] via-[rgba(16,21,31,0.35)] to-transparent"
        aria-hidden
      />

      {/* logotype */}
      <header className="absolute top-8 left-10">
        <h1 className="skew-display font-display text-4xl tracking-tight text-white uppercase drop-shadow-[0_3px_0_rgba(16,21,31,0.45)]">
          {t("app.name")}
        </h1>
        <svg viewBox="0 0 200 14" className="mt-1 h-3 w-44" aria-hidden>
          <path
            d="M0 12 L60 12 Q80 12 90 4 Q100 -4 110 4 Q120 12 140 12 L200 12"
            fill="none"
            stroke="var(--sun-500)"
            strokeWidth="5"
          />
        </svg>
        <p className="mt-1 font-ui text-xs font-semibold tracking-[0.1em] text-frost-300 uppercase">
          {t("app.tagline")}
        </p>
      </header>

      <div className="absolute top-8 right-10">
        <IdentityChip />
      </div>

      {/* the OW-style vertical menu (UI_UX §6.1) */}
      <nav className="absolute top-1/2 left-10 -translate-y-1/2" aria-label={t("app.name")}>
        <ul className="flex flex-col gap-4">
          {MENU.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                data-testid={`menu-${item.id}`}
                disabled={item.disabled}
                title={item.disabled ? item.disabledHint : undefined}
                onMouseEnter={() => !item.disabled && setFocused(index)}
                onFocus={() => !item.disabled && setFocused(index)}
                onClick={() => activate(item)}
                className={`skew-display block cursor-pointer text-left font-display text-4xl uppercase transition-all duration-100 md:text-5xl ${
                  item.disabled
                    ? "cursor-not-allowed text-white/30"
                    : index === focused
                      ? "translate-x-3 text-gold-400 drop-shadow-[0_3px_0_rgba(16,21,31,0.5)]"
                      : "text-white drop-shadow-[0_3px_0_rgba(16,21,31,0.5)] hover:text-frost-100"
                }`}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <footer className="absolute right-10 bottom-6 left-10 flex items-end justify-between">
        <span className="font-ui text-xs font-semibold tracking-[0.08em] text-frost-300/80 uppercase">
          {t("title.version", { version: APP_VERSION })}
        </span>
        <div className="text-frost-100">
          <HintRail
            hints={[
              { keys: ["↑", "↓"], label: t("hint.navigate") },
              { keys: ["↵"], label: t("hint.select") },
            ]}
          />
        </div>
      </footer>
    </main>
  );
}
