import Link from "next/link";
import { t } from "@/ui/i18n/t";
import { DisplayTitle } from "@/ui/kit/DisplayTitle";

export default function NotFound() {
  return (
    <main className="facet-bg flex h-dvh flex-col items-center justify-center gap-6">
      <DisplayTitle sub={t("notFound.blurb")}>{t("notFound.title")}</DisplayTitle>
      <Link
        href="/"
        className="skew-ui bg-sun-500 px-6 py-2.5 font-ui font-bold tracking-[0.06em] text-ink-900 uppercase shadow-[var(--elev-slab)] hover:bg-sun-600"
      >
        <span className="unskew-ui inline-block">{t("notFound.home")}</span>
      </Link>
    </main>
  );
}
