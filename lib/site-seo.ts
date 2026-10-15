import type { Metadata } from 'next';
import { PUBLIC_ORIGIN } from './release';

export const HOME_TITLE = 'BRAIZ : jeu de mots du jour gratuit en français';
export const HOME_DESCRIPTION = 'Trouvez le mot secret du jour grâce à la proximité de sens. Un jeu de mots gratuit en français, avec une flamme de progression, des parties libres et des duels.';
export const ADSENSE_PUBLISHER = 'ca-pub-6705187262207125';

export function publicMetadata(path: string, title: string, description: string): Metadata {
  return {
    title, description, alternates: { canonical: path }, robots: { index: true, follow: true },
    openGraph: { type: 'website', locale: 'fr_FR', siteName: 'BRAIZ', url: path, title, description,
      images: [{ url: '/social-card.png', width: 1200, height: 630, alt: 'BRAIZ — Jeu de mots sémantique en français' }] },
    twitter: { card: 'summary_large_image', title, description, images: ['/social-card.png'] },
  };
}

export const PRIVATE_METADATA: Metadata = { robots: { index: false, follow: true } };

export function websiteSchema() {
  return { '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${PUBLIC_ORIGIN}/#website`,
    name: 'BRAIZ', url: `${PUBLIC_ORIGIN}/`, inLanguage: 'fr', description: HOME_DESCRIPTION };
}

export function gameSchema() {
  return { '@context': 'https://schema.org', '@type': 'WebApplication', '@id': `${PUBLIC_ORIGIN}/#game`,
    name: 'BRAIZ', url: `${PUBLIC_ORIGIN}/`, description: HOME_DESCRIPTION,
    applicationCategory: 'GameApplication', operatingSystem: 'Web', inLanguage: 'fr', isAccessibleForFree: true };
}

export function breadcrumbSchema(path: string, heading: string) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'BRAIZ', item: `${PUBLIC_ORIGIN}/` },
    { '@type': 'ListItem', position: 2, name: heading, item: `${PUBLIC_ORIGIN}${path}` },
  ] };
}
