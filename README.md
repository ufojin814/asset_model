# Asset Model · 资产配置与股票配置研究平台

基于 Node.js（**零依赖、原生 HTTP**）的资产配置研究平台，参考 `asset_model_analysis` 的项目框架与数据源设计，面向**大类资产配置**与**股票配置研究**两大场景。

> ⚠️ 本项目仅供研究使用，所有结论须以可核验数据支撑，严禁虚构、严禁对外/对客展示。

## 四大能力

| 板块 | 入口 | 产出 |
|------|------|------|
| ① 宏观研判 | `GET /api/macro` | 股/债/房地产/黄金在**短期(≤3月)/中期(3月-1年)/长期(1年+)** 的看涨/震荡/看跌概率（学术支撑的信号聚合） |
| ② 主题选股 | `GET /api/select?theme=` | 指定主题→筛选标的→基本面/技术面/消息面三维评分→统一加权→每主题 Top3（雷达图+结论+复制清单） |
| ③ 深度研究 | `GET /api/deep?ticker=` | 严格遵循 **Serenity 投资研究框架（白毛股神 serenity × Loop Engineering 对抗式迭代）** 的详尽个股报告 |
| ④ 研究资料库 | `GET /api/kb` | 所有报告按 `类型_标的_时间戳` 落盘，可回溯检索 |

## 快速开始

```bash
# 1) 生成演示种子数据（清晰标注 DEMO，非实时）
node scripts/seed_demo_data.js

# 2) 启动服务（默认端口 3300）
node server.js
# 浏览器访问 http://localhost:3300

# 3) 冒烟测试
node tests/smoke.js
```

无需 `npm install`（零运行时依赖）。

## 项目结构

```
asset_model/
├── server.js                 # 原生 HTTP 服务：API 路由 + 静态托管
├── src/
│   ├── config.js             # 路径与配置加载
│   ├── utils.js              # 统计工具（z-score/分位/正态CDF）
│   ├── dataProvider.js       # 数据提供方抽象：local / akshare / wind
│   ├── macroAnalyzer.js      # 宏观研判：多因子信号→概率
│   ├── stockSelector.js      # 选股：三维评分+统一加权
│   ├── sentiment.js          # 消息面：Loughran-McDonald 金融情感词典
│   ├── deepResearch.js       # 深度研究：Serenity 九角色框架
│   └── researchDB.js         # 研究资料库（时间戳+标的戳）
├── config/                  # themes / sources / research-framework / macro-indicators
├── data/                    # stocks/*.json（演示种子）+ macro/snapshot.json
├── public/                  # 前端（index.html / css / js，含 Canvas 雷达图）
├── knowledge-base/          # 研究资料库落盘（macro/selection/deep）
├── scripts/                 # seed_demo_data.js 等
├── tests/                   # smoke.js
└── docs/                    # 复现指南 / 沟通日志 / 方法论与学术支撑
```

## 数据源

默认 `local`（演示种子数据）。真实数据通过 `src/dataProvider.js` 接入：
- **Wind**（S 级，参考项目同款）：配置 `config/wind.json`（已 gitignore）；
- **akshare**（B/C 级）：Python 开源数据，文档见 `docs/复现指南.md`；
- 所有因子/评分方法均为确定性、可复现实现，切换数据源不影响研究框架。

详细学术出处见 [`docs/方法论与学术支撑.md`](./docs/方法论与学术支撑.md)；完整复现步骤见 [`docs/复现指南.md`](./docs/复现指南.md)。
