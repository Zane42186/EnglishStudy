# SKILL-DESIGNER-STATUS.md — Skill 设计工作状态

> 角色：Skill 设计师（`AGENTS.md` §3.2）
> 更新时间：**2026-10-01 19:10**（本机 `date` 实测）
> 末次工作：**`POST /mistakes` 载荷口径同步 R3 + A15 判重键订正**（be-dev §6.12「仍待」#1/#2，附录 A **第十轮**）—— §2.3 映射改「不整体上送」、§2.5/§3.7/`mistake.schema.json` 判重键 4 处去 `errorType`（改 `normKey` 三步）、§3.7 新增「上送口径（R3）」块、§4.4 去「Step 2a 待实现」；`SCHEMA_OK` 结构零变更
> 提交状态：我方累计 **8 个文件已入库**（`14718d6` 4 份 → `0e2d3fa` 2 份 → `9a66dc6` 行 14 的 3 份 schema + skills.md 第九轮）；**余 2 份契约待提交**（附录 A **第十轮**：`docs/skills.md` + `docs/schemas/mistake.schema.json`）＋ 本状态文档（持续更新）
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
| 9 | **`english-daily` 升 v2.6.0**：阅读理解题答案必填 | ① `SKILL.md` 第六章新增「每道理解题的答案必填」（归档自检「题数 ≥2 且答案非空」，**不达标该篇整体重写、不产 `null`/空串**）；② `references/course-template.md` 阅读模板补同一条；③ `reading-set.schema.json` 的 `answer` 补 `description`（`type/minLength` 原本已禁 null，**契约结构未改**）；④ `docs/skills.md` 3.1 异常情况新增「答案缺失 / 题数不足 → 重写该篇」 | `diff -r` 受控源 vs 副本**无差异**；两侧 `version: 2.6.0`；`.workbuddy/build/check_schemas.py` → `SCHEMA_OK (files=12 refs=85 objects=535)`（**注**：同名脚本有两份、口径不同，受控的 `docs/schemas/check_schemas.py` 为 `objects=71`，见 §1.3 O）【已实测】 |
| 10 | 附录 A 第六轮变更记录 | `docs/skills.md` 附录 A 记录 v2.6.0 四层落点与只读核查结论；7.3 补后续版本注 | 【静态证据】 |
| 11 | 文档镜像收尾（多轮） | 修 8 处废弃表名（`user_progress`→`progress`、`courses`→`lessons`）；版本引用统一；降级矩阵 2 行改写；0.5/0.6 去「生成脚本」路径 | 【静态证据】 |
| 12 | **文档订正（路由 / 表名 / 陈旧列引用，2026-10-01）** | `docs/skills.md` §2.3 / §6 / §4.2：`POST /courses`→`POST /lessons`、`course_sections`→`lesson_sections`、`exercises`→`lesson_exercises`、`course_id`→`lesson_id`，并注明 `POST/PUT /lessons` 为 **Step 2a 待实现**；**§4.2 G5** 与 `docs/schemas/lesson-record.schema.json` 去掉不存在的 `courses.study_minutes`；附录 A 补「第七轮」 | 【静态证据】 |
| 13 | **`english-daily` 升 v2.7.0**：归档步产出 `LessonRecord`（Step 2a 归属 ①） | `SKILL.md` 第 8 步扩为**三件产出**（写 md + 更新错词本 + 产出 `LessonRecord`）；第九章自查 +1；第十一章依赖 +`lesson-record.schema.json`；目录树补 `record.json` | 受控源与运行副本 `diff -r` **无差异**、均 `2.7.0`；备份 `english-daily-v2.6.0-20261001/`【已实测】 |
| 14 | **契约描述订正（附录 A「第九轮」，2026-10-01）**：废弃/未建表名 + G1 过时描述 | `common.schema.json` **4 处**（`exercises.`→`lesson_exercises.`；`progress_feedback.feedback`→`progress.last_feedback` 并注「规划中、尚未建」；`skill_runs` 两处补注；`MistakeItem` 判重口径写准）；`grading-result.schema.json` **1 处**（`exercises.error_note`→`lesson_exercises.error_note`）；`agent-snapshot.schema.json` **2 处**（G1 由「缺口未补」改为「已闭环」）；`docs/skills.md` 附录 A 新增「第九轮」 | `docs/schemas/check_schemas.py` → `SCHEMA_OK (files=12 refs=85 objects=71)`，**与 `git archive HEAD` 三数逐项一致** → 结构零变更；12 个 JSON `json.load` 全过【已实测】 |
| 15 | **`POST /mistakes` 载荷口径同步 R3 + A15 判重键订正（附录 A「第十轮」，2026-10-01 19:10）** | ① §2.3 映射：`MistakeAnalysisResult` **不整体上送**，原始条目（8 列 + 顶层 `lessonNo`）→ `POST /mistakes`；② §2.3 注：2a/2b **均已实现**（`05` #28/#29/#30，总数 **30**）+ R3 三不传；③ §3.7 新增「**上送口径（R3）**」块（服务端判重累加、Skill 不得自行累加落库、DQ1 → 400）；④ §4.4 去「Step 2a 待实现」+ `POST /mistakes` 行补 R3；⑤ **A15：判重键 4 处去 `errorType`**（`skills.md` §2.5/§3.7×2 + `mistake.schema.json`，改 `normKey` 三步） | 对应 be-dev §6.12「仍待」#1/#2 回执；`SCHEMA_OK (files=12 refs=85 objects=71)` 结构零变更；残留扫描：旧口径文本零命中（余 3 处命中均属变更记录本身）【已实测】 |

