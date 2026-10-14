// src/hermesClient.js — Hermes Agent 调用层（复用参考项目 asset_model_analysis 的文件传参模式）
// 零额外依赖：仅用 Node 内置模块。把 prompt 写入纯 ASCII 路径的 UTF-8 文件，
// 再用 venv 的 python 调 hermes_oneshot.py（run_oneshot），彻底绕开中文 argv 编码坑。
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const HERMES_CFG_PATH = path.join(ROOT, 'config', 'hermes.json');

function loadHermesCfg() {
  try { return JSON.parse(fs.readFileSync(HERMES_CFG_PATH, 'utf8')); }
  catch (e) { return {}; }
}
const HC = loadHermesCfg();

const HERMES_PATH = HC.hermesPath || (process.env.HERMES_PATH || 'hermes');
const HERMES_PYTHON = path.join(path.dirname(HERMES_PATH), 'python.exe');
const HERMES_WRAPPER = path.join(ROOT, 'scripts', 'hermes_oneshot.py');
const HERMES_HOME = process.env.USERPROFILE || os.homedir();
const HERMES_PROMPT_DIR = path.join(HERMES_HOME, 'AppData', 'Local', 'hermes', 'hermes_prompts');

if (!fs.existsSync(HERMES_PROMPT_DIR)) {
  try { fs.mkdirSync(HERMES_PROMPT_DIR, { recursive: true }); } catch (e) {}
}

// 强制注入正确的 Windows HOME（Git Bash 注入的 HOME 为 Unix 风格，Windows 版 Hermes/Python 据此无法定位 home）
function hermesEnv() {
  return Object.assign({}, process.env, {
    HOME: HERMES_HOME,
    USERPROFILE: HERMES_HOME,
    HOMEDRIVE: HERMES_HOME.slice(0, 2),
    HOMEPATH: HERMES_HOME.slice(2),
    PYTHONUTF8: '1',
    PYTHONIOENCODING: 'utf-8',
    HERMES_CONFIG: HC.hermesConfigPath || '',
    WIND_API_KEY: HC.windApiKey || ''
  });
}

// 并发信号量：避免连点/多用户并发无限 spawn 导致 FD 与内存耗尽
const MAX_CONCURRENT = 2;
let running = 0;
const waitQueue = [];
function acquire() {
  return new Promise(res => {
    if (running < MAX_CONCURRENT) { running++; res(); }
    else waitQueue.push(res);
  });
}
function release() {
  running--;
  if (waitQueue.length) { running++; waitQueue.shift()(); }
}

function callHermes(prompt, options = {}) {
  return new Promise((resolve) => {
    const timeout = options.timeout || HC.timeout || 540000;
    const promptFile = path.join(HERMES_PROMPT_DIR, `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.txt`);
    try { fs.writeFileSync(promptFile, prompt, 'utf8'); }
    catch (e) { resolve({ success: false, output: '', error: '写入 prompt 文件失败: ' + e.message, durationMs: 0 }); return; }

    acquire().then(() => {
      const started = Date.now();
      execFile(HERMES_PYTHON, [HERMES_WRAPPER, promptFile], {
        cwd: ROOT, timeout, maxBuffer: 32 * 1024 * 1024, windowsHide: true, env: hermesEnv()
      }, (err, stdout, stderr) => {
        release();
        try { fs.unlinkSync(promptFile); } catch (e) {}
        const output = (stdout || '').trim();
        if (err || !output) {
          const error = err ? (err.message + (stderr ? ' | ' + stderr.slice(0, 400) : '')) : 'Hermes 返回空内容';
          resolve({ success: false, output: '', error, durationMs: Date.now() - started });
        } else {
          resolve({ success: true, output, error: '', durationMs: Date.now() - started });
        }
      });
    });
  });
}

// 从 Hermes 文本回复中稳健提取 JSON（兼容 ```json 围栏 / 前后缀噪声）
function extractJSON(text) {
  if (!text) return null;
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  try { return JSON.parse(t); } catch (e) {}
  const a = t.indexOf('['), o = t.indexOf('{');
  const start = Math.min(a < 0 ? Infinity : a, o < 0 ? Infinity : o);
  if (start === Infinity) return null;
  const close = t[start] === '[' ? ']' : '}';
  const end = t.lastIndexOf(close);
  if (end <= start) return null;
  try { return JSON.parse(t.slice(start, end + 1)); } catch (e) { return null; }
}

async function callHermesJSON(prompt, options = {}) {
  const r = await callHermes(prompt, options);
  if (!r.success) return { success: false, error: r.error, output: r.output };
  const json = extractJSON(r.output);
  if (!json) return { success: false, error: 'Hermes 返回非 JSON', output: r.output };
  return { success: true, data: json, output: r.output };
}

module.exports = {
  callHermes, callHermesJSON, extractJSON,
  hermesConfig: HC, HERMES_PATH, HERMES_PYTHON, HERMES_WRAPPER, HERMES_PROMPT_DIR, hermesEnv
};
