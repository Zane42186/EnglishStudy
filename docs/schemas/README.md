# 数据契约（Schemas）

> **状态：第一版 · 2026-09-29**
> 本目录是 Skill 与后端之间的唯一接口定义。Skill 只认这里定义的对象，不认任何文件路径与文件格式。
> 配套设计文档：`docs/skills.md`；后端契约来源：`backend/docs/03-api-contract.md`、`backend/db/schema.sql`。

---

## 一、为什么要有这一层

`AGENTS.md` 要求数据流为：

```
AI Skill → 结构化 JSON → Backend API → Database → Frontend
```

只要有一个 Skill 直接去读 `digest.md` 或解析 `notes/*.md`，这条链就是名义上的。本目录的做法是：**把 JSON 契约先定死，把 Markdown 降级为契约的一种实现**。

| 阶段 | 数据从哪来 | Skill 是否需要改动 |
|---|---|---|
| 现在（后端未就绪） | 适配层读 `digest.md` / `progress.md` / `wrong-words.md` / `notes/` / `read/`，合成契约对象 | — |
| 后端就绪后 | `GET /api/agent/snapshot` 等接口返回同样的契约对象 | **不需要**，只换数据来源 |

判定标准很简单：**如果一个 Skill 的行为会因为 md 文件换了个排版而改变，说明设计错了。**

---

## 二、契约清单

| 文件 | 根对象 | 谁产出 | 谁消费 | 对应后端 |
|---|---|---|---|---|
| `common.schema.json` | 公共 `$defs` | — | 全部契约 | 枚举取值对齐 `schema.sql` |
| `agent-snapshot.schema.json` | `AgentSnapshot` | 适配层 / 后端 | **全部 9 个 Skill** | `GET /api/agent/snapshot` |
| `lesson-plan.schema.json` | `LessonPlan` | next-lesson-planning | daily-lesson、三个教学内容能力 | 无（合同内部对象） |
| `lesson-record.schema.json` | `LessonRecord` | daily-lesson | 后端 | `POST /api/lessons`、`PUT /api/lessons/:id` |
| `teaching-block.schema.json` | `TeachingBlock` | grammar-teaching、vocabulary-teaching | daily-lesson | `lesson_sections`、`vocabulary` / `lesson_vocabulary` |
| `exercise-set.schema.json` | `ExerciseSet` | exercise-generation | answer-grading | `lesson_exercises` |
| `grading-result.schema.json` | `GradingResult` | answer-grading | mistake-analysis、daily-lesson | `lesson_exercises.user_answer / is_correct / revised_answer / error_note` |
| `mistake.schema.json` | `MistakeAnalysisResult` | mistake-analysis | daily-lesson、learning-progress-analysis | `mistakes`、`mistake_events` |
| `review-session.schema.json` | `ReviewSession` | lesson-review | 后端 | `POST /api/mistakes/:id/review` |
| `progress-report.schema.json` | `ProgressReport` | learning-progress-analysis | next-lesson-planning、学生 | `study_records`（`grade`） |
| `reading-set.schema.json` | `ReadingSet` | daily-lesson | 后端、前端 | `readings` / `reading_pieces` / `reading_questions` |
| `skill-run.schema.json` | `SkillRun` | 全部 Skill | 后端 | `skill_runs` |

### 9 个 Skill 与契约的对应

| Skill | 输入 | 输出 |
|---|---|---|
| daily-lesson | `AgentSnapshot` + `LessonPlan` | `LessonRecord` + `ReadingSet` + `SkillRun` |
| lesson-review | `AgentSnapshot` | `ReviewSession` + `SkillRun` |
| grammar-teaching | `LessonPlan` + `AgentSnapshot` | `TeachingBlock`（kind=grammar） |
| vocabulary-teaching | `LessonPlan` + `AgentSnapshot` | `TeachingBlock`（kind=vocabulary） |
| exercise-generation | `LessonPlan` + `AgentSnapshot` | `ExerciseSet` |
| answer-grading | `ExerciseSet` + 学生作答 | `GradingResult` |
| mistake-analysis | `GradingResult` + 历史错词 | `MistakeAnalysisResult` |
| learning-progress-analysis | `AgentSnapshot` | `ProgressReport` |
| next-lesson-planning | `AgentSnapshot` + `ProgressReport` | `LessonPlan` |

---

## 三、版本与演进规则

