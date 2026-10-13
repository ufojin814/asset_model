// scripts/seed_demo_data.js — 生成演示种子数据（清晰标注为 DEMO，非实时行情）
// 用途：让平台开箱即跑；真实数据经 src/dataProvider.js 的 akshare/wind 适配器接入。
// 运行：node scripts/seed_demo_data.js
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const STOCK_DIR = path.join(ROOT, 'data', 'stocks');
const MACRO_DIR = path.join(ROOT, 'data', 'macro');
fs.mkdirSync(STOCK_DIR, { recursive: true });
fs.mkdirSync(MACRO_DIR, { recursive: true });

const NOTE = '演示种子数据（DEMO），非实时行情；真实数据经 src/dataProvider.js 接入 Wind/akshare。';

// 主题归类在 config/themes.json；此处按 ticker 指定主题
const S = [
  // ---------- 光通信 ----------
  { ticker:'300308.SZ', name:'中际旭创', theme:'光通信', industry:'光模块',
    f:{ roa:0.14, cfo:0.16, roaDelta:0.03, cfoMinusRoa:0.02, levDelta:-0.02, curRatioDelta:0.1, sharesDelta:0, gmDelta:0.02, atDelta:0.25, wc:120, re:260, ebit:62, mvEquity:1400, sales:240, ta:420, tl:160, equity:260, pe:38, pb:11, ps:14, pePct:0.82, pbPct:0.85, roe:0.42, roic:0.33, revGrowth:1.15, profitGrowth:1.6, businessNote:'全球800G光模块龙头，AI算力核心受益', capacityNote:'产能持续扩产，订单饱满', govNote:'治理规范，机构重仓', institutionNote:'公募基金+北向高配', riskNote:'估值处历史高位，客户集中' },
    t:{ price:142, ma20:130, ma60:115, ma250:88, rsi14:68, macdHist:1.8, ret12m:0.95, ret1m:0.12, vol20d:0.42, beta:1.5 },
    news:[ {title:'中际旭创斩获北美云厂800G大单',content:'公司中标某北美云厂商800G光模块订单，产能利用率维持高位',pubDate:'2026-09-20',source:'证券时报',authorityWeight:85}, {title:'光模块行业需求超预期上行',content:'AI训练集群扩张驱动1.6T迭代加速，板块景气度高',pubDate:'2026-09-25',source:'上海证券报',authorityWeight:80} ] },

  { ticker:'300502.SZ', name:'新易盛', theme:'光通信', industry:'光模块',
    f:{ roa:0.12, cfo:0.13, roaDelta:0.02, cfoMinusRoa:0.01, levDelta:-0.01, curRatioDelta:0.05, sharesDelta:0, gmDelta:0.01, atDelta:0.2, wc:70, re:120, ebit:30, mvEquity:700, sales:110, ta:200, tl:70, equity:130, pe:32, pb:9, ps:18, pePct:0.7, pbPct:0.72, roe:0.38, roic:0.3, revGrowth:0.9, profitGrowth:1.2, businessNote:'高速光模块核心供应商', capacityNote:'扩产节奏跟进', govNote:'治理良好', institutionNote:'机构持仓上升', riskNote:'客户集中，估值偏高' },
    t:{ price:96, ma20:90, ma60:80, ma250:62, rsi14:64, macdHist:1.2, ret12m:0.7, ret1m:0.08, vol20d:0.4, beta:1.4 },
    news:[ {title:'新易盛800G出货放量',content:'公司800G产品出货量逐季提升，毛利率改善',pubDate:'2026-09-22',source:'财联社',authorityWeight:75} ] },

  { ticker:'300394.SZ', name:'天孚通信', theme:'光通信', industry:'光器件',
    f:{ roa:0.16, cfo:0.18, roaDelta:0.04, cfoMinusRoa:0.02, levDelta:-0.03, curRatioDelta:0.12, sharesDelta:0, gmDelta:0.03, atDelta:0.22, wc:60, re:90, ebit:24, mvEquity:480, sales:60, ta:140, tl:40, equity:100, pe:45, pb:14, ps:36, pePct:0.78, pbPct:0.8, roe:0.46, roic:0.36, revGrowth:0.8, profitGrowth:0.95, businessNote:'光器件平台型龙头', capacityNote:'无源/有源器件双轮', govNote:'毛利率行业领先', institutionNote:'机构稳定持有', riskNote:'估值高位' },
    t:{ price:118, ma20:110, ma60:96, ma250:70, rsi14:62, macdHist:1.0, ret12m:0.6, ret1m:0.06, vol20d:0.38, beta:1.3 },
    news:[ {title:'天孚通信受益1.6T光引擎',content:'公司光引擎产品切入海外供应链',pubDate:'2026-09-18',source:'上证报',authorityWeight:80} ] },

  { ticker:'002281.SZ', name:'光迅科技', theme:'光通信', industry:'光芯片/器件',
    f:{ roa:0.07, cfo:0.08, roaDelta:0.01, cfoMinusRoa:0.01, levDelta:0.01, curRatioDelta:0.02, sharesDelta:0, gmDelta:0, atDelta:0.08, wc:50, re:80, ebit:18, mvEquity:320, sales:90, ta:200, tl:90, equity:110, pe:42, pb:3.6, ps:13, pePct:0.6, pbPct:0.5, roe:0.16, roic:0.13, revGrowth:0.2, profitGrowth:0.3, businessNote:'国产光芯片自主可控', capacityNote:'芯片自给率提升', govNote:'央企背景', institutionNote:'配置型持仓', riskNote:'增速平缓，盈利质量一般' },
    t:{ price:38, ma20:36, ma60:34, ma250:30, rsi14:55, macdHist:0.3, ret12m:0.25, ret1m:0.03, vol20d:0.33, beta:1.1 },
    news:[ {title:'光迅科技25G/100G光芯片量产',content:'国产替代进展顺利',pubDate:'2026-08-30',source:'证券时报',authorityWeight:85} ] },

  // ---------- 芯片/半导体 ----------
  { ticker:'688981.SH', name:'中芯国际', theme:'芯片/半导体', industry:'晶圆代工',
    f:{ roa:0.04, cfo:0.09, roaDelta:0.01, cfoMinusRoa:0.05, levDelta:0.02, curRatioDelta:-0.02, sharesDelta:0, gmDelta:-0.01, atDelta:0.15, wc:300, re:600, ebit:80, mvEquity:3500, sales:600, ta:2500, tl:900, equity:1600, pe:80, pb:2.4, ps:10, pePct:0.55, pbPct:0.35, roe:0.06, roic:0.05, revGrowth:0.25, profitGrowth:0.1, businessNote:'国内最大晶圆代工', capacityNote:'先进制程扩产', govNote:'国之重器，战略地位高', institutionNote:'长线资金持有', riskNote:'先进制程受制裁约束，盈利波动' },
    t:{ price:62, ma20:60, ma60:58, ma250:50, rsi14:52, macdHist:0.4, ret12m:0.2, ret1m:0.02, vol20d:0.35, beta:1.2 },
    news:[ {title:'中芯国际28nm产能利用率回升',content:'成熟制程需求回暖',pubDate:'2026-09-10',source:'财联社',authorityWeight:75}, {title:'半导体国产化政策加码',content:'大基金三期持续投入',pubDate:'2026-09-15',source:'上证报',authorityWeight:80} ] },

  { ticker:'002371.SZ', name:'北方华创', theme:'芯片/半导体', industry:'半导体设备',
    f:{ roa:0.1, cfo:0.08, roaDelta:0.03, cfoMinusRoa:-0.02, levDelta:0.01, curRatioDelta:0.03, sharesDelta:0, gmDelta:0.02, atDelta:0.3, wc:200, re:300, ebit:70, mvEquity:1800, sales:280, ta:700, tl:350, equity:350, pe:42, pb:9, ps:18, pePct:0.6, pbPct:0.7, roe:0.32, roic:0.25, revGrowth:0.4, profitGrowth:0.5, businessNote:'半导体设备平台龙头', capacityNote:'订单饱满', govNote:'国产替代核心', institutionNote:'机构重仓', riskNote:'估值不低' },
    t:{ price:380, ma20:360, ma60:330, ma250:280, rsi14:60, macdHist:2, ret12m:0.35, ret1m:0.05, vol20d:0.36, beta:1.3 },
    news:[ {title:'北方华创获大客户重复订单',content:'刻蚀/薄膜设备份额提升',pubDate:'2026-09-12',source:'证券时报',authorityWeight:85} ] },

  { ticker:'603501.SH', name:'韦尔股份', theme:'芯片/半导体', industry:'CIS/设计',
    f:{ roa:0.11, cfo:0.13, roaDelta:0.04, cfoMinusRoa:0.02, levDelta:-0.02, curRatioDelta:0.05, sharesDelta:0, gmDelta:0.03, atDelta:0.18, wc:150, re:200, ebit:55, mvEquity:1400, sales:260, ta:500, tl:180, equity:320, pe:48, pb:7, ps:14, pePct:0.65, pbPct:0.6, roe:0.34, roic:0.28, revGrowth:0.3, profitGrowth:0.6, businessNote:'CIS图像传感器龙头', capacityNote:'车载/安防放量', govNote:'治理良好', institutionNote:'机构持有', riskNote:'消费电子周期波动' },
    t:{ price:130, ma20:122, ma60:110, ma250:95, rsi14:58, macdHist:1.2, ret12m:0.4, ret1m:0.04, vol20d:0.37, beta:1.25 },
    news:[ {title:'韦尔股份车载CIS出货高增',content:'智能驾驶拉动需求',pubDate:'2026-09-08',source:'上海证券报',authorityWeight:80} ] },

  { ticker:'688041.SH', name:'海光信息', theme:'芯片/半导体', industry:'CPU/DCU',
    f:{ roa:0.09, cfo:0.07, roaDelta:0.02, cfoMinusRoa:-0.02, levDelta:0, curRatioDelta:0.02, sharesDelta:0, gmDelta:0.01, atDelta:0.2, wc:180, re:220, ebit:45, mvEquity:2200, sales:200, ta:600, tl:200, equity:400, pe:90, pb:12, ps:22, pePct:0.7, pbPct:0.75, roe:0.3, roic:0.22, revGrowth:0.45, profitGrowth:0.5, businessNote:'国产CPU/DCU核心', capacityNote:'信创+AI算力', govNote:'国产算力底座', institutionNote:'机构重仓', riskNote:'估值高，生态替代风险' },
    t:{ price:150, ma20:142, ma60:130, ma250:105, rsi14:59, macdHist:1.4, ret12m:0.45, ret1m:0.05, vol20d:0.39, beta:1.35 },
    news:[ {title:'海光DCU适配国产大模型',content:'算力自主可控进展',pubDate:'2026-09-05',source:'财联社',authorityWeight:75} ] },

  // ---------- 商业航天 ----------
  { ticker:'600118.SH', name:'中国卫星', theme:'商业航天', industry:'卫星制造',
    f:{ roa:0.03, cfo:0.02, roaDelta:0.01, cfoMinusRoa:-0.01, levDelta:0.01, curRatioDelta:0, sharesDelta:0, gmDelta:0, atDelta:0.05, wc:40, re:90, ebit:12, mvEquity:400, sales:90, ta:300, tl:140, equity:160, pe:110, pb:4.5, ps:16, pePct:0.8, pbPct:0.55, roe:0.07, roic:0.05, revGrowth:0.15, profitGrowth:0.1, businessNote:'小卫星研制龙头（航天五院）', capacityNote:'星座建设驱动', govNote:'央企，战略地位高', institutionNote:'主题配置', riskNote:'估值极高，业绩释放慢' },
    t:{ price:32, ma20:30, ma60:29, ma250:26, rsi14:56, macdHist:0.4, ret12m:0.18, ret1m:0.03, vol20d:0.4, beta:1.4 },
    news:[ {title:'千帆星座组网加速',content:'低轨卫星互联网进入密集发射期',pubDate:'2026-09-01',source:'上证报',authorityWeight:80}, {title:'商业航天写入中长期规划',content:'政策支持明确',pubDate:'2026-09-03',source:'人民日报',authorityWeight:95} ] },

  { ticker:'600879.SH', name:'航天电子', theme:'商业航天', industry:'航天电子',
    f:{ roa:0.04, cfo:0.03, roaDelta:0.01, cfoMinusRoa:-0.01, levDelta:0.01, curRatioDelta:0.01, sharesDelta:0, gmDelta:0, atDelta:0.06, wc:60, re:110, ebit:18, mvEquity:380, sales:200, ta:500, tl:250, equity:250, pe:55, pb:2.6, ps:3.5, pePct:0.5, pbPct:0.35, roe:0.1, roic:0.08, revGrowth:0.12, profitGrowth:0.1, businessNote:'航天电子配套核心', capacityNote:'火箭/卫星配套', govNote:'央企', institutionNote:'配置型', riskNote:'盈利弹性有限' },
    t:{ price:11, ma20:10.5, ma60:10, ma250:9, rsi14:53, macdHist:0.1, ret12m:0.12, ret1m:0.02, vol20d:0.36, beta:1.2 },
    news:[ {title:'航天电子配套新一代运载火箭',content:'批产任务充足',pubDate:'2026-08-28',source:'证券时报',authorityWeight:85} ] },

  { ticker:'603131.SH', name:'上海沪工', theme:'商业航天', industry:'焊接/航天部件',
    f:{ roa:0.05, cfo:0.04, roaDelta:0.02, cfoMinusRoa:-0.01, levDelta:0, curRatioDelta:0.02, sharesDelta:0.02, gmDelta:0.01, atDelta:0.1, wc:20, re:30, ebit:6, mvEquity:90, sales:40, ta:120, tl:60, equity:60, pe:60, pb:3, ps:7, pePct:0.55, pbPct:0.45, roe:0.12, roic:0.1, revGrowth:0.1, profitGrowth:0.15, businessNote:'焊接设备+卫星部件', capacityNote:'卫星制造布局', govNote:'民营', institutionNote:'主题博弈', riskNote:'主业承压，航天贡献小' },
    t:{ price:24, ma20:22, ma60:21, ma250:19, rsi14:57, macdHist:0.5, ret12m:0.22, ret1m:0.04, vol20d:0.45, beta:1.5 },
    news:[ {title:'上海沪工卫星业务落地',content:'商业航天主题催化',pubDate:'2026-09-02',source:'同花顺',authorityWeight:55} ] },

  { ticker:'002025.SZ', name:'航天电器', theme:'商业航天', industry:'连接器',
    f:{ roa:0.08, cfo:0.07, roaDelta:0.02, cfoMinusRoa:-0.01, levDelta:0, curRatioDelta:0.02, sharesDelta:0, gmDelta:0.01, atDelta:0.12, wc:50, re:80, ebit:20, mvEquity:400, sales:120, ta:280, tl:120, equity:160, pe:48, pb:5, ps:12, pePct:0.5, pbPct:0.5, roe:0.2, roic:0.16, revGrowth:0.18, profitGrowth:0.2, businessNote:'高端连接器核心供', capacityNote:'航天/弹载配套', govNote:'航天科工体系', institutionNote:'机构持有', riskNote:'军品订单节奏波动' },
    t:{ price:62, ma20:58, ma60:54, ma250:50, rsi14:55, macdHist:0.8, ret12m:0.2, ret1m:0.03, vol20d:0.37, beta:1.25 },
    news:[ {title:'航天电器弹载连接器放量',content:'装备现代化拉动',pubDate:'2026-08-25',source:'上证报',authorityWeight:80} ] },

  // ---------- 黄金/贵金属 ----------
  { ticker:'600547.SH', name:'山东黄金', theme:'黄金/贵金属', industry:'金矿',
    f:{ roa:0.09, cfo:0.11, roaDelta:0.03, cfoMinusRoa:0.02, levDelta:-0.02, curRatioDelta:0.03, sharesDelta:0.01, gmDelta:0.02, atDelta:0.1, wc:80, re:300, ebit:90, mvEquity:1500, sales:700, ta:900, tl:400, equity:500, pe:28, pb:4.2, ps:3.6, pePct:0.55, pbPct:0.5, roe:0.22, roic:0.18, revGrowth:0.25, profitGrowth:0.4, businessNote:'国内金矿龙头，资源量丰富', capacityNote:'矿产金产量提升', govNote:'国企', institutionNote:'避险配置', riskNote:'金价波动' },
    t:{ price:38, ma20:36, ma60:34, ma250:30, rsi14:58, macdHist:0.6, ret12m:0.3, ret1m:0.04, vol20d:0.3, beta:0.9 },
    news:[ {title:'金价突破历史新高',content:'实际利率下行+避险需求推动',pubDate:'2026-09-20',source:'路透',authorityWeight:75}, {title:'央行持续购金',content:'全球央行增持黄金储备',pubDate:'2026-09-22',source:'新华财经',authorityWeight:85} ] },

  { ticker:'601899.SH', name:'紫金矿业', theme:'黄金/贵金属', industry:'铜金矿',
    f:{ roa:0.12, cfo:0.14, roaDelta:0.03, cfoMinusRoa:0.02, levDelta:0.01, curRatioDelta:0.01, sharesDelta:0.01, gmDelta:0.02, atDelta:0.15, wc:200, re:600, ebit:300, mvEquity:3800, sales:3000, ta:2500, tl:1200, equity:1300, pe:18, pb:3.4, ps:1.8, pePct:0.4, pbPct:0.45, roe:0.28, roic:0.22, revGrowth:0.18, profitGrowth:0.3, businessNote:'全球矿业龙头，铜金双轮', capacityNote:'资源整合+扩产', govNote:'民企龙头', institutionNote:'机构重仓', riskNote:'海外运营/资源国风险' },
    t:{ price:22, ma20:21, ma60:20, ma250:17, rsi14:60, macdHist:0.4, ret12m:0.35, ret1m:0.03, vol20d:0.32, beta:1.0 },
    news:[ {title:'紫金矿业铜金产量双增',content:'战略资源自给率提升',pubDate:'2026-09-15',source:'证券时报',authorityWeight:85} ] },

  { ticker:'600988.SH', name:'赤峰黄金', theme:'黄金/贵金属', industry:'金矿',
    f:{ roa:0.1, cfo:0.09, roaDelta:0.02, cfoMinusRoa:-0.01, levDelta:-0.01, curRatioDelta:0.02, sharesDelta:0.03, gmDelta:0.01, atDelta:0.12, wc:40, re:90, ebit:40, mvEquity:600, sales:250, ta:400, tl:200, equity:200, pe:32, pb:5, ps:4, pePct:0.6, pbPct:0.55, roe:0.24, roic:0.18, revGrowth:0.2, profitGrowth:0.35, businessNote:'黄金弹性标的', capacityNote:'海外矿山放量', govNote:'民企', institutionNote:'主题配置', riskNote:'产量兑现/汇率风险' },
    t:{ price:28, ma20:26, ma60:24, ma250:21, rsi14:59, macdHist:0.7, ret12m:0.33, ret1m:0.05, vol20d:0.4, beta:1.1 },
    news:[ {title:'赤峰黄金海外矿山产量释放',content:'金价高位增厚利润',pubDate:'2026-09-18',source:'财联社',authorityWeight:75} ] },

  // ---------- 银行 ----------
  { ticker:'600036.SH', name:'招商银行', theme:'银行', industry:'股份行',
    f:{ roa:0.013, cfo:0.02, roaDelta:0.001, cfoMinusRoa:0.007, levDelta:0.005, curRatioDelta:0.01, sharesDelta:0, gmDelta:0, atDelta:0.06, wc:0, re:4000, ebit:1800, mvEquity:9500, sales:3500, ta:110000, tl:100000, equity:9500, pe:7.2, pb:1.0, ps:2.4, pePct:0.25, pbPct:0.2, roe:0.145, roic:0.13, revGrowth:0.05, profitGrowth:0.06, businessNote:'零售银行标杆，资产质量优', capacityNote:'—', govNote:'治理领先', institutionNote:'机构+北向核心仓', riskNote:'息差下行，地产风险敞口' },
    t:{ price:42, ma20:41, ma60:40, ma250:36, rsi14:54, macdHist:0.3, ret12m:0.15, ret1m:0.02, vol20d:0.22, beta:0.7 },
    news:[ {title:'招行中收企稳回升',content:'财富管理手续费边际改善',pubDate:'2026-08-30',source:'证券时报',authorityWeight:85}, {title:'招行拨备覆盖率维持高位',content:'资产质量稳健',pubDate:'2026-09-01',source:'上证报',authorityWeight:80} ] },

  { ticker:'002142.SZ', name:'宁波银行', theme:'银行', industry:'城商行',
    f:{ roa:0.012, cfo:0.018, roaDelta:0.001, cfoMinusRoa:0.006, levDelta:0.003, curRatioDelta:0.01, sharesDelta:0, gmDelta:0, atDelta:0.08, wc:0, re:900, ebit:300, mvEquity:1800, sales:600, ta:28000, tl:25500, equity:2500, pe:6.5, pb:0.95, ps:2.6, pePct:0.2, pbPct:0.15, roe:0.15, roic:0.14, revGrowth:0.08, profitGrowth:0.1, businessNote:'城商行标杆，风控扎实', capacityNote:'—', govNote:'治理优秀', institutionNote:'机构持有', riskNote:'区域经济波动' },
    t:{ price:28, ma20:27, ma60:26, ma250:24, rsi14:52, macdHist:0.2, ret12m:0.12, ret1m:0.02, vol20d:0.24, beta:0.75 },
    news:[ {title:'宁波银行不良率低位',content:'区域 antigen 优质客户基础',pubDate:'2026-08-28',source:'财联社',authorityWeight:75} ] },

  { ticker:'601838.SH', name:'成都银行', theme:'银行', industry:'城商行',
    f:{ roa:0.013, cfo:0.019, roaDelta:0.001, cfoMinusRoa:0.006, levDelta:0.002, curRatioDelta:0.01, sharesDelta:0, gmDelta:0, atDelta:0.09, wc:0, re:500, ebit:180, mvEquity:800, sales:250, ta:12000, tl:11000, equity:1100, pe:5.8, pb:0.85, ps:2.2, pePct:0.18, pbPct:0.12, roe:0.17, roic:0.15, revGrowth:0.1, profitGrowth:0.12, businessNote:'成渝经济圈城商行，高成长', capacityNote:'—', govNote:'区域龙头', institutionNote:'机构增持', riskNote:'城投敞口' },
    t:{ price:18, ma20:17.5, ma60:16.8, ma250:15, rsi14:53, macdHist:0.15, ret12m:0.2, ret1m:0.03, vol20d:0.26, beta:0.8 },
    news:[ {title:'成都银行受益于成渝双城',content:'区域信贷需求旺盛',pubDate:'2026-09-05',source:'上证报',authorityWeight:80} ] },

  { ticker:'601166.SH', name:'兴业银行', theme:'银行', industry:'股份行',
    f:{ roa:0.009, cfo:0.015, roaDelta:0, cfoMinusRoa:0.006, levDelta:0.004, curRatioDelta:0.01, sharesDelta:0, gmDelta:0, atDelta:0.05, wc:0, re:3500, ebit:1400, mvEquity:5200, sales:2200, ta:105000, tl:96000, equity:9000, pe:5.5, pb:0.6, ps:1.8, pePct:0.15, pbPct:0.1, roe:0.105, roic:0.1, revGrowth:0.03, profitGrowth:0.04, businessNote:'同业+绿色金融特色', capacityNote:'—', govNote:'治理稳健', institutionNote:'配置型', riskNote:'地产/城投敞口偏大' },
    t:{ price:20, ma20:19.5, ma60:19, ma250:17.5, rsi14:51, macdHist:0.1, ret12m:0.08, ret1m:0.01, vol20d:0.23, beta:0.65 },
    news:[ {title:'兴业银行绿色信贷提速',content:'转型金融布局',pubDate:'2026-08-26',source:'证券时报',authorityWeight:85} ] },
];

S.forEach(s => {
  const obj = { ticker:s.ticker, name:s.name, theme:s.theme, industry:s.industry, _demo:true, _note:NOTE, fundamentals:s.f, technicals:s.t, news:s.news };
  fs.writeFileSync(path.join(STOCK_DIR, s.ticker + '.json'), JSON.stringify(obj, null, 2), 'utf8');
});

const snapshot = {
  _demo:true, _note:NOTE,
  pmi:50.2, gdpYoY:4.8, m2YoY:7.0, socialFinancingYoY:8.5, policyRate:1.5, reserveRatio:7.0,
  cpiYoY:0.3, ppiYoY:-1.5, y10:2.1, y2:1.6, earningsYield:0.045, valuationPercentile:0.55,
  creditSpread:280, geoIndex:55, techIndex:62, rePolicyEasing:60, rePriceYoY:-3.0
};
fs.writeFileSync(path.join(MACRO_DIR, 'snapshot.json'), JSON.stringify(snapshot, null, 2), 'utf8');

console.log(`已生成 ${S.length} 只标的演示数据 + 宏观快照（均标注 DEMO）。运行 node server.js 即可使用。`);
