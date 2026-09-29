# 端到端集成方案（团队协作总纲）

> 本文由 team-lead 汇总，输入为 5 份角色方案：
> `frontend-plan.md`（fe-dev）、`backend-plan.md`（be-dev）、`skill-plan.md`（skill-designer）、`amy-teaching-plan.md`（amy）、`git-plan.md`（git-manager）。
>
> 定位：**下一阶段实施的唯一总纲**。不重复各角色的调研，只做对齐、消解冲突、串成一条链。
>
> 证据标注：**【实】**=已实测 ／ **【静】**=静态证据 ／ **【推】**=推断 ／ **【未】**=未验证。
>
> **最近订正**：2026-09-29 17:45（integration-synth，第二轮，按 team-lead 逐条核对结论）。两轮订正清单与新实测发现见文末《本次汇总的证据边界与订正记录》。

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
| 1 | 如何将静态平台逐步迁移为前后端分离 | **已解决** | 分 P0—P5 六阶段：P0 共享层 → P1 词汇/错词只读 → P2 课程详情参数化 → P3 错词打卡 → P4 阅读 → P5 Vue 评估。P0 共享层已落盘、P2 参数化已起头（新增 `review/lessons/lesson.html`）。裁决：页面**彻底脱离生成脚本**，`build_board.py` 退役 HTML 生成、只保留 md 解析做数据导入 | `frontend-plan.md` §3、本方案 §D-1 |
| 2 | 如何设计课程/词汇/阅读/练习/错题/学习记录核心数据 | **部分解决** | 现有 8 表主干**够用、不推倒重来**；需补 6 张：P0 `lesson_exercises` + `mistake_events`；P1 `knowledge_points` + `lesson_knowledge_points` + `readings`/`reading_pieces`/`reading_questions`；P2 `progress_feedback` + `skills`/`skill_runs`。新表沿用 `lessons_`/`students` 前缀体系，不回退设计稿 `courses`/`user_*` | `backend-plan.md` §一、§1.8 |
| 3 | 如何让 Amy 据历史数据决定下一步 | **已解决** | 决策输入 20 项（14 已可用 / 6 缺口）；选点用优先级链（学生指定 > 复发阻断 `wrongCount≥4` > 欠账前置 > 主线推进 > 降级回补）；难度判定表 9 行，关键创新是**错误构成分双轨**——只有书写规范类错误（标点/大小写/拼写）不得触发降级，它触发自查项。示范场景已定稿为**第 7 课**（`L2-07`：因 `E_6=5` 触发 T-1 轻度降载，生词由 10 调为 8）；降载判据 T-1—T-6 与 L0/L1/L2/LX 四档已补齐；`expectedMistakes` 字段入库但**学生端不展示** | `amy-teaching-plan.md` §二、§2.7、§四、附录 B；本方案 §D-6 / D-17 / D-18 |
| 4 | 如何设计统一 JSON 契约，让 Skill 与前端、md 解耦 | **已解决** | 12 个 schema 分层（谁产出/谁消费/落哪张表）；铁律「Skill 只认对象，不读路径、不解析 md、不拼 HTML」；`deploymentMode`（`markdown`↔`backend`）切换时 Skill **零改动**；md 适配层是**唯一**允许接触 md 的地方 | `skill-plan.md` §2、§3 |
| 5 | 如何把多个 AI Skill 组织成稳定可维护的体系 | **已解决** | 3 独立（`daily-lesson` / `lesson-review` / `learning-progress-analysis`）+ 6 内嵌（`next-lesson-planning` / `grammar-teaching` / `vocabulary-teaching` / `exercise-generation` / `answer-grading` / `mistake-analysis`）。升级为独立 Skill 的判据写成硬条件：**用户会单独点名且每周 ≥1 次** | `skill-plan.md` §1 |
| 6 | 如何让前端经 API 取数而非依赖 md/硬编码 | **部分解决** | 共享层已落盘工作区：`review/assets/api.js`（4823B）、`ui.js`（12651B）、`board.css`（8250B）【实：`ls` 核对；**已语法校验通过，但真机未验证**，且三者与 `lesson.html` 目前**均为未入库状态（`??`）**】。P1/P2 不依赖新接口可继续；P3/P4 被后端缺口阻塞。契约权威为 `backend/docs/05-api-reference.md` | `frontend-plan.md` §5、§6 |
| 7 | 如何保证学习记录长期保存并支持个性化教学 | **部分解决** | 持久化设计齐备：事务边界、`clientEventId` 幂等、索引建议、备份策略、`deploymentMode` 无感切换。工程侧已明显收敛：`c792b03` **已推送成功（单点风险已消除）**【实】、Skill 源码入库并打 tag【实】、`backup-20260929-before-ddl.sql` 已生成【实】。**剩余**：推送后的新增提交待再次 push、镜像与本机同盘、写接口与 M2 迁移脚本未实现 | `backend-plan.md` §五、本方案 §G-1 |
| 8 | 如何用 Git 管理多 Agent 协作变更 | **部分解决** | 规范已定稿：`main` 单分支 + 文件级职责隔离（不用多分支）+ 小步提交 + 禁止 `git add -A` + 危险命令护栏 + tag 节奏。已多次提交、建备份分支、**`c792b03` 推送成功**、Skill 源码入库并打 tag `skill-english-daily-v2.2.0`【实】。**剩余**：推送之后新增的本地提交待再次 push（清单以 git-manager 终版推送清单为准） | `git-plan.md` §二、§三；本方案 §E-0 |

