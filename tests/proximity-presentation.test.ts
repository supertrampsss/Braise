import test from 'node:test';
import assert from 'node:assert/strict';
import { proximityFill, PROXIMITY_MILESTONES, formatRankFr } from '../lib/proximity-presentation';
import { createGameFeedback } from '../lib/game-feedback';
import { getLegacyPuzzle } from '../lib/legacy-puzzles';

test('all ranks guide play before the top 5000 and each milestone keeps its position', () => {
  const vocabularySize = 155562;
  const ranks = [155562, 20000, 8000, 5000, 1000, 100, 10, 2, 1];
  const positions = ranks.map(rank => proximityFill(rank, vocabularySize));
  assert.equal(positions[0], 0);
  assert.ok(positions.every((position, i) => i === 0 || position > positions[i - 1]));
  assert.ok(proximityFill(8000,vocabularySize) < .2);
  for (const point of PROXIMITY_MILESTONES) assert.equal(proximityFill(point.rank,vocabularySize), point.position);
  assert.equal(proximityFill(null, undefined), 0);
  assert.equal(formatRankFr(21980), '21\u202f980e');
  assert.equal(formatRankFr(1), '1er');
});

test('the same display supports historical vocabularies and refuses invalid factual ranks', () => {
  assert.ok(proximityFill(20000,30000)>0);
  assert.ok(proximityFill(30,100)>proximityFill(50,100));
  for (const rank of [0,-1,1.2,NaN,155563]) assert.throws(()=>proximityFill(rank,155562),RangeError);
  assert.throws(()=>proximityFill(100,undefined),RangeError);
});

test('a closer exact rank triggers a record even if rounded temperatures are identical', () => {
  const ref=getLegacyPuzzle('free','042').publicPuzzle.ref;
  const guess={word:'arbre',temperature:12.25,rank:790,order:2,found:false};
  assert.equal(createGameFeedback(800,guess,ref).type,'bestImproved');
  assert.equal(createGameFeedback(780,guess,ref).type,'guessAccepted');
});
