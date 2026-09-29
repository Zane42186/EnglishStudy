# 前后端第一次联调报告

- 日期：2026-09-29
- 范围：Frontend → Backend API → Database 完整数据链路
- 结论：**链路打通，达标**。至少一个完整页面（看板首页 `review/index.html`）已实现「数据库真实数据 → API 返回 → 前端渲染」。
- 数据库口径说明：本次链路图中的「SQLite」按项目已确认方案实际为 **MySQL 8.0.27**（库名 `english_platform`），下文以 MySQL 为准。

---

## 一、链路图（本次实测路径）

```
浏览器 / jsdom
  │  GET http://localhost:4000/api/lessons?size=1        （跨域，Origin: http://localhost:5500）
  ▼
Express  (backend/src/app.js → routes → controllers → services → repositories)
  ▼
MySQL english_platform.lessons
  ▼
{ "code":200, "message":"success", "data":{ "list":[...], "total":6 } }
  ▼
review/index.html 渲染：#statLessons=6 / 6 张 .card.lesson / "共 6 课"
```

参与方与端口：

| 角色 | 地址 | 状态 |
|---|---|---|
| 前端静态服务 | http://localhost:5500 （`python -m http.server`，根目录 `review/`） | 运行中 |
| 后端 API | http://localhost:4000 （Node/Express） | 运行中 |
| 数据库 | MySQL 8.0.27 `english_platform` | 运行中 |

---

## 二、前端侧报告

### 2.1 API 调用

| 页面 | API Base URL | 请求库 | 实际请求 |
|---|---|---|---|
| `review/index.html`（看板首页） | `http://localhost:4000/api` | 原生 `fetch`（无 Axios） | `/lessons?size=1`、`/lessons?size=100`、`/progress`、`/vocabulary/stats`、`/mistakes/stats` |
| `words.html` / `wrong.html` / `reading.html` / `readIndex.html` / `lessons/lesson-*.html` | — | — | 尚未接入，仍为静态页（本次不影响达标） |

前端统一封装：`apiGet(path)` → `fetch(API_BASE + path)` → `res.json()` → 校验 `body.code === 200`，否则 `throw new Error(body.message)`；成功返回 `body.data`。

### 2.2 页面结果（实测渲染值）

| 检查项 | 期望来源 | 实测显示 |
|---|---|---|
| 已上课数 | `/lessons` → `data.total` | **6** |
| 当前级别 | `/progress` → `data.currentLevel` | **Level 2** |
| 累计生词 | `/vocabulary/stats` → `data.total` | **51** |
| 未过关错词 | `/mistakes/stats` → `data.pending` | **15** |
| 阅读篇数 | 后端暂无接口 | **—**（占位，不报错） |
| 课程卡片 | `/lessons` → `data.list[]` | **6 张**，首张「第 6 课 · 2026-09-29」 |
| 课程计数 | 前端本地计算 | **共 6 课** |
| 详情跳转 | `data.list[].lessonNo` | `lessons/lesson-6.html` |

### 2.3 四态检查（用户要求：Loading / Error / Empty）

| 状态 | 实现方式 | 实测 |
|---|---|---|
| **Loading** | 首屏 HTML 占位 `<p class="state loading">正在加载课程…</p>` + `@keyframes spin` 转圈 | ✅ 通过 |
| **Error** | `#apiError` 条 + `#apiErrorMsg` + `.api-error button#apiRetry` 重试 | ✅ 触发后显示「加载失败：课程列表：Failed to fetch（请确认后端服务是否在运行）」，重试按钮存在 |
| **Empty** | `renderLessons` 中 `list.length === 0` → 「暂无课程记录」 | ✅ 通过 |
| **正常** | 真值回填，无残留占位 | ✅ 通过 |

### 2.4 前端问题

| # | 问题 | 级别 | 说明 |
|---|---|---|---|
| F1 | **`review/index.html` 会被重建覆盖** | 🔴 高 | 该文件是 `build_board.py` 第 854 行的生成产物（`"review/index.html": build_board(...)`）。下次执行 Skill 重建看板，本次 API 改造**会被静态模板整体覆盖**，联调成果归零。前端改造必须同步落到 `build_board.py` 的对应模板函数里，或让该页移出生成集。 |
| F2 | `/lessons?size=100` 与后端上限**恰好相等** | 🟡 中 | 后端 `size` max=100，前端的 100 正好卡在上限。当前 6 课无影响；**一旦课程超过 100 课，页面会静默少显示**。建议改为分页拉取或后端提供全量接口。 |
| F3 | 阅读篇数显示「—」 | 🟢 低 | 后端暂无阅读接口（缺口 R1），前端已用占位 + title 提示，处理得当。 |
| F4 | 仅首页接入，其余页面未接 | 🟢 低 | 本次达标线是「至少一个完整页面」，其余页面留待下一轮。 |

---

## 三、后端侧报告