**统计**：已解决 4 项（1/3/4/5），部分解决 4 项（2/6/7/8），未解决 0 项。

---

## C. 契约对齐矩阵

### C.1 12 个 schema × 落点 × 状态

| 契约对象 | 主要落点 | 对应 API | 状态 |
|---|---|---|---|
| `AgentSnapshot` | 合成（多表聚合） | `GET /api/agent/snapshot` ❌404 | ⚠️ 待实现 |
| `LessonRecord` | `lessons` + `lesson_sections` + `lesson_vocabulary` | `POST /api/lessons`、`PUT /api/lessons/:id` ❌ | ⚠️ 待实现 |
| `LessonPlan` | **不落库**（课内中间对象，设计如此） | — | ✅ |
| `TeachingBlock` | `lesson_sections(section_type='grammar'\|'vocab_table')` + `vocabulary` | `GET /api/lessons/:id`✅ | ✅（`objectives`/`expected_mistakes` 两枚举值 S1 已批准；`expectedMistakes` **入库但前端不渲染**，见 D-17） |
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
| D-6 | 课号基准：任务书「Level 2 Lesson 5」vs 仓库实际 | **已完成 1—6 课，下一课为第 7 课**（`lessonNo:7` / `grammarPoint.code='L2-07'` / `backfill.seq:4` / `vocabularySize:8`）。amy 方案 §四示范场景**已改写为主场景「第 7 课」**，原「第 8 课」内容整段降为 §4.6 预案。**连锁结论**：第 7 课生词量因 `E_6=5` 触发 T-1 降载，由 `amy-session-07-plan.md` 的 10 调整为 **8**，该文件尚待同步 | `progress.md:107`、`notes/day-01-07.md:626` 互相印证【静】；§四已改写【实：章节标题核对】 |
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
| D-17 | `expectedMistakes`（备课预期错误）学生端是否展示 | **不展示**，但**字段仍入库**（`section_type='expected_mistakes'`，供 Amy 批改时生成「为什么不是 Y」文案与课后复盘）。理由：它是 `wrong→correct` 成对的**答案清单**，提交前展示等于提前给答案（违反 `ai-teacher.md` 1.3 硬规则 2）；提交后展示又与批改视图（F5）重复，且未发生的预判错误会以错误形态反向出现（负向记忆）。**分界线：规则可给（`selfChecks`），答案不可给。** 前端若已按 F10 预留展示位，改为不渲染，**不用不可见占位** | amy `amy-teaching-plan.md` 附录 B.1；与 D-10（S1 入库）不冲突 |
| D-18 | 「降载」触发阈值与档位如何定 | **采用 amy §2.7 的 T-1—T-6 触发 + L0/L1/L2/LX 四档**。触发（任一命中即降载，多命中取最高档）：T-1 单课 `E_{N-1}≥5`／T-2 连续 2 课 `E≥5`／T-3 `F_{N-1}=too_hard`／T-4 断更 `D≥7`／T-5 复发阻断（存在 `wrongCount≥4` 且 `error_type∈{grammar,word_choice}` 的未过关错词）／T-6 拟排生词 >12（schema 绝对上限）。档位：L0 常规（生词 10，区间 8—12）／L1 轻度（6—8）／L2 中度（0—6，不讲新点改同点变式）／LX 阻断（0 新词，产出专项）。**上限保护**：已 L2/LX 仍 `E≥5` 时不再降载，转 2.2 C3 诊断/降级评估。**退出**：连续 2 课同时 `E≤2` 且 `R=0`（无复发）且 `F∈{too_easy,just_right}` → 回 L0（第 1 课先升半档，第 2 课再回 L0）；状态写入 `next_recommendation` 可复盘。**降载 ≠ 降级**（降级只在 `too_hard` 触发） | amy `amy-teaching-plan.md` §2.7（可执行判据，供 `next-lesson-planning` 落地） |

