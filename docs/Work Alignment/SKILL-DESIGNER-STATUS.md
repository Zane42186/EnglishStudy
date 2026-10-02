# SKILL-DESIGNER-STATUS.md — Skill 设计工作状态

> 角色：Skill 设计师（`AGENTS.md` §3.2）
> 更新时间：**2026-10-02 20:02**（本机 `date` 实测）
> 末次工作：**第十五轮（`SKILL.md` 逐节通读审计，纯文档批、不动版本号）** —— 用户指出「**`SKILL.md` 工作目录的树结构都没改**」。第十四轮**只按 `review/` 关键词扫**，而 §一 目录树是树形字符 + 「前端静态页」字样、**关键词扫不到** → 本轮改为**通读全文件逐节过**，共查出 **10 处**（`SKILL.md` 8 处 + `init_workspace.py` 1 处 + `setup-guide.md` 1 处），含 `:3` `description`、§一 目录树、`records\` 树补第 4 件产出、§二 触发词、§八、§九 自查清单、§十。**根因：关键词查全 ≠ 逐节查全**
> 前次工作：**第十四轮（前端退役死引用清理，纯文档批、不动版本号）** —— 原生静态站 `review/` 于 `2e91345` 硬退役（`HEAD = 4543984`，14 文件物理删除）后，清理「教学权威文档 + 契约镜像」一侧的死引用：`docs/ai-teacher.md` **9 处**、`architecture.md` / `api.md` / `database.md` 各 1 处、`skills/english-daily/SKILL.md:67`（＋运行副本同步）、`docs/skills.md` **8 处**、计划类 3 处（含 F1 标关闭）
> 提交状态：我方累计 **9 个文件已入库**（`14718d6` 4 份 → `0e2d3fa` 2 份 → `9a66dc6` 3 份 → **`fcf3659`**）；**待提交扩为 11 份**（第十三 + 第十四 + 第十五轮）：`docs/skills.md`、`skills/english-daily/SKILL.md`（**v2.8.2**）、`docs/schemas/check_schemas.py`（合并版）、`docs/schemas/README.md`、`docs/plans/skill-plan.md`、`docs/ai-teacher.md`、`docs/architecture.md`、`docs/api.md`、`docs/database.md`、`docs/plans/amy-teaching-plan.md`、`docs/plans/backend-plan.md` ＋ 本状态文档。⚠️ `.workbuddy/skills/` 受 `.gitignore` 排除，**不在提交范围**
> 数据来源：`git status / log` 实测 + 受控源 `skills/english-daily/` 与 `docs/skills.md`、`docs/schemas/`、`backend/docs/05-api-reference.md`、库内直查现场核对 + 共享日志 `.workbuddy/memory/2026-10-02.md`
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
| 16 | **`english-daily` 升 v2.8.0 + `docs/skills.md` 镜像订正（附录 A「第十一轮」，2026-10-01 22:23）** | ① `SKILL.md` **7 处**（A—G）：判重键两处「去标点」→ `normKey` 三步 + 标点参与判重／`deploymentMode` `markdown`→`backend`（当前实况）／第 8 步补 **`exercises[].selfCheck` 必带**（§11.6 主通道）／第七章补 **§11.11 课号两列** + **上送「本次课号」口径**／G4 已落地（有值走上浮档）／第九章自查 **+2 条**（`selfCheck`、阅读答案非空）；② `version:` `2.7.0` → **`2.8.0`**；③ 受控源 → 运行副本单向同步；④ `docs/skills.md` 镜像：G1/G4 过期缺口标记 3 处、§3.7 新增 §11.11 段、§4.2 加闭环状态注、§7.2 B3 补实况、§8.2 后端行订正 3 项、版本号 3 处统一 `v2.8.0` + 后续版本链补 2 条、§6.3 加到期提示、附录 A 增第十一轮 | 受控源与运行副本 `diff -r` **无输出**、两侧 `version: 2.8.0`；`docs/schemas/check_schemas.py` → `SCHEMA_OK (files=12 refs=85 objects=71)`（本轮未动 schema）【已实测】；备份 `.workbuddy/skill-backups/english-daily-v2.7.0-20261001/` |
| 17 | **`english-daily` 升 v2.8.1：第 4 步复习回写补「调用面 + 必带课号」（附录 A「第十二轮」，2026-10-02 18:08）** | ① `SKILL.md` 第 4 步新增「**调用面**」子条：`POST /api/mistakes/:id/review`（`id` 取自 `GET /api/mistakes/pending`），body 必须带 **`lessonNo: N`** 与**确定性 `clientEventId`**；② 第七章 #6「上送课号」由只讲 `POST /mistakes` 扩为**两条写端点都必须显式带**；③ `version:` → **`2.8.1`**；④ `docs/skills.md`：§3.1 执行流程第 4 行镜像、版本号 3 处 → `v2.8.1`、§1.2「7 课」→「**9 课**实证」、§7.3 版本链补 `2.8.0→2.8.1`、§6.3 到期提示**去掉易腐行内数字**、附录 A 增第十二轮 | 回应 Amy `status-amy.md` **A23**（第 9 课 2 条复习流水 `mistake_events.lesson_id` 写成第 8 课 id 79，应为 92）；`last_lesson_id` 未受影响（两次均 `correct`，§15「`correct` 不刷」）。受控源与运行副本 `diff -r` **无输出**、两侧 `version: 2.8.1`【已实测】；备份 `.workbuddy/skill-backups/english-daily-v2.8.0-20261002/` |
| 19 | **第十四轮（2026-10-02 19:46）：原生前端退役 → 死引用清理（纯文档批）** | ① **`docs/ai-teacher.md` 9 处**（`:6`/`:21`/`:34`/`:156`/`:157`/`:462`/`:555`/`:791`/`:870`）：`review/*.html` 等 → `frontend/`（Vue 3）及路由 `/words`、`/wrong`、`/lesson/N`、`/reading`；`:34`/`:870` 性质由「生成物」订正为「手写源码」；`:791` 另补**已实测**证据；② `docs/architecture.md:22` 整条改写、`docs/api.md:78` TODO 标完成、`docs/database.md:69` 改指 `frontend/`；③ `skills/english-daily/SKILL.md:67` 旁证改指 Vue `/wrong`（**结论不变**：`WrongView.vue:145` 实测仍不传 `lessonNo`）＋运行副本同步；④ `docs/skills.md` **8 处**；⑤ 计划类 3 处（`amy-teaching-plan.md:496/:524` **F1 标关闭**、`backend-plan.md:79` 改指 + `:364` 标风险消解） | **验收【已实测】**：`ai-teacher.md` 残留仅 2 处、且均为**刻意保留的退役标注**；`diff -r` 受控源↔运行副本 **无输出**、两侧 `2.8.2`；Vue 侧行为**读源码核实**（`ReadingView.vue:87/:89/:277`、`WrongView.vue:145`、`api.js:119-126`）。**不动版本号**（纯文案/引用，零契约/规则变更）；SKILL.md 改动并入**未提交**的 2.8.2 |
| 18 | **第十三轮（v2.8.2 + 文档批，2026-10-02 18:34）：A25 五项裁定落地** | ① **O**：`docs/schemas/check_schemas.py` **重写为合并版**（build 版基底 + 补回 `required ⊆ properties`；保留自定位 `SCHEMA_DIR` / `*.schema.json` 精确 glob / 4 类枚举防回归守卫），**双量输出** `objects=71` / `nodes=535`；`docs/schemas/README.md` §五 补**两量定义表**；② **P**：`refs=84→85` 3 处；③ **O 引用点**：`docs/plans/skill-plan.md:261/:639` 由 `.workbuddy/build/` **改指受控版**，该文件另加**时点说明**；④ **R②**：`docs/skills.md` §4.2 **补登 G6/G7 两行** + 撤旧注；⑤ **T**：`SKILL.md` 第 8 步**三件→四件产出**（+ `records/lesson-NN.study-record.json`）+ `docs/skills.md` §3.1 输出表 +1 行 + `version: 2.8.2`；⑥ **U**：§4.4 `POST /study-records` 行降级为**备用路径** + 该节加**路径前缀**说明 | **验收【已实测】**：`check_schemas.py` → `files=12 refs=85 objects=71 nodes=535` + `SCHEMA_OK`，**三种调用方式结果一致**、`py_compile` 通过；**负向验证**注入 ①`required` 幽灵 ②`SectionType` 去 `backfill` ③`$ref` 断链 **三例全命中 `exit=1`**；`diff -r` 受控源↔运行副本 **无输出**、两侧 `2.8.2`；备份 `.workbuddy/skill-backups/english-daily-v2.8.1-20261002/` |
| 20 | **第十五轮（2026-10-02 20:02）：`SKILL.md` 逐节通读审计（纯文档批、不动版本号）** | 用户指出「**`SKILL.md` 工作目录的树结构都没改**」→ 改正方法：**弃用关键词扫，通读全文（269 行）逐节过**，共 **10 处**：① `:3` `description`「首页只放统计与入口、课程正文各一页」→ **首页放统计 + 课程正文**（读 `HomeView.vue:200-240` 核实：已内联 `LessonSections` + 左目录 + 上/下一课）；同句「整篇看中文」（`ReadingView.vue:252`）与「首字母索引」（`WordsView.vue:6`）**核实仍准确、不改**；② `:10` 概述「看板是静态页」→ `frontend/` Vue 3 单页应用；③ §一 目录树 `review\`（5 html）→ **`frontend\`**（`src\`/`index.html`/`serve.cjs`/`dist\` 不入库）+ **历史沿革注**（`2e91345`、路由映射）；④ §一 `records\` 树**补第 4 件 `study-record.json`** 并写清三条注释；⑤ §二 触发词行「打开 `review\index.html`…无需任何重建」→ `frontend/`（**「免重建」只对开发态成立**）；⑥ §八 `init_workspace.py` 描述去 `review`；⑦ §九 自查清单**补第 4 件产出**（原与第 8 步「四件产出」不同步）；⑧ §十 停止条件改指 `frontend/`；⑨ `scripts/init_workspace.py:59` **删 `review` mkdir**；⑩ `references/setup-guide.md:16` 改指 `frontend/` | **验收【已实测】**：`diff -r` 受控源↔运行副本 **无输出**、两侧 `2.8.2`；全目录 `grep -rn "review\|静态页\|看板\|\.html"` 剩余命中**全为合法项**；`init_workspace.py` **功能实测**（临时目录）→ `INIT_OK 新建=3`、生成 `notes/` `read/`、**未创建 `review/`**；`py_compile` 通过。**不动版本号**（纯失效事实订正，零契约/规则变更），并入**未提交**的 2.8.2。**备份**：`.workbuddy/skill-backups/english-daily-v2.8.2-20261002/runtime/`（⚠️ `.workbuddy/` 未被 git 跟踪且 2.8.2 改动未提交 ⇒ 此快照是改动前**唯一完整副本**） |

> **✅ 提交进度（2026-10-01，`git log` / `git diff --name-only` 实测）**：
> - **已入库 6 份** → `14718d6 feat(skill): english-daily 升 v2.6.0（阅读答案必填）+ skills.md 契约同步`（行 9/10/11 的 4 份：`SKILL.md`、`references/course-template.md`、`reading-set.schema.json`、`docs/skills.md`）＋ `0e2d3fa docs(schemas): 订正两处指向废弃表/不存在列的陈旧引用`（行 12 的 2 份：`common.schema.json`、`lesson-record.schema.json`）。
> - ⚠️ **提交信息与内容不符（登记）**：`14718d6` 题名只写 v2.6.0，但该提交快照里 `SKILL.md` 已是 **`version: 2.7.0`** —— **v2.7.0 与 v2.6.0 同批进了同一个提交**。建议 `docs/changelog.md` 补记时**两个版本都写**（或注明「v2.7.0 随 `14718d6` 一并入库」）。
>
> **✅ 提交进度（2026-10-01 19:10 复测，`git log` 实测）**：
> - `14718d6`（4 份）→ `0e2d3fa`（2 份）→ **`9a66dc6 docs(schemas): 契约描述订正（废弃/未建表名 + G1 已闭环）+ skills.md 附录A 第九轮记录`**（= 行 14：3 份 schema + skills.md 第九轮，`+26/−8` 与我 17:40 实测逐字节一致）。
> - be-dev Step 2b 批次亦已入库（`5a0d263` 后端 ×7 ／ `1c9b90c` `write-api-check` MW1—MW16 ／ `27c9703` `05` **§30** + be-dev-status §6.12）→ `05` **#28 / #29 / #30 已在库**。
>
> **仍未提交（11 份 + 本状态文档）**：`docs/skills.md`（第十一～**十五**轮镜像）、`skills/english-daily/SKILL.md`（**v2.8.2**，含第十三/十四/十五三轮改动）、`docs/schemas/check_schemas.py`（**合并版**）、`docs/schemas/README.md`、`docs/plans/skill-plan.md`、`docs/ai-teacher.md`、`docs/architecture.md`、`docs/api.md`、`docs/database.md`、`docs/plans/amy-teaching-plan.md`、`docs/plans/backend-plan.md` ＋ 本状态文档。✅ 均已定稿，待 git-manager 以**显式路径**提交（**禁 `git add -A`**）；✅ 第十轮的 `docs/skills.md` 与 `docs/schemas/mistake.schema.json` **已随 `fcf3659` 入库**；⚠️ `.workbuddy/skills/english-daily/` 受 `.gitignore` 排除，**不入库**。⚠️ 工作区尚有大量**他人在飞**文件（fe-dev 的 `frontend/**`、Amy 的 `notes/*`／`progress.md`／`wrong-words.md`／`INDEX.md`／`digest.md`、be-dev 的 `backend/scripts/*`、`项目书.md`、`records/*` 等）→ **只提我的 11 份 + 本状态文档**。

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
| O | **同名脚本双副本、统计口径不同**（核 K—N 时差点误判成「写死错常数」，先跑两份才避开）：`.workbuddy/build/check_schemas.py` 输出 `objects=535`，受控的 `docs/schemas/check_schemas.py` 输出 `objects=71`；两份**代码不同**（前者 `walk` 为生成器、`SCHEMA_DIR` 用 `__file__.parents[2]`；后者读 `sys.argv[1]` 或 `docs/schemas`）；另有旧副本 `.workbuddy/build.bak-20260929/`（口径同 71）。`docs/schemas/` 那份脚本历史**仅 `74b0382` 一次提交、从未改过** | ✅ **已裁并执行（2026-10-02，A25）**：**合并**为单一受控版 `docs/schemas/check_schemas.py` —— 以 build 版为基底**补回**受控版独有的 `required ⊆ properties`，同时**双量输出** `objects=71`（语义计数）/ `nodes=535`（原始计数），build 版独有的枚举防回归守卫 / 自定位路径 / 精确 glob 一并保留。**负向验证**证明两类校验均真实触发（非装饰）。⚠️ `.workbuddy/build/` 副本**仍在**（未被 git 跟踪），**删除需显式授权** |
| P | **`refs=84` 已陈旧、现为 85**：`docs/schemas/README.md:100`、`docs/plans/skill-plan.md:15` 仍写 `SCHEMA_CHECK files=12 refs=84 objects=71`，实测 **85** | ✅ **已修（2026-10-02，A25「授权直接做」）**：3 处 → `refs=85`（`docs/schemas/README.md` §五、`docs/plans/skill-plan.md:15` 与 **`:641`**，后者另补 `nodes=535` 复跑值）；`skill-plan.md` 顶部另加**时点说明**（原挂账 §3.1#5 一并清） |
| Q | **`docs/skills.md` 版本号引用三处停在 `v2.6.0`**（§1.2 `:107`、§3.1 `:260`、§6.3 `:1278`）—— 第八轮升 v2.7.0 时**只改了 §7.3**，这三处漏更；`docs/skills.md` 的版本号**散落 4 个位置**（另含 §7.3 `:1322`）→ 「改版本」是一个**需要全库 `grep` 的动作**，不是改一处 | ✅ **已修**（2026-10-01，第十一轮）：`:107` / `:260` / `:1322` → **`v2.8.0`**；`:107`「6 课实证」→ **「7 课实证」**；§7.3「后续版本」链补 `2.6.0→2.7.0`、`2.7.0→2.8.0`。⚠️ `:1278` 属 §6.3 **带日期的时点快照**，作为历史**保留 `v2.6.0` 不改** |
| R | **`docs/skills.md` §6.3 是带日期的时点快照（「截至 2026-09-29」），多行已失效**：③「与后端接口的读写联调 ❌ 未执行 / `backend/` 仅有设计稿」—— 后端已实现 **30 接口**并实测；②「实跑 6 课 / 阅读 11 篇 / 错词 23 条」；① `errorType` 走查「现有 19 条」。另 **§4.2 缺口表只登 G1—G5**，而权威 `ai-teacher.md` §9.3 为 **G1—G7**（G6 聚合快照 / G7 写接口，均已关闭） | ✅ **部分处置**（2026-10-01，第十一轮）：§6.3 **加到期提示**（列 3 处已知失效项 + 指向 `05` 与 `ai-teacher.md` §9.3/§9.4），**行内时点记录不改**（属历史证据）；§4.2 加闭环状态注并**明写「本表只登 G1—G5，权威另含 G6/G7」**。✅ **已做（2026-10-02，A25）**：§4.2 **补登 G6/G7 两行**（均标已关闭），与权威 `ai-teacher.md` §9.3 **全量对齐**；原「本表只登 G1—G5、待拍板」注**已撤**（注与行不并存）。**通则**：带日期的快照节**不该被静默改写**，但必须让它**不能误导现状**（加提示 or 指向权威） |
| T | **`records/lesson-NN.study-record.json` 在两层产出清单里都缺席**：`SKILL.md` 第 8 步写「**三件产出，缺一不可**」（md / `wrong-words.md` / `LessonRecord`），`docs/skills.md` §3.1「输出」表也只有 `grading.json` + `backfill.json`；但 `records/README.md:18` 明确该文件「**收完难度反馈后产出**」，且 `teach:sync`（`db/migration/sync_study_records.js:31/331-345` 实测）**靠它写 `progress` 7 教学列与 `study_records`** —— 没它，DB 里的级别/连击/`lastClassDate` 都不会动。**⇒ 漏在两层都漏，不是运行时滞后**（所以不属于「镜像已改、运行时漏改」那类） | ✅ **已裁并执行（2026-10-02，A25）**：**补为「四件产出」** —— `SKILL.md` 第 8 步「三件」→「**四件**」并新增该件说明（明写「它是 `progress` 7 列与 `study_records` 的**唯一写作路径**」），`docs/skills.md` §3.1 输出表 +1 行；随 **PATCH 2.8.2**（**独立于已封版 2.8.1**） |
| U | **学习记录的机制口径两说并存**：`docs/skills.md` §4.4 `:1213` 写 `POST /study-records`（**缺 `/api` 前缀**）「`daily-lesson` 下课时调用」；而实际走的是 `records/*.study-record.json` → **`teach:sync` 纯 DB 直连**（不走 HTTP）。两者结论相同但路径不同 | ✅ **已裁并执行（2026-10-02，A25）**：**现状唯一路径 ＝ `records/*.study-record.json` → `teach:sync`**；§4.4 该行降级为「**已实现、未被 Skill 调用**」的备用路径；并给该节加**路径前缀说明**（本节路径均以 `/api` 为根，一并补掉「缺 `/api`」口径）【已实测：`review/**` 对 `study-records` 零命中，调用方只有测试脚本】 |
| V | **`backend/docs/05-api-reference.md` §15 内部不自洽**：抬头写「**这是学生打卡的写路径**……故**必须**用 `clientEventId` 幂等」，而参数表写「`clientEventId`（**选填**）」；且真实前端确实不传 | ✅ **已由 be-dev 定稿（2026-10-02）**：抬头改为「**建议使用…；Skill 侧调用方必须带**」＋ 参数表保「选填」→ 区隔「API 必填性」与「调用方纪律」，不会让现有前端调用变非法。⚠️ **并纠正我方一处判断**：be-dev 实测 `review/wrong.html:191/194` **确实传了** `clientEventId`（我方先前「真实前端不传」**有误**；前端不传的是 **`lessonNo`**）——该更正**反而加固**「不必为『避免非法』而放宽措辞」的结论 |
| W | **根目录 `项目书.md`（be-dev 主责，2026-10-02 13:45 生成）含 8 处 `v2.8.0`**，其中 **5 处属「当前版本」表述**（`：313`「`version: 2.8.0`」、`:314`「已实现（v2.8.0）」、`:1286`、`:1363`、`:1491`、`:1646`「Skill 版本」）→ 随本次 2.8.1 变陈旧；另 3 处（`:82`「v2.8.0 起必须带 `selfCheck`」、`:320`「v2.8.0 关键约定」）是**历史正确表述、不必改** | ✅ **已由 be-dev 更新（2026-10-02）**：`项目书.md` 6 处 `v2.8.0` → **`v2.8.1`**，并**顺手把数据口径刷新到第 9 课**（8→9 课、45→52 题、33→39 错词等 —— 该文件生成于 13:45，而第 9 课 18:13 才入库）。**这正是我方「改版本号＝全库 grep」铁律的又一实例** |
| X | **Amy A23 的「修法 ②」笔误**：写「在 `docs/skills.md` §3.1 **第 8 步**注明同一句」—— 复习回写在**第 4 步**，第 8 步是归档 | ✅ **已按正确位置落**（`docs/skills.md` §3.1 执行流程**第 4 行**）；仅登记该笔误，避免后人照抄 |
| Y | **🔴 前端退役后，全仓 `review/` 引用的「查全」结果**（负责人只点名了 13 处，我反查全仓后另出 **11 份文件 / 180+ 处**）：`docs/backend-analysis.md` **10**、`docs/plans/frontend-plan.md` **72**、`前端工程师-工作状态.md` 27、`docs/plans/git-plan.md` 15、`be-dev-status.md` 15、`docs/plans/integration-plan.md` 10、`GIT-MANAGER-STATUS.md` 8、`docs/integration-report-01.md` 7、`docs/changelog.md` **3**、`status-amy.md` 3、`docs/amy-session-07-plan.md` 1。**另有一处假阳性**：`docs/plans/backend-plan.md:136` 的 `role=new/review/backfill` 是**枚举值**、非路径 | ⏳ **只登记、未擅改**（除自己文件外的均在册外/历史档）：`changelog.md` 是**历史台账，绝对不改**；`backend-analysis.md` 整篇是「尚无服务端」时期分析稿，**建议其主责方加时点注**；`frontend-plan.md` 其 `:39` 已有「迁移前审计快照、保留原样」声明；其余属各自状态文档。**请各主责方按同一口径处置** |

---

## 二、进行中事项

| # | 事项 | 当前状态 | 卡在哪 |
|---|---|---|---|
| 1 | **G4 `lastIncomplete` 闭环** | **✅ 已闭环（2026-10-01 实测）**：`GET /api/agent/snapshot` 返回 `lastIncomplete = {lessonNo:7, nextRecommendation:"第 8 课…"}`；Skill 侧运行时条文已同步（v2.8.0 的 F 项：**有值走 §11.2 上浮档、无值才按常规 5 题**） | ✅ 不卡后端、不卡 Amy |
| 2 | **下一课（第 10 课）的 Skill 侧准备** | 已就绪：课号 = 最大课号 + 1、断更不断号（第 9 课已闭环，`progress.current_lesson_no=9`）；自 v2.8.0 起归档多两件（**`exercises[].selfCheck` 必带**、**上送课号取本次课号**）；自 **v2.8.1** 起第 4 步复习回写**必须显式带 `lessonNo=10` 与 `clientEventId`** | 等 Amy 上课触发【已实测：`digest.md`「已上课数：9」、`teach:sync` 后 `current_lesson_no=9`】 |
| 3 | **本次会话的文档收尾** | git-manager **已入库 9 个我方文件**（`14718d6` / `0e2d3fa` / `9a66dc6` / **`fcf3659`**）；**待提交扩为 11 份**（第十三 + 第十四 + **第十五**轮）：`docs/skills.md`、`skills/english-daily/SKILL.md`（**v2.8.2**）、`docs/schemas/check_schemas.py`、`docs/schemas/README.md`、`docs/plans/skill-plan.md`、**`docs/ai-teacher.md`**、**`docs/architecture.md`**、**`docs/api.md`**、**`docs/database.md`**、**`docs/plans/amy-teaching-plan.md`**、**`docs/plans/backend-plan.md`** ＋ 本状态文档（持续更新） | 转由 git-manager 提交（负责人转达）；**只用显式路径、禁 `git add -A`**（工作区另有他人在飞文件） |

---

## 三、待完成事项

### 3.1 我可独立完成（待排期 / 待你确认优先级）

| # | 事项 | 说明 | 优先级 |
|---|---|---|---|
| 1 | **3 独立 Skill 拆分**：`lesson-review`、`learning-progress-analysis` 由「内嵌于 daily-lesson」独立为可单独触发的 Skill | `docs/skills.md` 7.3 的长期演进项；当前 6 个内嵌能力可用，这两个仍**不能独立触发** | 中 |
| 2 | ~~SKILL.md 第九章「质量自查清单」补一条**阅读答案自检**（题数 ≥2 且答案非空）~~ **✅ 已完成（2026-10-01，v2.8.0 的 G 项）** | v2.6.0 只写进第六章运行时规则；本轮第九章自查清单已 +2 条（`selfCheck` 必带、阅读答案非空） | ✅ 已结项 |
| 3 | `docs/skills.md` 8.2 与 7.x 的**数字口径**同步（`mistakes` 19→23、`error_type` 10 填 / 24 NULL 等） | **部分已做**（2026-10-01，第十一轮）：§8.2 后端工程师行 3 处过期断言已订正（`lastIncomplete` 已有值 / `error_type` 非空 **12** / `mistakes` **26 条**）；**余**：§6.3 行内时点数字按 R 行口径**保留不改**（只加到期提示）；`amy-teaching-plan.md` 的历史数字仍**单独一批** | 低 |
| 4 | ~~核实 `docs/schemas/` 与 `backend/docs/05-api-reference.md` 是否仍有字段级漂移~~ **✅ 已核查并已修（2026-10-01，附录 A 第九轮）** | **结构层干净**：`reading-set` ↔ `POST /api/readings` 逐字段一致（`date` 的**真日历守卫**已由 `05` 显式声明为「刻意比 schema 更严」）。查出 **4 处不存在的表 + 2 处 G1 过时描述 + 1 处契约缺口 + 1 处措辞** → **已修 7 处（§1.3 K/L/N）**；**2 处待后端确认**（K 的 `levels.code`、M 的 `progress` 两键）；顺带另查出 **O（同名脚本双副本 535/71）/ P（`refs=84` 陈旧）** | ✅ 已结项（余项 → §四 be-dev⑤⑥） |
| 5 | ~~`docs/plans/skill-plan.md`（**我作者的方案稿**）陈旧数字 → 加「时点快照（2026-09-29）」注记~~ **✅ 已完成（2026-10-02，第十三轮）** | 已在文件顶部加**时点说明**（2026-09-29 快照、**不含易腐行内数字**、指向 `05`/`ai-teacher.md`/`README.md` 为准），并顺手清掉 P 的 3 处 `refs` 与 O 的 2 处脚本引用；字面 `mistakes=20` 命中的另 3 份 plans（backend / frontend / integration）**非我** | ✅ 已结项 |
| 6 | **第十五轮浮出（甲）：`E:\English\review\` 空目录残留** | 该目录**已无任何文件**（`find review -type f` = **0**）、**git 未跟踪**（`git ls-files review/` 空）、mtime `2026-10-02 19:16` —— 文件确已随 `2e91345` 删除，**只剩壳**。风险：**低**（任何扫描 `review/` 的工具会看到空目录，易被误读为「还没退役」） | **待你裁定**（删目录属本地动作、**需显式授权**；授权前不动） |
| 7 | **第十五轮浮出（乙）：`init_workspace.py` 不创建 `records\`** | 该脚本建 `notes` / `read` + 3 个初始文件，但**本 Skill 要往 `records\` 写 4 类 json**。**当前非缺陷**（`records/README.md` 被 git 跟踪 ⇒ 克隆后必然存在）；**潜在缺口**＝在**仓库外工作区**或被误删时，第 6/8 步的写盘会失败 | **待你裁定**（修法＝`mkdir` 列表 +1 个 `records`，**1 行**；授权前不动） |

### 3.2 需其他 agent 交付（我做不了）

| # | 事项 | 归属 | 我的依赖 |
|---|---|---|---|
| 1 | 提交**待交 11 个文件**：`docs/skills.md`（第十一～**十五**轮镜像）、`skills/english-daily/SKILL.md`（**v2.8.2**）、`docs/schemas/check_schemas.py`（**合并版**）、`docs/schemas/README.md`、`docs/plans/skill-plan.md`、`docs/ai-teacher.md`、`docs/architecture.md`、`docs/api.md`、`docs/database.md`、`docs/plans/amy-teaching-plan.md`、`docs/plans/backend-plan.md` ＋ `docs/Work Alignment/SKILL-DESIGNER-STATUS.md`；`docs/changelog.md` **补记 v2.3.0 / 2.4.0 / 2.5.0 / 2.6.0 / 2.7.0 / 2.8.0 / 2.8.1 / 2.8.2**（⚠️ **v2.7.0 实际已随 `14718d6` 入库，但该提交题名只写 v2.6.0** → 补记时两个版本都要写） | **Git 工程师** | 授权已给（负责人 2026-10-01 17:34；其后我方 9 文件已分四批入库，第十轮的 `mistake.schema.json` 已随 **`fcf3659`** 入库）；**显式路径**、文件级隔离、禁 `git add -A`。**注**：be-dev 的 W1/W2 已自行收口；`.workbuddy/skills/` 受 `.gitignore` 排除、**不入库** |
| 2 | `lesson_exercises.error_type` 回填（**2026-10-01 实测：41 条中已填 12 条**；原「全 NULL」已不成立） | **Amy**（人工判定） | 我只保证契约与运行时规则正确，判定数据须 Amy 出 |
| 3 | `build_board` 残留清理（实测 **23 文件 / 110 行**） | 各文档自有人 | 我只清了 `skills/` 与 `docs/skills.md` 的**真实依赖**；其余均为历史叙述，建议保留 + 时点注记 |
| 4 | `check_instance.py` —— ❗**全仓（含 `.workbuddy/tmp/`）实测不存在** | **待负责人拍板** | `find -iname "check_instance*"` 零结果，与 GIT §四#8「仍在 `.workbuddy/tmp/`」**冲突**（be-dev「全仓无此文件」正确）→ 撤销该条 or 新建，待定 |

---

## 四、需其他 agent 确认或配合（示意说明）

| 对象 | 需确认 / 配合的事项 | 我需要对方给什么 | 当前状态 |
|---|---|---|---|
| **后端 be-dev** | ① `reading_questions.answer` 是否补 `NOT NULL`（API 层已挡，库列仍 NULL-able）；② 确认 2.5 的 DDL 与我文档描述一致（我核查为**已落地**）；③ G3 `backlog` 待 `knowledge_points` 建表；④ ~~Step 2a 的 `LessonRecord` 产出者边界~~ **✅ 已裁决＝①**；**⑤ `common.schema.json:8` 的 `levels.code` 该指哪里**（实测**无 `levels` 表**；级别实际存于 `lessons.level_code` / `progress.current_level` 两处 VARCHAR —— 是**改指这两列**，还是后端有计划建 `levels` 表？）；**⑥ `GET /api/agent/snapshot` 的 `progress.currentLessonNo` / `nextLessonNo` 取值是否稳定**（契约现未登记这两键，若稳定我补为**可选键**，Skill 侧就不必再自算「课号 = 最大 + 1」；另请顺带确认 `currentCourseNo` 与 `currentLessonNo` 两个命名空间的对应关系）；**⑦（回应你方 §6.13「仍待」#3）`export_md_to_json.py:91-95` 的 Python `norm_key` 去标点** → ✅ **已裁＝交你方改，且你方已落地**（收敛为 Node `normKey` 三步、**标点参与判重**；改动前后导出摘要逐字一致、Node↔Python **8/8** 一致、`db:compare` 15/0/0、`stale=0`）；**⑧（第十二轮新发现）`05` §15「必须 vs 选填」不自洽** → ✅ **已由你方定稿**（抬头「**建议使用…；Skill 侧调用方必须带**」＋ 参数表保「选填」）；⚠️ 另 **你方纠正我方一处判断** —— `review/wrong.html:191/194` **确实传** `clientEventId`（我方「真实前端不传」**有误**；前端不传的是 `lessonNo`），此更正**加固**了 V 的定稿方向 | ① 一句「补 / 不补」；② 确认；③ 建表排期；**⑤ 一句落点**；**⑥ 一句「稳定 / 不稳定」+ 两命名空间对应**；**⑦⑧ 已闭合** | ①② 待答复；③ 后端排期；④ ✅ 已裁决；**⑤⑥ 待答复**；**⑦⑧ ✅ 已闭合（你方落地）**；✅ **你方 §6.13「仍待」#4 已闭环**（`docs/skills.md:190` 载荷口径 + §6.10 A15 复核，见第十轮 / `fcf3659`） |
| **前端 fe-dev** | §11.10 前端三条行为（去掉「看答案」按钮 / 中性缺陷文案 / `console.warn` 告警）是否在 `review/reading.html` 落地 | 确认即可 | ✅ **已落地（2026-10-01 fe-dev 回执，第四轮）**：无答案题不出 `<details class="qbox">`、文案「参考答案缺失（数据异常，已记录）」、`console.warn`（一次会话去重）+ 登记 `window.__readingDefects`；mock 断言 32/32。真实数据 `missingTotal=0`，该分支暂只有 mock 证据 |
| **Git 工程师** | **已入库我方 9 个文件**（`14718d6` 4 份 → `0e2d3fa` 2 份 → `9a66dc6` 3 份 → **`fcf3659`**，**感谢**）；**待提交 11 份**：`docs/skills.md`（第十一～**十五**轮）、`skills/english-daily/SKILL.md`（**v2.8.2**）、`docs/schemas/check_schemas.py`（**合并版**）、`docs/schemas/README.md`、`docs/plans/skill-plan.md`、`docs/ai-teacher.md`、`docs/architecture.md`、`docs/api.md`、`docs/database.md`、`docs/plans/amy-teaching-plan.md`、`docs/plans/backend-plan.md` ＋ 本状态文档；另 `docs/changelog.md` 补记 v2.3.0—**2.8.2** | ① 以**显式路径**提交（禁 `git add -A`）；② changelog 里 v2.6.0 与 v2.7.0 **两个都写**（`14718d6` 题名只写了 v2.6.0）；③ **v2.8.0（MINOR）/ 2.8.1（PATCH）/ 2.8.2（PATCH）各单列一条**；④ ⚠️ 工作区另有**他人在飞**文件（`status-amy.md` / `docs/plans/amy-*.md` / `records/README.md` / `项目书.md` / `records/lesson-0*.json` / `frontend/**` / `backend/**`）→ **只提我的 11 份 + 本状态文档** | ⏳ 待 git-manager 执行（负责人转达） |
| **Amy** | ⓪ 🔴 **请复核第十四轮对 `docs/ai-teacher.md` 的 9 处改动** —— 你方权威文档本属我界外，本轮**经项目负责人明确指派**执行；**只改死引用（`review/*.html` → `frontend/` 与路由），未动任何教学规则 / 结论 / 阈值**（逐行可 `git diff` 核对）；① v2.6.0 的「答案必填、缺则该篇重写、不产 null」是否符合她 §11.10 的承诺；② 下次写记录带上 `next_recommendation` 以闭合 G4；③ `error_type` 人工判定回填；④ **刷新 `docs/ai-teacher.md` 的成组废弃命名**（23 行，见 §1.3 J，建议与「6 处旧数字」合并一次做）；⑤ **`records/README.md` 补一行 `lesson-NN.record.json`**（v2.7.0 新增产出，见 §1.2 行 13）；**⑥ `status-amy.md` A23 已按修法 ① 执行完毕（v2.8.1，含我两处补充）→ 请复核；T/U 两项已于 2026-10-02 由 A25 裁定（T→「四件产出」随 **2.8.2**、U→以 `records/*.study-record.json` → `teach:sync` 为准），**无需你方再裁**；另 `docs/skills.md` §4.2 已补登 **G6/G7** 与权威 §9.3 对齐** | **⓪ 一句复核（`ai-teacher.md` 9 处死引用）**；① 点头确认；② 写记录时带该字段；③ 判定结果；④⑤ 文档刷新；**⑥ 一句复核（T/U 已裁，不必再答）** | ⓪ **待复核（第十四轮新增）**；① 已按交办执行，**待复核**；②③ 进行中；④⑤ 新增；**⑥ 本轮更新（A23→第十二轮 已闭环，待她复核）** |
| **team-lead / 项目负责人** | ① `build_board` 历史叙述处理口径；② `check_instance.py` 是否新建；③ 本表待办优先级；**④（§1.3 O）`check_schemas.py` 同名双副本（`.workbuddy/build/` 535 vs `docs/schemas/` 71）是否收敛为单一受控副本**；**⑤（§1.3 R）`docs/skills.md` §4.2 缺口表是否补登 G6/G7 两行**（权威 `ai-teacher.md` §9.3 为 G1—G7，本表只登 G1—G5；已加注但未补行）；**⑥（§1.3 S）`backend/db/migration/export_md_to_json.py:91-95` 的 Python `norm_key` 去标点由谁改**（be-dev §6.13「仍待」#3 划为「Skill 设计师域」，但文件属 `backend/**`＝我界外）；**⑦（§1.3 T）`records/lesson-NN.study-record.json` 是否补进「产出清单」**（`SKILL.md` 第 8 步现写「三件产出缺一不可」、`docs/skills.md` §3.1 输出表亦是；但 `teach:sync` 靠它写 `progress` 7 列——**两层都漏**）；**⑧（§1.3 U）学习记录机制以 `POST /api/study-records` 还是 `records/*.study-record.json` + `teach:sync` 为准** | 指派与优先级；④ 一个「收敛 / 保留 + 注明」的决定；⑤ 一句「补 / 不补」；⑥ 一句「谁改」；**⑦ 一句「补四件 / 维持三件」**；**⑧ 一句口径** | ✅ **已裁（2026-10-02，A25）** → 见下方新增行 |
| ✅ **已拍板（2026-10-02，A25）** | **④（O）`check_schemas.py` 双副本 = 收敛 ＋ 合并能力**（双量输出 `objects=71`/`nodes=535`）；**⑤（R②）§4.2 补登 G6/G7 两行**；**⑥（S）`export_md_to_json.py` 的 `norm_key` 交 be-dev 改**；**⑦（T）补为「四件产出」→ 升 2.8.2**；**⑧（U）学习记录以 `records/*.study-record.json` → `teach:sync` 为准**；另 **P 授权直接做**、**V / W 转 be-dev** | — | ✅ **已落地**（第十三轮；S/V/W 由 be-dev 落地） |
| ✅ **已拍板（2026-10-01）** | **⑨ 运行时副本 `SKILL.md` 滞后（A—G 共 7 处）= 全改 + 同步镜像、升 v2.8.0**；**⑩ `docs/schemas` 漂移（K—N）＝现在就修（已在批次 8 份内）** | — | ✅ 已落地（⑨→第十一轮） |
| ✅ **已拍板（2026-10-01 17:40）** | **⑦ `docs/schemas` 漂移（§1.3 K—N）修复时机 = 现在就修、并入当前批次**（→ 批次 6 份扩为 **8 份**）；**⑧ `levels.code` 落点 = 先与后端确认再定**（→ 已转为 §四 be-dev⑤，我**未动**该行） | — | ✅ 即刻生效 |
| ✅ **已拍板（2026-10-01 17:34）** | **⑤ Step 2a 归属 = ①**（Skill 归档步产出 `LessonRecord`）；**⑥ 写路径切换点 = 第 8 课**；**③ 我方 5 文件提交授权** | — | ✅ 即刻生效 |

> #### 📌 跨职责登记（fe-dev → skill-designer，依 P5；2026-10-02 19:50）
>
> 依 P5「跨职责改动须在对方状态文档登记一行」。**本块由 fe-dev 追加，未改动你方正文任何一行**；若冲突以你方为准。
>
> **原生站 `review/` 已于 2026-10-02 硬退役**（14 文件物理删除，Vue 版全面替代；commit `2e91345` + `4543984` + `a03d306`）⇒ **全仓库一切 `review/*` 引用均已失效**，你方文档待订正清单：
>
> - `docs/ai-teacher.md`：`:6`、`:21`、`:34`、`:156`、**`:157`（「人读版课程页 = `review/lessons/lesson-N.html`」—— 该目录已随退役删除）**、`:462`、`:555`、`:791`、`:870`
> - `docs/architecture.md:22`、`docs/api.md:78`、`docs/database.md:69`
> - **`skills/english-daily/SKILL.md:67`（⚠️ 受控 + 运行时 `.workbuddy/skills/english-daily/SKILL.md` 两份须同步改 —— 按你方「订正先源后镜」铁则）**：该处拿 `review/wrong.html` 当「真实前端不知课号」的旁证。**文件已删，但教学结论不变**（Vue 版 `WrongView.vue` 行为等价、**仍不传 `lessonNo`**），故只需换引用名或加注，**不必改结论**。
> - `docs/plans/amy-teaching-plan.md:496/:524`、`docs/plans/backend-plan.md:79`
>
> 建议口径：改指 `frontend/src/views/*.vue`，或加注「原引用已随 2026-10-02 原生版退役」。**历史时点快照**（`docs/changelog.md`、`docs/backend-analysis.md`、`docs/integration-report-01.md`）按惯例**不静默改写**，加注即可。
>
> 另：你方 §1.3 内曾据 `review/wrong.html:191/194` 更正「`clientEventId` 确实传、不传的是 `lessonNo`」——该**结论仍成立**，仅文件名需换（Vue 版 `WrongView.vue`）。

### 4.1 待拍板项 · 责任表（2026-10-02 补登；**同日 A25 全部裁定并已执行**）

> 口径：**决策人**＝有权定口径的那一方；**执行人**＝落笔改文件的那一方。逐项证据均已实测（见各条 §1.3）。
> ✅ **裁定结果（2026-10-02，A25）**：**O / P / R② / T / U 五项全部落地**（第十三轮）；**S / V / W 三项转 be-dev 并已由其落地**。**本表已无待拍板项。**

| 项 | 议题 | **决策人** | **裁定** | **执行人 / 状态** |
|---|---|---|---|---|
| **O** | `check_schemas.py` **同名双副本**（`.workbuddy/build/` = `objects=535` vs 受控 `docs/schemas/` = `objects=71`，**代码不同、两数都不错**；**且能力互补，删任一份都会丢校验**） | **负责人** | ✅ **收敛 ＋ 合并能力**：以 build 版为基底**补回** `required ⊆ properties`，**双量输出** `objects=71` / `nodes=535`，落受控路径 | **我** —— ✅ **已执行**（第十三轮）。**引用点 7 处**全部处置：`schemas/README.md:97` 原已指对；`plans/skill-plan.md:261`/`:639` **改指受控版**；`skills.md:1276`（§6.3 时点快照）**加注不改行**；`skills.md:1579`/`:1608`（历史轮次）**保留**；`be-dev-status.md` / `GIT-MANAGER-STATUS.md` / `项目书.md` 只泛引、无路径。⚠️ **删 `.workbuddy/build/` 副本仍未授权**（未被 git 跟踪、属**本地动作**）→ **原样保留** |
| **P** | `refs=84` 陈旧（现 **85**） | ~~负责人~~ **不需拍板** | ✅ **授权直接做** | **我** —— ✅ **已执行**：3 处 → `refs=85`（`schemas/README.md` §五、`plans/skill-plan.md:15` 与 **`:641`**）；`skill-plan.md` 另加**时点说明**（清掉原挂账 §3.1#5） |
| **R②** | §4.2 缺口表**只登 G1—G5**（权威 `ai-teacher.md` §9.3 为 **G1—G7**） | **负责人** | ✅ **补 G6/G7 两行（标已关闭）**，并**撤掉原「待拍板」注**（注与行不并存） | **我** —— ✅ **已执行**：§4.2 与权威 §9.3 **全量对齐** |
| **T** | `records/lesson-NN.study-record.json` **未登「产出清单」**（`SKILL.md` 第 8 步「三件产出缺一不可」、`docs/skills.md` §3.1 输出表都漏），但 `teach:sync` **靠它写 `progress` 7 列与 `study_records`** | **Amy**（`records/` 清单问题） | ✅ **补为「四件产出」**，**另起 PATCH 2.8.2**（不并入已封版 2.8.1） | **我** —— ✅ **已执行**（**v2.8.2**）：`SKILL.md` 第 8 步 + `docs/skills.md` §3.1 输出表各 +1 行；`diff -r` 无差异、两侧 `2.8.2` |
| **U** | 学习记录机制两说并存：`docs/skills.md` §4.4 `:1213` 写 `POST /study-records`（**缺 `/api` 前缀**）vs 实际 `records/*.study-record.json` + `teach:sync`（DB 直连） | **负责人 / be-dev** | ✅ **现状唯一路径 ＝ `records/*.study-record.json` → `teach:sync`**；`05` #18 降为**未被 Skill 调用**的备用路径 | **我** —— ✅ **已执行**：§4.4 该行降级 + 该节加**路径前缀**说明 |

**✅ 同族 3 项（当时未被点名，现已一并闭合，均由 be-dev 落地）**：**S** `export_md_to_json.py` 的 `norm_key` 去标点 → 裁定**交 be-dev 改**，**已落**（收敛为 Node `normKey` 三步、**标点参与判重**；改动前后摘要逐字一致、Node↔Python **8/8** 一致、`db:compare` 15/0/0）；**V** `05 §15` 口径 → **be-dev 已定稿**（抬头「**建议用；Skill 侧必须带**」＋ 参数表保「选填」）；**W** `项目书.md` 版本引用 → **be-dev 已更新**（6 处 → `v2.8.1`，**并顺手刷新数据口径到第 9 课**）。

> ⚠️ **一处我方判断被更正**：我方曾在 §1.3 V 记「**真实前端不传 `clientEventId`**」——**be-dev 实测为不成立**（`review/wrong.html:191/194` 确实传；**不传的是 `lessonNo`**）。此更正**反而加固**了 V 的定稿方向（前端调用本就合法，无需为「避免非法」而放宽措辞）。已在 §1.3 V 行同步。

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

**（续）本轮追加回执（第 16 条，be-dev §6.13，2026-10-01 21:40）**

| # | 来源 | 事项 | 核查结论 |
|---|---|---|---|
| 16 | `be-dev-status.md` §6.13（经负责人转达） | **A15/A16 已实现并实测**：`src/utils/mistakeLesson.js`（定则唯一实现）+ `refreshLastLessonOn()`；写接口与迁移器**共用定则**；`05 §30` 落库映射表**分列改写** + 语义 9；`test:write` **129** / `test:api` **49** / `db:compare` 15/0/0。**「仍待」#1/#2 归 Amy**（`review` 判错是否刷 `last`、`db:sync-mistakes` 的「本次课号」数据源）；**#3/#4 归 skill-designer** | ✅ **已收/已回执**：**#4 已闭环** —— `docs/skills.md:190` 载荷口径（R3）＋ §6.10 的 A15 判重键 4 处，**均已于第十轮落文档并随 `fcf3659` 入库**。**#3 未动** —— `export_md_to_json.py:91-95` 的 `norm_key` 去标点，虽被你方划为「Skill 设计师域」，但**文件在 `backend/db/migration/**`＝我界外** → 已转 §四 be-dev⑦ / team-lead⑥ 请一句「谁改」；**未获授权前不碰**。另**接受**你方两处方法论（`first_lesson_id == null` 整体跳过＝「诊断」来源不补填；**按课号比较而非 `lessons.id`**）—— 与我的「禁依赖恰好如此的环境状态」同源；**你方自报的测试夹具坑（硬编码 91/92 撞 `uk_lessons_no`）已是我方成文铁律**（`MEMORY.md` §二#1）。 |

**小结（更新）**：16 条 —— 已完成 5、已收并回执 **6**（+ #16）、已拍板 1、我方可答「已定稿」1、卡点已消 2、需后续处理 2（#2/#3）、待拍板 1（#4）；**新增待我处理的实质项 = #3（需先定「谁改 `backend/` 导出器」）**。

**（续）第 17 条（`status-amy.md` A23，2026-10-02）**

| # | 来源 | 事项 | 核查结论 |
|---|---|---|---|
| 17 | `status-amy.md` §A23（负责人裁定「只登记、交 skill-designer」） | **第 9 课实跑踩到「顺序缺口」**：A20 的 `review` 回退值取决于 `teach:sync` 是否已跑，而 `teach:sync` 在归档之后、`review` 在第 3—4 步 ⇒ **新课首课**时 `progress.current_lesson_no` 仍是 N-1，复习流水被挂到上一课（`mistake_events.lesson_id` 写成 79＝第 8 课，应为 92＝第 9 课）。**受影响的只有流水课号**：`last_lesson_id` 未受影响（两次复习均 `correct`，§15「`correct` 不刷」）。Amy 给修法 ①（第 4 步补句）/ ②（`docs/skills.md` §3.1 注明），**前端不改** | ✅ **已收、已执行 ①（并同步镜像）**：`SKILL.md` v2.8.1 第 4 步补齐「**调用面**」（端点 + `id` 来源 + **必带 `lessonNo=N`** + 必带确定性 `clientEventId`），第七章 #6 扩为**两条写端点都必须显式带课号**；`docs/skills.md` §3.1 执行流程第 4 行同步。**根因复核属实**（`mistake.service.js:124` 是**全仓唯一**回退点、`study-records` 无此回退；`teach:sync` 确实在归档后）。**我的两处超出建议的补充**：`id` 来源（`digest.md` 待复习段无 id，不补则指令不可执行）、`clientEventId`（`05 §15` 抬头写「必须」）。**另登记 4 项**（§1.3 T/U/V/W）与 **1 处笔误**（§1.3 X：A23 修法② 指向「§3.1 第 8 步」，复习回写实为**第 4 步**）。**请 Amy 复核** |

| ✅ **已拍板（2026-10-02）** | **⑪ Amy A23「顺序缺口」= 按修法 ① 执行，交 Skill 设计师**（Amy 不改受控文件、前端不改） | — | ✅ 已落地（第十二轮 / v2.8.1） |

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
