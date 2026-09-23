import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, getPool, seededRandom, shuffle, applyOperations, generateSession, operationText, operationSlots, changeSlots, changeDuration, wrongPositions, scoreSession, resumeCheckpoint, phaseAt, submissionTime } from '../src/engine.js';

test('25 script configurations preserve length, time budgets, tutorials, and thresholds', () => {
  const serveTimes = [13, 14, 13, 13.5, 13.5, 10.5, 11, 11, 10, 11, 13, 13, 13, 13, 12.5, 12.5, 12.5, 12, 12.5, 12, 17, 14, 11, 11, 13.5];
  const finalLengths = [3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 5, 5, 5, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5];
  const rememberTimes = [5, 4, 5, 4.5, 4.5, 5, 4.5, 4.5, 4.5, 4.5, 6, 6, 6, 6, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 7, 7, 7, 7, 7];
  assert.equal(LEVELS.length, 25);
  for (const level of LEVELS) {
    assert.equal(level.roundDuration, level.id <= 10 ? 20 : level.id <= 20 ? 24 : 26);
    assert.equal(level.changeDuration, level.id <= 10 ? 2.5 : 3);
    assert.equal(level.feedbackDuration, 2);
    assert.equal(level.remember, rememberTimes[level.id - 1]);
    assert.equal(level.remember + level.changeDuration * level.operations.length + level.wait + level.serve + level.feedbackDuration, level.roundDuration);
    assert.equal(level.serve, serveTimes[level.id - 1]);
    assert.equal(level.threshold, level.id <= 10 ? 0.75 : 0.8);
    assert.equal(generateSession(level.id, 'length').orders[0].final.length, finalLengths[level.id - 1]);
    if (level.id > 10) assert.ok(level.serve >= 11, `level ${level.id} needs at least 11 seconds to serve`);
    if (level.chapter <= 4) assert.ok(level.operations.length <= 1);
    if (level.id % 5 === 0) assert.ok(level.operations.length <= 1);
  }
  assert.deepEqual(LEVELS.filter((level) => level.operations.length === 2).map((level) => level.id), [23, 24]);
  assert.deepEqual(LEVELS.filter((level) => level.tutorial).map((level) => level.id), [1, 6, 11, 13, 14, 19, 23, 24]);
});

test('later chapters introduce five dishes and only add double changes at levels 23 and 24', () => {
  assert.equal(LEVELS[16].title, '四道变五道');
  assert.equal(LEVELS[16].length, 4);
  assert.deepEqual(LEVELS[16].operations, [{ type: 'insert', index: 3, symbol: 4 }]);
  assert.equal(LEVELS[18].title, '中间换一道');
  assert.deepEqual(LEVELS[18].operations, [{ type: 'replace', index: 2, symbol: 5 }]);
  assert.equal(LEVELS[18].wait, 0);
  assert.equal(LEVELS[20].title, '五道菜上桌');
  assert.deepEqual(LEVELS[20].operations, []);
  assert.equal(LEVELS[21].title, '五道中的新菜');
  assert.deepEqual(LEVELS[21].operations, [{ type: 'replace', index: 3, symbol: 5 }]);
  assert.deepEqual(LEVELS[22].operations, [{ type: 'remove', index: 1 }, { type: 'insert', index: 3, symbol: 5 }]);
  assert.deepEqual(LEVELS[23].operations, [{ type: 'replace', index: 1, symbol: 5 }, { type: 'replace', index: 3, symbol: 6 }]);
  assert.deepEqual(LEVELS.filter((level) => level.id > 10 && level.wait).map((level) => [level.id, level.wait]), [[18, 0.5], [20, 0.5], [25, 0.5]]);
});

test('current-menu positions handle consecutive replacement and remove-then-insert', () => {
  assert.deepEqual(applyOperations(['A', 'B', 'C', 'D', 'E'], [
    { type: 'replace', index: 2, dishId: 'F' },
    { type: 'replace', index: 2, dishId: 'G' },
  ]), ['A', 'B', 'G', 'D', 'E']);
  assert.deepEqual(applyOperations(['A', 'B', 'C', 'D', 'E', 'F'], [
    { type: 'remove', index: 1 },
    { type: 'insert', index: 3, dishId: 'G' },
  ]), ['A', 'C', 'D', 'G', 'E', 'F']);
  const initial = ['A', 'B', 'C'];
  assert.deepEqual(applyOperations(initial, [{ type: 'append', dishId: 'D' }]), ['A', 'B', 'C', 'D']);
  assert.deepEqual(initial, ['A', 'B', 'C']);
  assert.throws(() => applyOperations(initial, [{ type: 'replace', index: 0, dishId: 'C' }]));
  assert.throws(() => applyOperations(initial, [{ type: 'remove', index: 3 }]));
  assert.throws(() => applyOperations(['A', 'A'], []));
});