### D.16 已核对一致的项（无冲突）

- `AgentSnapshot` 的 `pendingMistakes` 定义（`status='pending'` 的未过关错词）三方一致：amy 决策规则、skill-designer 契约、be-dev 映射。
- `backlog` 定义（4 项编号补漏队列，当前第 4 项为介词 on/at）三方一致；skill-designer 另补三条硬边界：`planned` 绝不进补漏队列、`untested` 首版恒为空数组、`seq ≥ 1`。
- `error_type` 三步判定与 19 条回归基线未被任何方案修改。
- 契约演进规则（加 optional 字段不升版本、Skill 忽略未知字段）三方一致。
- 生词量口径三方已同源：**Level 1 = 5—8**（`level-map.md:8`，正确保留）、**Level 2 常规 = 10（区间 8—12）/ 降载 = 6—8**（`level-map.md:31`）；`docs/schemas/lesson-plan.schema.json` 已对齐，`skills/english-daily/SKILL.md:59` 已改为按级别取数（`version: 2.2.1`）【实：`grep` 核对，两处副本 md5 一致】。⚠ 口径值已同源，但**降载判据本身尚未落地进 Skill**（见 §G-7 第 2/11 项、G-9）。
- `expectedMistakes` 的「入库 / 展示」职责分离三方一致（D-17）：be-dev 负责落库，skill-designer 负责在批改文案中消费，fe-dev 负责不渲染。

---

## E. 分阶段实施路线

### E-0 · 阶段 0：Git 安全（**前置，已完成；后续新增提交待下次推送**）

| 项 | 状态 | 说明 |
|---|---|---|
| `.gitignore` 补 9 项缺口 | ✅ 完成 | commit `1aca69c` |
| 提交四份方案文档 | ✅ 完成 | commit `e45c532`（+2394 行） |
| 提交 `review/index.html` | ✅ 完成 | commit `54f8330`（+93/-13） |
| 建备份分支 | ✅ 完成 | `backup/2026-09-29-before-push` → `54f8330` |
| **push 到 origin** | ✅ **已成功** | 用户的 `c792b03` **已推送成功**，远端 `refs/heads/main` = `c792b03`【实：`git ls-remote`】。此前「`Recv failure: Connection was reset` / GitHub 502」的网络出口拦截已解除，**「全部改动只在本机」的单点风险已消除** |
| **推送后的新增本地提交** | ⏳ **待下次推送** | 推送成功**之后**团队又产生了新的本地提交（amy 方案 → 集成方案 → ignore `backup-*.sql` → Skill 入库 → amy 两笔订正 → 契约落笔……）。**这不是「push 未完成」，而是「推送之后又有新提交」**；笔数随收尾提交持续增长，**此处不写死数字**，待推送清单**以 git-manager 的终版推送清单为准**【实：`git log origin/main..main`】 |
| 本地裸镜像备份 | ✅ 完成 | `D:/English-mirror.git`，已验证含全部分支与提交（**与本机同盘，防不了整盘故障**） |
| Skill 源码入库 + tag | ✅ **完成** | commit `5aab235`；`skills/english-daily/` **8 个文件**；tag `skill-english-daily-v2.2.0` 已建【实：`git tag` 检出】 |
| 4 份旧 `build_board.py` 副本处置 | ✅ **完成** | 4 份旧副本已加 `.bak-20260929` 后缀隔离（**文件名级 + 目录级双层**），**未删任何文件**。活跃副本共 **2** 份——`skills/english-daily/scripts/build_board.py` 与运行时副本 `.workbuddy/skills/english-daily/scripts/build_board.py`，**md5 均为 `50aca14b1edf40cb20404a088e4e3d14`（44415B / 1040 行）**，无旧版残留【实：`md5sum` 核对】 |
| `backup-20260929-before-ddl.sql` | ✅ 完成 | 已生成（14642B，`backend/db/`），并由 commit `7210b08` 加入 `.gitignore`（`backup-*.sql` **不入库**）【实：`ls` 核对】 |

