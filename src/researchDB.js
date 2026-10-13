// src/researchDB.js — 研究资料库：所有研究报告/结论按 类型_标的_时间戳 落盘，含索引便于检索。
// 落盘目录：knowledge-base/{macro,selection,deep}/
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { fileStamp, dateStamp, safeKey, isoStamp } = require('./utils');

const INDEX_FILE = path.join(config.KB_DIR, 'index.json');
const TYPE_DIR = { macro: config.MACRO_DIR, selection: config.SELECTION_DIR, deep: config.DEEP_DIR };

function readIndex() {
  try { if (fs.existsSync(INDEX_FILE)) return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8')); } catch (e) {}
  return { entries: [] };
}
function writeIndex(idx) {
  try { fs.writeFileSync(INDEX_FILE, JSON.stringify(idx, null, 2), 'utf8'); } catch (e) {}
}

// 保存一份研究报告。meta 可含任意结构化字段。
function saveReport({ type, ticker, title, markdown, meta = {} }) {
  if (!TYPE_DIR[type]) throw new Error('未知资料库类型: ' + type);
  const dir = TYPE_DIR[type];
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  const stamp = fileStamp();
  const tk = ticker ? safeKey(ticker) : 'macro';
  const fname = `${type}_${tk}_${stamp}.md`;
  const fpath = path.join(dir, fname);
  const header = [
    '---',
    `type: ${type}`,
    `ticker: ${ticker || 'macro'}`,
    `title: ${title}`,
    `timestamp: ${isoStamp()}`,
    `fileStamp: ${stamp}`,
    ...Object.entries(meta).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`),
    '---\n',
  ].join('\n');
  fs.writeFileSync(fpath, header + markdown, 'utf8');
  const idx = readIndex();
  const entry = {
    id: fname.replace('.md', ''),
    type, ticker: ticker || 'macro', title,
    file: fname, timestamp: isoStamp(), date: dateStamp(),
    summary: (markdown.split('\n').find(l => l.trim() && !l.startsWith('#') && !l.startsWith('---')) || '').slice(0, 120),
  };
  idx.entries.unshift(entry);
  if (idx.entries.length > 500) idx.entries = idx.entries.slice(0, 500);
  writeIndex(idx);
  return { file: fname, path: fpath, entry };
}

function listReports({ type, ticker, limit = 50 } = {}) {
  let entries = readIndex().entries;
  if (type) entries = entries.filter(e => e.type === type);
  if (ticker) entries = entries.filter(e => e.ticker === ticker);
  return entries.slice(0, limit);
}

function getReport(file) {
  const p = path.join(config.KB_DIR, file);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf8');
}

function stats() {
  const idx = readIndex();
  const byType = {};
  idx.entries.forEach(e => { byType[e.type] = (byType[e.type] || 0) + 1; });
  return { total: idx.entries.length, byType };
}

module.exports = { saveReport, listReports, getReport, stats, INDEX_FILE };