test('seeded random is repeatable, bounded, and shuffle never mutates its input', () => {
  const one = seededRandom('山海-seed');
  const two = seededRandom('山海-seed');
  for (let i = 0; i < 1000; i += 1) {
    const value = one();
    assert.equal(value, two());
    assert.ok(value >= 0 && value < 1);
  }
  const values = [1, 2, 3, 4, 5];
  assert.deepEqual(shuffle(values, seededRandom(10)).sort(), values);
  assert.deepEqual(values, [1, 2, 3, 4, 5]);
  assert.deepEqual(generateSession(23, 'replay'), generateSession(23, 'replay'));
  assert.notDeepEqual(generateSession(23, 'replay'), generateSession(23, 'another-seed'));
});

test('all 25 levels satisfy generation invariants over 128 seeds each', () => {
  for (const level of LEVELS) {
    const pool = getPool(level.chapter);
    const local = new Set(pool.slice(0, 5));
    for (let seed = 0; seed < 128; seed += 1) {
      const session = generateSession(level.id, seed);
      assert.equal(session.seed, seed);
      assert.equal(session.orders.length, 3);
      assert.equal(new Set(session.orders.map(({ initial, final }) => JSON.stringify([initial, final]))).size, 3);
      for (const order of session.orders) {
        for (const menu of [order.initial, order.final]) {
          assert.ok(menu.length <= 5, `level ${level.id} cannot exceed five dishes`);
          assert.equal(new Set(menu).size, menu.length);
          assert.ok(menu.every((id) => pool.includes(id)));
          assert.ok(menu.filter((id) => local.has(id)).length >= 2);
        }
        assert.equal(order.initial.length, level.length);
        assert.deepEqual(applyOperations(order.initial, order.operations), order.final);
        let current = order.initial;
        for (const operation of order.operations) {
          assert.deepEqual(operation.before, current);
          if (operation.type !== 'remove') assert.ok(!current.includes(operation.dishId));
          current = applyOperations(current, [operation]);
          assert.ok(current.length <= 5);
          assert.deepEqual(operation.after, current);
        }
        assert.deepEqual([...order.shelf].sort(), [...pool].sort());
        const positions = order.final.map((id) => order.shelf.indexOf(id));
        assert.ok(!positions.every((position, index) => index === 0 || positions[index - 1] < position));
        assert.ok(!positions.every((position) => Math.floor(position / 3) === Math.floor(positions[0] / 3)));
        assert.ok(!positions.every((position) => position % 3 === positions[0] % 3));
      }
    }
  }
});

test('wrong positions include every misplaced or missing dish and leave correct positions unchanged', () => {
  const expected = Object.freeze(['A', 'B', 'C', 'D', 'E']);
  const swapped = Object.freeze(['B', 'A', 'C', 'E', 'D']);
  const gap = Object.freeze(['A', null, 'C', 'D', 'E']);
  const short = Object.freeze(['A', 'B', 'C']);
  assert.deepEqual(wrongPositions(expected, swapped), [0, 1, 3, 4]);
  assert.deepEqual(wrongPositions(expected, gap), [1]);
  assert.deepEqual(wrongPositions(expected, short), [3, 4]);
  assert.deepEqual(wrongPositions(expected, expected), []);
  assert.deepEqual(wrongPositions(expected), [0, 1, 2, 3, 4]);
  assert.deepEqual(wrongPositions([], []), []);
  assert.deepEqual(expected, ['A', 'B', 'C', 'D', 'E']);
  assert.deepEqual(swapped, ['B', 'A', 'C', 'E', 'D']);
  assert.deepEqual(gap, ['A', null, 'C', 'D', 'E']);
  assert.deepEqual(short, ['A', 'B', 'C']);
});

