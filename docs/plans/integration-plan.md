# 端到端集成方案（团队协作总纲）

> 本文由 team-lead 汇总，输入为 5 份角色方案：
> `frontend-plan.md`（fe-dev）、`backend-plan.md`（be-dev）、`skill-plan.md`（skill-designer）、`amy-teaching-plan.md`（amy）、`git-plan.md`（git-manager）。
>
> 定位：**下一阶段实施的唯一总纲**。不重复各角色的调研，只做对齐、消解冲突、串成一条链。
>
> 证据标注：**【实】**=已实测 ／ **【静】**=静态证据 ／ **【推】**=推断 ／ **【未】**=未验证。

---

## A. 端到端数据流总图

### A.1 三条链路

系统不是「一个读链路」，而是**三条方向不同的链路**。把它们混在一起看，是前面几轮反复踩坑的根源（例如把「诊断快照」当成「当前状态」用、把「生成脚本」当成「页面真相源」）。

```
┌─ 链路① 展示链路（读） ────────────────────────────────────────────┐
│  MySQL ──▶ Backend API ──▶ review/*.html（纯静态页 + api.js）      │
│  负责：前端 fe-dev ｜ 契约：{code,message,data} ｜ 真相源：DB       │
└──────────────────────────────────────────────────────────────────┘

┌─ 链路② 教学链路（AI） ────────────────────────────────────────────┐
│  AgentSnapshot ──▶ Skill(3 独立 + 6 内嵌) ──▶ 契约对象            │
│  负责：skill-designer（流程）+ amy（决策与内容）                    │
│  真相源：deploymentMode=markdown 时来自 md 适配层；               │
│          =backend 时来自 GET /api/agent/snapshot                  │
└──────────────────────────────────────────────────────────────────┘

┌─ 链路③ 记忆链路（写） ────────────────────────────────────────────┐
│  学生作答/难度反馈 ──▶ 写接口 ──▶ DB ──▶ 下次 AgentSnapshot       │
│  负责：fe-dev（触发）+ be-dev（落库）+ amy（判定内容）             │
│  ⚠ 这是当前最薄弱的一环：写接口几乎全部缺失，闭环断裂              │
└──────────────────────────────────────────────────────────────────┘
```

**链路③ 决定系统能否「长期、连续、个性化」。** 链路①做得再好，若链路③不断，第 N 课永远只能靠人工读 md 汇总，Amy 无法自动消费历史数据。因此本方案的阶段排序把写接口放在第一优先。

### A.2 两条必须显式画出的写入路径（易被误当成读链路）

amy 认领了两项写入义务（见 `amy-teaching-plan.md` 附录 A），它们让两个原本的「缺口」变成「写入约定」，**端到端图上必须画出，否则会被当成纯读链路而漏实现**：

| 路径 | 谁写 | 写到哪 | 谁读 | 解决的原缺口 |
|---|---|---|---|---|
| **P-1 · 错误类型分布** | amy 每次批改，在 grade payload 带 `byType` | `study_records`（`record_type='grade'`）`.payload.byType` | `GET /api/lessons/error-trend` → 快照 `errorTrend.byLesson[].byType` | G1 `errorTrend` 的 `byType`（原计划等 `mistake_events` 建表，现提前） |
| **P-2 · 下一课建议** | amy 每次反馈，在 feedback payload 带 `next_recommendation` | `study_records`（`record_type='feedback'`）`.payload.next_recommendation` | `GET /api/agent/snapshot` → `lastRecommendation` | G4 `lastIncomplete` / 快照 `lastRecommendation` |

**关键结论**：这两条的**上线速度取决于 amy 下一次写记录，不取决于后端排期**【静：be-dev 2.11 节】。历史 6 课的 `byType` 已由 amy 重算（附录 A.2），`next_recommendation` 已补齐（附录 A.3），可直接作为迁移回填数据。

### A.3 各环节职责与真相源

