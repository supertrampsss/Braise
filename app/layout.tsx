import type { Metadata } from "next";
import "./globals.css";
import "./foyer.css";
import "./approved-braiz.css";
import "./p1-game.css";
import "./parties.css";
import "./fillable-game.css";
import "./guides.css";
import "./brasier.css";
import { OfflineRegistration } from "@/components/offline-registration";
import { MetricsLifecycle } from "@/components/metrics-lifecycle";
import { PUBLIC_ORIGIN } from "@/lib/release";
import { ADSENSE_PUBLISHER, HOME_DESCRIPTION, HOME_TITLE } from '@/lib/site-seo';
export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_ORIGIN),
  manifest: "/manifest.webmanifest?v=drawn-1",
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  other: { 'google-adsense-account': ADSENSE_PUBLISHER },
  icons: {
    icon: [
      {url:"/favicon.svg?v=drawn-1",type:"image/svg+xml",sizes:"any"},
      {url:"/icons/icon-48.png?v=drawn-1",type:"image/png",sizes:"48x48"},
    ],
    apple: [{url:"/icons/apple-touch-icon.png?v=drawn-1",sizes:"180x180",type:"image/png"}],
  },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="fr"><body>{children}<OfflineRegistration /><MetricsLifecycle /></body></html>;
}