> **✅ 提交进度（2026-10-01，`git log` / `git diff --name-only` 实测）**：
> - **已入库 6 份** → `14718d6 feat(skill): english-daily 升 v2.6.0（阅读答案必填）+ skills.md 契约同步`（行 9/10/11 的 4 份：`SKILL.md`、`references/course-template.md`、`reading-set.schema.json`、`docs/skills.md`）＋ `0e2d3fa docs(schemas): 订正两处指向废弃表/不存在列的陈旧引用`（行 12 的 2 份：`common.schema.json`、`lesson-record.schema.json`）。
> - ⚠️ **提交信息与内容不符（登记）**：`14718d6` 题名只写 v2.6.0，但该提交快照里 `SKILL.md` 已是 **`version: 2.7.0`** —— **v2.7.0 与 v2.6.0 同批进了同一个提交**。建议 `docs/changelog.md` 补记时**两个版本都写**（或注明「v2.7.0 随 `14718d6` 一并入库」）。
>
> **✅ 提交进度（2026-10-01 19:10 复测，`git log` 实测）**：
> - `14718d6`（4 份）→ `0e2d3fa`（2 份）→ **`9a66dc6 docs(schemas): 契约描述订正（废弃/未建表名 + G1 已闭环）+ skills.md 附录A 第九轮记录`**（= 行 14：3 份 schema + skills.md 第九轮，`+26/−8` 与我 17:40 实测逐字节一致）。
> - be-dev Step 2b 批次亦已入库（`5a0d263` 后端 ×7 ／ `1c9b90c` `write-api-check` MW1—MW16 ／ `27c9703` `05` **§30** + be-dev-status §6.12）→ `05` **#28 / #29 / #30 已在库**。
>
> **仍未提交（2 份契约 + 本状态文档）**：`docs/skills.md`（附录 A **第十轮**：R3 同步 + A15）、`docs/schemas/mistake.schema.json`（同轮）、`docs/Work Alignment/SKILL-DESIGNER-STATUS.md`（持续更新）。✅ 均已定稿，待 git-manager 以**显式路径**提交（**禁 `git add -A`**）；**注**：be-dev 的 W1/W2 已自行收口，不卡这批。

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
| K | **`docs/schemas/` 仍引用 4 个「不存在的表」**（§3.1#4 漂移核查所得）。实测 `backend/db/schema.sql` = **13 表 + 2 视图**，`levels` / `exercises` / `progress_feedback` / `skill_runs` **零命中** → ① 2 处 `exercises.*`（**废弃 18 表稿残留**，＝ §1.3 I「同类残留」的第 7/8 处，**我上轮漏改**）；② 1 处 `levels.code`（**无此类表**）；③ 3 处引 P2 规划表（**未注明「尚未建」**） | ✅ **①②③ 中的「废弃名」与「补注记」已修**（2026-10-01，第九轮）：2 处 → `lesson_exercises.*`；`progress_feedback.feedback` → `progress.last_feedback` + 注「规划中、尚未建」；`skill_runs` 两处补注。**⚠️ 唯一未改：`common.schema.json:8` `levels.code`** —— 负责人拍板「**先与后端确认再定**」，已备好问法（§四 be-dev⑤）【已实测：`schema.sql` 表清单一跑 + `grep -rn` 全目录 + `SCHEMA_OK`】 |
| L | **`agent-snapshot.schema.json` 两处 G1 描述已过时**：`:59` `recentLessons[].errorCount`、`:95` `errorTrend` 均仍写「**对应文档缺口 G1，后端补上前由适配层推算 / 可缺省**」，但 `GET /api/lessons/error-trend` **已实现**（`05` 接口清单 #6），`05 §21` 实测响应已带 `errorCount: 5` 与 `errorTrend.byLesson[].byType`（2026-09-30 回填第 1—6 课） | ✅ **已修**（2026-10-01，第九轮）：两处改为「**G1 已闭环**」并写明数据来源与「无数据时省略 `byType` 键」。**仅改描述、结构不动**【静态证据：`05:391-392`、`05:410-411`；已实测 `SCHEMA_OK`】 |
| M | **`agent-snapshot.schema.json` `progress` 契约缺口**：`05 §21` 实测返回 `progress.currentLessonNo` 与 `progress.nextLessonNo`，而契约 `progress` 只登记 `currentLevel / currentCourseNo / lastFeedback / easyStreak / upgradeFrozenUntil / lastClassDate`（**两键未登记**）→ Skill 侧目前只能按「课号 = 最大课号 + 1」自算，用不上后端已给的 `nextLessonNo` | ⏳ **未改**（与 `levels` 同口径处理）：补**可选键**属契约追加（加字段本不升版本），但**须先与 be-dev 确认取值稳定性**（尤其 `currentCourseNo` / `currentLessonNo` 两个命名空间的取值约定）→ §四 be-dev⑥【静态证据：`05:379-381`】 |
| N | `common.schema.json:104` `MistakeItem` 描述「**`wrongText` 与 `correctText` 是判重与判过关的唯一依据**」表述不精确（`correctText` 根本不吃判重） | ✅ **已修**（2026-10-01，第九轮）：改为「**判重键是 `wrongText`**（库唯一键 `uk_mistakes_text`）；**判过关看 `streak`**（连对 2 次）；`correctText` **不参与判重**」——与 `records/README.md`、`ai-teacher.md` §11 三处同源【静态证据】 |
| O | **同名脚本双副本、统计口径不同**（核 K—N 时差点误判成「写死错常数」，先跑两份才避开）：`.workbuddy/build/check_schemas.py` 输出 `objects=535`，受控的 `docs/schemas/check_schemas.py` 输出 `objects=71`；两份**代码不同**（前者 `walk` 为生成器、`SCHEMA_DIR` 用 `__file__.parents[2]`；后者读 `sys.argv[1]` 或 `docs/schemas`）；另有旧副本 `.workbuddy/build.bak-20260929/`（口径同 71）。`docs/schemas/` 那份脚本历史**仅 `74b0382` 一次提交、从未改过** | ⏳ **登记待拍板**：两份文档各引一份（`skills.md` §6.3/第三轮引 build 版 → 535；`schemas/README.md` + `plans/skill-plan.md` 引受控版 → 71），**数字看似矛盾实则各自自洽** → 是否**收敛为单一受控副本**？（与「受控源唯一」原则同型，参考 `build_board.py` 多副本的历史教训） |
| P | **`refs=84` 已陈旧、现为 85**：`docs/schemas/README.md:100`、`docs/plans/skill-plan.md:15` 仍写 `SCHEMA_CHECK files=12 refs=84 objects=71`，实测 **85** | ⏳ **未改**：两处均**不在**当前 8 份提交批内；`skill-plan.md` 本来就有挂账待办（§3.1#5 加时点注记）→ 建议**随那一批一并更**，避免重复触同一文件 |

