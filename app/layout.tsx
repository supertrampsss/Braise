import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Braise · Le jeu de mots qui chauffe",
  description: "Un mot secret, mille chemins pour le trouver. Le défi sémantique quotidien, le mode libre et les défis entre amis. Gratuit, en français.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="fr"><body>{children}</body></html>;
}
