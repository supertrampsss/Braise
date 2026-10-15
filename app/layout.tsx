import type { Metadata } from "next";
import "./globals.css";
import "./foyer.css";
import "./approved-braiz.css";
import "./p1-game.css";
import "./parties.css";
import "./fillable-game.css";
import "./guides.css";
import { OfflineRegistration } from "@/components/offline-registration";
import { PUBLIC_ORIGIN } from "@/lib/release";
import { ADSENSE_PUBLISHER, HOME_DESCRIPTION, HOME_TITLE } from '@/lib/site-seo';
export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_ORIGIN),
  manifest: "/manifest.webmanifest",
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  other: { 'google-adsense-account': ADSENSE_PUBLISHER },
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="fr"><body>{children}<OfflineRegistration /></body></html>;
}

