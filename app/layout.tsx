import type { Metadata } from "next";
import "./globals.css";
import "./foyer.css";
import { OfflineRegistration } from "@/components/offline-registration";
export const metadata: Metadata = {
  metadataBase: new URL("https://braiz.io"),
  manifest: "/manifest.webmanifest",
  title: "BRAIZ · Le jeu de mots qui chauffe",
  description: "Trouvez le mot secret grâce à la chaleur. Un jeu de mots gratuit en français, avec un défi quotidien et des parties libres.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="fr"><body>{children}<OfflineRegistration /></body></html>;
}