### 3.1 API

本次链路使用到的 5 个接口，全部实测可用（详见 `backend/docs/05-api-reference.md`）：

| Method | URL | 用途 | 实测 |
|---|---|---|---|
| GET | `/api/lessons?size=1` | 取课程总数 | ✅ total=6 |
| GET | `/api/lessons?size=100` | 取课程列表 | ✅ 6 条 |
| GET | `/api/progress` | 当前级别 / 下一课号 | ✅ Level 2 / nextLessonNo=7 |
| GET | `/api/vocabulary/stats` | 累计生词 | ✅ total=51 |
| GET | `/api/mistakes/stats` | 未过关错词 | ✅ pending=15 |

### 3.2 参数

- 分页 `page` / `size`：`size` 上限 100，越界返回 `400 参数校验失败`，`size=abc` 返回 `必须是整数` —— 实测通过，边界行为明确。
- 前端使用的 5 个路径均无需 path 参数，无编码/转义风险。

### 3.3 数据库查询

| 表 | 实测行数 | 说明 |
|---|---|---|
| students | 1 | 默认学员 Zane |
| lessons | 6 | 第 1—6 课 |
| lesson_sections | 12 | 课程小节 |
| vocabulary | 51 | 按 `word` 去重 |
| lesson_vocabulary | 52 | 课程×词汇关联（去重导致 51 词对应 52 关联） |
| mistakes | 20 | 错词（含跨课归并 1 条） |
| study_records | 18 | 上课/批改/反馈记录 |
| progress | 1 | 学习进度快照 |

### 3.4 Response / Error / CORS

- **Response 包络**：成功 `{code:200, message:"success", data}`；失败 `{code:4xx, message, data}`，与前端解析逻辑一致。
- **Error**：404（资源不存在）、400（参数校验）均返回统一包络，前端统一走 `Error(message)` 展示。
- **CORS**：`app.use(cors({ origin: true, credentials: false }))`。实测携带 `Origin: http://localhost:5500` 时返回
  `Access-Control-Allow-Origin: http://localhost:5500` + `Vary: Origin` —— 跨域放行正常，无需预检（简单请求）。

### 3.5 后端问题

| # | 问题 | 级别 | 说明 |
|---|---|---|---|
| B1 | CORS `origin: true` 反射任意来源 | 🟡 中 | 开发期可用；上线前应收敛为白名单。 |
| B2 | 无阅读相关接口 | 🟡 中 | 导致 F3；阅读表未建，属第二阶段。 |
| B3 | 无 `size` 与前端约定的联动约束 | 🟢 低 | 与 F2 同源，建议后续提供全量/游标接口。 |
| B4 | 服务为手工后台启动 | 🟢 低 | 无进程守护，重启机器即失效；建议后续补 `pm2`/计划任务或文档化启动步骤。 |

---

## 四、接口一致性核对（联调核心）

| 检查点 | 前端发出 | 后端定义 | 一致 |
|---|---|---|---|
| Base URL | `http://localhost:4000/api` | `/api` 前缀 | ✅ |
| Method | 全 GET | 全 GET | ✅ |
| `/lessons` 列表字段 | `data.list[].lessonNo / lessonDate / summary / grammarPoint / vocabCount / exerciseCount` | 同名同义 | ✅ |
| `/lessons` 分页字段 | `data.total` | `total / page / size` | ✅ |
| `/progress` 字段 | `data.currentLevel` | `currentLevel` | ✅ |
| `/vocabulary/stats` 字段 | `data.total` | `total` | ✅ |
| `/mistakes/stats` 字段 | `data.pending` | `pending` | ✅ |
| 成功判定 | `body.code === 200` | `code: 200` | ✅ |
| 失败展示 | `body.message` | `message` 为中文可读文案 | ✅ |

**结论：无接口不一致项，无需为联调改动任何一方代码。**

---

## 五、测试结果

执行：`node backend/scripts/integration-check.js`（jsdom 加载真实页面 → 真跑页面脚本 → 真实请求后端 API → 读渲染后 DOM）

```
[A] 正常链路（真实 API + 真实数据库）
  ✅ 页面脚本执行完成          ✅ 控制台无 JS 错误
  ✅ 已上课数 = 6              ✅ 当前级别 = Level 2
  ✅ 累计生词 = 51             ✅ 未过关错词 = 15
  ✅ 课程卡片 = 6 张           ✅ 计数文案 = "共 6 课"
  ✅ 首卡 = 第 6 课 · 2026-09-29   ✅ 详情链接 = lessons/lesson-6.html
  ✅ 请求集合与后端接口一致（5/5）
  ✅ Loading 态已实现
[B] 空数据态 → ✅「暂无课程记录」
[C] 错误态   → ✅ 提示条显示 + 重试按钮存在

结果：16 通过 / 0 失败
```

后端回归：`npm run test:api` 27/27 通过；`GET /api/health` 返回 `database:"up"`。

