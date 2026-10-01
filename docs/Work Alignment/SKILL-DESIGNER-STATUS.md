# SKILL-DESIGNER-STATUS.md — Skill 设计工作状态

> 角色：Skill 设计师（`AGENTS.md` §3.2）
> 更新时间：**2026-10-01 17:40**（本机 `date` 实测；上轮标 18:05 系估值，此处校正）
> 末次工作：**`docs/schemas/` × `backend/docs/05-api-reference.md` 字段级漂移核查**（§1.3 K—N，待拍板）
> 数据来源：`git status / log` 实测 + 受控源 `skills/english-daily/` 与 `docs/skills.md`、`docs/schemas/` 现场核对 + 共享日志 `.workbuddy/memory/2026-09-30.md`
> 可信度标注：**【已实测】**= 本机跑过；**【静态证据】**= 文件/代码可定位但未运行；**【推断】**= 由证据推导；**【未验证】**= 尚未执行
>
> 职责范围（我负责）：`skills/english-daily/**`（受控源，唯一真源）、`docs/skills.md`（Skill 契约）、`docs/schemas/*.schema.json`（JSON 契约）、`.workbuddy/skills/english-daily/`（运行副本，**单向**同步）
>
> 边界声明：本角色**不改 `backend/**`、`review/**`、`docs/ai-teacher.md`（Amy 权威）、`docs/changelog.md`**；不实现后端接口；不把 `error_type` 判定自动化。协作链：Amy 定规则 → 我落契约与运行时 → 后端 → 前端。

---

## 一、已完成事项

### 1.1 已提交（git 已捕获）【已实测】

| # | 事项 | 交付物 | 提交点 / 证据 |
|---|---|---|---|
| 1 | Skill 源码入库 + 受控源单向同步机制 | `skills/english-daily/` 确立为唯一真源；`.workbuddy/skills/` 为运行副本，方向**单向**、禁止反向 | `5aab235`、`87ee73e` |
| 2 | `build_board.py` 退役 HTML 生成 | 脚本头部标注退役，受控源与副本同步 | `87ee73e` |
| 3 | **`build_board.py` 删除 + 全量清引用**（v2.3.0） | 受控源 + 运行副本各删一份；`skill-dependencies.json` 移 2 能力、`setup-guide.md` 5 处、`course-template.md` 4 处、`init_workspace.py` 1 处 | `fe24d2a`；两侧 `grep` 零命中【已实测】 |
| 4 | **补漏块归置口径**（2.5 节 + 契约侧） | `common.schema.json` 的 `SectionType` **末尾**追加 `backfill`、新增 `ExerciseBlockKind`；`exercise-set` 增 `blockNo`；`lesson-record.ExerciseRecord` 增 `blockKind`/`blockNo` | `4ebd4fc`、`814293a`；`check_schemas` → `SCHEMA_OK`【已实测】 |
| 5 | **`english-daily` 升 v2.4.0** | SKILL.md 新增**第七章「错词本 8 列」**（`错误点` 只写错误形式、禁括号批注；`类型`/`累计犯错` 禁止推导）；第 6 步「收作业」补 **`records/*.json` 硬性产物**；`init_workspace.py` 模板 6→8 列；`docs/skills.md` 输出表补 records 两行、流程 11→10 步、架构图去「生成脚本」路径 | `dd38b34`（含 v2.4.0 与 v2.5.0 两部分） |
| 6 | **`english-daily` 升 v2.5.0**：§11.2—§11.5 镜像 + 运行时最小条文 | 修掉**取题排序漂移**（3.1/3.2 由「按 `priority` 取题」改为 §11.2 四位制**教学排序**，并明写服务端 `priority` 只用于展示排序）；3.6 补 G1/G4/G5/G6 批改细则；3.7 补 `error_type` 判定指针；SKILL.md 第七章新增「运行时必做」5 条 | `dd38b34`、`814293a`；四项验收全过【已实测】 |
| 7 | 判重键字段更正 | `docs/skills.md` 3.6 两处 + `mistake.schema.json` 一处，由误写的 `correctText` 改为 **`wrongText`**（与 `ai-teacher.md` §11、`records/README.md`、DB 唯一键 `uk_mistakes_text` 三处对齐） | `814293a`【静态证据】 |
| 8 | 导出器解耦 | `export_md_to_json.py` 默认解析目录改受控 `<root>/skills/english-daily/scripts`（后由后端改造为**自包含**，不再 import `build_board`） | 后端侧落地；负向验证通过【已实测】 |