| 环节 | 负责角色 | 输入 | 输出 | 真相源 |
|---|---|---|---|---|
| 学习界面 | fe-dev | Backend API 响应 | 页面渲染 | DB（**不再依赖 md 与硬编码**） |
| 学习记忆 | be-dev | 写接口请求 | 库表持久化 | DB |
| 长期数据 | be-dev | — | 8 表 + 2 视图 → 补至 14 表 | DB |
| AI 能力 | skill-designer | 契约对象 | 契约对象 | `docs/schemas/` |
| 教学决策 | **amy（唯一权威）** | `AgentSnapshot` | `LessonPlan` / `GradingResult` / `ProgressReport` | `docs/ai-teacher.md` |
| 版本安全 | git-manager | 各角色的改动 | 提交 / 分支 / tag | Git |
| Markdown 原始数据 | amy 手工维护 | — | `progress.md` / `wrong-words.md` / `notes/` | **仅适配层可读** |

---

## B. 逐条回答用户的 8 个原始问题

| # | 问题 | 状态 | 结论要点 | 依据 |
|---|---|---|---|---|
| 1 | 如何将静态平台逐步迁移为前后端分离 | **已解决** | 分 P0—P5 六阶段：P0 共享层 → P1 词汇/错词只读 → P2 课程详情参数化 → P3 错词打卡 → P4 阅读 → P5 Vue 评估。裁决：页面**彻底脱离生成脚本**，`build_board.py` 退役 HTML 生成、只保留 md 解析做数据导入 | `frontend-plan.md` §3、本方案 §D-1 |
| 2 | 如何设计课程/词汇/阅读/练习/错题/学习记录核心数据 | **部分解决** | 现有 8 表主干**够用、不推倒重来**；需补 6 张：P0 `lesson_exercises` + `mistake_events`；P1 `knowledge_points` + `lesson_knowledge_points` + `readings`/`reading_pieces`/`reading_questions`；P2 `progress_feedback` + `skills`/`skill_runs`。新表沿用 `lessons_`/`students` 前缀体系，不回退设计稿 `courses`/`user_*` | `backend-plan.md` §一、§1.8 |
| 3 | 如何让 Amy 据历史数据决定下一步 | **已解决（含 1 处待改）** | 决策输入 20 项（14 已可用 / 6 缺口）；选点用优先级链（学生指定 > 复发阻断 `wrongCount≥4` > 欠账前置 > 主线推进 > 降级回补）；难度判定表 9 行，关键创新是**错误构成分双轨**——只有书写规范类错误（标点/大小写/拼写）不得触发降级，它触发自查项。**待改**：示范场景由「第 8 课」改为「第 7 课」（见 §D-6） | `amy-teaching-plan.md` §二、§四；本方案 §D-6 |
| 4 | 如何设计统一 JSON 契约，让 Skill 与前端、md 解耦 | **已解决** | 12 个 schema 分层（谁产出/谁消费/落哪张表）；铁律「Skill 只认对象，不读路径、不解析 md、不拼 HTML」；`deploymentMode`（`markdown`↔`backend`）切换时 Skill **零改动**；md 适配层是**唯一**允许接触 md 的地方 | `skill-plan.md` §2、§3 |
| 5 | 如何把多个 AI Skill 组织成稳定可维护的体系 | **已解决** | 3 独立（`daily-lesson` / `lesson-review` / `learning-progress-analysis`）+ 6 内嵌（`next-lesson-planning` / `grammar-teaching` / `vocabulary-teaching` / `exercise-generation` / `answer-grading` / `mistake-analysis`）。升级为独立 Skill 的判据写成硬条件：**用户会单独点名且每周 ≥1 次** | `skill-plan.md` §1 |
| 6 | 如何让前端经 API 取数而非依赖 md/硬编码 | **部分解决** | 共享层已落地物理文件：`review/assets/api.js`（4823B）、`ui.js`（12539B）、`board.css`（8167B）【实：语法校验通过】。P1/P2 不依赖新接口可继续；P3/P4 被后端缺口阻塞。契约权威为 `backend/docs/05-api-reference.md` | `frontend-plan.md` §5、§6 |
| 7 | 如何保证学习记录长期保存并支持个性化教学 | **部分解决** | 持久化设计齐备：事务边界、`clientEventId` 幂等、索引建议、备份策略、`deploymentMode` 无感切换。**但风险在工程侧**：本地领先远端 9 个提交、push 被本机网络阻断、Skill 源码仍无版本备份 | `backend-plan.md` §五、本方案 §G-1 |
| 8 | 如何用 Git 管理多 Agent 协作变更 | **部分解决** | 规范已定稿：`main` 单分支 + 文件级职责隔离（不用多分支）+ 小步提交 + 禁止 `git add -A` + 危险命令护栏 + tag 节奏。已执行 3 次提交并建备份分支；push 未完成 | `git-plan.md` §二、§三；本方案 §E-0 |

