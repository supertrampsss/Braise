import { gzipSync } from "node:zlib";

/** Frozen Linux gzip envelope. OS metadata is outside the compressed payload/CRC. */
export function canonicalGzip(raw, options = { level: 9 }) {
  const compressed = gzipSync(raw, options);
  compressed[9] = 3;
  return compressed;
}