### 1.2 已完成、尚未提交（等你 / Git 工程师确认后提交）

| # | 事项 | 交付物 | 证据 |
|---|---|---|---|
| 9 | **`english-daily` 升 v2.6.0**：阅读理解题答案必填 | ① `SKILL.md` 第六章新增「每道理解题的答案必填」（归档自检「题数 ≥2 且答案非空」，**不达标该篇整体重写、不产 `null`/空串**）；② `references/course-template.md` 阅读模板补同一条；③ `reading-set.schema.json` 的 `answer` 补 `description`（`type/minLength` 原本已禁 null，**契约结构未改**）；④ `docs/skills.md` 3.1 异常情况新增「答案缺失 / 题数不足 → 重写该篇」 | `diff -r` 受控源 vs 副本**无差异**；两侧 `version: 2.6.0`；`check_schemas` → `SCHEMA_OK (files=12 refs=85 objects=535)`【已实测】 |
| 10 | 附录 A 第六轮变更记录 | `docs/skills.md` 附录 A 记录 v2.6.0 四层落点与只读核查结论；7.3 补后续版本注 | 【静态证据】 |
| 11 | 文档镜像收尾（多轮） | 修 8 处废弃表名（`user_progress`→`progress`、`courses`→`lessons`）；版本引用统一；降级矩阵 2 行改写；0.5/0.6 去「生成脚本」路径 | 【静态证据】 |
| 12 | **文档订正（路由 / 表名 / 陈旧列引用，2026-10-01）** | `docs/skills.md` §2.3 / §6 / §4.2：`POST /courses`→`POST /lessons`、`course_sections`→`lesson_sections`、`exercises`→`lesson_exercises`、`course_id`→`lesson_id`，并注明 `POST/PUT /lessons` 为 **Step 2a 待实现**；**§4.2 G5** 与 `docs/schemas/lesson-record.schema.json` 去掉不存在的 `courses.study_minutes`；附录 A 补「第七轮」 | 【静态证据】 |
| 13 | **`english-daily` 升 v2.7.0**：归档步产出 `LessonRecord`（Step 2a 归属 ①） | `SKILL.md` 第 8 步扩为**三件产出**（写 md + 更新错词本 + 产出 `LessonRecord`）；第九章自查 +1；第十一章依赖 +`lesson-record.schema.json`；目录树补 `record.json` | 受控源与运行副本 `diff -r` **无差异**、均 `2.7.0`；备份 `english-daily-v2.6.0-20261001/`【已实测】 |

> **本轮 4 个未提交文件**（`git status` 实测）：`skills/english-daily/SKILL.md`、`skills/english-daily/references/course-template.md`、`docs/schemas/reading-set.schema.json`、`docs/skills.md`。
>
> ✅ **此 4 份已定稿**（2026-10-01 复核）：`git diff --stat` = `+29 / −6`，`SKILL.md` 头 `version: 2.6.0`。待 git-manager 以**显式路径**提交；**它们正是 be-dev §二 W1 / W2 的卡点**，一经入库即可复查。

### 1.3 只读核查（发现即登记，未越界改）

