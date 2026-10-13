// src/dataProvider.js — 数据提供方抽象层
// 设计目标：分析方法与数据来源解耦。默认 local（演示种子数据），可切换 akshare / wind。
// 零依赖，仅用 Node 内置模块。

const fs = require('fs');
const path = require('path');
const config = require('./config');

// ---------- 本地适配器（演示种子数据，清晰标注为示例） ----------
const localAdapter = {
  type: 'local',
  // 主题 → 标的列表（名称来自 themes.json）
  async getThemeTickers() {
    return (config.themes.themes || []).map(t => ({
      key: t.key, name: t.name, description: t.description, tickers: t.tickers || [],
    }));
  },
  async getStock(ticker) {
    const p = path.join(config.DATA_DIR, 'stocks', `${ticker}.json`);
    if (!fs.existsSync(p)) return null;
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
  },
  async getAllStocks() {
    const dir = path.join(config.DATA_DIR, 'stocks');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { return null; }
    }).filter(Boolean);
  },
  async getMacroSnapshot() {
    const p = path.join(config.DATA_DIR, 'macro', 'snapshot.json');
    if (!fs.existsSync(p)) return null;
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
  },
};

// ---------- akshare 适配器（需 pip install akshare，文档见复现指南） ----------
// 该适配器通过子进程调用 Python akshare 拉取实时数据；此处给出接口骨架与失败提示。
const akshareAdapter = {
  type: 'akshare',
  async getThemeTickers() { return localAdapter.getThemeTickers(); },
  async getStock(ticker) {
    throw new Error('akshare 适配器未启用：请按 docs/复现指南.md 配置 Python 环境并安装 akshare，或在 src/dataProvider.js 中实现 fetchAkshare()。当前仅 local 演示数据可用。');
  },
  async getMacroSnapshot() { return localAdapter.getMacroSnapshot(); },
};

// ---------- Wind 适配器（S 级数据源，需 Wind 终端/API 权限） ----------
const windAdapter = {
  type: 'wind',
  async getThemeTickers() { return localAdapter.getThemeTickers(); },
  async getStock(ticker) {
    throw new Error('Wind 适配器未启用：需配置 Wind API Key（config/wind.json，已 gitignore）。参考 docs/复现指南.md。当前仅 local 演示数据可用。');
  },
  async getMacroSnapshot() { return localAdapter.getMacroSnapshot(); },
};

const registry = { local: localAdapter, akshare: akshareAdapter, wind: windAdapter };

function getProvider(type = config.dataProvider) {
  return registry[type] || localAdapter;
}

module.exports = { getProvider, localAdapter, akshareAdapter, windAdapter };