test('script example: 13/15 positions and two complete orders gives 83 points and two stars', () => {
  const orders = Array.from({ length: 3 }, () => ({ final: ['A', 'B', 'C', 'D', 'E'] }));
  const result = scoreSession(15, [['A', 'B', 'C', 'D', 'E'], ['A', 'B', 'C', 'D', 'E'], ['A', 'B', 'C']], orders);
  assert.equal(result.accuracy, 13 / 15 * 100);
  assert.equal(result.correct, 13);
  assert.equal(result.total, 15);
  assert.equal(result.complete, 2);
  assert.equal(result.score, 83);
  assert.equal(result.stars, 2);
  assert.equal(result.passed, true);
  assert.equal(result.details[2].firstWrong, 3);
});

test('grading counts positions, missing dishes, aggregate lengths, and complete orders', () => {
  const orders = [{ final: ['A', 'B', 'C'] }, { final: ['A', 'B', 'C', 'D'] }, { final: ['A', 'B', 'C', 'D', 'E'] }];
  const all = scoreSession(1, orders.map((order) => order.final), orders);
  assert.equal(all.score, 100);
  assert.equal(all.stars, 3);
  assert.ok(all.details.every((detail) => detail.firstWrong === -1));
  const empty = scoreSession(1, [], orders);
  assert.equal(empty.accuracy, 0);
  assert.equal(empty.complete, 0);
  assert.equal(empty.stars, 0);
  const aggregate = scoreSession(1, [[], orders[1].final, orders[2].final], orders);
  assert.equal(aggregate.accuracy, 75);
  assert.equal(aggregate.passed, true);
  assert.equal(aggregate.stars, 1);
  assert.equal(scoreSession(11, [[], orders[1].final, orders[2].final], orders).passed, false);
  const shifted = scoreSession(15, [['A', 'C', 'B'], ['A', 'C', 'B', 'D'], ['A', 'C', 'D', 'E', 'B']], orders);
  assert.equal(shifted.correct, 4);
  assert.equal(shifted.complete, 0);
  assert.equal(shifted.passed, false);
});

test('pass and star thresholds use the raw ratio rather than rounded display percentages', () => {
  const orders = [200, 200, 600].map((length) => ({ final: Array.from({ length }, (_, index) => String(index)) }));
  const result = scoreSession(11, [orders[0].final, orders[1].final, orders[2].final.slice(0, 399)], orders);
  assert.equal(result.correct, 799);
  assert.equal(result.complete, 2);
  assert.equal(Math.round(result.accuracy), 80);
  assert.equal(result.passed, false);
  const star = scoreSession(11, [orders[0].final, orders[1].final, orders[2].final.slice(0, 449)], orders);
  assert.equal(star.correct, 849);
  assert.equal(Math.round(star.accuracy), 85);
  assert.equal(star.passed, true);
  assert.equal(star.stars, 1);
});

test('exact phase boundaries honor all 25 scripts and stop after three configured rounds', () => {
  for (const level of LEVELS) {
    const feedbackStart = (level.roundDuration - level.feedbackDuration) * 1000;
    for (let round = 0; round < 3; round += 1) {
      const offset = round * level.roundDuration * 1000;
      assert.deepEqual(phaseAt(level, offset), { phase: 'remember', remaining: level.remember, round });
      assert.equal(phaseAt(level, offset + level.remember * 1000 - 1).phase, 'remember');
      const changeEnd = level.remember + changeDuration(level);
      if (level.operations.length) {
        const current = phaseAt(level, offset + level.remember * 1000);
        assert.equal(current.phase, 'change');
        assert.equal(current.operationIndex, 0);
        assert.equal(current.remaining, changeDuration(level));
        assert.equal(phaseAt(level, offset + changeEnd * 1000 - 1).phase, 'change');
      }
      if (level.wait) {
        assert.equal(phaseAt(level, offset + changeEnd * 1000).phase, 'wait');
        assert.equal(phaseAt(level, offset + changeEnd * 1000).remaining, level.wait);
      }
      const serving = phaseAt(level, offset + (changeEnd + level.wait) * 1000);
      assert.equal(serving.phase, 'serve');
      assert.equal(serving.remaining, level.serve);
      assert.equal(phaseAt(level, offset + feedbackStart - 1).phase, 'serve');
      assert.deepEqual(phaseAt(level, offset + feedbackStart), { phase: 'feedback', remaining: level.feedbackDuration, round });
      assert.equal(phaseAt(level, offset + level.roundDuration * 1000 - 1).phase, 'feedback');
    }
    const duration = level.roundDuration * 3000;
    assert.deepEqual(phaseAt(level, duration), { phase: 'done', remaining: 0, round: 2 });
    assert.deepEqual(phaseAt(level.id, duration + 60000), { phase: 'done', remaining: 0, round: 2 });
    assert.equal(phaseAt(level.id, -1).phase, 'remember');
  }
});

