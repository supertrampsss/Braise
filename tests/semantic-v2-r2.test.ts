import test from "node:test";
import assert from "node:assert/strict";
import { boundedR2Loader } from "../lib/semantic-v2-r2";
test("R2 transport enforces declared and streamed byte limits without fallback", async () => {
  const stream = (values: number[]) => new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(Uint8Array.from(values)); controller.close(); } });
  assert.deepEqual(await boundedR2Loader({ get: async () => ({ size: 2, body: stream([1, 2]) }) })("key", 2), Uint8Array.from([1, 2]));
  await assert.rejects(boundedR2Loader({ get: async () => null })("missing", 2), /missing/);
  await assert.rejects(boundedR2Loader({ get: async () => ({ size: 3, body: stream([1, 2, 3]) }) })("large", 2), /too-large/);
  await assert.rejects(boundedR2Loader({ get: async () => ({ size: 2, body: stream([1, 2, 3]) }) })("lie", 2), /mismatch/);
  await assert.rejects(boundedR2Loader({ get: async () => ({ size: 2, body: stream([1]) }) })("short", 2), /mismatch/);
});
