# 04 · 迁移方案与落地路线

> 状态：**设计稿**。原则：**现有 Markdown 是真相源，只读不改；迁移是单向的 md → DB。**

---

## 一、迁移原则

1. **不破坏**：`review/*.html`、`INDEX.md`、`digest.md`、`notes/`、`read/`、`progress.md`、`wrong-words.md` 全程保持不动。
2. **单向**：只把 md 导入数据库，**绝不反向写回 md**。
3. **可重复**：迁移脚本幂等（重复运行结果一致），用业务唯一键 `ON DUPLICATE KEY UPDATE` 实现。
4. **可回溯**：每行保留 `source_file`（如 `day-01-07.md`），出问题能定位来源。
5. **不丢信息**：结构性弱的内容（复述段落等）原样存进 `course_sections.content_md`。

---

## 二、为什么不重写解析器

现有 `build_board.py` 里已经有一套**经过生产验证**的 Markdown 解析规则（`LESSON_RE` / `SUMMARY_RE` / `SECTION_ORDER` / `parse_vocab` / `parse_piece` / `parse_wrong_words`）。重写一份 JS 解析器会造成规则漂移（两套正则不一致 → 数据对不上）。

**方案：复用 Python 解析、Node 只负责入库。**

```
notes/*.md  read/*.md  wrong-words.md  progress.md
        │
        ▼  export_md_to_json.py   ← 复用 build_board.py 的纯解析函数，不写文件
   snapshot.json（结构化快照）
        │
        ▼  import_json.js         ← 事务 + 幂等 upsert
      MySQL
```

- `export_md_to_json.py`：import `build_board` 的 `parse_notes` / `parse_read_dir` / `parse_wrong_words` / `read_level`，打印 JSON 到 stdout 或写 `db/_snapshot.json`（**只读 md，不改任何文件**）。
- `import_json.js`：单个事务内按依赖顺序 upsert：`users → user_progress → courses → course_sections → vocabulary → course_vocabulary → exercises → readings → reading_pieces → reading_questions → mistakes`。

---

## 三、字段映射

见 `02-data-model.md` 第六节。要点：

| md 来源 | 目标表 | 备注 |
|---|---|---|
| `## 第 N 课 · 日期` | `courses` | 同日第二课无日期 → `lesson_date=NULL`，沿用当日 |
| `### 词汇` 表行 | `vocabulary` + `course_vocabulary` | 单词按 `word` 去重，`is_new` 由首次出现判定 |
| `### 作业` 编号题 | `exercises` | 题干与 `<details>` 答案拆分 |
| `wrong-words.md` 表行 | `mistakes` | 「连续答对」「状态」直接映射；「第 3 次犯」→ `wrong_count` |
| 脏值 `第 诊断 课` | `mistakes.first_course_id=NULL` | 非数字课号 → 置空并记日志，不阻断迁移 |

---

## 四、落地里程碑（建议顺序）

| 阶段 | 内容 | 产出 | 依赖 |
|---|---|---|---|
| **M0（本次）** | 设计与文档 | 本目录 4 份文档 + `db/schema.sql` | 无 ✅ |
| M1 | 建库建表 | 执行 `schema.sql`，`BOARD_OK` 式校验输出 | **需 root 密码** |
| M2 | 迁移脚本 | `export_md_to_json.py` + `import_json.js`，跑通历史数据导入 | M1 |
| M3 | 只读 API | courses / vocabulary / reading / mistakes / progress / dashboard / agent snapshot | M2 |
| M4 | 写接口与业务规则 | `POST /courses`、`POST /mistakes/:id/review`、`POST /progress/feedback`（连击与升降级） | M3 |
| M5 | 前端对接（可选） | 前端工程师把静态页改为调用 API；**需前端 Agent 参与** | M4 |

---

## 五、风险与回滚

| 风险 | 应对 |
|---|---|
| 迁移写入脏数据 | 导入在**单事务**内；失败整体回滚，DB 不留半成品 |
| 解析规则与 md 不一致 | 复用 Python 已验证规则；导入后跑一致性校验（课数/词数/错词数与 `INDEX.md` 对比） |
| 影响现有静态看板 | 后端完全独立目录，**不改不删任何现有文件**；回滚 = 删掉 `backend/` 即可 |
| 密钥泄漏 | 密码走 `.env`；实现阶段先补 `.gitignore`（加 `.env`、`node_modules/`） |

---

## 六、待你确认的事项

1. **MySQL root 密码**（或专用账号）——M1 起必须，仅用于建库与连接。
2. 是否需要**多用户**：当前 schema 已按 `user_id` 隔离，默认单用户；若确认只要单用户，可保留现状不简化。
3. M5 是否启动：即是否要把静态看板改为动态前端（会触碰**前端工程师**职责）。