| # | 发现 | 处置 |
|---|---|---|
| A | **§11.2 取题排序漂移**：3.1/3.2 原写「按 `priority` 高→低」= 服务端**展示排序**，与 §11.2 的 Amy **出题排序**不是一回事 | ✅ 已修（v2.5.0） |
| B | **判重键写错字段**：3 处写 `correctText`，应与 `wrongText` 对齐 | ✅ 已修 |
| C | **2.5 节申请的 DDL 后端已落地**：`lesson_exercises` 已有 `block_kind`(190)、`block_no`(192)、`uk_exercise(lesson_id, block_kind, block_no, exercise_no)`(211)；`lesson_sections.section_type` 末尾已有 `backfill`(69) | ✅ 无需后端再做【静态证据】 |
| D | **`POST /api/readings` 已实现 `answer` 非空校验**：`backend/src/services/reading.service.js:143-144`（提交 `5932365`），拒绝非字符串与空串 | ✅ 契约 / API / 运行时三层均已堵住，无需后端再做 |
| E | **残余落差（仅登记）**：`reading_questions.answer` 库列仍为 `TEXT NULL`（`schema.sql:288`）、导出器缺 `<details>` 回落空串 `""` | ⏳ 纵深防御可选加固，**是否补 `NOT NULL` 由后端定夺** |
| F | **`build_board` 提及仍遍布多份文档**（GIT 记「18 文件」口径已过时） | 🔎 2026-10-01 实测 **23 文件 / 110 行**；**属我的 2 份**（`docs/skills.md` 17 处、`docs/plans/skill-plan.md` 27 处）**逐行核对全为历史叙述、无真实依赖**（`skills/` 与消费方 `grep` 零命中）→ 按文件级职责隔离**未动他人文件**，待各自认领 |
| G | **`docs/skills.md` §2.3/§6/§4.2 仍用废弃路由与表名**（`POST /courses`、`course_sections`、`exercises`、`course_id`）—— 与 `05-api-reference.md`（`/api/lessons*`）、`schema.sql`（`lesson_sections`/`lesson_exercises`）不一致 | ✅ **已订正**（2026-10-01：`lessons` / `lesson_sections` / `lesson_exercises` / `lesson_id`，并标注 Step 2a 待实现；见 `docs/skills.md` 附录 A 第七轮） |
| H | **两处 `courses.study_minutes` 陈旧引用**（`docs/skills.md` G5 行、`docs/schemas/lesson-record.schema.json:81`）—— 实测 `schema.sql` **无 `courses` 表**、`study_minutes` **零命中**（表与列都不存在）；由 be-dev 复核后报回 | ✅ **已订正**（2026-10-01，两处一起修；改为「**当前无落库列** → G5 维持降级，加列属 R2 议题」） |
| I | **同类残留不止一处**：`docs/skills.md` 另有 4 处 `course_knowledge_points`（491/497/648/733）+ 1 处 `course_vocabulary`（575），`docs/schemas/common.schema.json:53` 1 处 `course_knowledge_points` —— **be-dev 只报了 575 一处**，我查全后为 **6 处** | ✅ **已一并订正**（2026-10-01：→ `lesson_knowledge_points` / `lesson_vocabulary`，并注明两表**规划中、尚未建**；附录 A 第七轮同步） |
| J | **`docs/ai-teacher.md` 成组使用废弃命名**（`courses` / `course_sections` / `course_vocabulary` / `course_knowledge_points` / `GET /courses/latest` / `POST /courses` / `PUT /courses/:id`，实测 23 行；另 `:265` 写 `courses.study_minutes`（**已有字段**）与实测矛盾）。**Amy 的权威文档，我不越界** | ⏳ 已登记并**交 Amy**（建议与已挂账的「`ai-teacher.md` 6 处旧数字」**合并为一次文档刷新**）—— §11.9 原则：「源头不清、镜像先清」＝修反方向，故源头必须一并修 |
| K | **`docs/schemas/` 仍引用 4 个「不存在的表」**（执行 §3.1#4 漂移核查所得）。实测 `backend/db/schema.sql` = **13 表 + 2 视图**，`levels` / `exercises` / `progress_feedback` / `skill_runs` **零命中**：<br>① `common.schema.json:28` `exercises.exercise_type`、② `grading-result.schema.json:29` `exercises.error_note` —— **废弃 18 表稿残留**（①②即 §1.3 I「同类残留」的第 7/8 处，**我上轮漏改**；正解 = `lesson_exercises.exercise_type` / `.error_note`，库内 `schema.sql:206/216` 且该表注释已写「与 `common.schema.json` 同源」）；<br>③ `common.schema.json:8` `levels.code` —— **无此类表**，级别实际散落在 `lessons.level_code` / `progress.current_level` / `reading_pieces.level_code`（均 VARCHAR）；<br>④ `common.schema.json:13` `progress_feedback.feedback`、`:73` `skill_runs.status` —— 属 **P2 规划表、尚未建**，却未像 `KnowledgeRole`(:53) 那样注明 | ⏳ **待拍板后修**（①②④ 改法明确＝纯文字订正 / 补「规划中、尚未建」；③ **需定落点**——见 §四 待拍板⑦）【已实测：`schema.sql` 表清单一跑 + `grep -rn` 全目录】 |
| L | **`agent-snapshot.schema.json` 两处 G1 描述已过时**：`:59` `recentLessons[].errorCount`、`:95` `errorTrend` 均仍写「**对应文档缺口 G1，后端补上前由适配层推算 / 可缺省**」，但 `GET /api/lessons/error-trend` **已实现**（`05` 接口清单 #6），`05 §21` 实测响应已带 `errorCount: 5` 与 `errorTrend.byLesson[].byType`（2026-09-30 回填第 1—6 课） | ⏳ 待修（**仅更新描述、不动结构**；属 PATCH）【静态证据：`05:391-392`、`05:410-411`】 |
| M | **`agent-snapshot.schema.json` `progress` 契约缺口**：`05 §21` 实测返回 `progress.currentLessonNo` 与 `progress.nextLessonNo`，而契约 `progress` 只登记 `currentLevel / currentCourseNo / lastFeedback / easyStreak / upgradeFrozenUntil / lastClassDate`（**两键未登记**）→ Skill 侧目前只能按「课号 = 最大课号 + 1」自算，用不上后端已给的 `nextLessonNo` | ⏳ 登记待议（补**可选键**属「加字段不升版本」；是否改用 `nextLessonNo` 需先与 be-dev 确认取值稳定性 —— 见 §四 待拍板⑧）【静态证据：`05:379-381`】 |
| N | `common.schema.json:104` `MistakeItem` 描述「**`wrongText` 与 `correctText` 是判重与判过关的唯一依据**」表述不精确 | ⏳ 待修：判重键 = **`wrongText`**（库唯一键 `uk_mistakes_text`、`records/README.md`、`ai-teacher.md` §11 三处同源）；判过关 = **`streak`（连对 2 次）**；`correctText` **不参与**判重（`records/README.md` 与 `ai-teacher.md` §11）【静态证据】 |

