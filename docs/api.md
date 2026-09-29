# API 文档（API）

> **状态：第一版已落地并实测 · 2026-09-29**
> 后端服务可运行（`backend/`，Node + Express + MySQL），16 个只读接口全部通过冒烟测试（27 项）。
> 完整契约与响应样例见 **`backend/docs/05-api-reference.md`**（实现权威来源，本文只做登记与导航）。

---

## 一、权威资料

| 资料 | 位置 | 说明 |
|---|---|---|
| **API 参考（已实现）** | `backend/docs/05-api-reference.md` | 16 个接口的 URL / Query / 响应样例 / 错误样例，**实现阶段唯一权威** |
| API 契约设计稿 | `backend/docs/03-api-contract.md` | 长期契约（含写接口、Agent Snapshot），尚未实现 |
| 后端对接摘要 | `backend/README.md` | 启动方式、通用响应结构、给各 Agent 的对接要点 |

---

## 二、服务信息

- **Base URL**：`http://localhost:4000`
- **接口前缀**：`/api`（第一阶段不带版本号）
- **启动**：`cd backend && npm run db:init && npm start`
- **自测**：`npm run test:api`
- **健康检查**：`GET /api/health`

---

## 三、统一响应格式（已实现）

**成功**
```json
{ "code": 200, "message": "success", "data": { } }
```
**失败**
```json
{ "code": 404, "message": "课程不存在：id=999", "data": null }
```
**分页**
```json
{ "code": 200, "message": "success",
  "data": { "list": [ ], "total": 6, "page": 1, "size": 20 } }
```

> ⚠️ **与设计稿的差异**：`03-api-contract.md` 早期定义为 `{success, data, meta}`；本次按项目负责人要求改为 **`{code, message, data}`**。前端与 Skill 一律以本文档与 `05-api-reference.md` 为准。

---

## 四、已实现接口（16 个，全部只读）

| # | 方法 | 路径 | 说明 |
|---|---|---|---|
| 1 | GET | `/api/health` | 健康检查（服务 + 数据库 + 默认学生） |
| 2 | GET | `/api` | 接口索引 |
| 3 | GET | `/api/lessons` | 课程列表（分页 / 级别 / 关键词 / 日期） |
| 4 | GET | `/api/lessons/latest` | 最近一课 + 下一课号 |
| 5 | GET | `/api/lessons/error-trend` | 错误趋势（最近 N 课） |
| 6 | GET | `/api/lessons/:id` | 课程详情（含小节与词汇） |
| 7 | GET | `/api/vocabulary` | 词汇列表（分页 / 首字母 / 搜索 / 按课） |
| 8 | GET | `/api/vocabulary/stats` | 词汇统计（总数 + 首字母分布） |
| 9 | GET | `/api/vocabulary/:id` | 词汇详情 |
| 10 | GET | `/api/mistakes` | 错词列表（状态 / 类型 / 关键词） |
| 11 | GET | `/api/mistakes/pending` | 未过关错词（按优先级） |
| 12 | GET | `/api/mistakes/stats` | 错词统计（按状态与类型） |
| 13 | GET | `/api/mistakes/:id` | 错词详情 |
| 14 | GET | `/api/study-records` | 学习记录（类型 / 课 / 日期区间） |
| 15 | GET | `/api/study-records/stats` | 学习记录统计 |
| 16 | GET | `/api/progress` | 学习进度 |

---

## 五、待补充（TODO）

- [ ] **写接口**：`POST /courses`、`POST /mistakes`、`POST /mistakes/:id/review`（连击与过关）、`POST /progress/feedback`（升降级）—— 第二阶段
- [ ] **Agent Snapshot**：`GET /agent/snapshot`（把 `digest.md` 升级为 JSON，供 Amy / Skill 一次取全）—— 第二阶段
- [ ] **鉴权方案**：当前单用户，写入接口上线前需确定
- [ ] **错误码字典**：已实现的状态码见 `05-api-reference.md` 1.4 节；业务错误码字符串待写入接口落地后补充
- [ ] **前端实际接入时间点**：`review/*.html` 在项目负责人确认切换前保持不动