**统计**：已解决 4 项（1/3/4/5），部分解决 4 项（2/6/7/8），未解决 0 项。

---

## C. 契约对齐矩阵

### C.1 12 个 schema × 落点 × 状态

| 契约对象 | 主要落点 | 对应 API | 状态 |
|---|---|---|---|
| `AgentSnapshot` | 合成（多表聚合） | `GET /api/agent/snapshot` ❌404 | ⚠️ 待实现 |
| `LessonRecord` | `lessons` + `lesson_sections` + `lesson_vocabulary` | `POST /api/lessons`、`PUT /api/lessons/:id` ❌ | ⚠️ 待实现 |
| `LessonPlan` | **不落库**（课内中间对象，设计如此） | — | ✅ |
| `TeachingBlock` | `lesson_sections(section_type='grammar'\|'vocab_table')` + `vocabulary` | `GET /api/lessons/:id`✅ | ✅（`expectedMistakes` 需 S1） |
| `ExerciseSet` | `lesson_exercises` | `GET /api/lessons/:id/exercises` ❌ | ❌ 待建表 |
| `GradingResult` | `lesson_exercises.user_answer/is_correct/error_note` | `PUT /api/lessons/:id` ❌ | ❌ 待建表 |
| `MistakeAnalysisResult` | `mistakes` + `mistake_events` | `POST /api/mistakes` ❌ | ❌ 待建表 |
| `ReviewSession` | `mistake_events`（`outcomes[]` 逐条走 `/mistakes/:id/review`） | `POST /api/mistakes/:id/review` ❌404 | ❌ 待建表 |
| `ProgressReport` | 由 `study_records(grade)` + `lessons` 聚合，**无独立表** | `GET /api/lessons/error-trend`✅、`/api/mistakes/stats`✅ | ✅ |
| `ReadingSet` | `readings` + `reading_pieces` + `reading_questions` | `GET /api/readings*` ❌ | ❌ 待建 3 表 |
| `SkillRun` | `skill_runs`（`parentSkillRunId` 需新增列 S2） | `POST /api/skill-runs` ❌ | ❌ 待建表 |
| `common` | 公共定义（枚举/分页/错误） | — | ✅ |

### C.2 `AgentSnapshot` 字段级映射（前端与 Skill 的最大公约数）

| 契约字段 | 库表.列 | 状态 |
|---|---|---|
| `progress.currentLevel` | `progress.current_level` | ✅ |
| `progress.currentCourseNo` | `progress.current_lesson_no`（与 `lessons` 最大课号取大者） | ✅ 适配层映射 |
| `courseCatalog[].levelCode` | `lessons.level_code` | ✅ |
| `recentLessons[].vocabulary[]` | `lesson_vocabulary` ⋈ `vocabulary.word` | ✅ |
| `recentLessons[].errorCount` | `lessons.error_count` | ✅ |
| `pendingMistakes[]` | `mistakes`（复用 `mapMistake`，含 `derivePriority`） | ✅ |
| `errorTrend.byLesson[]` | `lessons.lesson_no/error_count/lesson_date` | ✅ |
| `errorTrend.byLesson[].byType` | 无列 → 走写入路径 P-1 | ⚠️ 依赖写入约定 |
| `backlog` | 无 → 需 `knowledge_points` | ❌ 待建表 |
| `lastIncomplete` | 无列 → 走 `study_records.payload` | ⚠️ 依赖写入约定 |
| `lastRecommendation`（optional） | 走写入路径 P-2 | ⚠️ 依赖写入约定 |
| `pendingMistakeStats`（optional） | `mistakes` 按 `error_type` 分组 | ⚠️ 可聚合 |
| `readingCatalog` | 无 → 需 `readings` | ❌ 待建表 |
| `deploymentMode` | 无（后端固定返回 `"backend"`） | ✅ 合成 |

**三处命名差异（不改契约，只做映射）**：`currentCourseNo` ↔ `current_lesson_no`；`firstCourseNo/lastCourseNo` ↔ `first_lesson_id/last_lesson_id`（契约用课号、库里是 ID）；契约 `exercises` ↔ 实际表 `lesson_exercises`。

---

## D. 冲突消解记录

