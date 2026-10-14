import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { act, create, type ReactTestRenderer, type ReactTestInstance } from "react-test-renderer";
import Studio from "../components/studio";
import Streamer from "../components/streamer";
import Intruder from "../components/intruder-game";
import TwoBraises from "../components/two-braises-game";
import { database } from "./support/social-database";
import { randomToken } from "../lib/server-security";
import { env } from "./support/cloudflare-workers";
import { GET as studioGET, POST as studioPOST } from "../app/api/studio/route";
import { saveIntruderAttempt } from "../lib/profile-storage";
import { SyncMemory } from "../lib/device-sync";
import { answerIntruder, intruderQuestion, summarizeIntruder } from "../lib/intruder-server";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
function text(node: ReactTestInstance): string { return node.children.map(c => typeof c === "string" ? c : text(c)).join(""); }
const buttons = (tree: ReactTestRenderer, label: string) => tree.root.findAll(n => n.type === "button" && text(n) === label);
async function click(tree: ReactTestRenderer, label: string) { const b = buttons(tree, label)[0]; assert.ok(b, label); assert.ok(!b.props.disabled, label + " enabled"); await act(async () => b.props.onClick()); }
async function input(tree: ReactTestRenderer, id: string, value: string) { await act(async () => tree.root.findByProps({ id }).props.onChange({ target: { value } })); }
function browser(search = "") {
  const listeners = new Map<string, () => void>(), timers = new Map<number, () => void>(); let next = 0;
  const doc = { hidden: false, addEventListener(name: string, fn: () => void) { listeners.set(name, fn); }, removeEventListener(name: string) { listeners.delete(name); } };
  Object.assign(globalThis, { localStorage: new SyncMemory(), location: { search, origin: "https://braiz.io", assign() {} }, document: doc, window: { addEventListener() {}, removeEventListener() {}, setInterval(fn: () => void, delay: number) { assert.equal(delay, 15000); timers.set(++next, fn); return next; }, clearInterval(id: number) { timers.delete(id); } } });
  return { doc, listeners, timers };
}
test("Studio real editing preview, bounded save and duplicate with synchronous async lock", async () => {
  browser(); const writes: Record<string, unknown>[] = []; let release!: (r: Response) => void; let delay = false;
  const initial = { id: "draft", title: "Titre", description: "Description", visual: "ember", entries: ["nature-v1:0"], revision: 0 };
  globalThis.fetch = async (url, opts) => {
    if (url === "/api/session") return Response.json({ guest: { id: "a", name: "A" }, csrf: "csrf" });
    if (opts?.method === "POST") { const body = JSON.parse(opts.body as string); writes.push(body); if (delay) return new Promise(resolve => release = resolve); return Response.json({ ...initial, ...body, id: body.id, revision: 0 }); }
    if (String(url).includes("?id=")) return Response.json(initial);
    return Response.json({ drafts: [initial], titles: ["Titre"], catalogue: [{ id: "nature-v1:0", label: "Nature · énigme 1" }] });
  };
  let tree!: ReactTestRenderer; await act(async () => { tree = create(createElement(Studio)); });
  try {
    await click(tree, "Titre · révision 0"); await input(tree, "studio-title", "Mon parcours"); await input(tree, "studio-description", "À votre rythme"); await input(tree, "studio-visual", "paper");
    const preview = tree.root.findByProps({ "aria-label": "Aperçu participant" }); assert.match(text(preview), /Mon parcours/); assert.match(text(preview), /À votre rythme/); assert.ok(!text(preview).includes("Nature"));
    assert.ok(buttons(tree, "Publier cette version")[0].props.disabled);
    await input(tree, "studio-title", " "); assert.ok(buttons(tree, "Enregistrer le brouillon")[0].props.disabled); await input(tree, "studio-title", "Mon parcours");
    delay = true; const handler = buttons(tree, "Enregistrer le brouillon")[0].props.onClick; await act(async () => { handler(); handler(); }); assert.equal(writes.length, 1);
    assert.equal(writes[0].description, "À votre rythme"); assert.equal(writes[0].visual, "paper");
    await act(async () => release(Response.json({ ...initial, ...writes[0], revision: 1 }))); delay = false;
    await click(tree, "Dupliquer ce brouillon"); assert.equal(writes[1].action, "duplicate"); assert.equal(writes[1].source, "draft"); assert.notEqual(writes[1].id, "draft");
  } finally { await act(async () => tree.unmount()); }
});
test("actual Intrus finite session reaches truthful result summary and explanation without replaying choices", async () => {
  browser(); let choices = 0, summaries = 0;
  globalThis.fetch = async (url, opts) => {
    if (url === "/api/intruder/summary") { summaries++; return Response.json(summarizeIntruder(JSON.parse(opts!.body as string).attempts)); }
    if (opts?.method === "POST") { choices++; const b = JSON.parse(opts.body as string); return Response.json(answerIntruder(b.index, b.choice)); }
    return Response.json(intruderQuestion(Number(new URL(String(url), "https://braiz.io").searchParams.get("index"))));
  };
  let tree!: ReactTestRenderer; await act(async () => { tree = create(createElement(Intruder)); });
  try {
    for (let index = 0; index < 20; index++) {
      const choice = tree.root.findAll(n => n.type === "button" && String(n.props["aria-label"]).startsWith("Choisir "))[0]; await act(async () => choice.props.onClick());
      assert.ok(tree.root.findAll(n => n.props.className === "laboratory-explanation").length); if (index < 19) await click(tree, "Énigme suivante");
    }
    assert.equal(choices, 20); await click(tree, "Voir le bilan des 20 énigmes"); assert.equal(summaries, 1);
    const summary = tree.root.findByProps({ "aria-label": "Bilan de la session" }); assert.match(text(summary), /20 \/ 20 énigmes terminées/); const correct = Array.from({ length: 20 }, (_, i) => answerIntruder(i, 0)).filter(a => a.correct).length; assert.ok(text(summary).includes(`${correct} réponse${correct === 1 ? "" : "s"} juste${correct === 1 ? "" : "s"}`)); assert.equal(buttons(tree, "Énigme suivante").length, 0);
    await act(async () => tree.unmount()); await act(async () => { tree = create(createElement(Intruder)); }); assert.equal(choices, 20); assert.equal(summaries, 2);
  } finally { await act(async () => tree.unmount()); }
});
test("Two braises actual response displays independent A/B scores and preserves in-flight input edits", async () => {
  browser(); let release!: (r: Response) => void; let calls = 0; globalThis.fetch = async () => { calls++; return new Promise(resolve => release = resolve); };
  let tree!: ReactTestRenderer; await act(async () => { tree = create(createElement(TwoBraises)); });
  try {
    await input(tree, "two-guess", "arbre"); const submit = tree.root.findByType("form").props.onSubmit; await act(async () => { submit({ preventDefault() {} }); submit({ preventDefault() {} }); }); assert.equal(calls, 1);
    await input(tree, "two-guess", "forêt"); await act(async () => release(Response.json({ word: "arbre", values: [{ temperature: 100, rank: 1, found: true }, { temperature: 12.25, rank: 4321, found: false }] })));
    assert.equal(tree.root.findByProps({ id: "two-guess" }).props.value, "forêt"); assert.match(text(tree.root), /Cible A : trouvée/); assert.match(text(tree.root), /Cible B : à découvrir/); assert.ok(text(tree.root).includes("12°")); assert.ok(text(tree.root).includes("100°"));
    await act(async () => { tree.root.findByType("form").props.onSubmit({ preventDefault() {} }); });
    await act(async () => release(Response.json({ word: "forêt", values: [{ temperature: 10, rank: 300, found: false }, { temperature: 100, rank: 1, found: true }] })));
    assert.match(text(tree.root), /Cible A : trouvée/); assert.match(text(tree.root), /Cible B : trouvée/); assert.match(text(tree.root), /Les deux mots sont trouvés ! 2 essais/);
    assert.ok(text(tree.root.findByProps({ "aria-label": "Cible A" })).includes("100°"));

  } finally { await act(async () => tree.unmount()); }
});
test("projection manual/polling uses sanitized API, stops when hidden and rejects aborted responses", async () => {
  const { doc, listeners, timers } = browser("?game=owned"); let calls = 0, delay = false; let release!: (r: Response) => void; let signal: AbortSignal | undefined;
  globalThis.fetch = async (url, opts) => { assert.equal(url, "/api/projection?id=owned"); calls++; signal = opts?.signal as AbortSignal; if (delay) return new Promise(resolve => release = resolve); return Response.json({ revision: 1, won: false, temperatures: [12.25], refreshedAt: Date.now() }); };
  let tree!: ReactTestRenderer; await act(async () => { tree = create(createElement(Streamer)); });
  try {
    assert.equal(calls, 0); await click(tree, "Actualiser les températures"); assert.match(text(tree.root), /Vue à jour/); assert.match(text(tree.root), /Essai 1 · 12°/);
    await act(async () => { for (const fn of timers.values()) fn(); }); assert.equal(calls, 1);
    await act(async () => tree.root.findByProps({ type: "checkbox" }).props.onChange({ target: { checked: true } })); delay = true;
    await act(async () => { for (const fn of timers.values()) fn(); }); assert.equal(calls, 2);
    await act(async () => { doc.hidden = true; listeners.get("visibilitychange")!(); }); assert.equal(timers.size, 0); assert.equal(signal!.aborted, true);
    await act(async () => release(Response.json({ revision: 99, won: true, temperatures: [100], refreshedAt: Date.now() }))); assert.ok(!text(tree.root).includes("Défi réussi"));
    await act(async () => { doc.hidden = false; listeners.get("visibilitychange")!(); }); globalThis.fetch = async () => { throw new Error("Hors connexion"); }; await click(tree, "Actualiser les températures"); assert.match(text(tree.root), /Déconnecté/); assert.ok(!text(tree.root).includes("Essai 1 · 12°"));
  } finally { await act(async () => tree.unmount()); assert.equal(timers.size, 0); }
});