---

## 二、进行中事项

| # | 事项 | 当前状态 | 卡在哪 |
|---|---|---|---|
| 1 | **G4 `lastIncomplete` 闭环** | Skill 侧运行时条文**已就位**（第 4 步判重与列口径、第七章「运行时必做」均已按 §11 落好） | **不卡后端**——卡在 Amy 下次写记录时带上 `next_recommendation`。上线速度取决于那一刻，不取决于后端排期【推断：依据 §11.9 未落地项表与后端 8.2 答复】 |
| 2 | **下一课（第 7 课）的 Skill 侧准备** | 已就绪：课号 = 最大课号 + 1、断更不断号；1 个语法点（规则动词过去式）+ 补漏块 ④ 介词 on/at | 等 Amy 上课触发【静态证据：`docs/skills.md` 3.1、`/api/progress → nextLessonNo=7`】 |
| 3 | **本次会话的文档收尾** | git-manager **已入库 8 个我方文件**（`14718d6` / `0e2d3fa` / `9a66dc6`）；**余 2 份契约**待提交（附录 A 第十轮：`docs/skills.md` + `mistake.schema.json`）＋ 本状态文档（持续更新） | 转由 git-manager 提交余下 2 份（负责人转达） |

---

## 三、待完成事项

### 3.1 我可独立完成（待排期 / 待你确认优先级）

