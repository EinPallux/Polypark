"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useHasSave } from "@/ui/game/useHasSave";
import { t } from "@/ui/i18n/t";
import { DisplayTitle } from "@/ui/kit/DisplayTitle";
import { HintRail } from "@/ui/kit/HintRail";
import { IdentityChip } from "@/ui/kit/IdentityChip";
import { KitCard } from "@/ui/kit/KitCard";
import { SlabButton } from "@/ui/kit/SlabButton";

/**
 * Hub shell (UI_UX §6.2): the four mode cards. My Parks is live since M1;
 * Stories/Collection/Profile keep their honest "arrives in Mx" ribbons.
 */
export function HubScreen() {
  const router = useRouter();
  const hasSave = useHasSave();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        router.push("/");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return (
    <main className="facet-bg flex h-dvh flex-col overflow-hidden">
      <header className="flex items-start justify-between px-10 pt-8">
        <DisplayTitle sub={t("app.tagline")}>{t("hub.title")}</DisplayTitle>
        <IdentityChip />
      </header>

      <section className="flex flex-1 items-center justify-center px-10">
        <div className="flex flex-wrap items-stretch justify-center gap-6">
          <KitCard
            testId="card-my-parks"
            accent="var(--kit-rails)"
            icon="⛏"
            eyebrow={t("app.name")}
            title={t("hub.myParks")}
            blurb={t("hub.myParks.blurb")}
            ribbon={{ variant: "new", label: t("hub.playable") }}
            onSelect={() => router.push(hasSave ? "/play" : "/play?new=1")}
          />
          <KitCard
            testId="card-stories"
            accent="var(--kit-boardwalk)"
            icon="🎢"
            eyebrow="8 ★"
            title={t("hub.stories")}
            blurb={t("hub.stories.blurb")}
            ribbon={{ variant: "info", label: t("hub.arrives", { milestone: "M5" }) }}
            disabled
          />
          <KitCard
            testId="card-collection"
            accent="var(--kit-cosmic)"
            icon="🎟"
            title={t("hub.collection")}
            blurb={t("hub.collection.blurb")}
            ribbon={{ variant: "info", label: t("hub.arrives", { milestone: "M5" }) }}
            disabled
          />
          <KitCard
            testId="card-profile"
            accent="var(--kit-cuddle)"
            icon="★"
            title={t("hub.profile")}
            blurb={t("hub.profile.blurb")}
            ribbon={{ variant: "info", label: t("hub.arrives", { milestone: "M5" }) }}
            disabled
          />
        </div>
      </section>

      <footer className="flex items-end justify-between px-10 pb-6">
        <div className="flex items-center gap-3">
          <SlabButton
            size="lg"
            disabled={!hasSave}
            title={hasSave ? undefined : t("title.continue.empty")}
            onClick={() => router.push("/play")}
            data-testid="hub-continue"
          >
            {t("hub.continueLast")}
          </SlabButton>
          <SlabButton
            size="lg"
            variant="secondary"
            onClick={() => router.push("/play?new=1")}
            data-testid="hub-new-park"
          >
            {t("hub.newPark")}
          </SlabButton>
        </div>
        <button type="button" onClick={() => router.push("/")} className="cursor-pointer">
          <HintRail hints={[{ keys: ["ESC"], label: t("hint.back") }]} />
        </button>
      </footer>
    </main>
  );
}
