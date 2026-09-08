// Explicit R2 adapter for a future verified V2 activation. Does not change V1.
type R2Readable = { size: number; body: ReadableStream<Uint8Array> };
export function boundedR2Loader(bucket: { get(key: string): Promise<R2Readable | null> }) {
  return async (key: string, maximum: number) => {
    const object = await bucket.get(key);
    if (!object) throw new Error("v2-r2-object-missing");
    if (!Number.isSafeInteger(object.size) || object.size < 1 || object.size > maximum) { await object.body.cancel(); throw new Error("v2-r2-object-too-large"); }
    const output = new Uint8Array(object.size); const reader = object.body.getReader(); let offset = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        if (offset + value.length > output.length) { await reader.cancel(); throw new Error("v2-r2-size-mismatch"); }
        output.set(value, offset); offset += value.length;
      }
    } finally { reader.releaseLock(); }
    if (offset !== output.length) throw new Error("v2-r2-size-mismatch");
    return output;
  };
}