| # | 事项 | 说明 | 优先级 |
|---|---|---|---|
| 1 | **3 独立 Skill 拆分**：`lesson-review`、`learning-progress-analysis` 由「内嵌于 daily-lesson」独立为可单独触发的 Skill | `docs/skills.md` 7.3 的长期演进项；当前 6 个内嵌能力可用，这两个仍**不能独立触发** | 中 |
| 2 | SKILL.md 第九章「质量自查清单」补一条**阅读答案自检**（题数 ≥2 且答案非空） | v2.6.0 只写进了第六章运行时规则，自查清单尚未同步 | 低 |
| 3 | `docs/skills.md` 8.2 与 7.x 的**数字口径**同步（`mistakes` 19→23、`error_type` 10 填 / 24 NULL 等） | 属文档数字更新；Amy 明确指定 `amy-teaching-plan.md` 的历史数字**单独一批处理** | 低 |
| 4 | ~~核实 `docs/schemas/` 与 `backend/docs/05-api-reference.md` 是否仍有字段级漂移~~ **✅ 已核查并已修（2026-10-01，附录 A 第九轮）** | **结构层干净**：`reading-set` ↔ `POST /api/readings` 逐字段一致（`date` 的**真日历守卫**已由 `05` 显式声明为「刻意比 schema 更严」）。查出 **4 处不存在的表 + 2 处 G1 过时描述 + 1 处契约缺口 + 1 处措辞** → **已修 7 处（§1.3 K/L/N）**；**2 处待后端确认**（K 的 `levels.code`、M 的 `progress` 两键）；顺带另查出 **O（同名脚本双副本 535/71）/ P（`refs=84` 陈旧）** | ✅ 已结项（余项 → §四 be-dev⑤⑥） |
| 5 | `docs/plans/skill-plan.md`（**我作者的方案稿**）陈旧数字（`wrong-words.md` 19 行 / 20 条错词）→ 加「时点快照（2026-09-29）」注记 | 字面 `mistakes=20` 命中的 3 份 plans（backend / frontend / integration）**非我**，仅此份属我 | 低 |

### 3.2 需其他 agent 交付（我做不了）

| # | 事项 | 归属 | 我的依赖 |
|---|---|---|---|
| 1 | 提交**余下 2 个契约文件**：`docs/skills.md`、`docs/schemas/mistake.schema.json`（附录 A 第十轮：R3 载荷口径 + A15 判重键）＋ `docs/Work Alignment/SKILL-DESIGNER-STATUS.md`；`docs/changelog.md` **补记 v2.3.0 / 2.4.0 / 2.5.0 / 2.6.0 / 2.7.0**（⚠️ **v2.7.0 实际已随 `14718d6` 入库，但该提交题名只写 v2.6.0** → 补记时两个版本都要写） | **Git 工程师** | 授权已给（负责人 2026-10-01 17:34；其后我方 8 文件已分三批入库）；**显式路径**、文件级隔离、禁 `git add -A`。**注**：be-dev 的 W1/W2 已自行收口，不再等我的提交 |
| 2 | `lesson_exercises.error_type` 回填（现 10 填 / 24 NULL） | **Amy**（人工判定） | 我只保证契约与运行时规则正确，判定数据须 Amy 出 |
| 3 | `build_board` 残留清理（实测 **23 文件 / 110 行**） | 各文档自有人 | 我只清了 `skills/` 与 `docs/skills.md` 的**真实依赖**；其余均为历史叙述，建议保留 + 时点注记 |
| 4 | `check_instance.py` —— ❗**全仓（含 `.workbuddy/tmp/`）实测不存在** | **待负责人拍板** | `find -iname "check_instance*"` 零结果，与 GIT §四#8「仍在 `.workbuddy/tmp/`」**冲突**（be-dev「全仓无此文件」正确）→ 撤销该条 or 新建，待定 |

