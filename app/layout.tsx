import type { Metadata } from "next";
import "./globals.css";
import "./foyer.css";
import { OfflineRegistration } from "@/components/offline-registration";
export const metadata: Metadata = {
  metadataBase: new URL("https://braiz.io"),
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
  return <html lang="fr"><body>{children}<OfflineRegistration /></body></html>;
}