| # | 冲突点 | 裁决 | 依据 |
|---|---|---|---|
| D-1 | `build_board.py` 归属：脚本会覆盖 10 个页面，而脚本自身不在版本控制内 | **页面彻底脱离脚本**：`review/` 改为纯 API 驱动静态页；脚本退役 HTML 生成、只保留 md 解析做数据导入 | 用户拍板；`frontend-plan.md` F-A |
| D-2 | 前端技术栈：渐进改造 vs 现在重写 Vue 3 | **暂缓 Vue**，抽 `api.js`/`ui.js`/`board.css` 共享层，页面仍为原生 HTML，Vue 留 P5 评估 | 用户拍板；`AGENTS.md` §2.3 禁止擅自换栈 |
| D-3 | 词汇数量口径：库内 51 vs 看板 52 | **统一 51**（按 word 去重） | 用户拍板 |
| D-4 | 契约真相源：`docs/03-api-contract.md`（`{success,data,meta}`）vs `backend/docs/05-api-reference.md`（`{code,message,data}`） | **以 `05-api-reference.md` 为唯一权威**；`03-api-contract.md` 作废 | 契约已变更【静】 |
| D-5 | 资源命名：设计稿 `courses`/`user_*` vs 已实现 `lessons`/`students` | **沿用 `lessons`/`students`**，不只前缀、资源名也不回退 | be-dev 与 skill-designer 一致 |
| D-6 | 课号基准：任务书「Level 2 Lesson 5」vs 仓库实际 | **已完成 1—6 课，下一课为第 7 课**。amy 方案 §四示范场景应由「第 8 课」改为主场景「第 7 课」（原写法是假设第 7 课已上完，属降级分支） | `progress.md:107`、`notes/day-01-07.md:626` 互相印证【静】 |
| D-7 | 错词 20 vs 19（DQ1） | **删除 `mistakes.id=19`**（`correct_text` 为「—」、`wrong_count=0`，是 amy 已删但种子未同步的残留）+ 迁移脚本加「非错题不导入」规则 | amy 确认；be-dev 实测判重返回空集，唯一索引可建 |
| D-8 | 诊断结果表（2026-09-27 十题）是否入库 | **不入库**。一次性快照会成第二真相源——诊断判「三单 -s 通过」但 `Tom play soccer` 至今未过关。若要结构化只能建独立 `diagnostics` 表带 `diagnosed_at`/`superseded`，**冲突时以错词本为准** | amy + skill-designer 一致 |
| D-9 | `studyMinutes` 口径 | **后端不推算**。由学习记录显式上报，历史无数据返回 `null` 并标降级原因，必须区分「没数据」与「数据为 0」；任何估算值必须带标记 | 用户裁决；沿用 be-dev 在 N1 上的降级写法 |
| D-10 | S1：`section_type` 是否增 `objectives`/`expected_mistakes` | **批准**。按枚举同源顺序执行：先 `schema.sql` → 再 `constants.js` → 最后 schema JSON。反序会造成「代码接受、库拒绝」的 500，且测试环境跑不出来 | be-dev 与 skill-designer 一致 |
| D-11 | 开放题「完整改后版」字段 | **批准 `revisedAnswer` 入契约**（`grading-result.schema.json`，optional，不升版本）。它与 `referenceAnswer`（标准答案）语义不同，塞一起会让 Skill 与前端都不知道该展示哪个 | 用户裁决 |
| D-12 | 批改结论字段名：`isCorrect` vs 前端提议的 `verdict` | **用契约已有的 `isCorrect`**，不新造字段；`errorType` 复用 `mistakes` 同一套 ENUM | be-dev 与 skill-designer 一致 |
| D-13 | 「词汇是否曾是错词」能否自动生成 | **否决文本匹配**。实测 20 条错词命中 15 条，但 `Tom plays soccer`（错在 -s）会匹配到 `play`、`Do you like coffee?`（错在问号）会匹配到 `like`——命中率高但语义完全错，是**假数据**。改走 `mistakes` 加可空 `vocabulary_id`、由 amy 批改时显式关联 | be-dev 实测 |
| D-14 | `docs/skills.md` 7.4 的 `.gitignore` 否定写法 | **写法无效，已批准更正**。实测 `!.workbuddy/skills/` 在父目录被整体排除后无法 re-include；改用方案 A：新建 `skills/english-daily/` 只入库 8 个源文件，`.workbuddy/` 保持整体忽略 | skill-designer 实测 `git check-ignore` |
| D-15 | `build_board.py` 权威副本大小：38KB vs 44415 字节 | **以 44415 字节 / 1040 行为准**。此前的 38KB 与 fe-dev 依据的 28980 字节 / 681 行都是旧副本；fe-dev 基于旧版得出的「重建会冲掉 API 改造」**结论不成立**——权威版首页模板已是 API 驱动版，F5 修复在模板第 562 行 | skill-designer 实测 |
| D-16 | 快照字段命名：`pendingMistakeStats` vs `pendingMistakesStats` | **单数为准**，复数写法作废 | `06-api-requirements-amy.md:79` |