---

## 四、需其他 agent 确认或配合（示意说明）

| 对象 | 需确认 / 配合的事项 | 我需要对方给什么 | 当前状态 |
|---|---|---|---|
| **Amy** | ① v2.6.0 的「答案必填、缺则该篇重写、不产 null」是否符合她 §11.10 的承诺；② 下次写记录带上 `next_recommendation` 以闭合 G4；③ `error_type` 人工判定回填 | ① 点头确认；② 写记录时带该字段；③ 判定结果 | ① 已按交办执行，**待复核**；②③ 进行中 |
| **后端 be-dev** | ① `reading_questions.answer` 是否补 `NOT NULL`（API 层已挡，库列仍 NULL-able）；② 确认 2.5 的 DDL 与我文档描述一致（我核查为**已落地**）；③ G3 `backlog` 待 `knowledge_points` 建表；④ ~~Step 2a 的 `LessonRecord` 产出者边界~~ **✅ 已裁决＝①**；**⑤ `common.schema.json:8` 的 `levels.code` 该指哪里**（实测**无 `levels` 表**；级别实际存于 `lessons.level_code` / `progress.current_level` 两处 VARCHAR —— 是**改指这两列**，还是后端有计划建 `levels` 表？）；**⑥ `GET /api/agent/snapshot` 的 `progress.currentLessonNo` / `nextLessonNo` 取值是否稳定**（契约现未登记这两键，若稳定我补为**可选键**，Skill 侧就不必再自算「课号 = 最大 + 1」；另请顺带确认 `currentCourseNo` 与 `currentLessonNo` 两个命名空间的对应关系） | ① 一句「补 / 不补」；② 确认；③ 建表排期；**⑤ 一句落点**；**⑥ 一句「稳定 / 不稳定」+ 两命名空间对应** | ①② 待答复；③ 后端排期；④ ✅ 已裁决；**⑤⑥ 本轮新增，待答复** |
| **前端 fe-dev** | §11.10 前端三条行为（去掉「看答案」按钮 / 中性缺陷文案 / `console.warn` 告警）是否在 `review/reading.html` 落地 | 确认即可 | ✅ **已落地（2026-10-01 fe-dev 回执，第四轮）**：无答案题不出 `<details class="qbox">`、文案「参考答案缺失（数据异常，已记录）」、`console.warn`（一次会话去重）+ 登记 `window.__readingDefects`；mock 断言 32/32。真实数据 `missingTotal=0`，该分支暂只有 mock 证据 |
| **Git 工程师** | **已入库我方 8 个文件**（`14718d6` 4 份 → `0e2d3fa` 2 份 → `9a66dc6` 3 份 schema + skills.md 第九轮，**感谢**）；**余 2 份契约**待提交：`docs/skills.md`、`docs/schemas/mistake.schema.json`（附录 A **第十轮**）＋ 本状态文档；另 `docs/changelog.md` 补记 v2.3.0—**2.7.0** | ① 以**显式路径**提交（禁 `git add -A`）；② changelog 里 v2.6.0 与 v2.7.0 **两个都写**（`14718d6` 题名只写了 v2.6.0） | ⏳ 待 git-manager 执行（负责人转达） |
| **Amy** | ① v2.6.0 的「答案必填、缺则该篇重写、不产 null」是否符合她 §11.10 的承诺；② 下次写记录带上 `next_recommendation` 以闭合 G4；③ `error_type` 人工判定回填；④ **刷新 `docs/ai-teacher.md` 的成组废弃命名**（23 行，见 §1.3 J，建议与「6 处旧数字」合并一次做）；⑤ **`records/README.md` 补一行 `lesson-NN.record.json`**（v2.7.0 新增产出，见 §1.2 行 13） | ① 点头确认；② 写记录时带该字段；③ 判定结果；④⑤ 文档刷新 | ① 已按交办执行，**待复核**；②③ 进行中；④⑤ 新增 |
| **team-lead / 项目负责人** | ① `build_board` 历史叙述处理口径；② `check_instance.py` 是否新建；③ 本表待办优先级；**④（§1.3 O）`check_schemas.py` 同名双副本（`.workbuddy/build/` 535 vs `docs/schemas/` 71）是否收敛为单一受控副本** | 指派与优先级；④ 一个「收敛 / 保留 + 注明」的决定 | 待拍板 |
| ✅ **已拍板（2026-10-01 17:40）** | **⑦ `docs/schemas` 漂移（§1.3 K—N）修复时机 = 现在就修、并入当前批次**（→ 批次 6 份扩为 **8 份**）；**⑧ `levels.code` 落点 = 先与后端确认再定**（→ 已转为 §四 be-dev⑤，我**未动**该行） | — | ✅ 即刻生效 |
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
| 15 | `be-dev-status.md` §6.12（经负责人转达） | **Step 2b 完成**：`POST /api/mistakes`（载荷 = **R3「只喂原始条目」**：错词本 8 列 + 顶层 `lessonNo`；`normKey` 上移共享、写接口与迁移器共用；`wrong_count` 人工值覆盖 + 差异逐条告警；DQ1 括号批注 → 400；`test:write` **123** / `test:api` **49** / `db:compare` 15/0/0）。「仍待」#1 = 我方 `§2.3/:190` 与 `§4.4/:1203` 同步；#2 = **A15 判重键 4 处漏改**；#3 = 命中时 `first/last_lesson_id` 不刷新（独立决策） | ✅ **已回执（2026-10-01 19:10，附录 A 第十轮 / §1.2 行 15）**：**#1 / #2 均已同步落文档**（§2.3 映射改「不整体上送」+ §3.7 新增「上送口径（R3）」块 + 判重键 4 处去 `errorType` 改 `normKey` 三步）；**#3 未动** —— 「最近犯错课是否随复发刷新」牵动 §11.2 出题排序（N-1/N-3/N-7）与快照 `lastCourseNo` 语义，**须 Amy 权威侧先表态**、且迁移器与写接口**两条路径一起**改 → 只登记 |

