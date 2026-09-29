# 后端建设方案 · 分析报告（backend-analysis）

> 项目：English Learning Platform（工作目录 `E:\English`）
> 角色：后端工程师
> 状态：**纯分析文档**。本文不含任何代码实现，不建 Express 项目、不建数据库、不改现有页面。
> 结论仅供项目负责人确认，确认后方可进入开发。
> 附：分册设计见 `backend/docs/01-architecture.md`、`02-data-model.md`、`03-api-contract.md`、`04-migration-and-roadmap.md`；本文是它们的**合并总览版**。

---

## 1. 当前项目结构

```
E:\English\
├─ AGENTS.md              多 Agent 协作规范（角色分工、禁止事项）
├─ PROJECT.md             项目目标与技术栈规划
├─ README.md              仅一行标题（EnglishStudy）
├─ INDEX.md               总目录（build_board.py 生成）
├─ digest.md              学习摘要（build_board.py 生成，供上课读取）
├─ progress.md            进度与级别（人工/模型维护）
├─ wrong-words.md         错词本（人工/模型追加）
├─ notes\
│   └─ day-01-07.md       课程笔记，每 7 课一份（第 1—6 课）
├─ read\
│   ├─ 2026-09-26-read.md ~ 2026-09-29-read.md   阅读材料，一天一份
├─ review\                前端原型（build_board.py 生成的静态页面）
│   ├─ index.html         看板首页
│   ├─ reading.html       阅读页
│   ├─ readIndex.html     阅读目录（被 reading.html 以 iframe 嵌入）
│   ├─ words.html         词汇卡页
│   ├─ wrong.html         错词本页
│   └─ lessons\lesson-1..6.html   每课详情页
├─ .workbuddy\            工作区（记忆、skill、构建缓存；已在 .gitignore）
└─ backend\               ★ 本次分析新建设计目录（仅文档与 DDL 设计稿）
    ├─ README.md
    ├─ docs\01-architecture.md ~ 04-migration-and-roadmap.md
    └─ db\schema.sql       建表设计稿（未执行）
```

**要点**：项目当前是「**Markdown 源 + Python 脚本生成静态页面**」的单机单用户原型，**尚无任何服务端**。`review/` 下所有 HTML 都是产物，不是手写源码。

---

## 2. 当前前端技术情况

| 项 | 现状 |
|---|---|
| 技术栈 | 纯 **HTML + CSS + 原生 JavaScript**；无框架、无构建工具、无 `package.json` |
| 入口 | `review/index.html` |
| 页面 | 看板（统计 + 课程总结）/ 阅读（iframe 目录 + 卡片翻页）/ 词汇卡 / 错词本 / 每课详情 |
| 交互 | 原生 DOM：tab 切换、折叠中文、卡片点击翻转、首页关键词过滤、iframe `postMessage` 联动 |
| 数据获取 | **无**。数据在生成时硬编码进 HTML，前端不做任何网络请求 |
| 生成方式 | 由 `build_board.py` 每次重建（会先删旧 `lesson-*.html` 再重新生成） |
| PROJECT.md 规划 | Vue 3 + Vite + Router + Axios —— **仅规划，尚未落地** |

> 结论：前端目前是**只读展示层**，与「前后端分离」目标还有距离，但**本期不动它**。

---

## 3. 当前数据情况

**数据真相源是 4 类 Markdown 文件**，没有数据库。

| 数据 | 载体 | 结构 |
|---|---|---|
| 课程 | `notes/day-XX-YY.md` | `## 第 N 课 · 日期` + `> 一句话` + 8 个小节（复习/今日语法/词汇/例句/作业/我的作答/批改/难度反馈） |
| 词汇 | 各课 `### 词汇` 表格 | 单词 / 音标 / 中文 / 例句 |
| 阅读 | `read/YYYY-MM-DD-read.md` | `## 第 N 篇 · 标题` + 级别/来源 + 英中对照段 + 生词注释 + 理解题 |
| 错词 | `wrong-words.md` | 课号 / 错误点 / 正确形式 / 错因 / 连续答对 / 状态 |
| 进度 | `progress.md` | 当前级别 / 课号 / 连击计数 / 待补清单 / 反馈记录 |