### D.16 已核对一致的项（无冲突）

- `AgentSnapshot` 的 `pendingMistakes` 定义（`status='pending'` 的未过关错词）三方一致：amy 决策规则、skill-designer 契约、be-dev 映射。
- `backlog` 定义（4 项编号补漏队列，当前第 4 项为介词 on/at）三方一致；skill-designer 另补三条硬边界：`planned` 绝不进补漏队列、`untested` 首版恒为空数组、`seq ≥ 1`。
- `error_type` 三步判定与 19 条回归基线未被任何方案修改。
- 契约演进规则（加 optional 字段不升版本、Skill 忽略未知字段）三方一致。

---

## E. 分阶段实施路线

### E-0 · 阶段 0：Git 安全（**前置，未完成**）

| 项 | 状态 | 说明 |
|---|---|---|
| `.gitignore` 补 9 项缺口 | ✅ 完成 | commit `1aca69c` |
| 提交四份方案文档 | ✅ 完成 | commit `e45c532`（+2394 行） |
| 提交 `review/index.html` | ✅ 完成 | commit `54f8330`（+93/-13） |
| 建备份分支 | ✅ 完成 | `backup/2026-09-29-before-push` → `54f8330` |
| **push 到 origin** | ❌ **被阻断** | `Recv failure: Connection was reset`；`curl https://github.com` → 502，`curl https://www.baidu.com` → 200。**本机网络出口拦截 GitHub，非代码问题** |
| 本地裸镜像备份 | ✅ 完成（本方案新增） | `D:/English-mirror.git`，已验证含全部分支与提交 |
| Skill 源码入库 + tag | ⏸ 待办 | 等 `skills/english-daily/` 就绪，tag `skill-english-daily-v2.2.0` |
| 4 份旧副本处置 | ⏸ 待办 | 先 md5 核对（期望 `50aca14b1edf40cb20404a088e4e3d14`）→ 加 `.bak-20260929` 后缀静置 7 天，**不直接删** |

### E-1 · 阶段 1：写接口闭环 + 前端共享层（**最高杠杆**）

| 项 | 负责 | 依赖 | 验证 |
|---|---|---|---|
| `POST /api/mistakes/:id/review`（`clientEventId` 幂等） | be-dev | `mistake_events` 建表 | 重复提交不污染过关判定 |
| `POST /api/progress/feedback` | be-dev | 无 | 难度反馈能触发升降级 |
| `POST /api/study-records`（含 P-1/P-2 两个 payload 约定） | be-dev + amy | 无 | grade 带 `byType`、feedback 带 `next_recommendation` 能落库并读回 |
| `GET /api/agent/snapshot`（含两个 optional 字段） | be-dev | 无（缺字段降级） | 9 次请求 → 1 次 |
| `GET /api/lessons/all` + `maxSize` 放宽 500（**须含 `grammarPoint`**） | be-dev | 无 | 解掉 `size=100` 静默截断 |
| 前端 P0 共享层 | fe-dev | ✅ 已完成物理文件 | 语法校验通过；可见性用 `getComputedStyle().display` |
| 前端 P1 词汇/错词只读（口径 51） | fe-dev | `/api/vocabulary/stats`✅ `/api/mistakes/stats`✅ | 真机渲染验证 |
| 前端 P2 课程详情参数化 | fe-dev | `/api/lessons/all` | 用 lessonNo↔id 映射兜底 |

**可回滚点**：DDL 执行前必须先有已 push 的版本点（当前尚未满足，见 G-1）。

### E-2 · 阶段 2：数据模型补齐

DDL 顺序固定：先 `schema.sql` + 库内 ENUM → 再 `constants.js` → 最后 schema JSON。同批执行：`lesson_exercises`、`mistake_events` 建表；S1 两个 ENUM 值；DQ1 删 `id=19`。

