import { test } from "node:test";
import assert from "node:assert/strict";
import { intruderQuestion, answerIntruder } from "../lib/intruder-server";
import { readIntruderAttempts, saveIntruderAttempt } from "../lib/profile-storage";
import { GET, POST } from "../app/api/intruder/route";
test("twenty intruder questions expose four unique words and exactly one explained answer", () => {
  for (let index = 0; index < 20; index++) {
    const question = intruderQuestion(index);
    assert.equal(new Set(question.words).size, 4);
    assert.equal(Object.hasOwn(question, "answer"), false); assert.equal(Object.hasOwn(question, "explanation"), false);
    const results = [0, 1, 2, 3].map(choice => answerIntruder(index, choice));
    assert.equal(results.filter(result => result.correct).length, 1);
    assert.ok(results.every(result => result.explanation.length > 30));
  }
});
test("intruder API refuses unknown editions and out-of-range input", async () => {
  for (const index of ["", "-1", "20", "1.5", "foo"]) assert.equal(GET(new Request(`https://braise.test/api/intruder?index=${index}`)).status, 400);
  for (const body of [{ edition: "intrus-v2", index: 0, choice: 1 }, { edition: "intrus-v1", index: 0, choice: 4 }, null]) {
    assert.equal((await POST(new Request("https://braise.test/api/intruder", { method: "POST", body: JSON.stringify(body) }))).status, 400);
  }
});
test("intruder attempts are idempotent and storage failure is explicit", () => {
  const values = new Map<string, string>();
  const storage = { get length() { return values.size; }, key: (i: number) => [...values.keys()][i] ?? null, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const attempt = { edition: "intrus-v1" as const, index: 0, choice: 3, occurredAt: "2026-09-08T07:00:00.000Z" };
  assert.equal(saveIntruderAttempt(attempt, storage).persisted, true);
  assert.deepEqual(saveIntruderAttempt({ ...attempt, choice: 0 }, storage), { persisted: true, attempt });
  assert.deepEqual(readIntruderAttempts(storage), [attempt]); assert.equal(values.size, 1);
  assert.equal(saveIntruderAttempt({ ...attempt, index: 1 }, { ...storage, setItem: () => { throw new Error("quota"); } }).persisted, false);
});