**数据流（单向管道）**：
```
notes/ + read/ + progress.md + wrong-words.md
        │  解析（build_board.py）
        ▼
INDEX.md / digest.md / review/*.html      ← 全部是「派生快照」
```

- 现有统计：课程 6 / 级别 Level 2 / 累计生词 52 / 阅读 11 篇 / 未过关错词 16。
- 关联方式：**用「课号」字符串做外键**，已出现 `第 诊断 课` 这类脏值。

---

## 4. 当前 API 情况

**完全没有。**
- 全项目（含 `review/` 全部 HTML）搜索 `fetch` / `axios` / `XMLHttpRequest` / `/api/` / `localhost` / `localStorage`：**零命中**。
- 页面数据全部在生成时写死进 HTML，运行期不发起任何请求。
- 不存在任何接口契约、路由或网络层代码。

---

## 5. 当前后端情况

**不存在。**
- 无 `package.json`、无 `server.js` / `app.js`、无 `.env`、无 `*.sql`、无 `docker-compose`。
- 无服务进程、无数据库、无持久化层。
- `PROJECT.md` 把 **Node.js + Express + MySQL** 列为「推荐技术栈」，但目录中无任何实现痕迹。
- 运行环境已具备：Node 22.22.2 ✅、npm 10.9.7 ✅、**MySQL 8.0.27 已在 3306 端口运行** ✅（root 密码未知，当前无法连接）。

---

## 6. 当前存在的问题

| # | 问题 | 影响 |
|---|---|---|
| 1 | 无持久化层，状态散落在 Markdown | 无用户/时间/关系维度，无法增长式查询 |
| 2 | 数据不可检索 | 前端只能对已渲染卡片做客户端字符串过滤，无法按级别/日期/掌握度查询 |
| 3 | 无写入 API | 作答与批改只能靠 AI 改 md，Amy/Skill 拿不到机器可读数据 |
| 4 | 弱 ID 与脆弱关联 | 以「课号字符串」做外键，已出现脏值 `第 诊断 课` |
| 5 | 源文件与派生产物混放 | `INDEX.md`/`digest.md`/`review/*.html` 是产物却与源同目录，易被误手改 |
| 6 | 派生副本冗余 | `digest.md` 是压缩副本，超 8KB 需手工清理 |
| 7 | 单用户假设 | 无 user 概念，无法支持多学员 |
| 8 | 前后端未分离 | 前端是构建期静态产物，无 API 层，无法动态化 |

---

## 7. 建议的后端架构

**技术栈（对齐 PROJECT.md）**：Node.js 22 · Express 4 · MySQL 8.0 · `mysql2` · `zod` · `helmet`/`cors`/`morgan` · `dotenv`。
**不引入 ORM**：SQL 手写 + 参数化，透明可读。

**分层架构**：
```
HTTP → routes（绑定）
     → middlewares（requestId → zod 校验 → 路由 → 404 → 错误处理）
     → controllers（解析请求、包装响应，不含业务规则）
     → services（业务规则：连击过关、升降级、快照组装）
     → repositories（纯 SQL，prepared statement）
     → config/db（mysql2 连接池）
     → MySQL 8.0
```

**目录规划**：
```
backend/
├─ package.json（实现阶段创建）
├─ .env.example
├─ src/
│  ├─ server.js / app.js
│  ├─ config/{env.js, db.js}
│  ├─ routes/{index,course,vocabulary,reading,mistake,progress,studyRecord,dashboard,agent}.routes.js
│  ├─ controllers/  services/  repositories/  validators/
│  ├─ middlewares/{requestContext,validate,notFound,errorHandler}.js
│  └─ utils/{ApiError,asyncHandler,response}.js
├─ db/{schema.sql, seed.sql, export_md_to_json.py, import_json.js}
└─ docs/
```

