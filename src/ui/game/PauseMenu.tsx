"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { t } from "@/ui/i18n/t";
import { DisplayTitle } from "@/ui/kit/DisplayTitle";
import { SlabButton } from "@/ui/kit/SlabButton";
import { useGame } from "./store";

export function PauseMenu() {
  const router = useRouter();
  const menuOpen = useGame((state) => state.menuOpen);
  const setMenuOpen = useGame((state) => state.setMenuOpen);
  const save = useGame((state) => state.save);
  const [justSaved, setJustSaved] = useState(false);

  if (!menuOpen) {
    return null;
  }
  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-ink-900/55">
      <div className="panel-cut flex w-80 flex-col gap-3 bg-frost-100 p-8 shadow-[var(--elev-slab)]">
        <DisplayTitle as="h2">{t("pause.title")}</DisplayTitle>
        <SlabButton
          size="lg"
          data-testid="pause-resume"
          onClick={() => setMenuOpen(false)}
          className="mt-4"
        >
          {t("pause.resume")}
        </SlabButton>
        <SlabButton
          variant="secondary"
          size="lg"
          data-testid="pause-save"
          onClick={() => {
            void save().then(() => {
              setJustSaved(true);
              setTimeout(() => setJustSaved(false), 2000);
            });
          }}
        >
          {justSaved ? t("pause.saveDone") : t("pause.save")}
        </SlabButton>
        <SlabButton variant="secondary" size="lg" onClick={() => router.push("/options")}>
          {t("pause.options")}
        </SlabButton>
        <SlabButton
          variant="danger"
          size="lg"
          data-testid="pause-exit"
          onClick={() => router.push("/")}
        >
          {t("pause.exit")}
        </SlabButton>
        <p className="mt-1 font-body text-xs text-ink-500">{t("pause.exitHint")}</p>
      </div>
    </div>
  );
}
