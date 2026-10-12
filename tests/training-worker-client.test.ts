import test from "node:test";
import assert from "node:assert/strict";
import { trainingWorkerRequest, TRAINING_INFO } from "../lib/training";
import manifest from "../public/training/manifest.json";

class Worker {
  state: ServiceWorkerState = "installed";
  listeners = new Set<() => void>();
  messages: string[] = [];
  constructor(private neutral = false) {}
  addEventListener(name: string, callback: () => void) { assert.equal(name, "statechange"); this.listeners.add(callback); }
  removeEventListener(name: string, callback: () => void) { assert.equal(name, "statechange"); this.listeners.delete(callback); }
  change(state: ServiceWorkerState) { this.state = state; for (const listener of this.listeners) listener(); }
  postMessage(message: { action: string; packSha256: string }, ports: MessagePort[]) {
    this.messages.push(message.action);
    assert.equal(message.packSha256, TRAINING_INFO.sha256);
    if (!this.neutral) {
      ports[0].postMessage({ ready: message.action === "download", bytes: manifest.totalBytes, wordCount: 208, puzzleCount: 3, packSha256: TRAINING_INFO.sha256, olderVersions: 0, storedVersions: message.action === "download" ? 1 : 0 });
      ports[0].close();
    }
  }
}
function browser(registration: { active: Worker | null; waiting: Worker | null; installing: Worker | null }) {
  Object.assign(globalThis, { window: { isSecureContext: true } });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { serviceWorker: { register: async (path: string) => { assert.equal(path, "/sw.js"); return registration; }, ready: Promise.resolve(registration) } } });
}

test("active neutral worker is bypassed: status and explicit download address the new waiting worker", async () => {
  const neutral = new Worker(true), waiting = new Worker(); neutral.state = "activated";
  browser({ active: neutral, waiting, installing: null });
  const status = await trainingWorkerRequest("status");
  assert.equal(status.ready, false); assert.equal(status.bytes, manifest.totalBytes);
  assert.equal((await trainingWorkerRequest("download")).ready, true);
  assert.deepEqual(neutral.messages, []);
  assert.deepEqual(waiting.messages, ["status", "download"]);
});

test("pending installation is awaited before selecting the waiting training worker", async () => {
  const neutral = new Worker(true), installing = new Worker(); installing.state = "installing";
  const registration = { active: neutral, waiting: null as Worker | null, installing: installing as Worker | null }; browser(registration);
  const response = trainingWorkerRequest("status");
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(installing.listeners.size, 1); assert.deepEqual(neutral.messages, []); assert.deepEqual(installing.messages, []);
  registration.waiting = installing; registration.installing = null; installing.change("installed");
  assert.equal((await response).ready, false);
  assert.deepEqual(installing.messages, ["status"]); assert.deepEqual(neutral.messages, []); assert.equal(installing.listeners.size, 0);
});

test("redundant installation rejects instead of silently posting to the old neutral worker", async () => {
  const neutral = new Worker(true), installing = new Worker(); installing.state = "installing";
  browser({ active: neutral, waiting: null, installing });
  const response = trainingWorkerRequest("download");
  await new Promise(resolve => setImmediate(resolve)); installing.change("redundant");
  await assert.rejects(response, /installation.*échoué/);
  assert.deepEqual(neutral.messages, []); assert.deepEqual(installing.messages, []); assert.equal(installing.listeners.size, 0);
});

test("hung installation times out, removes listeners and never activates or messages the old worker", async () => {
  const original = globalThis.setTimeout;
  // Retain the production bound and shorten only elapsed test time.
  globalThis.setTimeout = ((callback: () => void, delay?: number) => original(callback, delay === 15000 ? 5 : delay)) as typeof setTimeout;
  const neutral = new Worker(true), installing = new Worker(); installing.state = "installing";
  browser({ active: neutral, waiting: null, installing });
  try {
    await assert.rejects(trainingWorkerRequest("status"), /interrompue|pas prêt/);
    assert.equal(installing.listeners.size, 0); assert.deepEqual(neutral.messages, []); assert.deepEqual(installing.messages, []);
  } finally { globalThis.setTimeout = original; }
});
