import { AppNavigation } from './app-navigation';
import { DUEL_GUIDE, GUIDES, type Guide } from '@/lib/site-content';
import { articleSchema, breadcrumbSchema, faqSchema, websiteSchema } from '@/lib/site-seo';

export function JsonLd({ value }: { value: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(value).replace(/</g, '\\u003c') }} />;
}

function GuideLinks({ current }: { current?: string }) {
  return <nav className="guide-links" aria-label="Guides BRAIZ">
    {GUIDES.filter(guide => guide.path !== current && guide.path !== '/confidentialite').map(guide => <a key={guide.path} href={guide.path}>{guide.path === '/jeu-de-mots-semantique' ? 'Le jeu sémantique' : guide.path === '/proximite' ? 'La proximité' : guide.path === '/comment-jouer' ? 'Les règles' : guide.path === '/partie-libre' ? 'Partie libre' : guide.path === '/archives' ? 'Les archives' : 'À propos'}</a>)}
    {current !== '/duels' && <a href="/duels">Le duel</a>}
  </nav>;
}

export function Faq({ items }: { items: { question: string; answer: string }[] }) {
  if (items.length === 0) return null;
  return <section className="guide-faq" aria-labelledby="guide-faq-title"><h2 id="guide-faq-title">Questions fréquentes</h2>
    {items.map(item => <div key={item.question}><h3>{item.question}</h3><p>{item.answer}</p></div>)}
    <JsonLd value={faqSchema(items)} />
  </section>;
}

function Breadcrumb({ heading }: { heading: string }) {
  return <nav className="guide-breadcrumb" aria-label="Fil d’Ariane"><a href="/">BRAIZ</a><span aria-hidden="true"> / </span><span aria-current="page">{heading}</span></nav>;
}

export function SiteFooter() {
  return <footer className="guide-footer"><a href="/a-propos">À propos</a><a href="/confidentialite">Confidentialité</a></footer>;
}

export function SiteGuide({ guide }: { guide: Guide }) {
  return <div className="app-shell approved-interface guide-shell">
    <a className="skip-link" href="#guide-main">Aller au contenu</a><AppNavigation />
    <main className="guide-main" id="guide-main" tabIndex={-1}>
      <Breadcrumb heading={guide.heading} />
      <h1>{guide.heading}</h1><p className="guide-intro">{guide.intro}</p>
      {guide.action && <a className="guide-action" href={guide.action.href}>{guide.action.label}</a>}
      {guide.sections.map(section => <section key={section.heading}><h2>{section.heading}</h2>{section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</section>)}
      {guide.path === '/a-propos' && <p className="guide-sources">Sources : <a href="https://fauconnier.github.io/#data">modèles de Jean-Philippe Fauconnier</a> · <a href="https://creativecommons.org/licenses/by/3.0/">CC BY 3.0</a> · <a href="https://fasttext.cc/docs/en/pretrained-vectors.html">fastText</a> · <a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</a>.</p>}
      <Faq items={guide.faq} /><GuideLinks current={guide.path} /><JsonLd value={breadcrumbSchema(guide.path, guide.heading)} />
      {guide.kind === 'article' && <JsonLd value={articleSchema(guide)} />}
    </main><SiteFooter />
  </div>;
}

/** Le pied de l'accueil : une phrase, une ligne de liens. Les guides restent au plan du site. */
export function HomeGuide() {
  return <footer className="home-guide" aria-label="À propos de BRAIZ">
    <p>Un mot secret par jour, à trouver par le sens. Gratuit, en français.</p>
    <nav aria-label="Liens du site"><a href="/comment-jouer">Règles</a><a href="/archives">Archives</a><a href="/duels">Duel</a><a href="/a-propos">À propos</a><a href="/confidentialite">Confidentialité</a></nav>
    <JsonLd value={websiteSchema()} />
  </footer>;
}

export function DuelGuide() {
  return <section className="home-guide duel-guide" aria-labelledby="duel-guide-title">
    <Breadcrumb heading="Duel" />
    <h2 id="duel-guide-title">{DUEL_GUIDE.heading}</h2><p>{DUEL_GUIDE.intro}</p>
    <Faq items={DUEL_GUIDE.faq} /><GuideLinks current="/duels" /><SiteFooter />
    <JsonLd value={breadcrumbSchema('/duels', 'Duel')} />
  </section>;
}