test('phase, submission, and resume respect customized round, change, and feedback durations', () => {
  const level = { ...LEVELS[22], roundDuration: 32, remember: 8, changeDuration: 4, wait: 1, feedbackDuration: 3, serve: 12 };
  const orders = generateSession(level.id, 'custom-timing').orders;
  assert.equal(changeDuration(level), 8);
  assert.deepEqual(phaseAt(level, 8000), { phase: 'change', operationIndex: 0, remaining: 8, round: 0 });
  assert.deepEqual(phaseAt(level, 12000), { phase: 'change', operationIndex: 0, remaining: 4, round: 0 });
  assert.deepEqual(phaseAt(level, 16000), { phase: 'wait', remaining: 1, round: 0 });
  assert.deepEqual(phaseAt(level, 17000), { phase: 'serve', remaining: 12, round: 0 });
  assert.deepEqual(phaseAt(level, 29000), { phase: 'feedback', remaining: 3, round: 0 });
  assert.deepEqual(phaseAt(level, 32000), { phase: 'remember', remaining: 8, round: 1 });
  assert.equal(submissionTime(level, 50000, 1, 5, 5), 61000);
  assert.deepEqual(phaseAt(level, 61000), { phase: 'feedback', remaining: 3, round: 1 });
  const resumed = resumeCheckpoint(orders, [orders[0].final, orders[1].final, []], new Set([0, 1]), level);
  assert.equal(resumed.elapsedMs, 64000);
  assert.deepEqual(phaseAt(level, resumed.elapsedMs), { phase: 'remember', remaining: 8, round: 2 });
  assert.deepEqual(phaseAt(level, 96000), { phase: 'done', remaining: 0, round: 2 });
});

test('instructions describe current positions with Chinese dish names', () => {
  const name = () => '白切鸡';
  assert.equal(operationText({ type: 'replace', index: 2, dishId: '01' }, name), '第3道换成白切鸡。');
  assert.equal(operationText({ type: 'remove', index: 1 }, name), '取消第2道。');
  assert.equal(operationText({ type: 'insert', index: 3, dishId: '01' }, name), '加一道白切鸡，排在第4道。');
  assert.equal(operationText({ type: 'append', dishId: '01' }, name), '最后加一道白切鸡。');
  assert.throws(() => getPool(0));
  assert.throws(() => generateSession(26, 1));
});

test('inserting before the fourth dish shows five resulting positions with the new dish in fourth', () => {
  const operation = Object.freeze({
    type: 'insert', index: 3, dishId: '蒸蛋',
    before: Object.freeze(['A', 'B', 'C', 'D']),
    after: Object.freeze(['A', 'B', 'C', '蒸蛋', 'D']),
  });
  assert.deepEqual(operationSlots(operation), [
    { number: 1, originalNumber: 1, type: 'unchanged', dishId: null },
    { number: 2, originalNumber: 2, type: 'unchanged', dishId: null },
    { number: 3, originalNumber: 3, type: 'unchanged', dishId: null },
    { number: 4, originalNumber: null, type: 'added', dishId: '蒸蛋' },
    { number: 5, originalNumber: 4, type: 'unchanged', dishId: null },
  ]);
  assert.deepEqual(operation.before, ['A', 'B', 'C', 'D']);
  assert.deepEqual(operation.after, ['A', 'B', 'C', '蒸蛋', 'D']);
});

test('append and replacement reveal only the changed dish at its resulting position', () => {
  assert.deepEqual(operationSlots({ type: 'append', dishId: 'D', before: ['A', 'B', 'C'], after: ['A', 'B', 'C', 'D'] }), [
    { number: 1, originalNumber: 1, type: 'unchanged', dishId: null },
    { number: 2, originalNumber: 2, type: 'unchanged', dishId: null },
    { number: 3, originalNumber: 3, type: 'unchanged', dishId: null },
    { number: 4, originalNumber: null, type: 'added', dishId: 'D' },
  ]);
  assert.deepEqual(operationSlots({ type: 'replace', index: 1, dishId: 'D', before: ['A', 'B', 'C'], after: ['A', 'D', 'C'] }), [
    { number: 1, originalNumber: 1, type: 'unchanged', dishId: null },
    { number: 2, originalNumber: 2, type: 'replaced', dishId: 'D' },
    { number: 3, originalNumber: 3, type: 'unchanged', dishId: null },
  ]);
});