**小结**：15 条中 —— **已完成 5 条**（#8、#9 及 §四 已闭环、#13 v2.7.0 落地）、**已收并回执 5 条**（#10 主张属实·建议 ①、#11 口径一致、#12 复核通过、#14 复核通过、**#15 Step 2b 同步落文档**）、**已拍板 1 条**（#13 相关的负责人裁决）、**我方可答「已定稿」1 条**（#1）、**卡点已消 2 条**（#5/#6 —— be-dev 已自行收口）、**需后续处理 2 条**（#2/#3）、**待拍板 1 条**（#4）。

**备注（他方文档过时 / 口径不一，均未代改）**：
- 🔎 **2026-10-01 快照：be-dev 的 Step 2a 正在施工**（`git diff --name-only` 实测 7 个 `backend/**` 文件在飞：`migration/import_json.js`、`scripts/write-api-check.js`、`controllers/lesson.controller.js`、`repositories/lesson.repository.js`、`routes/index.js`、`routes/lesson.routes.js`、`services/lesson.service.js`）→ **纯登记，我界外**；但提醒 git-manager：**提交余下 4 份时勿用 `git add -A`**，否则会卷进他人在飞改动。
- 🔎 同期 `docs/ai-teacher.md` 有改动（Amy 侧在改）—— 与我 §1.3 J 挂账的「23 行废弃命名 + 6 处旧数字」是否同批未知，**我不代问不代改**。
- `be-dev-status.md` §一D / §一B8 写 `verify-frontend-shared` **35/35** → 实际 **36/36**（fe-dev 第五轮补 `renderMarkdown` 回归）。
- `GIT-MANAGER-STATUS.md` §〇/§一 的「领先 33 提交」「8 个 in-flight」均为 **09-30 19:36 快照**，已过时（`HEAD` 现为 `25fc26f`）。
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
