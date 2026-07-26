"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { t } from "@/ui/i18n/t";
import { DisplayTitle } from "@/ui/kit/DisplayTitle";
import { HintRail } from "@/ui/kit/HintRail";
import { RibbonTag } from "@/ui/kit/RibbonTag";
import { RowControl, RowSlider, RowToggle } from "@/ui/kit/RowControl";
import { SlabButton } from "@/ui/kit/SlabButton";
import { TabBar } from "@/ui/kit/TabBar";

const TABS = [
  { id: "video", label: t("options.tab.video") },
  { id: "audio", label: t("options.tab.audio") },
  { id: "controls", label: t("options.tab.controls") },
  { id: "gameplay", label: t("options.tab.gameplay") },
  { id: "accessibility", label: t("options.tab.accessibility") },
] as const;

interface Draft {
  quality: string;
  resolutionScale: number;
  bloom: boolean;
  master: number;
  music: number;
  sfx: number;
  ui: number;
  captions: boolean;
  edgePan: boolean;
  invertZoom: boolean;
  autosave: string;
  advisor: boolean;
  uiScale: number;
  readableFont: boolean;
  reducedMotion: boolean;
}

const DEFAULTS: Draft = {
  quality: "Medium",
  resolutionScale: 100,
  bloom: true,
  master: 80,
  music: 70,
  sfx: 80,
  ui: 60,
  captions: false,
  edgePan: true,
  invertZoom: false,
  autosave: "Monthly",
  advisor: true,
  uiScale: 100,
  readableFont: false,
  reducedMotion: false,
};

/**
 * Options shell (UI_UX §6.12): the real row-bar layout with live controls.
 * Values are draft-only until the settings store lands in M5 — the ribbon
 * says so honestly.
 */
export function OptionsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<string>("video");
  const [draft, setDraft] = useState<Draft>(DEFAULTS);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]): void =>
    setDraft((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") router.push("/");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  const onLabel = t("options.on");
  const offLabel = t("options.off");

  return (
    <main className="facet-bg flex h-dvh flex-col overflow-hidden">
      <header className="flex items-start justify-between px-10 pt-8">
        <DisplayTitle>{t("options.title")}</DisplayTitle>
        <RibbonTag variant="info">{t("options.note.m5")}</RibbonTag>
      </header>

      <div className="mx-auto mt-6 w-full max-w-3xl px-6">
        <TabBar tabs={TABS} active={tab} onChange={setTab} />
        <div className="mt-3 flex flex-col gap-1.5" role="tabpanel">
          {tab === "video" && (
            <>
              <RowControl label={t("options.video.quality")}>
                <span className="font-ui text-sm font-bold text-sky-500 uppercase">
                  {draft.quality}
                </span>
              </RowControl>
              <RowSlider
                label={t("options.video.resolutionScale")}
                value={draft.resolutionScale}
                min={50}
                max={150}
                onChange={(value) => set("resolutionScale", value)}
              />
              <RowToggle
                label={t("options.video.bloom")}
                value={draft.bloom}
                onLabel={onLabel}
                offLabel={offLabel}
                onChange={(value) => set("bloom", value)}
              />
            </>
          )}
          {tab === "audio" && (
            <>
              <RowSlider label={t("options.audio.master")} value={draft.master} onChange={(v) => set("master", v)} />
              <RowSlider label={t("options.audio.music")} value={draft.music} onChange={(v) => set("music", v)} />
              <RowSlider label={t("options.audio.sfx")} value={draft.sfx} onChange={(v) => set("sfx", v)} />
              <RowSlider label={t("options.audio.ui")} value={draft.ui} onChange={(v) => set("ui", v)} />
              <RowToggle
                label={t("options.audio.captions")}
                value={draft.captions}
                onLabel={onLabel}
                offLabel={offLabel}
                onChange={(v) => set("captions", v)}
              />
            </>
          )}
          {tab === "controls" && (
            <>
              <RowToggle
                label={t("options.controls.edgePan")}
                value={draft.edgePan}
                onLabel={onLabel}
                offLabel={offLabel}
                onChange={(v) => set("edgePan", v)}
              />
              <RowToggle
                label={t("options.controls.invertZoom")}
                value={draft.invertZoom}
                onLabel={onLabel}
                offLabel={offLabel}
                onChange={(v) => set("invertZoom", v)}
              />
            </>
          )}
          {tab === "gameplay" && (
            <>
              <RowControl label={t("options.gameplay.autosave")}>
                <span className="font-ui text-sm font-bold text-sky-500 uppercase">
                  {draft.autosave}
                </span>
              </RowControl>
              <RowToggle
                label={t("options.gameplay.advisor")}
                value={draft.advisor}
                onLabel={onLabel}
                offLabel={offLabel}
                onChange={(v) => set("advisor", v)}
              />
            </>
          )}
          {tab === "accessibility" && (
            <>
              <RowSlider
                label={t("options.a11y.uiScale")}
                value={draft.uiScale}
                min={80}
                max={140}
                onChange={(v) => set("uiScale", v)}
              />
              <RowToggle
                label={t("options.a11y.readableFont")}
                value={draft.readableFont}
                onLabel={onLabel}
                offLabel={offLabel}
                onChange={(v) => set("readableFont", v)}
              />
              <RowToggle
                label={t("options.a11y.reducedMotion")}
                value={draft.reducedMotion}
                onLabel={onLabel}
                offLabel={offLabel}
                onChange={(v) => set("reducedMotion", v)}
              />
            </>
          )}
        </div>
      </div>

      <footer className="mt-auto flex items-end justify-between px-10 pb-6">
        <SlabButton variant="secondary" onClick={() => setDraft(DEFAULTS)}>
          {t("options.restoreDefaults")}
        </SlabButton>
        <button type="button" onClick={() => router.push("/")} className="cursor-pointer">
          <HintRail hints={[{ keys: ["ESC"], label: t("hint.back") }]} />
        </button>
      </footer>
    </main>
  );
}
