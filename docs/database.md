# 数据库文档（Database）

> **状态：第一版已创建并初始化 · 2026-09-29**
> 数据库 `english_platform` 已在 MySQL 8.0.27 中创建，8 张表 + 2 个视图已建，含真实种子数据。
> 长期完整设计（18 表 + 2 视图）见 `backend/db/schema.full.design.sql`。

---

## 一、权威资料

| 资料 | 位置 | 说明 |
|---|---|---|
| **第一阶段可执行 Schema** | `backend/db/schema.sql` | 8 表 + 2 视图，由 `npm run db:init` 执行 |
| 初始化与种子 | `backend/db/init.js`、`backend/db/seed.js` | 建库建表 + 幂等写入真实数据 |
| 长期完整设计稿 | `backend/db/schema.full.design.sql` | 18 表 + 2 视图（知识点地图、阅读、Skill 运行记录等），未执行 |
| 数据模型设计说明 | `backend/docs/02-data-model.md` | ER、字段字典、业务规则、Markdown ↔ DB 映射 |
| 迁移与路线 | `backend/docs/04-migration-and-roadmap.md` | md → DB 迁移方案与 M0–M5 路线 |

---

## 二、当前实际状态（非推测，均为实测）

- **数据库**：`english_platform`（MySQL 8.0.27，字符集 `utf8mb4` / `utf8mb4_unicode_ci`，InnoDB）
- **连接**：`127.0.0.1:3306`，账号配置在 `backend/.env`（不入版本库）
- **初始化命令**：`cd backend && npm run db:init`（幂等）；`npm run db:reset` 会先删库再重建

### 已建表（8 张）与实测行数

| 表 | 行数 | 说明 |
|---|---|---|
| `students` | 1 | 学生（Zane） |
| `lessons` | 6 | 课程（第 1—6 课） |
| `lesson_sections` | 12 | 课程小节正文（每课 2 条：今日语法 / 难度反馈） |
| `vocabulary` | 51 | 词汇库（**学生内单词唯一**，已去重） |
| `lesson_vocabulary` | 52 | 课程 ↔ 词汇关联（按课累计，`tired` 在第 2、6 课各一次） |
| `mistakes` | 20 | 错词本（来源 21 行，`play game` 跨两课同错误归并为 1 条） |
| `study_records` | 18 | 学习记录（6 课 × 上课/批改/反馈） |
| `progress` | 1 | 学习进度（Level 2 · 第 6 课） |

### 已建视图（2 个）

- `v_dashboard_stats` —— 看板统计（课程数 / 当前级别 / 词汇总数 / 未过关错词数）
- `v_pending_mistakes` —— 未过关错词（等价 `digest.md` 的「待复习」段）

---

## 三、Schema 要点

- **主键用自增 `id`**，业务唯一键 `uk_lessons_no (student_id, lesson_no)`——替代旧体系里脆弱的「课号字符串关联」。
- **`lesson_sections.content_md`** 用 MEDIUMTEXT 保存原始 Markdown，**不丢信息**。
- **`mistakes`** 含掌握度字段：`streak`（连续答对，≥2 判过关）、`wrong_count`（累计犯错）、`status`（pending/passed）、`error_type`（6 类）。
- **外键删除策略统一 `RESTRICT`**：学习数据只增不删。
- 枚举与 `backend/src/constants.js` **同源**，改枚举必须先改表。

### 与静态看板的口径差异（已知且有意）

| 指标 | 静态看板 `review/index.html` | 数据库 | 原因 |
|---|---|---|---|
| 累计生词 | 52 | **51** | 看板按课累计；库内按 `word` 去重（`tired` 重复） |
| 未过关错词 | 16 | **15** | 看板未归并 `play game`（第 4、6 课各记一次）；库内归并为 1 条 |
| 错词总数 | 21 行 | **20** | 同上 |

---

## 四、迁移现状

**本期未执行 Markdown → 数据库的自动迁移**：种子数据是依据 `progress.md` / `wrong-words.md` / `notes/day-01-07.md` 手工整理后写入 `seed.js` 的。
自动迁移（复用 `build_board.py` 解析规则：Python 导出 JSON → Node 入库）仍在 `04-migration-and-roadmap.md` 的 **M2** 阶段，待后续实施。

---

## 五、待补充（TODO）

- [ ] 自动迁移脚本 `export_md_to_json.py` + `import_json.js`（M2）
- [ ] 长期设计中的其余 10 张表（知识点、阅读、练习、Skill 运行记录等）
- [ ] 写接口对应的数据变更路径（新课时归档、错词连击更新、难度反馈升降级）
- [ ] 备份与恢复策略（学习数据为长期资产，需明确频率与存放位置）
