import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import Training from "../components/training";
import { TRAINING_INFO, TRAINING_STORAGE_KEY } from "../lib/training";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const text = (node: ReactTestInstance): string => node.children.map(child => typeof child === "string" ? child : text(child)).join("");
let fieldEffects: string[] = [];
class Memory {
  data = new Map<string, string>(); writes: string[] = [];
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.writes.push(key); this.data.set(key, value); }
}
function browser() {
  const storage = new Memory(), requests: string[] = [];
  const frames: FrameRequestCallback[] = []; fieldEffects = [];
  Object.assign(globalThis, { localStorage: storage, requestAnimationFrame: (callback: FrameRequestCallback) => frames.push(callback), window: { isSecureContext: false, addEventListener() {}, removeEventListener() {} } });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine: false } });
  globalThis.fetch = async path => { requests.push(String(path)); assert.equal(path, TRAINING_INFO.path); return new Response(readFileSync(`public${TRAINING_INFO.path}`)); };
  return { storage, requests, frames, fieldEffects };
}
async function mount() {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(createElement(Training), { createNodeMock: element => element.type === "input" ? { focus: () => fieldEffects.push("focus"), scrollIntoView: () => fieldEffects.push("scroll") } : null }); });
  for (let i = 0; i < 30 && !tree.root.findAllByType("form").length; i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
  assert.equal(tree.root.findAllByType("form").length, 1);
  return tree;
}
async function enter(tree: ReactTestRenderer, value: string) { await act(async () => tree.root.findByProps({ id: "training-word" }).props.onChange({ target: { value } })); }
async function submit(tree: ReactTestRenderer) { await act(async () => tree.root.findByType("form").props.onSubmit({ preventDefault() {} })); }

test("actual Training component rejects unknown without score/attempt, records local hints/win, restores silently offline", async () => {
  const h = browser(); h.storage.data.set("braise.v1.profile", "existing profile");
  let tree = await mount();
  try {
    assert.match(text(tree.root), /Hors connexion/);
    assert.equal(h.storage.writes.length, 0);
    await enter(tree, "inexistant-dans-ce-pack"); await submit(tree);
    assert.match(text(tree.root), /hors du vocabulaire de ce petit pack/);
    assert.equal(h.storage.writes.length, 0);
    assert.equal(tree.root.findByProps({ id: "training-word" }).props.value, "inexistant-dans-ce-pack");
    const hint = tree.root.findAll(n => n.type === "button" && text(n) === "Voir l’indice suivant")[0];
    await act(async () => hint.props.onClick());
    assert.match(text(tree.root), /Cherchez du côté de l’alimentation/);
    await enter(tree, "banane"); await submit(tree); await enter(tree, "pomme"); await submit(tree);
    const saved = h.storage.getItem(TRAINING_STORAGE_KEY); assert.ok(saved);
    assert.deepEqual(JSON.parse(saved).games[`${TRAINING_INFO.id}-1`], { words: ["banane", "pomme"], hints: 1 });
    assert.equal(h.storage.getItem("braise.v1.profile"), "existing profile");
    assert.ok(h.storage.writes.every(key => key === TRAINING_STORAGE_KEY));
    assert.equal(tree.root.findByProps({ id: "training-word" }).props.disabled, true);
    const writes = h.storage.writes.length;
    await act(async () => tree.unmount()); tree = await mount();
    assert.equal(h.storage.writes.length, writes);
    assert.equal(h.storage.getItem(TRAINING_STORAGE_KEY), saved);
    assert.ok(!tree.root.findAll(n => n.props.role === "status").some(n => text(n).includes("Mot trouvé !")));
    assert.match(text(tree.root), /Facile · Mot trouvé/);
    assert.ok(h.requests.every(path => path === TRAINING_INFO.path));
  } finally { await act(async () => tree.unmount()); }
});

test("actual Training blocks corrupt/future progress and preserves existing data", async () => {
  const h = browser(); const saved = '{"schema":99,"newer":"do not overwrite"}'; h.storage.data.set(TRAINING_STORAGE_KEY, saved);
  const tree = await mount();
  try {
    assert.match(text(tree.root), /incompatible ou altérée/);
    assert.equal(tree.root.findByProps({ id: "training-word" }).props.disabled, true);
    await submit(tree); assert.equal(h.storage.getItem(TRAINING_STORAGE_KEY), saved); assert.equal(h.storage.writes.length, 0);
  } finally { await act(async () => tree.unmount()); }
});

test("training live announcement, best and history use French decimals and one attempt uses singular", async () => {
  browser(); const tree = await mount();
  try {
    await enter(tree, "fruit"); await submit(tree);
    const statuses = tree.root.findAll(n => n.props.role === "status");
    assert.ok(statuses.some(n => text(n).includes("48,10 °C, rang 49")));
    assert.match(text(tree.root), /1 essai · Continuer/);
    assert.ok(!text(tree.root).includes("1 essais"));
    assert.match(text(tree.root.findByProps({ className: "training-attempts" })), /48,10 °C/);
    assert.ok(!text(tree.root).includes("48.1"));
  } finally { await act(async () => tree.unmount()); }
});

test("playable board precedes optional download; compact explicit level choice focuses input but restoration never does", async () => {
  const h = browser(); let tree = await mount();
  try {
    assert.ok(text(tree.root).indexOf("Votre proposition") < text(tree.root).indexOf("Emporter ce petit pack"));
    const selector = tree.root.findByProps({ "aria-label": "Choisir un parcours" });
    assert.ok(!text(selector).includes("Un objet concret"));
    assert.equal(h.frames.length, 0); assert.deepEqual(h.fieldEffects, []);
    await act(async () => selector.findAllByType("button")[1].props.onClick());
    assert.match(text(tree.root), /Un mot qui a plusieurs sens/);
    assert.equal(h.frames.length, 1);
    await act(async () => h.frames.shift()!(0));
    assert.deepEqual(h.fieldEffects, ["focus", "scroll"]);
    h.fieldEffects.length = 0;
    await act(async () => tree.unmount()); tree = await mount();
    assert.match(text(tree.root), /Standard · À vous de chercher/);
    assert.equal(h.frames.length, 0); assert.deepEqual(h.fieldEffects, []);
  } finally { await act(async () => tree.unmount()); }
});

test("stale training handlers cannot overwrite newly selected puzzle or increment hints twice", async () => {
  browser(); const tree = await mount();
  try {
    await enter(tree, "banane"); const oldSubmit = tree.root.findByType("form").props.onSubmit;
    const standard = tree.root.findAll(n => n.type === "button" && n.props["aria-pressed"] !== undefined)[1];
    await act(async () => { standard.props.onClick(); oldSubmit({ preventDefault() {} }); });
    assert.match(text(tree.root), /Standard · À vous de chercher/);
    const hint = tree.root.findAll(n => n.type === "button" && text(n) === "Voir l’indice suivant")[0];
    await act(async () => { hint.props.onClick(); hint.props.onClick(); });
    assert.match(text(tree.root), /1 \/ 3 utilisés/);
  } finally { await act(async () => tree.unmount()); }
});
