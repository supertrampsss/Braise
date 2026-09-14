import test from "node:test";
import assert from "node:assert/strict";
import { chooseEditorialHint, editorialCandidateQuality, isObviousEditorialVariant } from "../lib/editorial-hints";

test("editorial policy removes function words and obvious variants", () => {
  assert.equal(editorialCandidateQuality("de", "sable"), "excluded");
  assert.equal(editorialCandidateQuality("test", "sable"), "excluded");
  assert.equal(isObviousEditorialVariant("sables", "sable"), true);
  assert.equal(editorialCandidateQuality("plage", "sable"), "preferred");
});

test("editorial choice keeps a readable fallback without changing candidate identity", () => {
  const candidates = [{ index: 1, word: "de" }, { index: 2, word: "plage" }, { index: 3, word: "très-long-mot-qui-reste" }];
  assert.deepEqual(chooseEditorialHint(candidates, "sable"), candidates[1]);
  assert.equal(chooseEditorialHint([{ index: 4, word: "très-long-mot-qui-reste" }], "sable")?.index, 4);
});