**遗留动作**：把**推送之后新增的本地提交**再次 push 到远端（见 §G-1）。清单以 git-manager 的终版推送清单为准。

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

**可回滚点与 DDL 规程**（`c792b03` 已推送成功后，原「push 成功前不执行 DDL」的门槛解除，改用以下三条【裁决】）：
1. 执行任何 DDL 前，先确认 `backend/db/backup-20260929-before-ddl.sql` **可重放**（能成功导入一个空库）。
2. **每次 DDL 单独 commit**，commit message 内写明对应的**回滚 SQL**。
3. `backup-*.sql` **不提交进仓库**（已由 `7210b08` 加入 `.gitignore`）。

### E-2 · 阶段 2：数据模型补齐

DDL 顺序固定：先 `schema.sql` + 库内 ENUM → 再 `constants.js` → 最后 schema JSON。同批执行：`lesson_exercises`、`mistake_events` 建表；S1 两个 ENUM 值；DQ1 删 `id=19`。

**执行时适用 §E-1 的三条 DDL 规程**（backup 可重放 → 单独 commit 带回滚 SQL → `backup-*.sql` 不入库）。

### E-3 · 阶段 3：阅读与知识点

`readings`/`reading_pieces`/`reading_questions` 三表 + `/api/readings` 系列；`knowledge_points` + `lesson_knowledge_points` + `/api/knowledge-points`（G3 `backlog`）。前置：`M2` 初始导入须补写第 4/5/6 课三条 `role='backfill'` 关联，否则已出队的补漏块会被误判未完成、重新冒进第 7 课队列。

### E-4 · 阶段 4：Skill 全链路 + 前端 P3/P4

前端错词打卡（P3）与阅读模块（P4）；Skill 侧 `lesson-review` 独立入口、`learning-progress-analysis` 实现；适配层从 md 切到 backend（只改 `deploymentMode`）。

### E-5 · 阶段 5：Vue 评估（可选）

页面收敛后再评估是否重写。

### E-6 · 并行低风险小项（不阻塞主线）

| 项 | 负责 | 说明 |
|---|---|---|
| ~~`amy-session-07-plan.md` 生词量 10 → 8~~ | amy | ✅ **已完成**（commit `c3c6d05`）：第 7 课词汇改为 8，原 10 个痕迹留痕不删【实】 |
| 降载判据并入 `docs/ai-teacher.md` + 改 `SKILL.md:59` 引用指向 | amy → skill-designer | **未完成**，见 §G-9 / §G-7 第 2、11 项 |
| `review/assets/*` 与 `review/lessons/lesson.html` 入库 | fe-dev | 当前为 `??` 未跟踪态 |
| `backend/README.md` 补「4000 连接被拒 = 服务未启动，不是接口 404」 | be-dev | 见 §G-8，零风险 |

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
- [ ] 生词量口径唯一：**Level 2 = 8—12（常规 10）/ 降载 6—8**；全仓**无「5—8」残留在 Level 2 语境**（Level 1 的 5—8 保留）——当前已满足：`skills/english-daily/SKILL.md:59`、`references/level-map.md:31` 均已改【实】
- [ ] `expectedMistakes` 已入库（`section_type='expected_mistakes'`）但**前端任何页面不渲染**（D-17）

**前端**
- [ ] 每个页面的数据均来自 API，无硬编码业务数据
- [ ] 四态齐备：Loading / Error / Empty / 正常
- [ ] 新增带 `display` 的类均补了 `.<cls>.hide{display:none}`
- [ ] 可见性验证使用 `getComputedStyle().display`，未使用 class 断言
- [ ] `size=100` 已替换为 `/api/lessons/all`，且搜索未因缺 `grammarPoint` 漏词
- [ ] 11 个页面的内联 CSS/JS 重复已收敛到 `review/assets/`
- [ ] F10 位置**不留不可见占位**（防误接 `expectedMistakes` 后意外外露，D-17）
- [ ] `review/assets/*` 与 `review/lessons/lesson.html` 已纳入版本控制（当前仍为 `??`）

