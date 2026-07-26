"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { t } from "@/ui/i18n/t";
import { DisplayTitle } from "@/ui/kit/DisplayTitle";
import { HintRail } from "@/ui/kit/HintRail";
import { RibbonTag } from "@/ui/kit/RibbonTag";

export function ExtrasScreen() {
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") router.push("/");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return (
    <main className="facet-bg flex h-dvh flex-col overflow-hidden">
      <header className="px-10 pt-8">
        <DisplayTitle>{t("extras.title")}</DisplayTitle>
      </header>

      <div className="mx-auto mt-8 flex w-full max-w-2xl flex-col gap-6 px-6">
        <section className="panel-cut bg-frost-100 p-6 shadow-[var(--elev-slab)]">
          <h2 className="skew-ui font-ui text-xl font-bold tracking-tight text-ink-700 uppercase">
            {t("extras.credits")}
          </h2>
          <p className="mt-3 font-body text-sm leading-relaxed text-ink-700">
            {t("extras.credits.assets")}
          </p>
          <p className="mt-2 font-body text-sm leading-relaxed text-ink-500">
            {t("extras.credits.fonts")}
          </p>
          <p className="mt-2 font-body text-sm leading-relaxed text-ink-500">
            {t("extras.credits.built")}
          </p>
        </section>

        <section className="panel-cut bg-frost-100 p-6 shadow-[var(--elev-slab)]">
          <div className="flex items-center gap-3">
            <h2 className="skew-ui font-ui text-xl font-bold tracking-tight text-ink-700 uppercase">
              {t("extras.guidance")}
            </h2>
            <RibbonTag variant="info">{t("hub.arrives", { milestone: "M5" })}</RibbonTag>
          </div>
          <p className="mt-3 font-body text-sm text-ink-500">{t("extras.guidance.blurb")}</p>
        </section>
      </div>

      <footer className="mt-auto flex justify-end px-10 pb-6">
        <button type="button" onClick={() => router.push("/")} className="cursor-pointer">
          <HintRail hints={[{ keys: ["ESC"], label: t("hint.back") }]} />
        </button>
      </footer>
    </main>
  );
}
