import { Keycap } from "./Keycap";

export interface Hint {
  readonly keys: readonly string[];
  readonly label: string;
}

/** Bottom-right context hints (UI_UX §3). */
export function HintRail({ hints }: { hints: readonly Hint[] }) {
  return (
    <div className="flex items-center gap-5">
      {hints.map((hint) => (
        <span key={hint.label} className="flex items-center gap-1.5">
          {hint.keys.map((key) => (
            <Keycap key={key}>{key}</Keycap>
          ))}
          <span className="font-ui text-sm font-semibold tracking-[0.04em] uppercase">
            {hint.label}
          </span>
        </span>
      ))}
    </div>
  );
}
