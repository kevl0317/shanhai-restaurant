import test from 'node:test';
import assert from 'node:assert/strict';
import { freshProgress, loadProgress, persistProgress, recordResult, sanitizeProgress, SAVE_KEY } from '../src/storage.js';
import { generateSession, scoreSession } from '../src/engine.js';

function memoryStorage(initial = null) {
  let value = initial;
  return {
    getItem(key) { assert.equal(key, SAVE_KEY); return value; },
    setItem(key, next) { assert.equal(key, SAVE_KEY); value = next; },
  };
}

function play(progress, levelId, answersFor = (orders) => orders.map((order) => [...order.final])) {
  const session = generateSession(levelId, `storage-test-${levelId}`);
  const answers = answersFor(session.orders);
  const result = scoreSession(levelId, answers, session.orders);
  recordResult(progress, levelId, result, session, answers);
  return { session, answers, result };
}

test('fresh storage begins with an independent empty progress record', () => {
  const first = freshProgress();
  const second = freshProgress();
  first.cards.push('01');
  first.settings.sound = false;
  assert.deepEqual(second.cards, []);
  assert.equal(second.settings.sound, true);
  const loaded = loadProgress(memoryStorage());
  assert.equal(loaded.available, true);
  assert.deepEqual(loaded.progress, second);
});

test('save/load restores earned cards, best results, preferences and reproducible last session', () => {
  const progress = freshProgress();
  for (let levelId = 1; levelId <= 5; levelId += 1) play(progress, levelId);
  progress.tutorials = [1];
  progress.decorations = [1];
  progress.placements.left = 1;
  progress.settings.sound = false;
  const storage = memoryStorage();
  assert.equal(persistProgress(progress, storage), true);
  const restored = loadProgress(storage);
  assert.equal(restored.available, true);
  assert.deepEqual(restored.progress, progress);
  assert.deepEqual(generateSession(restored.progress.latest.levelId, restored.progress.latest.seed).orders, restored.progress.latest.orders);
  assert.deepEqual(restored.progress.cards, ['01', '02', '03', '04', '05']);
});

test('retries preserve best results and award each card once, even after a later failure', () => {
  const progress = freshProgress();
  play(progress, 1);
  const best = { ...progress.levels[1] };
  play(progress, 1);
  const failed = play(progress, 1, () => [[], [], []]);
  assert.equal(failed.result.passed, false);
  assert.deepEqual(progress.levels[1], best);
  assert.deepEqual(progress.cards, ['01']);
  assert.equal(progress.latest.passed, false);
  assert.equal(progress.latest.score, 0);
  play(progress, 2, () => [[], [], []]);
  assert.equal(progress.levels[2].passed, false);
  assert.deepEqual(progress.cards, ['01']);
  play(progress, 2);
  assert.deepEqual(progress.cards, ['01', '02']);
});

test('last submitted answers are snapshotted rather than changed by later UI edits', () => {
  const progress = freshProgress();
  const { answers } = play(progress, 1);
  const submitted = progress.latest.answers.map((answer) => [...answer]);
  answers[0].pop();
  answers[1].reverse();
  assert.deepEqual(progress.latest.answers, submitted);
});

test('malformed and unsupported saves recover without unlocking cards or unearned decorations', () => {
  for (const raw of [null, undefined, [], {}, { version: 2, cards: ['25'] }]) {
    assert.deepEqual(sanitizeProgress(raw), freshProgress());
  }
  const raw = {
    version: 1,
    levels: { 1: { stars: 2, score: 82, accuracy: 87, passed: true }, 2: { stars: 4, score: 100, passed: true }, 3: { stars: 3, score: '100', passed: true }, 26: { stars: 3, score: 100, passed: true } },
    cards: ['01', '01', '02', '25', '99'],
    tutorials: [1, 1, 6, 0, 26, '11', null],
    decorations: [1, 1, 5, -1, '2'],
    placements: { left: 1, center: 5, right: 99 },
    latest: { levelId: 26, score: 100 },
  };
  const progress = sanitizeProgress(raw);
  assert.deepEqual(progress.cards, ['01']);
  assert.deepEqual(Object.keys(progress.levels), ['1']);
  assert.deepEqual(progress.tutorials, [1, 6]);
  assert.deepEqual(progress.decorations, []);
  assert.deepEqual(progress.placements, { left: null, center: null, right: null });
  assert.equal(progress.latest, null);
  assert.equal(loadProgress(memoryStorage('{broken json')).available, false);
  assert.deepEqual(loadProgress(memoryStorage('{broken json')).progress, freshProgress());
});

test('unavailable or full browser storage returns a recoverable failure', () => {
  const unavailable = { getItem() { throw new Error('Blocked'); }, setItem() { throw new Error('Quota'); } };
  assert.equal(loadProgress(unavailable).available, false);
  assert.deepEqual(loadProgress(unavailable).progress, freshProgress());
  assert.equal(persistProgress(freshProgress(), unavailable), false);
  assert.equal(loadProgress(null).available, false);
  assert.equal(persistProgress(freshProgress(), null), false);
});
