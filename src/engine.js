/** Pure rules for 山海食谱铺. Times are seconds; menu positions are zero-based. */
const replace = (index, symbol) => ({ type: 'replace', index, symbol });
const remove = (index) => ({ type: 'remove', index });
const insert = (index, symbol) => ({ type: 'insert', index, symbol });
const append = (symbol) => ({ type: 'append', symbol });

const LEVEL_ROWS = [
  ['第一桌客人', 3, 5, 0, []],
  ['早茶记单', 3, 4, 0, []],
  ['多上一道', 4, 5, 0, []],
  ['记住四道菜', 4, 4.5, 0, []],
  ['章节验收·粤菜', 4, 4.5, 0, []],
  ['最后一道换菜', 4, 5, 0, [replace(3, 4)]],
  ['第一道换菜', 4, 4.5, 0, [replace(0, 4)]],
  ['换掉第二道', 4, 4.5, 0, [replace(1, 4)]],
  ['换单后稍等', 4, 4.5, 1, [replace(2, 4)]],
  ['章节验收·川菜', 4, 4.5, 0, [replace(2, 4)]],
  ['少上一道', 4, 6, 0, [remove(3)]],
  ['中间取消一道', 4, 6, 0, [remove(1)]],
  ['最后加一道', 4, 6, 0, [append(4)]],
  ['加菜排在前面', 4, 6, 0, [insert(1, 4)]],
  ['章节验收·鲁菜', 5, 6.5, 0, [replace(2, 5)]],
  ['五道变四道', 5, 6.5, 0, [remove(2)]],
  ['四道变五道', 4, 6.5, 0, [insert(3, 4)]],
  ['改完稍等片刻', 5, 6.5, 0.5, [replace(1, 5)]],
  ['中间换一道', 5, 6.5, 0, [replace(2, 5)]],
  ['章节验收·苏菜', 5, 6.5, 0.5, [replace(2, 5)]],
  ['五道菜上桌', 5, 7, 0, []],
  ['五道中的新菜', 5, 7, 0, [replace(3, 5)]],
  ['先取消再加菜', 5, 7, 0, [remove(1), insert(3, 5)]],
  ['两处各换一道', 5, 7, 0, [replace(1, 5), replace(3, 6)]],
  ['章节验收·浙菜', 5, 7, 0.5, [replace(2, 5)]],
];

export const LEVELS = Object.freeze(LEVEL_ROWS.map(([title, length, remember, wait, operations], index) => {
  const roundDuration = index < 10 ? 20 : index < 20 ? 24 : 26;
  const changeDuration = index < 10 ? 2.5 : 3;
  const feedbackDuration = 2;
  return Object.freeze({
    id: index + 1,
    chapter: Math.floor(index / 5) + 1,
    title,
    length,
    remember,
    wait,
    operations: Object.freeze(operations.map(Object.freeze)),
    roundDuration,
    changeDuration,
    feedbackDuration,
    serve: roundDuration - remember - operations.length * changeDuration - wait - feedbackDuration,
    threshold: index < 10 ? 0.75 : 0.8,
    tutorial: [1, 6, 11, 13, 14, 19, 23, 24].includes(index + 1),
  });
}));

function findLevel(levelId) {
  const level = LEVELS.find((item) => item.id === Number(levelId));
  if (!level) throw new RangeError(`Unknown level: ${levelId}`);
  return level;
}

export function getPool(chapter) {
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > 5) throw new RangeError('Chapter must be 1–5.');
  return [...Array.from({ length: 5 }, (_, index) => String((chapter - 1) * 5 + index + 1).padStart(2, '0')), '26', '27', '28', '29'];
}