test("Intrus refuses an old choice while navigation is synchronously starting", async () => {
  browser(); let choices = 0; let release!: (r: Response) => void;
  globalThis.fetch = async (url, opts) => { if (opts?.method === "POST") { choices++; return Response.json(answerIntruder(0, 0)); } if (String(url).endsWith("index=1")) return new Promise(resolve => release = resolve); return Response.json(intruderQuestion(0)); };
  let tree!: ReactTestRenderer; await act(async () => { tree = create(createElement(Intruder)); });
  try { const oldChoice = tree.root.findAll(n => n.type === "button" && String(n.props["aria-label"]).startsWith("Choisir "))[0].props.onClick; const next = buttons(tree, "2")[0].props.onClick;
    await act(async () => { next(); oldChoice(); }); assert.equal(choices, 0); await act(async () => release(Response.json(intruderQuestion(1)))); assert.match(text(tree.root), /Énigme 2 \/ 20/);
  } finally { await act(async () => tree.unmount()); }
});
test("Two braises refuses old pair submission after synchronous navigation", async () => {
  browser(); let calls = 0; globalThis.fetch = async () => { calls++; throw new Error("must not submit"); };
  let tree!: ReactTestRenderer; await act(async () => { tree = create(createElement(TwoBraises)); });
  try { await input(tree, "two-guess", "arbre"); const submit = tree.root.findByType("form").props.onSubmit; const change = tree.root.findByProps({ id: "pair-select" }).props.onChange;
    await act(async () => { change({ target: { value: "1" } }); submit({ preventDefault() {} }); }); assert.equal(calls, 0); assert.equal(tree.root.findByProps({ id: "pair-select" }).props.value, 1);
  } finally { await act(async () => tree.unmount()); }
});