---

## 二、进行中事项

| # | 事项 | 当前状态 | 卡在哪 |
|---|---|---|---|
| 1 | **G4 `lastIncomplete` 闭环** | Skill 侧运行时条文**已就位**（第 4 步判重与列口径、第七章「运行时必做」均已按 §11 落好） | **不卡后端**——卡在 Amy 下次写记录时带上 `next_recommendation`。上线速度取决于那一刻，不取决于后端排期【推断：依据 §11.9 未落地项表与后端 8.2 答复】 |
| 2 | **下一课（第 7 课）的 Skill 侧准备** | 已就绪：课号 = 最大课号 + 1、断更不断号；1 个语法点（规则动词过去式）+ 补漏块 ④ 介词 on/at | 等 Amy 上课触发【静态证据：`docs/skills.md` 3.1、`/api/progress → nextLessonNo=7`】 |
| 3 | **本次会话的文档收尾** | **6 个文件**待提交（**已授权**）；本状态文档已出 | 转由 git-manager 提交（负责人转达） |

---

## 三、待完成事项

### 3.1 我可独立完成（待排期 / 待你确认优先级）

| # | 事项 | 说明 | 优先级 |
|---|---|---|---|
| 1 | **3 独立 Skill 拆分**：`lesson-review`、`learning-progress-analysis` 由「内嵌于 daily-lesson」独立为可单独触发的 Skill | `docs/skills.md` 7.3 的长期演进项；当前 6 个内嵌能力可用，这两个仍**不能独立触发** | 中 |
| 2 | SKILL.md 第九章「质量自查清单」补一条**阅读答案自检**（题数 ≥2 且答案非空） | v2.6.0 只写进了第六章运行时规则，自查清单尚未同步 | 低 |
| 3 | `docs/skills.md` 8.2 与 7.x 的**数字口径**同步（`mistakes` 19→23、`error_type` 10 填 / 24 NULL 等） | 属文档数字更新；Amy 明确指定 `amy-teaching-plan.md` 的历史数字**单独一批处理** | 低 |
| 4 | ~~核实 `docs/schemas/` 与 `backend/docs/05-api-reference.md` 是否仍有字段级漂移~~ **✅ 已核查（2026-10-01 17:40）** | **结论：有，但结构层干净**。`reading-set` ↔ `POST /api/readings` **逐字段一致**（含 schema `questions` `min/maxItems=2` ↔ 服务端「恰好 2 道」；`date` 真日历守卫由 `05` 显式声明为「刻意比 schema 更严」，非漂移）；`agent-snapshot` 结构亦对齐。查出 **4 处不存在的表引用（§1.3 K）+ 2 处 G1 过时描述（L）+ 1 处契约缺口（M）+ 1 处措辞（N）** → 待拍板后修 | 中 → **待拍板（§四⑦⑧）** |
| 5 | `docs/plans/skill-plan.md`（**我作者的方案稿**）陈旧数字（`wrong-words.md` 19 行 / 20 条错词）→ 加「时点快照（2026-09-29）」注记 | 字面 `mistakes=20` 命中的 3 份 plans（backend / frontend / integration）**非我**，仅此份属我 | 低 |

