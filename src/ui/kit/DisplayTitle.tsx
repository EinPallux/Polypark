import { type ReactNode } from "react";

/**
 * Mega screen title (UI_UX §3): Archivo Black, uppercase, skewed −10°.
 * The skew lives in the component so copy stays plain text.
 */
export function DisplayTitle({
  children,
  sub,
  as: Tag = "h1",
}: {
  children: ReactNode;
  sub?: ReactNode;
  as?: "h1" | "h2";
}) {
  return (
    <div className="select-none">
      <Tag className="skew-display font-display text-5xl leading-none tracking-tight text-ink-700 uppercase md:text-7xl">
        {children}
      </Tag>
      {sub ? (
        <p className="skew-ui mt-2 font-ui text-sm font-semibold tracking-[0.08em] text-ink-500 uppercase">
          {sub}
        </p>
      ) : null}
    </div>
  );
}