test("Studio real API and store recover lost duplication after source edit without an extra copy", async () => {
  browser(); const { sqlite, d1, store, studio } = database(); env.DB = d1; const token = randomToken(), csrf = "csrf"; await store.createGuest("A", token, csrf); const session = (await store.session(token))!;
  const source = crypto.randomUUID(); await studio.save(session, source, -1, "Original", ["nature-v1:0"]); const duplicates: string[] = []; let loseResponse = true;
  globalThis.fetch = async (url, opts) => {
    if (url === "/api/session") return Response.json({ guest: { id: session.guest_id, name: "A" }, csrf });
    const request = new Request("https://braiz.io" + String(url), { method: opts?.method ?? "GET", headers: { "Content-Type": "application/json", origin: "https://braiz.io", cookie: "__Host-braise_session=" + token, "X-Braise-CSRF": csrf }, ...(opts?.body ? { body: opts.body } : {}) });
    if (opts?.method !== "POST") return studioGET(request);
    const body = JSON.parse(opts.body as string), response = await studioPOST(request);
    if (body.action === "duplicate") { duplicates.push(body.id); if (loseResponse) { loseResponse = false; assert.equal(response.status, 200); throw new Error("Response lost after durable write"); } }
    return response;
  };
  let tree!: ReactTestRenderer; await act(async () => { tree = create(createElement(Studio)); });
  async function settle() { for (let i = 0; i < 200; i++) { if (!tree.root.findAll(n => n.props.role === "status" && text(n) === "Chargement…").length) return; await act(async () => new Promise(resolve => setTimeout(resolve, 1))); } assert.fail("Studio request did not settle"); }
  async function action(label: string) { await click(tree, label); await settle(); }
  try { await settle();
    await action("Original · révision 0"); await action("Dupliquer ce brouillon"); assert.match(text(tree.root), /Response lost/);
    await input(tree, "studio-title", "Updated"); await action("Enregistrer le brouillon"); await action("Dupliquer ce brouillon");
    assert.equal(duplicates.length, 2); assert.equal(duplicates[0], duplicates[1]); assert.equal(tree.root.findByProps({ id: "studio-title" }).props.value, "Original"); assert.equal((await studio.list(session.guest_id)).length, 2);
    await action("Updated · révision 1"); await action("Dupliquer ce brouillon"); assert.notEqual(duplicates[2], duplicates[0]); assert.equal((await studio.list(session.guest_id)).length, 3);
  } finally { await act(async () => tree.unmount()); delete env.DB; sqlite.close(); }
});
test("Intrus Retry after summary failure retries summary rather than loading a question", async () => {
  browser(); for (let index = 0; index < 20; index++) saveIntruderAttempt({ edition: "intrus-v1", index, choice: 0, occurredAt: "2026-10-12T12:00:00.000Z" }); const requests: string[] = [];
  globalThis.fetch = async (url, opts) => { requests.push(String(url)); if (requests.length === 1) throw new Error("Summary offline"); if (url === "/api/intruder/summary") return Response.json(summarizeIntruder(JSON.parse(opts!.body as string).attempts)); return Response.json(answerIntruder(0, 0)); };
  let tree!: ReactTestRenderer; await act(async () => { tree = create(createElement(Intruder)); });
  try { assert.match(text(tree.root), /Summary offline/); await click(tree, "Réessayer"); assert.deepEqual(requests, ["/api/intruder/summary", "/api/intruder/summary"]); assert.ok(tree.root.findByProps({ "aria-label": "Bilan de la session" })); }
  finally { await act(async () => tree.unmount()); }
});