### 3.2 需其他 agent 交付（我做不了）

| # | 事项 | 归属 | 我的依赖 |
|---|---|---|---|
| 1 | 提交我的 **6 个文件**；`docs/changelog.md` 补记 v2.3.0 / 2.4.0 / 2.5.0 / 2.6.0 / **2.7.0** | **Git 工程师** | 授权已给（负责人 2026-10-01 17:34）；**显式路径**、文件级隔离、禁 `git add -A`。**注**：be-dev 的 W1/W2 已改为直接内容核验、**自行收口**，不再等我的提交 |
| 2 | `lesson_exercises.error_type` 回填（现 10 填 / 24 NULL） | **Amy**（人工判定） | 我只保证契约与运行时规则正确，判定数据须 Amy 出 |
| 3 | `build_board` 残留清理（实测 **23 文件 / 110 行**） | 各文档自有人 | 我只清了 `skills/` 与 `docs/skills.md` 的**真实依赖**；其余均为历史叙述，建议保留 + 时点注记 |
| 4 | `check_instance.py` —— ❗**全仓（含 `.workbuddy/tmp/`）实测不存在** | **待负责人拍板** | `find -iname "check_instance*"` 零结果，与 GIT §四#8「仍在 `.workbuddy/tmp/`」**冲突**（be-dev「全仓无此文件」正确）→ 撤销该条 or 新建，待定 |

---

## 四、需其他 agent 确认或配合（示意说明）