### E-3 · 阶段 3：阅读与知识点

`readings`/`reading_pieces`/`reading_questions` 三表 + `/api/readings` 系列；`knowledge_points` + `lesson_knowledge_points` + `/api/knowledge-points`（G3 `backlog`）。前置：`M2` 初始导入须补写第 4/5/6 课三条 `role='backfill'` 关联，否则已出队的补漏块会被误判未完成、重新冒进第 7 课队列。

### E-4 · 阶段 4：Skill 全链路 + 前端 P3/P4

前端错词打卡（P3）与阅读模块（P4）；Skill 侧 `lesson-review` 独立入口、`learning-progress-analysis` 实现；适配层从 md 切到 backend（只改 `deploymentMode`）。

### E-5 · 阶段 5：Vue 评估（可选）

页面收敛后再评估是否重写。

---

## F. 端到端验收清单

**契约与枚举**
- [ ] `docs/schemas/` 的 12 个对象与 `05-api-reference.md` 逐字段对齐，无反向约束
- [ ] 枚举三处同源：`schema.sql` ENUM == `backend/src/constants.js` == schema JSON
- [ ] 响应包络统一 `{code,message,data}`，分页统一 `{list,total,page,size}`
- [ ] 全仓无 `{success,data,meta}` 残留引用
- [ ] `integration-check.js` 拆出「契约一致性检查」并纳入 CI 门禁

**数据**
- [ ] 词汇口径唯一 = 51；错词 total=19 / pending=15 / passed=4，与 `wrong-words.md` 完全一致
- [ ] `mistakes` 判重唯一索引已建
- [ ] 非错题（`wrong_count=0` 或 `correct_text` 为空/占位符）不被导入
- [ ] 历史 6 课 `byType` 已回填；第 5 课按 amy 判断**不回填**（两种读法都能凑成 2，不塞推测数据）
- [ ] 历史 `next_recommendation` 已回填；无数据的字段返回 `null` 且带降级标记
- [ ] `lesson_sections` 的 `objectives`/`expected_mistakes` 可写可读

**前端**
- [ ] 每个页面的数据均来自 API，无硬编码业务数据
- [ ] 四态齐备：Loading / Error / Empty / 正常
- [ ] 新增带 `display` 的类均补了 `.<cls>.hide{display:none}`
- [ ] 可见性验证使用 `getComputedStyle().display`，未使用 class 断言
- [ ] `size=100` 已替换为 `/api/lessons/all`，且搜索未因缺 `grammarPoint` 漏词
- [ ] 11 个页面的内联 CSS/JS 重复已收敛到 `review/assets/`

**Skill**
- [ ] Skill 不读文件路径、不解析 md 排版、不拼 HTML
- [ ] md 适配层是唯一接触 md 的模块
- [ ] `deploymentMode` 从 `markdown` 切到 `backend` 时 Skill 代码零改动
- [ ] Skill 能忽略未知字段；`error_type` 19 条回归全通过
- [ ] 改 Skill 前已完整备份、版本自增，正文不留版本标注

**Git**
- [ ] 本地与远端一致（当前**未满足**）
- [ ] 至少一个备份分支 + 一个本地镜像存在
- [ ] `skills/english-daily/` 源码已入库并打 tag
- [ ] `git log` 中每次 DDL/大规模改动前都有可回滚提交
- [ ] 未使用过 `git add -A`、`reset --hard`、`push --force`

---

## G. 风险与未决问题

### G-1 · 🔴 最高：版本安全未闭环

本地领先远端 **9 个提交**（全部 `backend/` 与 21 个文档只在本机）。备份分支与本地镜像已建，但镜像在同一台机器上——**防不了整盘故障**。push 被本机网络出口阻断（GitHub 502，国内站点正常）【实】，**需用户在能访问 GitHub 的网络环境手动执行**：
```
git -C E:/English push origin main
git -C E:/English push origin backup/2026-09-29-before-push
```
在 push 成功前，**不建议执行任何 DDL**（AGENTS.md：数据库迁移前必须先有可回滚版本点）。

### G-2 · 🔴 `lesson_sections` 正文缺失

库内只有 `grammar`/`feedback` 两类共 12 条【实】，意味着**阶段内复习/作业/例句/批改正文只能从 md 取**，契约里的结构化查询暂不可依赖【静：skill-plan R11】。这也解释了为什么课程全文检索现在「没有正文可搜」。

