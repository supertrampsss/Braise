import type { Metadata } from "next";
import "./globals.css";
import "./foyer.css";
import "./approved-braiz.css";
import "./p1-game.css";
import "./parties.css";
import { OfflineRegistration } from "@/components/offline-registration";
import { PUBLIC_ORIGIN } from "@/lib/release";
export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_ORIGIN),
  manifest: "/manifest.webmanifest",
  title: "BRAIZ · Devinez le mot secret du jour.",
  description: "Devinez le mot secret du jour. Un jeu de mots gratuit en français, avec un défi quotidien et des parties libres.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "/",
    siteName: "BRAIZ",
    title: "BRAIZ · Devinez le mot secret du jour.",
    description: "Un jeu de mots gratuit en français, avec un défi quotidien et des parties libres.",
  },
  twitter: {
    card: "summary",
    title: "BRAIZ · Devinez le mot secret du jour.",
    description: "Un jeu de mots gratuit en français, avec un défi quotidien et des parties libres.",
  },
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="fr"><head>
    <script
      async
      src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6705187262207125"
      crossOrigin="anonymous"
    />
  </head><body>{children}<OfflineRegistration /></body></html>;
}