test('removal retains an unnumbered placeholder and renumbers every later dish', () => {
  assert.deepEqual(operationSlots({ type: 'remove', index: 1, before: ['A', 'B', 'C', 'D', 'E'], after: ['A', 'C', 'D', 'E'] }), [
    { number: 1, originalNumber: 1, type: 'unchanged', dishId: null },
    { number: null, originalNumber: 2, type: 'removed', dishId: null },
    { number: 2, originalNumber: 3, type: 'unchanged', dishId: null },
    { number: 3, originalNumber: 4, type: 'unchanged', dishId: null },
    { number: 4, originalNumber: 5, type: 'unchanged', dishId: null },
  ]);
});

test('level 23 combines cancellation and insertion while preserving original and final positions', () => {
  for (const order of generateSession(23, 'visible-change-positions').orders) {
    const original = structuredClone(order.operations);
    order.operations.forEach((operation) => {
      Object.freeze(operation.before);
      Object.freeze(operation.after);
      Object.freeze(operation);
    });
    Object.freeze(order.operations);
    const slots = changeSlots(order.operations);
    assert.deepEqual(slots, [
      { number: 1, originalNumber: 1, type: 'unchanged', dishId: null },
      { number: null, originalNumber: 2, type: 'removed', dishId: null },
      { number: 2, originalNumber: 3, type: 'unchanged', dishId: null },
      { number: 3, originalNumber: 4, type: 'unchanged', dishId: null },
      { number: 4, originalNumber: null, type: 'added', dishId: order.operations[1].dishId },
      { number: 5, originalNumber: 5, type: 'unchanged', dishId: null },
    ]);
    assert.deepEqual(order.operations, original);
  }
});

test('combined previews preserve single changes and reveal both level 24 replacements together', () => {
  assert.deepEqual(changeSlots([]), []);
  for (const level of LEVELS) {
    if (level.operations.length !== 1) continue;
    for (const { operations } of generateSession(level.id, 'single-change-compatibility').orders) {
      assert.deepEqual(changeSlots(operations), operationSlots(operations[0]));
    }
  }
  for (const { operations } of generateSession(24, 'both-replacements').orders) {
    const slots = changeSlots(operations);
    assert.deepEqual(slots.map((slot) => slot.number), [1, 2, 3, 4, 5]);
    assert.deepEqual(slots.map((slot) => slot.originalNumber), [1, 2, 3, 4, 5]);
    assert.deepEqual(slots.filter((slot) => slot.type === 'replaced').map((slot) => [slot.number, slot.dishId]), [[2, operations[0].dishId], [4, operations[1].dishId]]);
    assert.ok(slots.filter((slot) => slot.type === 'unchanged').every((slot) => slot.dishId === null));
  }
});

test('combined previews follow sequential edits without revealing discarded or remembered dishes', () => {
  const initial = ['A', 'B', 'C', 'D', 'E'];
  const edits = [
    { type: 'replace', index: 1, dishId: 'F' },
    { type: 'replace', index: 1, dishId: 'G' },
    { type: 'remove', index: 1 },
    { type: 'insert', index: 1, dishId: 'H' },
    { type: 'replace', index: 1, dishId: 'I' },
    { type: 'remove', index: 2 },
    { type: 'append', dishId: 'J' },
    { type: 'remove', index: 4 },
  ];
  let current = initial;
  const operations = edits.map((operation) => {
    const before = current;
    current = applyOperations(before, [operation]);
    return { ...operation, before, after: current };
  });
  assert.deepEqual(current, ['A', 'I', 'D', 'E']);
  assert.deepEqual(changeSlots(operations), [
    { number: 1, originalNumber: 1, type: 'unchanged', dishId: null },
    { number: null, originalNumber: 2, type: 'removed', dishId: null },
    { number: 2, originalNumber: null, type: 'added', dishId: 'I' },
    { number: null, originalNumber: 3, type: 'removed', dishId: null },
    { number: 3, originalNumber: 4, type: 'unchanged', dishId: null },
    { number: 4, originalNumber: 5, type: 'unchanged', dishId: null },
  ]);
  assert.deepEqual(initial, ['A', 'B', 'C', 'D', 'E']);
});