**关键原则**：后端是**正交新增**——不改前端技术栈、不删现有文件、不动 Amy 教学规则、不做无说明的重构。

---

## 8. 数据库设计建议

设计目标：让 Amy 每天教学后能回答 —— **学生学过什么 / 错过什么 / 掌握什么**。
DDL 设计稿见 `backend/db/schema.sql`（**未执行**）。

**18 张表 + 2 视图**：

| 分组 | 表 |
|---|---|
| 用户与状态 | `users`、`user_progress` |
| 课程 | `courses`、`course_sections`、`knowledge_points`、`course_knowledge_points` |
| 词汇 | `vocabulary`、`course_vocabulary` |
| 练习 | `exercises` |
| 阅读 | `readings`、`reading_pieces`、`reading_questions` |
| 错题 | `mistakes`、`mistake_events` |
| 记录 | `progress_feedback`、`study_records` |
| 技能 | `skills`、`skill_runs` |
| 视图 | `v_pending_mistakes`、`v_dashboard_stats` |

**关键设计点**：
- 用自增 `id` 作主键，`lesson_no` 作业务唯一键（`UNIQUE(user_id, lesson_no)`），**替代脆弱的「课号字符串外键」**。
- 课程 8 个小节原文存入 `course_sections.content_md`（MEDIUMTEXT），保留 Markdown，**不丢信息**。
- 错词表核心字段：`streak`（连续答对）、`wrong_count`（累计犯错）、`status`（pending/passed）、`error_type`，支撑掌握度判断与错误趋势。
- 统计改用**视图实时计算**，替代 `digest.md` 这份会膨胀的派生副本。
- 外键删除策略统一 `RESTRICT`：学习数据只增不删。
- 以 `user_id` 隔离，默认单用户但为多用户预留。

**迁移建议**：md → DB **单向导入**；**复用 `build_board.py` 已验证的 Python 解析规则**（避免重写 JS 解析器造成规则漂移），导出 JSON 后用 Node 事务幂等入库。现有文件全程保持不动。

---

## 9. API 设计建议

**Base**：`http://localhost:4000/api/v1`
**通用约定**：REST 方法；分页 `?page=&size=`；成功 `{success,data,meta}`，失败 `{success:false,error:{code,message,details}}`；8 类错误码（`VALIDATION_ERROR` / `NOT_FOUND` / `CONFLICT` / `INVALID_LEVEL` / `INVALID_FEEDBACK` 等）。

**接口分组（约 31 个）**：

| 分组 | 代表接口 |
|---|---|
| 课程 | `GET /courses`、`GET /courses/:id`、`GET /courses/latest`、`POST /courses` |
| 词汇 | `GET /vocabulary`、`GET /vocabulary/stats` |
| 阅读 | `GET /readings`、`GET /readings/:date`、`GET /reading-pieces/:id` |
| 错词 | `GET /mistakes`、`GET /mistakes/pending`、`POST /mistakes/:id/review` ★ |
| 进度 | `GET /progress`、`POST /progress/feedback` ★ |
| 记录 | `GET /study-records`、`POST /study-records` |
| 看板 | `GET /dashboard/summary` |
| **AI 侧** | `GET /agent/snapshot` ★、`GET /skills`、`POST /skill-runs` |

★ 为最关键的三个：`/agent/snapshot` 让 Amy 一次拿到全貌；`/mistakes/:id/review` 与 `/progress/feedback` 把「连击过关」「升降级」规则收敛到服务端，规则**与现有 `progress.md` 完全一致，只搬运不重设计**。

---

## 10. Amy 需要的数据

Amy 的诉求：**每天上课前知道学生学过什么、错过什么、掌握什么**，并据此决定下一课。