| 对象 | 需确认 / 配合的事项 | 我需要对方给什么 | 当前状态 |
|---|---|---|---|
| **Amy** | ① v2.6.0 的「答案必填、缺则该篇重写、不产 null」是否符合她 §11.10 的承诺；② 下次写记录带上 `next_recommendation` 以闭合 G4；③ `error_type` 人工判定回填 | ① 点头确认；② 写记录时带该字段；③ 判定结果 | ① 已按交办执行，**待复核**；②③ 进行中 |
| **后端 be-dev** | ① `reading_questions.answer` 是否补 `NOT NULL`（API 层已挡，库列仍 NULL-able）；② 确认 2.5 的 DDL 与我文档描述一致（我核查为**已落地**）；③ G3 `backlog` 待 `knowledge_points` 建表；④ **Step 2a 的 `LessonRecord` 产出者边界**（见 §五#10） | ① 一句「补 / 不补」；② 确认；③ 建表排期；④ 认领边界 | ①② 待答复；③ 后端排期；④ 待负责人裁决 |
| **前端 fe-dev** | §11.10 前端三条行为（去掉「看答案」按钮 / 中性缺陷文案 / `console.warn` 告警）是否在 `review/reading.html` 落地 | 确认即可 | ✅ **已落地（2026-10-01 fe-dev 回执，第四轮）**：无答案题不出 `<details class="qbox">`、文案「参考答案缺失（数据异常，已记录）」、`console.warn`（一次会话去重）+ 登记 `window.__readingDefects`；mock 断言 32/32。真实数据 `missingTotal=0`，该分支暂只有 mock 证据 |
| **Git 工程师** | 提交我的 **6 个文件**（已定稿，**授权已给** —— 负责人 2026-10-01 17:34 确认，由其本人转达）：`docs/skills.md`、`docs/schemas/reading-set.schema.json`、`docs/schemas/lesson-record.schema.json`、`docs/schemas/common.schema.json`、`skills/english-daily/SKILL.md`、`skills/english-daily/references/course-template.md`；`docs/changelog.md` 补记 v2.3.0—**2.7.0** | 提交方式与实际提交点（**显式路径**、禁 `git add -A`；文件级隔离，勿卷他人在飞改动） | ⏳ 待 git-manager 执行（负责人转达） |
| **Amy** | ① v2.6.0 的「答案必填、缺则该篇重写、不产 null」是否符合她 §11.10 的承诺；② 下次写记录带上 `next_recommendation` 以闭合 G4；③ `error_type` 人工判定回填；④ **刷新 `docs/ai-teacher.md` 的成组废弃命名**（23 行，见 §1.3 J，建议与「6 处旧数字」合并一次做）；⑤ **`records/README.md` 补一行 `lesson-NN.record.json`**（v2.7.0 新增产出，见 §1.2 行 13） | ① 点头确认；② 写记录时带该字段；③ 判定结果；④⑤ 文档刷新 | ① 已按交办执行，**待复核**；②③ 进行中；④⑤ 新增 |
| **team-lead / 项目负责人** | ① `build_board` 历史叙述处理口径；② `check_instance.py` 是否新建；③ 本表待办优先级 | 指派与优先级 | 待拍板 |
| **待拍板（新增，2026-10-01 17:40）** | **⑦ `docs/schemas` 漂移（§1.3 K—N）的修复时机**：现在修（并入当前 6 文件批次 → 变 7 文件 / 另开一批）还是只登记；**⑧ `levels.code`（不存在的表）改指何处** | 一个「修 / 不修 / 何时修」的决定 + `levels` 落点 | ⏳ 待拍板 |
| ✅ **已拍板（2026-10-01 17:34）** | **⑤ Step 2a 归属 = ①**（Skill 归档步产出 `LessonRecord`）；**⑥ 写路径切换点 = 第 8 课**；**③ 我方 5 文件提交授权** | — | ✅ 即刻生效 |

---

## 五、跨角色文档核查结论（2026-10-01，`docs/Work Alignment/` 6 份）

> **来源**：对目录内 5 份他方状态文档 + 1 份他方临时稿逐一通读，提取「需 Skill 设计师配合」的事项并**独立复核**（`git grep` / `git status` / `find` / 读源码），不采信转述。
> **说明**：本节结论原载临时稿 `_TEMP-skill-designer-核查.md`，已同步至此，**该临时稿已删除**。