**Skill**
- [ ] Skill 不读文件路径、不解析 md 排版、不拼 HTML
- [ ] md 适配层是唯一接触 md 的模块
- [ ] `deploymentMode` 从 `markdown` 切到 `backend` 时 Skill 代码零改动
- [ ] Skill 能忽略未知字段；`error_type` 19 条回归全通过
- [ ] 改 Skill 前已完整备份、版本自增，正文不留版本标注
- [ ] **Skill 只引用长期稳定规则文档**（`docs/ai-teacher.md`、`references/*.md`），**不引用 `docs/plans/` 下的方案文档**——当前 `SKILL.md:59` 仍引用 `docs/plans/amy-teaching-plan.md` §2.7，**为已知断链项**（G-9），待判据并入 `docs/ai-teacher.md` 后改指向
- [ ] 全仓 Skill 文件内无 `docs/plans/` 引用残留

**Git**
- [x] `c792b03` 已推送成功，远端 `refs/heads/main` = `c792b03`（单点风险已消除）
- [ ] 推送之后新增的本地提交已再次 push（**清单以 git-manager 终版推送清单为准，不写死笔数**）
- [x] 至少一个备份分支 + 一个本地镜像存在
- [x] **双副本防漂移**：`skills/english-daily/scripts/build_board.py` 与运行时副本 `.workbuddy/skills/english-daily/scripts/build_board.py` 的 **md5 一致**（单向同步 `skills/` ⇒ `.workbuddy/skills/` 未被打破）
- [x] `skills/english-daily/` 源码已入库并打 tag `skill-english-daily-v2.2.0`
- [x] `backend/db/backup-20260929-before-ddl.sql` 已生成，且**未**提交进仓库
- [x] 4 份旧 `build_board.py` 副本已隔离（`.bak-20260929`）
- [ ] 每次 DDL 单独 commit 且 message 写明回滚 SQL
- [ ] 未使用过 `git add -A`、`reset --hard`、`push --force`

---

## G. 风险与未决问题

### G-1 · 🟢 版本安全：push 已成功，单点风险已消除

**已闭环的部分**【实】：
- **`c792b03` 已推送成功**：远端 `refs/heads/main` = `c792b03`，此前「`Connection was reset` / GitHub 502」的本机网络出口拦截已解除。**「全部改动只在本机」的单点风险已消除。**
- **Skill 源码有了版本备份**：`skills/english-daily/` 8 个文件已入库（commit `5aab235`）并打 tag `skill-english-daily-v2.2.0`。
- 备份分支 `backup/2026-09-29-before-push` 与本地镜像 `D:/English-mirror.git` 均在（镜像同盘，见下）。
- `backend/db/backup-20260929-before-ddl.sql` 已生成且不入库。

**仍开放**（均为「增量」，非「未完成」）：
- **推送之后又有新的本地提交**（`c6261e9`…`197ce8b` 等，笔数随收尾提交增长）待**下一次** push。清单**以 git-manager 的终版推送清单为准**，不要在文档里写死笔数。
```
git -C E:/English push origin main
```
- 本地镜像与备份分支**同盘同机**，防不了整盘故障【静】；若要异地冗余，需考虑外部存储（未决，见 G-7）。
- 「push 前不执行 DDL」的旧门槛**已解除**，改用 §E-1 的三条 DDL 规程。

### G-2 · 🔴 `lesson_sections` 正文缺失

库内只有 `grammar`/`feedback` 两类共 12 条【实】，意味着**阶段内复习/作业/例句/批改正文只能从 md 取**，契约里的结构化查询暂不可依赖【静：skill-plan R11】。这也解释了为什么课程全文检索现在「没有正文可搜」。

### G-3 · 🔴 历史数据可推导性（跨模块通用检查项）

skill-designer 发现一类坑：**已补过的补漏块因无记录会被判为未完成**，重新进入第 7 课队列，与 amy 已定规划（补漏块 ④ 介词 on/at）直接冲突，学生会被要求重做已出队的三块。同类问题在 `lessons` 表的作业/例句正文（R11）、前端静态页里的历史数据（可能与 DB 现状不一致）大概率也存在。
**建议**：把「历史数据可推导性」列为每次加字段/加接口前的强制检查项——**契约定得对不对，不看类型，看历史数据能不能接上**。

### G-4 · 🟡 快照数据被当成当前状态用

诊断结论会过期且与错词本冲突（D-8）。同类风险还有：`study_records.payload` 里的 `next_recommendation` 是**当时的建议**，不一定是当前有效建议。凡「快照型数据」进契约，必须带时间戳或 `superseded` 语义。

> **同类归纳**：本条与 G-3（历史数据可推导性）、G-9（Skill 引用方案文档）同属一类——**引用对象的生命周期比引用方短**。G-9 是本轮新增的、后果最直接的一条。