### G-3 · 🔴 历史数据可推导性（跨模块通用检查项）

skill-designer 发现一类坑：**已补过的补漏块因无记录会被判为未完成**，重新进入第 7 课队列，与 amy 已定规划（补漏块 ④ 介词 on/at）直接冲突，学生会被要求重做已出队的三块。同类问题在 `lessons` 表的作业/例句正文（R11）、前端静态页里的历史数据（可能与 DB 现状不一致）大概率也存在。
**建议**：把「历史数据可推导性」列为每次加字段/加接口前的强制检查项——**契约定得对不对，不看类型，看历史数据能不能接上**。

### G-4 · 🟡 快照数据被当成当前状态用

诊断结论会过期且与错词本冲突（D-8）。同类风险还有：`study_records.payload` 里的 `next_recommendation` 是**当时的建议**，不一定是当前有效建议。凡「快照型数据」进契约，必须带时间戳或 `superseded` 语义。

### G-5 · 🟡 多副本误跑会让首页倒退

权威版首页模板已是 API 驱动版【实】。真实风险不是「重建冲掉改造」，而是**误跑旧副本让首页倒退成静态页**。处置：重命名静置 + md5 防覆盖校验（期望 `50aca14b1edf40cb20404a088e4e3d14`）。

### G-6 · 🟡 未验证项（明确声明，不声称通过）

- 前端 P0 共享层（`api.js`/`ui.js`/`board.css`）**只做了语法校验**，未在浏览器真机验证行为【未】。
- 新接口（`/agent/snapshot`、`/knowledge-points`、`/readings`、`POST /mistakes/:id/review`）**均未实现**，调用会 404【实】。
- 前端 P1—P4 未开工。
- `M2` md→DB 迁移脚本未实现。
- DDL 全部为**待确认候选**，库内未执行任何结构变更【实】。
- Git push 未成功。
- `docs/schemas/` 的 `agent-snapshot.schema.json` 已补两个 optional 字段并复跑 `SCHEMA_OK`（objects 68→71）【实】；`lesson-plan.schema.json` 生词量描述已改为「Level 2 常规 10（8—12）、降载 6—8」【实】，但 `SKILL.md` 第 5 步仍写「5—8」**与之一致性未修**，且「降载」缺触发条件【未】。

### G-7 · 未决问题

| # | 问题 | 等谁 | 是否阻塞 |
|---|---|---|---|
| 1 | `expectedMistakes`（备课预期错误）学生端是否展示 | **amy**（教学决策） | 阻塞前端 F10 开工 |
| 2 | 「降载」触发阈值未写死 | **amy** | 阻塞 Skill 判据落地 |
| 3 | `SKILL.md` 第 5 步生词量「5—8」与 `progress.md` 的 8—12 冲突 | amy 确认口径 | 不阻塞（属源码改动，留实施阶段） |
| 4 | amy 方案 §四示范场景需由「第 8 课」改为「第 7 课」 | amy | 不阻塞（内容不变，仅课号与分支主次） |
| 5 | `revisedAnswer` / S1 两枚举值的 schema 落笔 | skill-designer | 不阻塞（已批准，属执行） |
| 6 | `.workbuddy/` 排除策略（Q3）、副本处置（Q4/Q8/Q9） | git-manager | 曾阻塞前端 P0；现已可绕过 |
| 7 | 是否配置常驻后端服务（pm2 / 计划任务） | 用户 | 不阻塞。**建议先做低成本的文档提示**（见 G-8） |

### G-8 · 🟡 后端服务易被误判为故障

后端进程随会话结束被回收【实】，导致 amy 曾误判「4 个接口全 404」。**建议在 `backend/README.md` 明确写出特征：4000 连接被拒 = 服务没启动，不是接口 404**。低成本、零风险。是否配常驻进程属环境变更，需用户决定。

---

## 附：本次汇总的证据边界

本文所有结论均来自 5 份角色方案与其内部标注的证据，未新增任何实测。凡标注【未】的项均未执行验证，不得视为通过。5 名角色在 2026-09-29 17:07 因 API 频率限制（429）暂停，本文由 team-lead 独立汇总完成，**未经各角色复核**——若后续复核发现与本文不一致，以角色方案的原始证据为准，并回写本文。
