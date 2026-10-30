import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Faq, JsonLd, SiteGuide, DuelGuide } from '../components/site-guide';
import { GUIDES, DUEL_GUIDE } from '../lib/site-content';
import { PRIVATE_METADATA, publicMetadata } from '../lib/site-seo';
import { PUBLIC_ORIGIN } from '../lib/release';

function schemas(html: string) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
}

test('every public guide renders one H1 and structured FAQ answers identical to visible content', () => {
  for (const guide of GUIDES) {
    const html = renderToStaticMarkup(createElement(SiteGuide, { guide }));
    assert.equal((html.match(/<h1>/g) ?? []).length, 1, guide.path);
    const faq = schemas(html).filter(value => value['@type'] === 'FAQPage');
    assert.equal(faq.length, 1, guide.path);
    assert.deepEqual(faq[0].mainEntity.map((question: any) => [question.name, question.acceptedAnswer.text]), guide.faq.map(item => [item.question, item.answer]));
    for (const item of guide.faq) {
      assert.ok(html.includes(renderToStaticMarkup(createElement('h3', null, item.question))));
      assert.ok(html.includes(renderToStaticMarkup(createElement('p', null, item.answer))));
    }
  }
});

test('Article is limited to editorial guides with canonical identity and no invented attribution or dates', () => {
  const articles: string[] = [];
  for (const guide of GUIDES) {
    const values = schemas(renderToStaticMarkup(createElement(SiteGuide, { guide })));
    const article = values.find(value => value['@type'] === 'Article');
    if (!article) continue;
    articles.push(guide.path);
    assert.equal(article.headline, guide.heading);
    assert.equal(article.mainEntityOfPage, PUBLIC_ORIGIN + guide.path);
    assert.equal(article.publisher.name, 'BRAIZ');
    assert.equal(article.author, undefined);
    assert.equal(article.datePublished, undefined);
    assert.equal(article.dateModified, undefined);
  }
  assert.deepEqual(articles, ['/jeu-de-mots-semantique', '/comment-jouer', '/proximite']);
});

test('visible guide breadcrumbs and schema identify the same canonical page', () => {
  for (const guide of GUIDES) {
    const html = renderToStaticMarkup(createElement(SiteGuide, { guide }));
    assert.match(html, /<nav class="guide-breadcrumb" aria-label="Fil d’Ariane">/);
    assert.ok(html.includes(renderToStaticMarkup(createElement('span', { 'aria-current': 'page' }, guide.heading))));
    const trail = schemas(html).find(value => value['@type'] === 'BreadcrumbList').itemListElement;
    assert.deepEqual(trail.map((item: any) => item.item), [PUBLIC_ORIGIN + '/', PUBLIC_ORIGIN + guide.path]);
    assert.equal(trail[1].name, guide.heading);
  }
});

test('duel FAQ and visible breadcrumb describe public rules without game data', () => {
  const html = renderToStaticMarkup(createElement(DuelGuide));
  const values = schemas(html);
  assert.deepEqual(values.find(value => value['@type'] === 'FAQPage').mainEntity.map((q: any) => q.name), DUEL_GUIDE.faq.map(q => q.question));
  assert.match(html, /aria-current="page">Duel/);
  assert.equal(values.some(value => value['@type'] === 'Article'), false);
});

test('JSON-LD cannot close its script and an empty FAQ is not emitted', () => {
  const payload = { question: '</script><script>alert("x")</script>', answer: '< & >' };
  const html = renderToStaticMarkup(createElement(JsonLd, { value: payload }));
  assert.equal((html.match(/<script/g) ?? []).length, 1);
  assert.deepEqual(schemas(html), [payload]);
  assert.equal(renderToStaticMarkup(createElement(Faq, { items: [] })), '');
});

test('public metadata remains indexable, unique and canonical while private spaces remain excluded', () => {
  assert.equal(new Set(GUIDES.map(guide => guide.title)).size, GUIDES.length);
  assert.equal(new Set(GUIDES.map(guide => guide.description)).size, GUIDES.length);
  for (const guide of GUIDES) {
    const metadata = publicMetadata(guide.path, guide.title, guide.description);
    assert.deepEqual(metadata.robots, { index: true, follow: true });
    assert.equal(metadata.alternates?.canonical, guide.path);
  }
  assert.deepEqual(PRIVATE_METADATA.robots, { index: false, follow: true });
});
