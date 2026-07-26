import type { Metadata, Viewport } from "next";
import "@fontsource/archivo-black";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow-semi-condensed/500.css";
import "@fontsource/barlow-semi-condensed/600.css";
import "@fontsource/barlow-semi-condensed/700.css";
import "@fontsource/barlow-semi-condensed/600-italic.css";
import "@fontsource/barlow-condensed/600.css";
import "./globals.css";
import { t } from "@/ui/i18n/t";

export const metadata: Metadata = {
  title: t("app.name"),
  description: t("app.tagline"),
};

export const viewport: Viewport = {
  themeColor: "#10151F",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
