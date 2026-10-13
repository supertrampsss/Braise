import type { RangeBucket } from './semantic-v2-range-r2';
// Per-request network limits. Counters describe actual calls and received bytes,
// never RSS or a numerical-validation attestation.
export function boundedRangeBucket(bucket: RangeBucket, limits: { reads: number; bytes: number; signal: AbortSignal; corruptRange?: boolean }) {
  const counters = { reads: 0, bytes: 0 }; let corrupted = false; let closed = false;
  const aborted = () => new Error('v2-range-deadline');
  const pending = new Set<() => void>();
  function stop() { for (const cancel of pending) cancel(); }
  limits.signal.addEventListener('abort', stop, { once: true });
  const wrapped: RangeBucket = { async get(key, options) {
    if (limits.signal.aborted || closed) throw aborted();
    if (counters.reads >= limits.reads) throw new Error('v2-range-read-budget');
    counters.reads++;
    let rejectAbort: (reason: Error) => void = () => {};
    const cancelPending = () => rejectAbort(aborted());
    const abortPromise = new Promise<never>((_, reject) => { rejectAbort = reject; });
    pending.add(cancelPending);
    const operation = bucket.get(key, options).then(async object => {
      if (limits.signal.aborted || closed) { if (object) await object.body.cancel(); throw aborted(); }
      return object;
    });
    let object;
    try { object = await Promise.race([operation, abortPromise]); }
    finally { pending.delete(cancelPending); }
    if (!object) return null;
    const reader = object.body.getReader(); let finished = false; let cancelling = false;
    let controller: ReadableStreamDefaultController<Uint8Array>;
    const finish = () => { pending.delete(cancelBody); if (!finished) { finished = true; reader.releaseLock(); } };
    const cancelBody = () => { if (finished || cancelling) return; cancelling = true; controller.error(aborted()); void reader.cancel().catch(() => {}).finally(finish); };
    const body = new ReadableStream<Uint8Array>({
      start(value) { controller = value; pending.add(cancelBody); if (limits.signal.aborted) cancelBody(); },
      async pull(output) {
        if (finished || cancelling) return;
        try {
          const { done, value } = await reader.read();
          if (limits.signal.aborted || closed || cancelling) { if (!finished) cancelBody(); return; }
          if (done) { finish(); output.close(); return; }
          counters.bytes += value.length;
          if (counters.bytes > limits.bytes) { await reader.cancel(); finish(); output.error(new Error('v2-range-byte-budget')); return; }
          if (limits.corruptRange && options?.range && !corrupted && value.length) { const changed = new Uint8Array(value); changed[0] ^= 1; corrupted = true; output.enqueue(changed); }
          else output.enqueue(value);
        } catch (error) { if (!finished) { await reader.cancel().catch(() => {}); finish(); output.error(error); } }
      },
      async cancel() { if (!finished) { await reader.cancel(); finish(); } },
    }, { highWaterMark: 0 });
    return { ...object, body };
  } };
  return { bucket: wrapped, counters, close() { closed = true; stop(); limits.signal.removeEventListener('abort', stop); } };
}