| Amy 需要的 | 提供方式 |
|---|---|
| 当前级别、当前课号、最近反馈、连击计数、冻结状态 | `GET /progress` |
| 已学过哪些课、每课一句话与语法点 | `GET /courses`（或快照的 `courseCatalog`） |
| 最近 N 课的语法点与词汇 | 快照的 `recentLessons`（`?recent=3`） |
| 未过关错词（含错因、连续答对、优先级） | `GET /mistakes/pending` |
| 错误趋势（每课错误数变化） | `GET /study-records` + `mistake_events` |
| 知识点地图与待补清单 | `knowledge_points` / `course_knowledge_points` |
| **一站式快照** | **`GET /agent/snapshot`** —— 等价把 `digest.md` 升级为机器可读 JSON |

---

## 11. Skill 需要的数据

Skill 是「AI 能力层」，需要**结构化输入输出**与**执行留痕**。

| Skill 需要 | 提供方式 |
|---|---|
| 上课状态输入（级别、最近课程、错词） | `GET /agent/snapshot` |
| 归档一课的写入接口（课 + 小节 + 词汇 + 练习） | `POST /courses` |
| 更新错词掌握度 | `POST /mistakes/:id/review` |
| 写入难度反馈、触发升降级 | `POST /progress/feedback` |
| Skill 注册信息 | `GET /skills`（表 `skills`，如 `english-daily v2.2.0`） |
| Skill 执行记录（输入/输出/状态） | `POST /skill-runs`、`GET /skill-runs` |
| 阅读生成结果落库 | `POST /readings`（当天已存在→409，与「不覆盖」规则一致） |

> 价值：Skill 今后**不必再手工解析 Markdown**，读写都走结构化接口，规则由服务端统一执行。

---

## 12. 前端需要的数据

前端各页面所需的接口已给定（本期**不要求改动**，切换动态化后再对接）：

| 页面 | 需要的数据 | 接口 |
|---|---|---|
| `review/index.html` | 5 个统计卡 + 课程卡列表 | `GET /dashboard/summary` + `GET /courses` |
| `review/reading.html` + `readIndex.html` | 阅读日列表、某天篇目、单篇详情 | `GET /readings` / `GET /readings/:date` / `GET /reading-pieces/:id` |
| `review/words.html` | 首字母分组与词卡 | `GET /vocabulary/stats` + `GET /vocabulary?letter=` |
| `review/wrong.html` | 错词表（已过关/待复习） | `GET /mistakes`（可加 `status=pending`） |
| `review/lessons/lesson-N.html` | 单课全部小节与词汇 | `GET /courses/:id` |

对接注意：统一响应包络、分页 `meta`、错误码枚举；`reading.html` 现有的 iframe/postMessage 联动逻辑可保留，仅把数据来源从「写死」换成「接口」。

---

## 13. 后续实施顺序

| 里程碑 | 内容 | 产出 | 依赖 |
|---|---|---|---|
| **M0（本次）** | 纯分析 | 本文 `docs/backend-analysis.md` + `backend/docs/` 分册 | 无 ✅ |
| M1 | 建库建表 | 执行 `schema.sql` 并校验 | **需 MySQL root 密码** |
| M2 | 迁移脚本 | `export_md_to_json.py` + `import_json.js`，导入历史数据 | M1 |
| M3 | 只读 API | courses / vocabulary / reading / mistakes / progress / dashboard / agent snapshot | M2 |
| M4 | 写接口与业务规则 | `POST /courses`、`POST /mistakes/:id/review`、`POST /progress/feedback` | M3 |
| M5 | 前端对接（可选） | 静态页改调 API | M4 + 前端工程师参与 |

**待负责人确认**：① MySQL root 密码；② 单用户还是多用户；③ 是否启动 M5。

---

## 本次分析的范围声明

- 本文为**纯分析**。未删除任何文件、未修改任何现有页面、未新建 Express 项目、未新建数据库、未改动 `package.json`、未改动任何 API。
- 本次新增仅文档：`docs/backend-analysis.md` 与 `backend/`（README + 4 份分册 + `db/schema.sql` 设计稿）。
- **分析到此结束，等待项目负责人确认后再开始后端开发。**
