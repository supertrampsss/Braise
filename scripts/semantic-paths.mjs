import { lstat, realpath } from "node:fs/promises";
import { dirname, resolve } from "node:path";

// Compare filesystem identities only after checking every component: realpath alone
// changes Windows case/8.3 spelling, but would also silently follow real junctions.
export async function canonicalDirectoryWithoutLinks(path) {
  const absolute = resolve(path);
  for (let cursor = absolute; ; cursor = dirname(cursor)) {
    const info = await lstat(cursor);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("Directory path cannot contain symbolic links or non-directories");
    if (dirname(cursor) === cursor) break;
  }
  return realpath(absolute);
}