---

## 六、达标判定

| 完成标准 | 判定 |
|---|---|
| 从数据库读取真实数据 | ✅ MySQL `english_platform` 实查行数一致 |
| 通过 API 返回 | ✅ 5 个接口返回统一包络，CORS 放行 |
| 前端显示 | ✅ 看板首页 DOM 落真值，四态齐全 |

**达标。** 唯一需要立即处理的是 **F1（生成脚本会覆盖 index.html）**，它决定这次成果能否存活。

---

## 七、下一步建议

1. **优先**：前端侧把 API 改造下沉到 `build_board.py` 模板（或调整生成范围），否则 F1 随时让本次联调归零。
2. 后端第二阶段：补写接口（`POST /courses`、`/mistakes/:id/review`、`/progress/feedback`）、`GET /agent/snapshot`、阅读表与迁移脚本（M2）。
3. 收敛 CORS 白名单；为后端补进程守护或启动脚本。
4. 由 Git 工程师提交本次变更（新增 `backend/scripts/integration-check.js` 与本报告）。

---

## 八、第二轮复验（2026-09-29 14:5x）· 真机浏览器 + 直连数据库

> 第一轮用 jsdom 验证（逻辑层，16 项通过）。本轮换用**真实浏览器内核**复验，目的是覆盖 jsdom 无法发现的渲染与样式问题。**结果：发现并修复 1 个真实前端 bug。**

### 8.1 验证方式（同时更正「本机无法做浏览器验证」的旧结论）

| 方式 | 结果 |
|---|---|
| Edge CLI 无头（`--dump-dom` / `--screenshot`） | ❌ 仍不可用（Windows GUI 进程不回传 stdout，截图静默失败） |
| **`playwright-core` + `channel:'msedge'`** | ✅ **可用**（复用本机已装 Edge，无需下载 Chromium） |
| `agent-browser` | 已装入受管工作区（`C:\Users\lenovo\.workbuddy\binaries\node\workspace`，未污染全局 npm） |

运行模板（依赖已装在受管工作区，须带 `NODE_PATH`）：
```bash
NODE_PATH="C:\Users\lenovo\.workbuddy\binaries\node\workspace\node_modules" \
  node.exe 脚本.js    # chromium.launch({ channel: 'msedge', headless: true })
```

### 8.2 实测证据链

```
file:///E:/English/review/index.html
  │  浏览器实际发出 5 个请求（抓包确认）：
  │  /lessons?size=1 → /progress → /vocabulary/stats → /mistakes/stats → /lessons?size=100
  ▼
Express(:4000) → MySQL english_platform（直连核对 5/5 一致）
  ▼
页面实测渲染：6 / Level 2 / 51 / — / 15，6 张课程卡，首卡「第 6 课 · 2026-09-29」，meta「生词 10 个 ｜ 作业 9 项」
```

- 直连 MySQL 核对（只读）：lessons=6、vocabulary=51、pending mistakes=15、progress=Level 2/第 6 课、第 6 课摘要与计数——**与 API 返回逐项一致**。
- 浏览器端 13 项断言全部通过（含搜索 `was` 命中过滤、无匹配时出现空状态提示）。
- 错误路径复测：400（非法枚举，`data[{field,message}]`）、400（`page=abc`）、404（资源）、`OPTIONS` 预检 204。
- 截图：`.workbuddy/tmp/dashboard-e2e.png`。

### 8.3 发现并修复的问题

| # | 问题 | 级别 | 处理 |
|---|---|---|---|
| **F5** | **错误横幅在无错误时仍然显示**：`.hide{display:none}` 与 `.api-error{display:flex}` 同为单类选择器（优先级相同），后者在样式表中靠后 → `display:flex` 胜出，`hide` 失效 | 🔴 高（首屏常驻错误提示，误导用户） | 已修复：追加 `.api-error.hide{display:none}`（优先级 0,2,0） |
| F6 | 单元式测试用 `classList` 断言「已隐藏」，无法发现上述 CSS 优先级问题 | 🟡 中（测试方法缺陷） | 断言改为 `getComputedStyle(...).display === 'none'` |

> **结论：只看 class 的断言不足以验证可见性；样式类问题必须真机渲染 + 计算样式断言。** 修复后复验 13/13 通过，截图确认横幅消失。

### 8.4 联调结论（第二轮）

| 完成标准 | 判定 |
|---|---|
| 从数据库读取真实数据 | ✅ 直连 MySQL 核对 5/5 一致 |
| 通过 API 返回 | ✅ 5 个接口、统一包络、CORS 放行 |
| 前端显示 | ✅ **真机浏览器**渲染 13/13，修复 F5 后无残留错误态 |

**达标（复验通过）。** 双方代码未互相干预：本轮未修改后端任何文件，前端仅改动 `review/index.html` 的 1 条 CSS 规则。
