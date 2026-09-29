# API 文档（API）

> **状态：TODO（骨架）**
> 当前项目**没有任何可运行接口**。API 仍处于契约设计阶段。
> 本文件只登记契约来源与页面对照，正文由后端工程师在实现阶段补充。

---

## 一、已有权威资料

| 资料 | 位置 | 说明 |
|---|---|---|
| API 契约设计稿 | `backend/docs/03-api-contract.md` | 全部 URL / Method / 请求体 / 响应体 / 错误码，及与前端页面的对照 |
| 后端对接摘要 | `backend/README.md` | Base URL、通用响应结构、给前端与 Amy 的对接要点 |

---

## 二、已确认的约定（摘录自上述文件，非推测）

- Base URL（设计值）：`http://localhost:4000/api/v1`
- 成功响应：`{ success, data, meta }`
- 失败响应：`{ success, error: { code, message, details } }`
- 面向 Amy / Skill 的核心读接口：`GET /agent/snapshot?recent=3`（等价于把 `digest.md` 升级为 JSON）
- 面向 Amy / Skill 的写接口：`POST /mistakes/:id/review`、`POST /progress/feedback`
- 页面对照：看板 `GET /dashboard/summary` + `GET /courses`；阅读 `GET /readings`；词汇 `GET /vocabulary/stats`、`GET /vocabulary?letter=`；错词 `GET /mistakes`

---

## 三、待补充（TODO）

- [ ] 接口清单表（实现完成后按模块登记，标明「已实现 / 设计中」）
- [ ] 鉴权方案（当前设计未涉及多用户，schema 预留 `user_id`）
- [ ] 错误码字典
- [ ] 前端实际接入时间点与灰度方式（`review/*.html` 在确认切换前保持不动）
