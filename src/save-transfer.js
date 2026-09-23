import { sanitizeProgress, persistProgress } from './storage.js';

export const MAX_SAVE_BYTES = 100 * 1024;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const invalid = () => new Error('存档中的进度不正确，原有进度未修改。');

// Only earned progress travels between browsers; preferences and active orders stay local.
export function exportProgressText(progress) {
  const clean = sanitizeProgress(progress);
  return JSON.stringify({ game: 'shanhai-restaurant', version: 1, exportedAt: new Date().toISOString(),
    progress: { levels: clean.levels, tutorials: clean.tutorials, decorations: clean.decorations, placements: clean.placements } }, null, 2);
}

export function parseProgressText(text) {
  if (new TextEncoder().encode(text).length > MAX_SAVE_BYTES) throw new Error('文件过大，请选择山海食谱铺导出的存档。');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('文件无法读取，请选择导出的 JSON 存档。'); }
  if (!object(data) || data.game !== 'shanhai-restaurant' || data.version !== 1 || !object(data.progress)) {
    throw new Error('这不是支持的山海食谱铺存档。');
  }
  const p = data.progress;
  if (!object(p.levels) || Object.keys(p.levels).length > 25) throw invalid();
  for (const [id, record] of Object.entries(p.levels)) {
    if (!/^(?:[1-9]|1\d|2[0-5])$/.test(id) || !object(record)
      || !integer(record.stars, 0, 3) || !integer(record.score, 0, 100)
      || !Number.isFinite(record.accuracy) || record.accuracy < 0 || record.accuracy > 100
      || typeof record.passed !== 'boolean' || record.passed !== (record.stars > 0)) throw invalid();
  }
  if (!Array.isArray(p.tutorials) || p.tutorials.length > 25 || !p.tutorials.every(id => integer(id, 1, 25))
    || !Array.isArray(p.decorations) || p.decorations.length > 5
    || !p.decorations.every(id => integer(id, 1, 5) && p.levels[id * 5]?.passed)
    || !object(p.placements)) throw invalid();
  const placed = [];
  for (const spot of ['left', 'center', 'right']) {
    const id = p.placements[spot];
    if (id !== null && (!p.decorations.includes(id) || placed.includes(id))) throw invalid();
    if (id !== null) placed.push(id);
  }
  return sanitizeProgress({ ...p, version: 1 });
}

export function mergeProgress(current, imported) {
  const merged = sanitizeProgress(current);
  for (const [id, record] of Object.entries(imported.levels)) {
    const old = merged.levels[id];
    merged.levels[id] = old ? { stars: Math.max(old.stars, record.stars), score: Math.max(old.score, record.score),
      accuracy: Math.max(old.accuracy, record.accuracy), passed: old.passed || record.passed } : { ...record };
  }
  merged.tutorials = [...new Set([...merged.tutorials, ...imported.tutorials])];
  merged.decorations = [...new Set([...merged.decorations, ...imported.decorations])];
  for (const spot of ['left', 'center', 'right']) {
    const id = imported.placements[spot];
    if (!merged.placements[spot] && id && !Object.values(merged.placements).includes(id)) merged.placements[spot] = id;
  }
  return sanitizeProgress(merged);
}

export function importProgressText(text, current, storage) {
  const merged = mergeProgress(current, parseProgressText(text));
  if (!persistProgress(merged, storage)) throw new Error('浏览器未能保存存档，原有进度未修改。请检查存储权限后重试。');
  return merged;
}
