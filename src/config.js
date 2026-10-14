// src/config.js — 路径与配置集中加载
// 零依赖：仅使用 Node 内置模块
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_DIR = path.join(ROOT, 'config');
const DATA_DIR = path.join(ROOT, 'data');
const KB_DIR = path.join(ROOT, 'knowledge-base'); // 研究资料库根

function loadJson(name, fallback) {
  const p = path.join(CONFIG_DIR, name);
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.warn('[config] 读取 %s 失败: %s', name, e.message);
  }
  return fallback;
}

const config = {
  ROOT,
  CONFIG_DIR,
  DATA_DIR,
  KB_DIR,
  MACRO_DIR: path.join(KB_DIR, 'macro'),
  SELECTION_DIR: path.join(KB_DIR, 'selection'),
  DEEP_DIR: path.join(KB_DIR, 'deep'),
  // 业务配置
  themes: loadJson('themes.json', { themes: [] }),
  sources: loadJson('sources.json', { sources: [] }),
  framework: loadJson('research-framework.json', {}),
  macroModel: loadJson('macro-indicators.json', {}),
  // 数据提供方类型：local | akshare | wind（默认 local，演示数据）
  dataProvider: process.env.AM_DATAPROVIDER || 'auto',
  port: parseInt(process.env.PORT || '3300', 10),
};

// 确保资料库目录存在
[config.MACRO_DIR, config.SELECTION_DIR, config.DEEP_DIR].forEach(d => {
  try { fs.mkdirSync(d, { recursive: true }); } catch (e) {}
});

module.exports = config;
