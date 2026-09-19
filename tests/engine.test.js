import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, getPool, seededRandom, shuffle, applyOperations, generateSession, operationText, scoreSession, phaseAt, submissionTime } from '../src/engine.js';

test('25 script configurations preserve length, time budgets, tutorials, and thresholds', () => {
  const serveTimes = [13, 14, 13, 13.5, 13.5, 10.5, 11, 11, 10, 11, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 10.5, 9.5, 8, 9.5, 12.5, 10, 8, 8, 8.5];
  const finalLengths = [3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 5, 5, 5, 4, 6, 5, 5, 5, 6, 6, 6, 6, 6];
  assert.equal(LEVELS.length, 25);
  for (const level of LEVELS) {
    assert.equal(level.remember + 2.5 * level.operations.length + level.wait + level.serve + 2, 20);
    assert.equal(level.serve, serveTimes[level.id - 1]);
    assert.equal(level.threshold, level.id <= 10 ? 0.75 : 0.8);
    assert.equal(generateSession(level.id, 'length').orders[0].final.length, finalLengths[level.id - 1]);
    if (level.id % 5 === 0) assert.ok(level.operations.length <= 1);
  }
  assert.deepEqual(LEVELS.filter((level) => level.tutorial).map((level) => level.id), [1, 6, 11, 13, 14, 19, 23, 24]);
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

test('exact phase boundaries honor all 25 scripts and stop at 60 seconds', () => {
  for (const level of LEVELS) {
    for (let round = 0; round < 3; round += 1) {
      const offset = round * 20000;
      assert.deepEqual(phaseAt(level, offset), { phase: 'remember', remaining: level.remember, round });
      assert.equal(phaseAt(level, offset + level.remember * 1000 - 1).phase, 'remember');
      let changeStart = level.remember;
      for (let operationIndex = 0; operationIndex < level.operations.length; operationIndex += 1) {
        const current = phaseAt(level, offset + changeStart * 1000);
        assert.equal(current.phase, 'change');
        assert.equal(current.operationIndex, operationIndex);
        assert.equal(current.remaining, 2.5);
        changeStart += 2.5;
      }
      if (level.wait) {
        assert.equal(phaseAt(level, offset + changeStart * 1000).phase, 'wait');
        assert.equal(phaseAt(level, offset + changeStart * 1000).remaining, level.wait);
      }
      const serving = phaseAt(level, offset + (changeStart + level.wait) * 1000);
      assert.equal(serving.phase, 'serve');
      assert.equal(serving.remaining, level.serve);
      assert.equal(phaseAt(level, offset + 17999).phase, 'serve');
      assert.deepEqual(phaseAt(level, offset + 18000), { phase: 'feedback', remaining: 2, round });
      assert.equal(phaseAt(level, offset + 19999).phase, 'feedback');
    }
    assert.deepEqual(phaseAt(level, 60000), { phase: 'done', remaining: 0, round: 2 });
    assert.equal(phaseAt(level.id, -1).phase, 'remember');
  }
});

test('instructions describe current positions with Chinese dish names', () => {
  const name = () => '白切鸡';
  assert.equal(operationText({ type: 'replace', index: 2, dishId: '01' }, name), '第3道换成白切鸡。');
  assert.equal(operationText({ type: 'remove', index: 1 }, name), '取消第2道。');
  assert.equal(operationText({ type: 'insert', index: 3, dishId: '01' }, name), '在当前第4道前加一道白切鸡。');
  assert.equal(operationText({ type: 'append', dishId: '01' }, name), '最后加一道白切鸡。');
  assert.throws(() => getPool(0));
  assert.throws(() => generateSession(26, 1));
});


test('early serving keeps full feedback and next-order exposure across all 25 levels', () => {
  for (const level of LEVELS) {
    const orders = generateSession(level.id, 42).orders;
    let skipped = 0;
    for (let round = 0; round < 3; round++) {
      const serveStart = (round * 20 + level.remember + level.operations.length * 2.5 + level.wait) * 1000;
      const elapsed = serveStart + 1000;
      const count = orders[round].final.length;
      assert.equal(submissionTime(level, serveStart - 1, round, count, count), null);
      assert.equal(submissionTime(level, elapsed, round, count - 1, count), null);
      assert.equal(submissionTime(level, elapsed, round - 1, count, count), null);
      const submitted = submissionTime(level, elapsed, round, count, count);
      skipped += submitted - elapsed;
      assert.deepEqual(phaseAt(level, submitted), {phase:'feedback',remaining:2,round});
      assert.equal(submissionTime(level, submitted, round, count, count), null);
      assert.equal(phaseAt(level, submitted + 1999).phase, 'feedback');
      const next = phaseAt(level, submitted + 2000);
      assert.equal(next.phase, round < 2 ? 'remember' : 'done');
      if(round < 2) {
        assert.equal(next.round, round + 1);
        assert.equal(next.remaining, level.remember);
      }
    }
    assert.ok(60000 - skipped < 60000, `level ${level.id} should finish earlier`);
    assert.equal(submissionTime(level, 60000, 2, 3, 3), null);
  }
});