test('levels 23 and 24 keep every change on one continuous six-second phase', () => {
  for (const id of [23, 24]) {
    const level = LEVELS[id - 1];
    assert.equal(changeDuration(level), 6);
    for (let round = 0; round < 3; round += 1) {
      const offset = round * level.roundDuration * 1000;
      assert.deepEqual(phaseAt(level, offset + 7000), { phase: 'change', operationIndex: 0, remaining: 6, round });
      assert.deepEqual(phaseAt(level, offset + 10000), { phase: 'change', operationIndex: 0, remaining: 3, round });
      assert.equal(phaseAt(level, offset + 12999).operationIndex, 0);
      assert.deepEqual(phaseAt(level, offset + 13000), { phase: 'serve', remaining: 11, round });
    }
  }
});


test('early serving keeps full feedback and next-order exposure across all 25 levels', () => {
  for (const level of LEVELS) {
    const orders = generateSession(level.id, 42).orders;
    let skipped = 0;
    for (let round = 0; round < 3; round++) {
      const serveStart = (round * level.roundDuration + level.remember + level.operations.length * level.changeDuration + level.wait) * 1000;
      const elapsed = serveStart + 1000;
      const count = orders[round].final.length;
      assert.equal(submissionTime(level, serveStart - 1, round, count, count), null);
      assert.equal(submissionTime(level, elapsed, round, count - 1, count), null);
      assert.equal(submissionTime(level, elapsed, round - 1, count, count), null);
      const submitted = submissionTime(level, elapsed, round, count, count);
      skipped += submitted - elapsed;
      assert.deepEqual(phaseAt(level, submitted), {phase:'feedback',remaining:level.feedbackDuration,round});
      assert.equal(submissionTime(level, submitted, round, count, count), null);
      assert.equal(phaseAt(level, submitted + level.feedbackDuration * 1000 - 1).phase, 'feedback');
      const next = phaseAt(level, submitted + level.feedbackDuration * 1000);
      assert.equal(next.phase, round < 2 ? 'remember' : 'done');
      if(round < 2) {
        assert.equal(next.round, round + 1);
        assert.equal(next.remaining, level.remember);
      }
    }
    const duration = level.roundDuration * 3000;
    assert.ok(duration - skipped < duration, `level ${level.id} should finish earlier`);
    assert.equal(submissionTime(level.id, duration, 2, 3, 3), null);
  }
});

test('resume defaults to 20-second rounds and clears only unsubmitted answers', () => {
  const orders = generateSession(23, 'pause-checkpoint').orders;
  const originalOrders = structuredClone(orders);
  const answers = orders.map((order) => Object.freeze([...order.final]));
  Object.freeze(answers);
  for (let completed = 0; completed <= 3; completed += 1) {
    const recorded = new Set(Array.from({ length: completed }, (_, round) => round));
    const checkpoint = resumeCheckpoint(orders, answers, recorded);
    assert.equal(checkpoint.round, completed);
    assert.equal(checkpoint.elapsedMs, completed * 20000);
    assert.equal(checkpoint.done, completed === 3);
    assert.deepEqual(checkpoint.answers, answers.map((answer, round) => round < completed ? [...answer] : []));
    assert.notEqual(checkpoint.answers, answers);
    checkpoint.answers.forEach((answer, round) => assert.notEqual(answer, answers[round]));
    assert.deepEqual([...recorded], Array.from({ length: completed }, (_, round) => round));
  }
  const gap = resumeCheckpoint(orders, answers, new Set([0, 2]));
  assert.equal(gap.round, 1);
  assert.deepEqual(gap.answers, [answers[0], [], answers[2]]);
  assert.deepEqual(orders, originalOrders);
  assert.deepEqual(answers, orders.map((order) => order.final));
});