### G-5 · 🟡 多副本漂移与误跑（旧副本已处置，**新增「双副本防漂移」检查项**）

权威版首页模板已是 API 驱动版【实】。真实风险不是「重建冲掉改造」，而是**误跑旧副本让首页倒退成静态页**。

**① 旧副本处置**【实：`md5sum` / `find` 核对】：
- 4 份旧副本已加 `.bak-20260929` 后缀隔离（**文件名级 + 目录级双层**），**未删任何文件**。
- 每次执行前仍须做 md5 防覆盖校验（期望 `50aca14b1edf40cb20404a088e4e3d14`）。

**② 新增隐患：入库后活跃副本从 1 份变 2 份**
- 现状：`skills/english-daily/scripts/build_board.py`（受控）与 `.workbuddy/skills/english-daily/scripts/build_board.py`（运行时），当前 **md5 均为 `50aca14b1edf40cb20404a088e4e3d14`（44415B / 1040 行）**，**无漂移**【实】。
- **成因**：团队刚把 `skills/` 纳入版本控制（commit `5aab235`），于是从「1 份活跃」变成「2 份活跃」。**这不是 git-manager 处置失败，而是入库带来的新状态。**
- **对策（团队已约定）**：`skills/`（受控）⇒ `.workbuddy/skills/`（运行时）**单向同步，方向固定，禁止反向**。
- **检查项**：**入库后两份 md5 必须一致**；不一致即说明同步方向被打破，或有人直接改了运行时副本。已纳入 §F 验收清单。

### G-6 · 🟡 未验证项（明确声明，不声称通过）

- 前端 P0 共享层（`api.js`/`ui.js`/`board.css`）**只做了语法校验**，未在浏览器真机验证行为【未】；且 `review/assets/*`、`review/lessons/lesson.html` 仍为未跟踪态（`??`）【实】。
- 新接口（`/agent/snapshot`、`/knowledge-points`、`/readings`、`POST /mistakes/:id/review`）**均未实现**，调用会 404【实】。
- **后端第一批接口未跑绿**：`backend/src/` 15 个文件处于 `M`（修改未提交），另新增 `controllers/agent.controller.js`、`routes/agent.routes.js`、`services/snapshot.service.js`、`utils/datetime.js`、`utils/json.js`（均 `??`）【实：`git status`】（`GET /api/lessons/all`、`maxSize` 放宽、`review` POST、`snapshot` 等，见 task #7）。
- 前端 P1—P4 未开工（P2 已起头 `review/lessons/lesson.html`，未验证）。
- `M2` md→DB 迁移脚本未实现。
- DDL 全部为**待确认候选**，库内未执行任何结构变更【实】。
- **推送之后新增的本地提交尚未再次 push**（清单以 git-manager 终版推送清单为准）【实：`git log origin/main..main`】。
- **已转为已完成、不再列为未验证**：①`docs/schemas/agent-snapshot.schema.json` 补两个 optional 字段并复跑 `SCHEMA_OK`（objects 68→71）【实】；②`lesson-plan.schema.json` 生词量描述已改「Level 2 常规 10（8—12）、降载 6—8」【实】；③**生词量口径问题已修复**——`skills/english-daily/SKILL.md:59` 已改为按级别取数（`version:` 已 bump 到 `2.2.1`），`references/level-map.md:31`（Level 2）已改「8—12（常规 10），触发降载时 6—8 个」【实：`grep`】。⚠ **`level-map.md:8` 的「5—8」是 Level 1 行，正确，不是残留**；④降载触发条件已由 D-18 补齐（**但判据尚未落地进 Skill，见 G-9 与 §G-7 第 2/11 项**）。

### G-7 · 未决问题（按「已关闭 / 仍开放」重排）

**✅ 已关闭**（关闭依据均已成文或经实测）