| # | 来源 | 事项 | 核查结论 |
|---|---|---|---|
| 1 | `GIT-MANAGER-STATUS.md` §四#2 / §三A.2 | 8 个 in-flight 文件何时定稿（含我 4 文件） | ✅ 我方可答「**已定稿**」；⚠️ 该「8 个」为 09-30 19:31 快照，**已过时** |
| 2 | `GIT-MANAGER-STATUS.md` §四#6 / §三B | `docs/plans/*.md` 仍写 `mistakes=20` | ⚠️ 字面命中 3 份（backend / frontend / integration）**均非我**；**我所有**的 `skill-plan.md`（作者=Skill 设计师）含陈旧 19/20 → 见 §三 3.1#5 |
| 3 | `GIT-MANAGER-STATUS.md` §四#7 / §三B | `build_board` 多文件提及，区分历史 vs 真实依赖 | 🔎 实测 **23 文件 / 110 行**；**属我 2 份**（`docs/skills.md` 17、`docs/plans/skill-plan.md` 27）**逐行核对全为历史叙述、无真实依赖** |
| 4 | `GIT-MANAGER-STATUS.md` §四#8 / §三B | `check_instance.py` 未提升为受控文件 | ❗ **全仓（含 `.workbuddy/tmp/`）无此文件**（`find` 零结果）→ 与 GIT 描述冲突，**待负责人拍板**（撤销该条 or 新建） |
| 5 | `be-dev-status.md` §四B.1 / §二W1 | `docs/skills.md` 提交后通知 be-dev 做 W1 判重键复查 | ⏳ **卡在我提交**（已改完待提交）；判重键已在 v2.5.0 改对 |
| 6 | `be-dev-status.md` §四B.2 / §二W2 | `reading-set.schema.json` 提交后通知 be-dev 做 W2 对齐 | ⏳ **卡在我提交**（v2.6.0 补 `answer.description`，**契约结构未变**） |
| 7 | `be-dev-status.md` §四B.3 | `backend/docs/06-api-requirements-amy.md` 与 `docs/plans/*` 需求状态表过时 | ⚠️ **非我文件**（be-dev 仅报告）→ 仅登记 |
| 8 | `status-amy.md` §四4.2 B1—B4 | drop-in 清单 / 错词本两列 / `records/*.json` / 阅读答案必填 | ✅ **四条实际均已完成**：B1=v2.5.0（`dd38b34`+`814293a`）、B2/B3=v2.4.0（`dd38b34`）、B4=v2.6.0（**待提交**）→ Amy 可改标 ✅ |
| 9 | `_TEMP-fe-dev-核查.md` §二#3 / §八 | 我 §四「前端 fe-dev」行：§11.10 是否落地 | ✅ fe-dev 回执**已落地**（第四轮）→ §四上表该行已标 ✅ |
| 10 | `be-dev-status.md` §6.3 / §6.6⑤（经负责人转达） | **Step 2a**：`sections`/`vocabulary`/`exercises` 须由**导出器改产 `LessonRecord` 形状** → 点名 **Skill 设计师**；后端只「按契约实现 + 自测」 | ⚠️ **已收，边界待裁决**：契约（`lesson-record.schema.json` §description、`docs/skills.md` §3.1 第 8 步）明确 **`LessonRecord` 的产出者 = `daily-lesson`**；而 `export_md_to_json.py` 在 **`backend/**`（我界外）** → 需裁决「改 Skill 归档步 / 还是动后端导出器」（见 §四 拍板 ⑤） |
| 11 | `be-dev-status.md` §6.6⑤ | **Step 2b**：`wrong_count` 双源冲突 → 约定「**batch 人工值为准（覆盖写）；`review` 只增量 + 逐条告警**」；2b 未实现故暂不写 `05-api-reference.md` | ✅ **口径与我侧一致**（错词本「`累计犯错` 只人工判定、禁推导」+ §11）；**待 2b 落地时我同步契约镜像**（`mistake.schema.json` / `docs/skills.md` 3.6·3.7） |
| 12 | `be-dev-status.md` §6.7（经负责人转达） | be-dev **逐条实测复核**我的三条主张 → **全部属实**；承认其「导出器」措辞歧义；**裁决建议 ①（改 Skill 归档步）并明确反对 ②**；另提**写路径「双写」新问题**（`POST /lessons` 与 `db:export→db:import` 写同三表） | ✅ 已收。**我同意 ①**：契约（`schema:5`「daily-lesson 归档一步的产物」+ `skills.md` §3.1 第 8 步 + §2.3）已写明产出者=`daily-lesson`；② 会让 `export_md_to_json.py` 由「历史回填工具」变成**第二产出者**（双源，且其语义「md 派生→snapshot」方向与契约相反）。**「双写」口径见 §四 拍板 ⑥**（我的建议：切换点=第 8 课、md **仍产出但不入写路径**） |
| 13 | **项目负责人裁决（2026-10-01 17:29 / 17:34）** | 阶段 B 的 md 口径：**「仍产出、不入写路径」**（否决「不再产出」）；**17:34 再确认 2a 归属 = ①、切换点 = 第 8 课、5 文件提交授权** | ✅ **已拍板** → md 口径已写入 `docs/skills.md` **§7.2「写路径切换口径」** 与附录 A 第七轮；**① 即刻生效：我开工「归档步产出 `LessonRecord`」**（见 §二） |

