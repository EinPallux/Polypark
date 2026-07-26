/**
 * English strings — the only shipped locale at 1.0 (ADR-11). ALL user-facing
 * copy lives here; components never hardcode text (CLAUDE.md). Voice: warm
 * carnival-barker, verbs first, ≤2 sentences (UI_UX §7.8).
 */
export const en = {
  "app.name": "Polypark",
  "app.tagline": "Snap together the park of your dreams.",

  "title.continue": "Continue",
  "title.continue.empty": "No parks yet — your first one starts in Play",
  "title.play": "Play",
  "title.options": "Options",
  "title.extras": "Extras",
  "title.version": "v{version} · building M0",

  "identity.defaultName": "Builder",
  "identity.tickets": "Star Tickets",

  "hint.back": "Back",
  "hint.select": "Select",
  "hint.navigate": "Navigate",

  "hub.title": "Play",
  "hub.myParks": "My Parks",
  "hub.myParks.blurb": "Endless sandbox parks on handcrafted terrain.",
  "hub.stories": "Stories",
  "hub.stories.blurb": "Eight curated starts. Parks live on after the stars.",
  "hub.collection": "Collection",
  "hub.collection.blurb": "Spend Star Tickets on Theme Kits and blueprints.",
  "hub.profile": "Profile",
  "hub.profile.blurb": "Lifetime stats and records.",
  "hub.continueLast": "Continue last park",
  "hub.inBuild": "In build",
  "hub.arrives": "Arrives in {milestone}",

  "options.title": "Options",
  "options.tab.video": "Video",
  "options.tab.audio": "Audio",
  "options.tab.controls": "Controls",
  "options.tab.gameplay": "Gameplay",
  "options.tab.accessibility": "Accessibility",
  "options.note.m5": "Settings persist from milestone M5 — today they reset on reload.",
  "options.video.quality": "Quality preset",
  "options.video.resolutionScale": "Resolution scale",
  "options.video.bloom": "Bloom",
  "options.audio.master": "Master volume",
  "options.audio.music": "Music volume",
  "options.audio.sfx": "Effects volume",
  "options.audio.ui": "Interface volume",
  "options.audio.captions": "Audio captions",
  "options.controls.edgePan": "Edge panning",
  "options.controls.invertZoom": "Invert zoom",
  "options.gameplay.autosave": "Autosave cadence",
  "options.gameplay.advisor": "Advisor tips",
  "options.a11y.uiScale": "Interface scale",
  "options.a11y.readableFont": "Readable font",
  "options.a11y.reducedMotion": "Reduced motion",
  "options.restoreDefaults": "Restore defaults",
  "options.on": "On",
  "options.off": "Off",

  "extras.title": "Extras",
  "extras.credits": "Credits",
  "extras.credits.assets":
    "Every 3D piece in Polypark comes from CC0 packs by Kenney (kenney.nl) and Kay Lousberg (kaylousberg.com). Public domain heroes — thank you.",
  "extras.credits.fonts":
    "Type: Archivo Black, Barlow, Barlow Semi Condensed and Barlow Condensed (SIL Open Font License).",
  "extras.credits.built": "Built with Next.js, React Three Fiber and three.js.",
  "extras.guidance": "Replay guidance",
  "extras.guidance.blurb": "The Guidance layer arrives with milestone M5.",

  "uikit.title": "UI Kit",
  "uikit.blurb": "Every component in every state — the visual regression surface.",

  "diorama.loading": "Setting up the diorama…",
  "notFound.title": "This path leads nowhere",
  "notFound.blurb": "The page you wanted isn't built yet. Back to the gate?",
  "notFound.home": "Back to title",
} as const;

export type TranslationKey = keyof typeof en;