| # | 问题 | 关闭依据 |
|---|---|---|
| 1 | `expectedMistakes` 学生端是否展示 | **不展示**，字段仍入库。依据：amy 附录 B.1 + 本方案 D-17。前端若已预留 F10 展示位，改为不渲染、**不留不可见占位** |
| 3 | `SKILL.md` 第 5 步生词量「5—8」与 `progress.md` 8—12 冲突 | amy 附录 B.2 裁定「Level 2 常规 10（8—12）/ 降载 6—8；5—8 仅 Level 1 成立」。**实测已修**：`SKILL.md:59` 已改为按级别取数、`references/level-map.md:31`（Level 2）已改【实：`grep`】。⚠ 注意 `level-map.md:8` 的「5—8」是 **Level 1 行，正确，不是残留**，勿当漏改 |
| 4 | amy 方案 §四示范场景课号 | 已由「第 8 课」改写为主场景「第 7 课」（`L2-07`），第 8 课内容降为 §4.6 预案。依据：D-6 |
| 6 | `.workbuddy/` 排除策略与副本处置（Q3/Q4/Q8/Q9） | 副本处置已完成（`.bak-20260929` 隔离）【实】；`.workbuddy/` 走方案 A——新建 `skills/english-daily/` 只入库 8 个源文件、`.workbuddy/` 整体忽略，已落地 commit `5aab235`。依据：D-14 |
| 8 | `amy-session-07-plan.md` 生词量 10 → 8 待同步 | **已完成**（commit `c3c6d05`）：第 7 课词汇改为 **8**，砍掉 `worked`/`visited`，原 10 个痕迹留痕不删。依据：D-6 / D-18【实：`git show --stat c3c6d05` + `grep`】 |

**🟡 仍开放**

| # | 问题 | 等谁 | 是否阻塞 |
|---|---|---|---|
| 2 | **降载判据（T-1—T-6 / L0-L1-L2-LX）尚未落地进 Skill** | amy → skill-designer | **已裁定但未落地**。判据已写在 `amy-teaching-plan.md` §2.7，但**只进了结果值（生词 8），没有进 Skill / `docs/ai-teacher.md`**；amy 正把 §2.7 并进 `docs/ai-teacher.md`（教学规则唯一来源），之后 `next-lesson-planning` 才能实现。另 `SKILL.md:59` 现引用的正是 `docs/plans/amy-teaching-plan.md`，见 **G-9** |
| 5 | `revisedAnswer` / S1 两枚举值的 schema 落笔 | skill-designer / be-dev | 不阻塞。JSON schema 侧工作区已改（`grading-result.schema.json` 等 `M`）；**DDL 未执行**【未】 |
| 7 | 是否配置常驻后端服务（pm2 / 计划任务） | 用户 | 不阻塞。**建议先做低成本文档提示**（见 §G-8） |
| 9 | 后端第一批接口未跑绿 | be-dev | 阻塞 P3/P4 与快照类功能。见 §G-6 |
| 10 | 是否需异地冗余（现镜像与本机同盘） | 用户 | 不阻塞。见 §G-1 |
| 11 | **Skill 引用会归档的方案文档（断链）** | amy → skill-designer | 阻塞 Skill 长期稳定。见 **G-9**；需把判据并入 `docs/ai-teacher.md` 后改引用指向 |

### G-8 · 🟡 后端服务易被误判为故障

后端进程随会话结束被回收【实】，导致 amy 曾误判「4 个接口全 404」。**建议在 `backend/README.md` 明确写出特征：4000 连接被拒 = 服务没启动，不是接口 404**。低成本、零风险。是否配常驻进程属环境变更，需用户决定。

### G-9 · 🔴 Skill 引用了「会归档」的方案文档（断链隐患）

**问题**：`skills/english-daily/SKILL.md:59` 写「降载判据见 `docs/plans/amy-teaching-plan.md` §2.7」【实：`grep`】。但 `docs/plans/` 是**方案目录**，按项目约定方案属阶段性产物、会归档或移动。**方案一移动，Skill 就断链**。

**正确做法**：把判据并进 `docs/ai-teacher.md`（**教学规则唯一来源**），再把 `SKILL.md` 的引用改为指向它。amy 已在执行。

**教训（须记档）**：**Skill 只能引用「长期稳定的规则文档」，不能引用「方案文档」。**

**同类归纳**：本条与 G-3（历史数据可推导性）、G-4（快照数据被当状态用）**是同一类问题**——**引用对象的生命周期比引用方短**。凡跨对象引用，先问一句：**被引用物会不会先消失或先过期？**

---

## 附：本次汇总的证据边界与订正记录

**初稿**：本文由 team-lead 汇总（commit `39186cb`），其结论来自 5 份角色方案与其内部标注的证据，成文时**未经各角色复核**。5 名角色曾于 2026-09-29 17:07 因 API 频率限制（429）暂停。

