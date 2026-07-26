"use client";

/**
 * The UI kit gallery (UI_UX §3): every component in every state, on one page.
 * Not linked from any menu; Playwright snapshots this as the visual
 * regression surface.
 */
import { useState } from "react";
import { t } from "@/ui/i18n/t";
import { DisplayTitle } from "@/ui/kit/DisplayTitle";
import { HintRail } from "@/ui/kit/HintRail";
import { IdentityChip } from "@/ui/kit/IdentityChip";
import { Keycap } from "@/ui/kit/Keycap";
import { KitCard } from "@/ui/kit/KitCard";
import { RibbonTag } from "@/ui/kit/RibbonTag";
import { RowControl, RowSlider, RowToggle } from "@/ui/kit/RowControl";
import { SlabButton } from "@/ui/kit/SlabButton";
import { TabBar } from "@/ui/kit/TabBar";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section data-testid={`uikit-${title.toLowerCase().replace(/\s+/g, "-")}`} className="flex flex-col gap-4">
      <h2 className="skew-ui font-ui text-lg font-bold tracking-[0.04em] text-ink-500 uppercase">
        {title}
      </h2>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </section>
  );
}

export default function UiKitPage() {
  const [tab, setTab] = useState("one");
  const [slider, setSlider] = useState(80);
  const [toggle, setToggle] = useState(true);

  return (
    <main className="facet-bg min-h-dvh px-10 py-10">
      <header className="mb-10 flex items-start justify-between">
        <DisplayTitle sub={t("uikit.blurb")}>{t("uikit.title")}</DisplayTitle>
        <IdentityChip name="Kit Tester" tickets={12} />
      </header>

      <div className="flex max-w-4xl flex-col gap-10">
        <Section title="Display Title">
          <DisplayTitle as="h2" sub="With a sub line">
            Sunny Meadows
          </DisplayTitle>
        </Section>

        <Section title="Slab Buttons">
          <SlabButton>Primary</SlabButton>
          <SlabButton size="lg">Primary large</SlabButton>
          <SlabButton variant="secondary">Secondary</SlabButton>
          <SlabButton variant="danger">Danger</SlabButton>
          <SlabButton disabled>Disabled</SlabButton>
        </Section>

        <Section title="Ribbon Tags">
          <RibbonTag variant="new">New!</RibbonTag>
          <RibbonTag variant="locked">Locked</RibbonTag>
          <RibbonTag variant="kit">Milestone</RibbonTag>
          <RibbonTag variant="info">Arrives in M5</RibbonTag>
        </Section>

        <Section title="Keycaps and Hints">
          <Keycap>ESC</Keycap>
          <Keycap>Q</Keycap>
          <Keycap>MMB</Keycap>
          <HintRail
            hints={[
              { keys: ["↑", "↓"], label: "Navigate" },
              { keys: ["↵"], label: "Select" },
              { keys: ["ESC"], label: "Back" },
            ]}
          />
        </Section>

        <Section title="Kit Cards">
          <KitCard accent="var(--kit-boardwalk)" icon="🎢" eyebrow="Story 1" title="Default" blurb="A default card." />
          <KitCard accent="var(--kit-pirate)" icon="⚓" title="Selected" blurb="Gold ring + underline." selected />
          <KitCard accent="var(--kit-spooky)" icon="🎃" title="With ribbon" blurb="Something new inside." ribbon={{ variant: "new", label: "New!" }} />
          <KitCard accent="var(--kit-winter)" icon="⛄" title="Disabled" blurb="Desaturated and locked." ribbon={{ variant: "locked", label: "Locked" }} disabled />
        </Section>

        <Section title="Tab Bar">
          <TabBar
            tabs={[
              { id: "one", label: "Video" },
              { id: "two", label: "Audio" },
              { id: "three", label: "Controls" },
            ]}
            active={tab}
            onChange={setTab}
          />
        </Section>

        <Section title="Row Controls">
          <div className="flex w-full max-w-xl flex-col gap-1.5">
            <RowSlider label="Master volume" value={slider} onChange={setSlider} />
            <RowToggle label="Audio captions" value={toggle} onLabel="On" offLabel="Off" onChange={setToggle} />
            <RowControl label="Quality preset">
              <span className="font-ui text-sm font-bold text-sky-500 uppercase">Medium</span>
            </RowControl>
          </div>
        </Section>

        <Section title="Identity Chip">
          <IdentityChip />
          <IdentityChip name="Riverbend Rita" tickets={42} />
        </Section>
      </div>
    </main>
  );
}
