import type { Metadata } from "next";
import "./globals.css";
import { OfflineRegistration } from "@/components/offline-registration";
export const metadata: Metadata = {
  metadataBase: new URL("https://braise-mots.yellow-drake-7186.chatgpt.site"),
  manifest: "/manifest.webmanifest",
  title: "Braise · Le jeu de mots qui chauffe",
  description: "Un mot secret, mille chemins pour le trouver. Le défi sémantique quotidien, le mode libre et les défis entre amis. Gratuit, en français.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="fr"><body>{children}<OfflineRegistration /></body></html>;
}