test('recorded mistakes, missing dishes, and empty timed-out answers stay final on resume', () => {
  const orders = generateSession(1, 'wrong-answer-checkpoint').orders;
  const wrong = [...orders[0].final].reverse();
  const answers = [wrong, [], [...orders[2].final]];
  const recorded = new Set([0, 1]);
  const checkpoint = resumeCheckpoint(orders, answers, recorded);
  assert.equal(checkpoint.round, 2);
  assert.deepEqual(checkpoint.answers, [wrong, [], []]);
  checkpoint.answers[0][0] = 'changed-after-checkpoint';
  assert.deepEqual(answers[0], [...orders[0].final].reverse());
  assert.deepEqual(answers[2], orders[2].final);

  const incomplete = orders[0].final.slice(0, 1);
  assert.deepEqual(resumeCheckpoint(orders, [incomplete], new Set([0])).answers, [incomplete, [], []]);
  assert.deepEqual(resumeCheckpoint(orders, [], new Set([0])).answers, [[], [], []]);
});

test('resuming any unfinished table restores the full phase durations across all 25 levels', () => {
  for (const level of LEVELS) {
    const orders = generateSession(level.id, 'pause-full-durations').orders;
    for (let completed = 0; completed < 3; completed += 1) {
      const checkpoint = resumeCheckpoint(orders, orders.map((order) => order.final), new Set(Array.from({ length: completed }, (_, round) => round)), level);
      const start = checkpoint.elapsedMs;
      assert.deepEqual(phaseAt(level, start), { phase: 'remember', remaining: level.remember, round: completed });
      let offset = level.remember * 1000;
      assert.equal(phaseAt(level, start + offset - 1).phase, 'remember');
      if (level.operations.length) {
        assert.deepEqual(phaseAt(level, start + offset), { phase: 'change', operationIndex: 0, remaining: changeDuration(level), round: completed });
        assert.equal(phaseAt(level, start + offset + changeDuration(level) * 1000 - 1).phase, 'change');
        offset += changeDuration(level) * 1000;
      }
      if (level.wait) {
        assert.deepEqual(phaseAt(level, start + offset), { phase: 'wait', remaining: level.wait, round: completed });
        assert.equal(phaseAt(level, start + offset + level.wait * 1000 - 1).phase, 'wait');
        offset += level.wait * 1000;
      }
      assert.deepEqual(phaseAt(level, start + offset), { phase: 'serve', remaining: level.serve, round: completed });
      const feedbackStart = (level.roundDuration - level.feedbackDuration) * 1000;
      assert.equal(phaseAt(level, start + feedbackStart - 1).phase, 'serve');
      assert.deepEqual(phaseAt(level, start + feedbackStart), { phase: 'feedback', remaining: level.feedbackDuration, round: completed });
      assert.equal(phaseAt(level, start + level.roundDuration * 1000 - 1).phase, 'feedback');
      assert.equal(phaseAt(level, start + level.roundDuration * 1000).phase, completed < 2 ? 'remember' : 'done');
    }
    const finished = resumeCheckpoint(orders, orders.map((order) => order.final), new Set([0, 1, 2]), level.id);
    assert.equal(finished.done, true);
    assert.equal(phaseAt(level, finished.elapsedMs).phase, 'done');
  }
});

test('multiple pause/resume cycles retain completed mistakes in the final session score', () => {
  const orders = generateSession(15, 'resumed-score').orders;
  const firstAnswer = orders[0].final.slice(0, 3);
  const recorded = new Set([0]);
  let checkpoint = resumeCheckpoint(orders, [firstAnswer, ['unfinished'], []], recorded, 15);
  assert.deepEqual(checkpoint.answers[0], firstAnswer);
  checkpoint.answers[1] = [...orders[1].final];
  recorded.add(1);
  checkpoint.answers[2] = ['another-unfinished'];
  checkpoint = resumeCheckpoint(orders, checkpoint.answers, recorded, 15);
  assert.deepEqual(checkpoint.answers, [firstAnswer, orders[1].final, []]);
  checkpoint.answers[2] = [...orders[2].final];
  recorded.add(2);
  const finished = resumeCheckpoint(orders, checkpoint.answers, recorded, 15);
  assert.equal(finished.done, true);
  const result = scoreSession(15, finished.answers, orders);
  assert.deepEqual(result, scoreSession(15, [firstAnswer, orders[1].final, orders[2].final], orders));
  assert.equal(result.correct, 13);
  assert.equal(result.complete, 2);
  assert.equal(result.score, 83);
  assert.equal(result.stars, 2);
  assert.deepEqual(result.details[0], { correct: 3, total: 5, perfect: false, firstWrong: 3 });
});