**第一轮订正**（2026-09-29 17:34，integration-synth）：复核全篇并更新以下章节——§B（Q1/Q2/Q3/Q6/Q7/Q8）、§D（更新 D-6；新增 **D-17** `expectedMistakes` 不展示、**D-18** 降载机制；§D.16 补两条同源项）、§E-0（重写为「已基本闭环，余一次 push」）、§E-1 / §E-2（新增三条 DDL 规程）、§E-6（新增并行小项）、§F（数据段 +2 项、前端段 +3 项、Git 段按实测重排）、§G-1（改为「通道已通，尚差一次 push」）、§G-5（改为已处置）、§G-6（新增后端未跑绿、移除已修项）、§G-7（按「已关闭 / 仍开放」重排）。

**第二轮订正**（2026-09-29 17:45，integration-synth，按 team-lead 逐条核对结论落笔）：team-lead 复核实测后，否定了第一轮中 1 处误读、确认 1 处新增隐患、并新增 1 条断链隐患。本轮改动：
- **§E-0 / §G-1 / §B(Q7,Q8)**：「push 未完成」是**误读**，已改为「`c792b03` 已推送成功、单点风险已消除；此后新增本地提交待下次推送」。**删除所有写死的待推送笔数**（第一轮写的「4 个提交」已过期），统一改为「以 git-manager 的终版推送清单为准」。
- **§G-5 / §F(Git)**：新增「**双副本防漂移**」隐患与检查项——`skills/` 入库（`5aab235`）后活跃副本从 1 份变 2 份（成因），对策为 `skills/` ⇒ `.workbuddy/skills/` **单向同步禁止反向**，检查项为两份 **md5 必须一致**。
- **§G-7**：第 2 项由「已关闭」**改回仍开放**（降载判据**已裁定但未落地进 Skill**）；第 8 项 `amy-session-07-plan.md` 生词量已由 commit `c3c6d05` 同步为 8，**关闭**；新增第 11 项（Skill 断链）。⚠ 明确 `level-map.md:8` 的「5—8」是 **Level 1 行，不是残留**。
- **新增 §G-9 · 🔴 Skill 引用了会归档的方案文档（断链隐患）** 与 §G-4 的同类归纳：`SKILL.md:59` 引用 `docs/plans/amy-teaching-plan.md` §2.7，而 `docs/plans/` 会归档；教训为「**Skill 只能引用长期稳定的规则文档，不能引用方案文档**」，并归入「引用对象生命周期比引用方短」这一类（与 G-3、G-4 同类）。
- **§F(Skill)** 新增两条：Skill 不引用 `docs/plans/`；全仓 Skill 文件内无 `docs/plans/` 残留。

**订正依据**：本机实测（`git ls-remote`、`git rev-list --left-right`、`git log`、`git show --stat`、`git status`、`md5sum`、`find`、`wc`、`grep`、`sed`、`ls`）与 amy《教学决策规则方案》附录 B / §2.7 的成文裁定，以及 team-lead 的逐条核对结论。**未修改除本文件外的任何文件。**

**两轮共 5 条实测发现**（与初稿不一致，已按实测回写）：
1. **push 状态**（第一轮误读、第二轮纠正）：远端 `refs/heads/main` = `c792b03`，**该点已推送成功**；此后又有新的本地提交产生。正确的表述是「推送成功后有新提交待下次推送」，**不是「push 未完成」**，且**不写死笔数**（笔数随收尾提交增长，以 git-manager 终版推送清单为准）。
2. **活跃 `build_board.py` 副本为 2 份**（非初稿所述 1 份）：`skills/english-daily/scripts/` 与 `.workbuddy/skills/english-daily/scripts/`，二者 md5 均为权威值 `50aca14b…`，**当前无漂移**；成因是 `skills/` 入库，对策见 §G-5 ②。
3. **生词量口径问题已修复**（初稿 §G-6 末条已过期）：`SKILL.md:59` 已改为按级别取数（`version: 2.2.1`），`level-map.md:31`（Level 2）已改；`level-map.md:8` 的「5—8」是 Level 1 行、正确。
4. **前端共享层与 `lesson.html` 仍未入库**（`??`），初稿「已提交进工作区」应按「已落盘、未跟踪」理解；真机验证仍未做【未】。
5. **Skill 引用了会归档的方案文档**（断链隐患，本轮最有价值的发现）：`SKILL.md:59` → `docs/plans/amy-teaching-plan.md` §2.7，见 §G-9。

凡标注【未】的项均**未执行验证**，不得视为通过。若后续复核发现与本文不一致，以**角色方案的原始证据**为准，并回写本文。