| 14 | `be-dev-status.md` §6.8（经负责人转达） | be-dev 确认我的两处修复已落地；**更正**：其 W1/W2 **已改为直接内容核验、自行收口**（不再等我提交）；另报 `skills.md:575` 与 `ai-teacher.md` 23 行同类残留；**不主张现在加 `lessons.write_source`**，改提零 DDL 兜底「`db:import` 对 `lesson_no ≥ 8` 跳过并告警」 | ✅ 已收。①我**复核并扩大**：`skills.md` 同类残留实为 **5 处**（含 575）+ `common.schema.json` 1 处 → 已全修（§1.3 I）；②`ai-teacher.md` 归 **Amy**（§1.3 J）；③**接受其 `write_source` 结论**（不在 Step 2a 加列 + 零 DDL 兜底）——兜底脚本 `db:import` 属后端，我只登记；④ W1/W2 更正见 §三 3.2#1 |

**小结**：14 条中 —— **已完成 5 条**（#8、#9 及 §四 已闭环、#13 v2.7.0 落地）、**已收并回执 4 条**（#10 主张属实·建议 ①、#11 口径一致、#12 复核通过、#14 复核通过）、**已拍板 1 条**（#13 相关的负责人裁决）、**我方可答「已定稿」1 条**（#1）、**卡点已消 2 条**（#5/#6 —— be-dev 已自行收口）、**需后续处理 2 条**（#2/#3）、**待拍板 1 条**（#4）。

**备注（他方文档过时 / 口径不一，均未代改）**：
- `be-dev-status.md` §一D / §一B8 写 `verify-frontend-shared` **35/35** → 实际 **36/36**（fe-dev 第五轮补 `renderMarkdown` 回归）。
- `GIT-MANAGER-STATUS.md` §〇/§一 的「领先 33 提交」「8 个 in-flight」均为 **09-30 19:36 快照**，已过时。
- `status-amy.md` **文档内数字自相矛盾**：§1.1「26 条」/ §1.3「23 条」/ §3.1.5「20 条」（库内实测 **26**，pending 20 / passed 6）。
- `_TEMP-fe-dev-核查.md` §六 6.1—6.5 登记的跨文档过时项，**我复核属实**（已并入上表）。

---

## 六、边界声明（避免范围膨胀）

本次及此前各轮，**我明确没有做**以下事项（均属他人口径，不代改）：

- 不实现 G4 `lastIncomplete`（后端职责）；
- 不改 `records/*.json` 的生成方式（仍由 Amy 判定后写出，**脚本不推导**）；
- **不把 `error_type` 判定自动化**——§11.5 与 §11.9 明确禁止，那会复活「文本匹配产假数据」的反面案例；
- 不动 `docs/ai-teacher.md`、不动 `backend/**`、不动 `review/**`、不写 `docs/changelog.md`；
- 不同步 `amy-teaching-plan.md` 的历史数字（Amy 指定单独一批处理）。