1. **命名空间即版本**：`$id` 为 `https://english-study.local/schemas/v1/<文件名>`。`$id` 是标识符，不是可访问网址，不要求能被抓取。
2. **向后兼容的加字段**：不升版本。Skill 必须忽略未知字段，不得因后端多返回字段而报错。所有契约默认允许附加属性。
3. **枚举加值**：属兼容变更，不升版本；但 Skill 侧不得自行发明枚举值，新增取值必须先改 `schema.sql` 与 `common.schema.json`。
4. **删字段、改字段含义、改必填项**：属破坏性变更，升 `v2` 并保留 `v1` 一个迁移周期。
5. **必填项只加不减**：`required` 数组只允许向后兼容地减少，不允许新增。
6. **`common.schema.json` 的引用方式**：同目录内使用相对路径引用，如 `"$ref": "common.schema.json#/$defs/LevelCode"`；文件内自引用使用 `"#/$defs/XXX"`。两份文件必须放在同一目录，不可分散。

---

## 四、与后端契约的差异登记

以下字段是本目录相对现有后端契约**新增**的，均以可选字段形式出现，后端未补上时 Skill 必须走降级路径而不是报错：

| 字段 | 所在契约 | 缺口编号 | 用途 |
|---|---|---|---|
| `errorTrend` | `AgentSnapshot` | G1 | 判断能否加速（教学规则 R3） |
| `recentLessons[].errorCount` | `AgentSnapshot` | G1 | 同上 |
| `pendingMistakes[].priority` | `AgentSnapshot` | G2 | 复习出题排序 |
| `backlog` | `AgentSnapshot` | G3 | 待补知识点与补漏队列（规则 R2） |
| `lastIncomplete` | `AgentSnapshot` | G4 | 断更后补课接续 |
| `studyMinutes` | `LessonRecord` | G5 | 学习时长统计 |
| `SectionType` 的 `objectives`、`expected_mistakes` | `common.schema.json`、`LessonRecord` | ai-teacher 5.4 | 本课目标与预判易错点 |

> 缺口编号与建议见 `docs/ai-teacher.md` 9.3 与 5.4。**本目录只登记需求，不代表后端已同意实现**，最终以 `backend/docs/03-api-contract.md` 为准。

---

## 五、校验方式

本目录只使用 JSON Schema 2020-12 的 `type`、`enum`、`required`、`properties`、`items`、`$ref`、`anyOf`、`pattern` 等基础关键字，不依赖任何在线 metaschema。

**推荐：零依赖只读校验（本目录自带，仅用标准库，无需安装任何包）**

```bash
python docs/schemas/check_schemas.py                 # 自定位（脚本所在目录即本目录），不依赖当前工作目录
python docs/schemas/check_schemas.py docs/schemas    # 亦可显式传目录（向后兼容）
```

通过时输出 `SCHEMA_CHECK files=12 refs=85 objects=71 nodes=535` 与 `SCHEMA_OK 全部 $ref 可解析，required 字段定义完整，枚举与字段防回归通过`；发现问题时输出 `SCHEMA_FAIL 问题数=N` 与 `⛔` 清单并以退出码 `1` 结束，可直接作为 CI 门禁。脚本只读，不做任何写入。

**两个计数量的定义（2026-10-02 合并双副本后同时输出，消除「535 vs 71」歧义）：**

| 量 | 当前值 | 定义 | 回答的问题 |
|---|---|---|---|
| `objects` | **71** | `type == "object"` 或含 `properties` 的节点数（**语义计数**） | 契约对象有多少个 |
| `nodes` | **535** | 全部 dict 节点数（**原始计数**，含 `$defs` 内每个子对象、`properties` 映射本身等） | 结构规模有多大 |

> 两者都对，只是口径不同。历史文档里报出的 `objects=535` / `objects=536` 属**原始计数**口径，与今日的 `nodes` 等价（已实测：注入一处断链后输出 `refs=86 objects=71 nodes=536`，可见 `536` 即原始计数）。
> 本目录曾同时存在两个同名脚本（本目录的与 `.workbuddy/build/` 的，**两版各有对方没有的校验**：本目录版独有 `required ⊆ properties`，build 版独有自定位路径 / 精确 glob / 枚举防回归守卫）；2026-10-02 已将两版**合并**为本目录的单一受控版本。

本地校验（需要 `jsonschema` 库）：

```bash
python -c "import json,glob,jsonschema; [json.load(open(f,encoding='utf-8')) for f in glob.glob('docs/schemas/*.json')]"
```

没有第三方库时，至少应逐文件确认：JSON 可解析、每个 `$ref` 目标存在、每个 `required` 字段在 `properties` 中有定义。