/** FNV-1a seed hashing followed by Mulberry32; reproducible on browser and Node. */
export function seededRandom(seed) {
  let state = 2166136261;
  for (const character of String(seed)) {
    state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0;
  }
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(items, rng = Math.random) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(rng() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

function applyOperation(menu, operation) {
  const { type, index, dishId } = operation;
  if (!['replace', 'remove', 'insert', 'append'].includes(type)) throw new TypeError(`Unknown operation: ${type}`);
  if (type !== 'append' && (!Number.isInteger(index) || index < 0 || index >= menu.length)) {
    throw new RangeError('Operation position must refer to the current menu.');
  }
  if (type !== 'remove' && (dishId == null || menu.includes(dishId))) {
    throw new Error('A new dish must be supplied and cannot already be in the current menu.');
  }
  const next = [...menu];
  if (type === 'replace') next[index] = dishId;
  if (type === 'remove') next.splice(index, 1);
  if (type === 'insert') next.splice(index, 0, dishId);
  if (type === 'append') next.push(dishId);
  return next;
}

export function applyOperations(initial, operations) {
  if (new Set(initial).size !== initial.length) throw new Error('Initial menus cannot contain duplicate dishes.');
  return operations.reduce(applyOperation, [...initial]);
}

function validShelf(shelf, answer) {
  const positions = answer.map((id) => shelf.indexOf(id));
  const inAnswerOrder = positions.every((position, index) => index === 0 || positions[index - 1] < position);
  const sameRow = positions.every((position) => Math.floor(position / 3) === Math.floor(positions[0] / 3));
  const sameColumn = positions.every((position) => position % 3 === positions[0] % 3);
  return !inAnswerOrder && !sameRow && !sameColumn;
}

/** The full generated session (including its seed) can be stored for review. */
export function generateSession(levelId, seed = Date.now()) {
  const level = findLevel(levelId);
  const pool = getPool(level.chapter);
  const localDishes = new Set(pool.slice(0, 5));
  const rng = seededRandom(seed);
  const orders = [];
  const seen = new Set();
  let attempts = 0;
  while (orders.length < 3) {
    if (++attempts > 10000) throw new Error('Could not generate three valid orders.');
    const mapping = shuffle(pool, rng);
    const initial = mapping.slice(0, level.length);
    let current = [...initial];
    const operations = level.operations.map((configuration) => {
      const operation = { type: configuration.type };
      if (configuration.index !== undefined) operation.index = configuration.index;
      if (configuration.symbol !== undefined) operation.dishId = mapping[configuration.symbol];
      const before = current;
      current = applyOperation(current, operation);
      return { ...operation, before: [...before], after: [...current] };
    });
    const final = current;
    const signature = JSON.stringify([initial, final]);
    const hasLocalDishes = (menu) => menu.filter((id) => localDishes.has(id)).length >= 2;
    if (!hasLocalDishes(initial) || !hasLocalDishes(final) || seen.has(signature)) continue;
    let shelf = shuffle(pool, rng);
    let shelfAttempts = 0;
    while (!validShelf(shelf, final)) {
      if (++shelfAttempts > 10000) throw new Error('Could not generate a valid shelf.');
      shelf = shuffle(pool, rng);
    }
    seen.add(signature);
    orders.push({ initial, final: [...final], operations, shelf });
  }
  return { levelId: level.id, seed, orders };
}

export function operationText(operation, getName = (id) => id) {
  const position = operation.index + 1;
  switch (operation.type) {
    case 'replace': return `第${position}道换成${getName(operation.dishId)}。`;
    case 'remove': return `取消第${position}道。`;
    case 'insert': return `加一道${getName(operation.dishId)}，排在第${position}道。`;
    case 'append': return `最后加一道${getName(operation.dishId)}。`;
    default: throw new TypeError(`Unknown operation: ${operation.type}`);
  }
}

/** Show the changed position and resulting numbering without revealing remembered dishes. */
export function operationSlots(operation) {
  const { type, index, dishId, before, after } = operation;
  if (type === 'remove') {
    return before.map((id, position) => ({
      number: position === index ? null : after.indexOf(id) + 1,
      originalNumber: position + 1,
      type: position === index ? 'removed' : 'unchanged',
      dishId: null,
    }));
  }
  if (!['insert', 'append', 'replace'].includes(type)) throw new TypeError(`Unknown operation: ${type}`);
  const changedIndex = type === 'append' ? after.length - 1 : index;
  return after.map((id, position) => {
    const changed = position === changedIndex;
    const added = changed && type !== 'replace';
    return {
      number: position + 1,
      originalNumber: added ? null : changed ? index + 1 : before.indexOf(id) + 1,
      type: changed ? added ? 'added' : 'replaced' : 'unchanged',
      dishId: changed ? dishId : null,
    };
  });
}

/** Keep every change visible together, using the final order's numbering. */
export function changeSlots(operations) {
  if (!operations.length) return [];
  if (operations.length === 1) return operationSlots(operations[0]);
  const slots = operations[0].before.map((_, index) => ({
    originalNumber: index + 1,
    type: 'unchanged',
    dishId: null,
  }));
  for (const operation of operations) {
    const { type, index, dishId } = operation;
    if (!['remove', 'insert', 'append', 'replace'].includes(type)) throw new TypeError(`Unknown operation: ${type}`);
    const current = slots.filter((slot) => slot.type !== 'removed');
    const target = current[index];
    if (type === 'append') {
      slots.push({ originalNumber: null, type: 'added', dishId });
    } else if (type === 'insert') {
      slots.splice(slots.indexOf(target), 0, { originalNumber: null, type: 'added', dishId });
    } else if (type === 'replace') {
      target.type = target.originalNumber === null ? 'added' : 'replaced';
      target.dishId = dishId;
    } else if (target.originalNumber === null) {
      slots.splice(slots.indexOf(target), 1);
    } else {
      target.type = 'removed';
      target.dishId = null;
    }
  }
  let number = 0;
  return slots.map((slot) => ({ number: slot.type === 'removed' ? null : ++number, ...slot }));
}

/** Report every incorrect or missing dish position without changing either menu. */
export function wrongPositions(expected, answer = []) {
  return expected.flatMap((dishId, index) => answer[index] === dishId ? [] : [index]);
}

/** Uses unrounded ratios for passage/stars; only the theme score is rounded. */
export function scoreSession(levelId, answers, orders) {
  const level = findLevel(levelId);
  if (orders.length !== 3 || orders.some((order) => !order.final.length)) throw new Error('A scored session requires three nonempty orders.');
  const details = orders.map((order, round) => {
    const answer = answers[round] ?? [];
    const total = order.final.length;
    const correct = order.final.filter((id, index) => answer[index] === id).length;
    const perfect = correct === total && answer.length === total;
    let firstWrong = order.final.findIndex((id, index) => answer[index] !== id);
    if (firstWrong === -1 && answer.length > total) firstWrong = total;
    return { correct, total, perfect, firstWrong };
  });
  const correct = details.reduce((sum, detail) => sum + detail.correct, 0);
  const total = details.reduce((sum, detail) => sum + detail.total, 0);
  const complete = details.filter((detail) => detail.perfect).length;
  const ratio = correct / total;
  const accuracy = ratio * 100;
  const passed = ratio >= level.threshold && complete >= 2;
  const score = Math.round(0.8 * accuracy + 0.2 * complete / 3 * 100);
  const stars = !passed ? 0 : complete === 3 ? 3 : ratio >= 0.85 ? 2 : 1;
  return { accuracy, complete, score, stars, passed, correct, total, details };
}

/** Restart the first unfinished order while keeping every submitted answer final. */
export function resumeCheckpoint(orders, answers, recorded, levelOrId = 1) {
  const level = typeof levelOrId === 'object' ? levelOrId : findLevel(levelOrId);
  const unfinished = orders.findIndex((_, round) => !recorded.has(round));
  const done = unfinished === -1;
  const round = done ? orders.length : unfinished;
  return {
    round,
    elapsedMs: round * level.roundDuration * 1000,
    answers: orders.map((_, index) => recorded.has(index) ? [...(answers[index] ?? [])] : []),
    done,
  };
}

/** All changes share the combined time previously allocated to individual instructions. */
export function changeDuration(level) {
  return level.changeDuration * level.operations.length;
}

/** Absolute elapsed time prevents background timer drift from changing exposure. */
export function phaseAt(levelOrId, elapsedMs) {
  const level = typeof levelOrId === 'object' ? levelOrId : findLevel(levelOrId);
  const elapsed = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0) / 1000;
  if (elapsed >= level.roundDuration * 3) return { phase: 'done', remaining: 0, round: 2 };
  const round = Math.floor(elapsed / level.roundDuration);
  const time = elapsed - round * level.roundDuration;
  let boundary = level.remember;
  if (time < boundary) return { phase: 'remember', remaining: boundary - time, round };
  boundary += changeDuration(level);
  if (time < boundary) return { phase: 'change', operationIndex: 0, remaining: boundary - time, round };
  boundary += level.wait;
  if (time < boundary) return { phase: 'wait', remaining: boundary - time, round };
  const feedbackStart = level.roundDuration - level.feedbackDuration;
  if (time < feedbackStart) return { phase: 'serve', remaining: feedbackStart - time, round };
  return { phase: 'feedback', remaining: level.roundDuration - time, round };
}

/** Skip only unused serving time. Feedback and the next order keep their full durations. */
export function submissionTime(levelOrId, elapsedMs, expectedRound, selectedCount, requiredCount) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || requiredCount <= 0 || selectedCount !== requiredCount) return null;
  const level = typeof levelOrId === 'object' ? levelOrId : findLevel(levelOrId);
  const phase = phaseAt(level, elapsedMs);
  if (phase.phase !== 'serve' || phase.round !== expectedRound) return null;
  return ((phase.round + 1) * level.roundDuration - level.feedbackDuration) * 1000;
}
