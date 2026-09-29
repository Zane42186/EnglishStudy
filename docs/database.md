# 数据库文档（Database）

> **状态：TODO（骨架）**
> 数据库**尚未创建**，目前只有设计稿。本文件只登记设计来源与落地前置条件，
> 正文由后端工程师在 MySQL 可用、schema 执行后补充。

---

## 一、已有权威资料

| 资料 | 位置 | 说明 |
|---|---|---|
| 数据模型设计稿 | `backend/docs/02-data-model.md` | ER、18 表 + 2 视图、字段字典、业务规则、Markdown ↔ DB 映射 |
| 建表 DDL | `backend/db/schema.sql` | MySQL 建表脚本（**设计稿，尚未执行**） |
| 迁移与路线 | `backend/docs/04-migration-and-roadmap.md` | md → DB 迁移方案与 M0–M5 路线 |

---

## 二、已确认的现状（非推测）

- 数据库：MySQL 8.0，本机 3306 运行中；**root 密码缺失，当前无法连接**。
- 表结构：设计为 18 张表 + 2 个视图，预留 `user_id`（默认单用户）。
- 迁移方向：以现有 Markdown 为真相源，**只读不改**地导入数据库。
- 环境约束：`.env`、`db/_snapshot.json` 等运行时产物**不入库**（见 `.gitignore`）。

---

## 三、待补充（TODO）

- [ ] 数据库创建与初始化步骤（含密码配置、字符集、时区）
- [ ] 表清单与关系说明（执行后与 `02-data-model.md` 对齐）
- [ ] 迁移脚本用法与回滚方案（`export_md_to_json.py` / `import_json.js`）
- [ ] 备份与恢复策略（学习数据为长期资产，需明确备份频率与存放位置）
