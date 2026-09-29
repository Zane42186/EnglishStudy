'use strict';

const { query, queryOn, executeOn } = require('../config/db');

function buildWhere(studentId, filters = {}) {
  const where = ['m.student_id = ?'];
  const params = [studentId];

  if (filters.status) {
    where.push('m.status = ?');
    params.push(filters.status);
  }
  if (filters.errorType) {
    where.push('m.error_type = ?');
    params.push(filters.errorType);
  }
  if (filters.q) {
    where.push('(m.wrong_text LIKE ? OR m.correct_text LIKE ? OR m.error_reason LIKE ?)');
    params.push(`%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`);
  }
  return { clause: `WHERE ${where.join(' AND ')}`, params };
}

const BASE_SELECT = `
  SELECT m.id, m.wrong_text, m.correct_text, m.error_type, m.error_reason,
         m.streak, m.wrong_count, m.status, m.last_reviewed_at, m.created_at, m.updated_at,
         (SELECT l.lesson_no FROM lessons l WHERE l.id = m.first_lesson_id) AS first_lesson_no,
         (SELECT l.lesson_no FROM lessons l WHERE l.id = m.last_lesson_id)  AS last_lesson_no
  FROM mistakes m`;

async function count(studentId, filters = {}) {
  const { clause, params } = buildWhere(studentId, filters);
  const rows = await query(`SELECT COUNT(*) AS total FROM mistakes m ${clause}`, params);
  return rows[0].total;
}

/** 默认排序：待复习优先 → 累计犯错多 → 最久没复习 */
async function list(studentId, filters = {}, paging = { offset: 0, size: 20 }) {
  const { clause, params } = buildWhere(studentId, filters);
  const sql = `
    ${BASE_SELECT}
    ${clause}
    ORDER BY (m.status = 'passed') ASC, m.wrong_count DESC, m.updated_at ASC
    LIMIT ${paging.size} OFFSET ${paging.offset}`;
  return query(sql, params);
}

async function findById(id, studentId) {
  const rows = await query(`${BASE_SELECT} WHERE m.id = ? AND m.student_id = ? LIMIT 1`, [id, studentId]);
  return rows[0] || null;
}

/** 事务内加行锁（SELECT ... FOR UPDATE），防止并发复习丢更新 */
async function lockRow(conn, id, studentId) {
  const [rows] = await conn.execute(
    'SELECT id FROM mistakes WHERE id = ? AND student_id = ? FOR UPDATE',
    [id, studentId]
  );
  return rows.length ? rows[0].id : null;
}

/** 事务内读取完整行（复用同一套字段，避免两套 SQL 漂移） */
async function findByIdOn(conn, id, studentId) {
  const rows = await queryOn(conn, `${BASE_SELECT} WHERE m.id = ? AND m.student_id = ? LIMIT 1`, [id, studentId]);
  return rows[0] || null;
}

/** 事务内回写复习结果 */
async function updateReviewState(conn, id, { streak, wrongCount, status, lastReviewedAt }) {
  const result = await executeOn(conn,
    `UPDATE mistakes SET streak = ?, wrong_count = ?, status = ?, last_reviewed_at = ?
     WHERE id = ?`,
    [streak, wrongCount, status, lastReviewedAt, id]
  );
  return result.affectedRows;
}

/** 未过关错词的 error_type 分布（快照 pendingMistakeStats.byType） */
async function pendingByType(studentId) {
  return query(
    `SELECT error_type, COUNT(*) AS cnt FROM mistakes
     WHERE student_id = ? AND status = 'pending'
     GROUP BY error_type ORDER BY cnt DESC`,
    [studentId]
  );
}

/* ---------------- mistake_events（复习流水） ---------------- */

/** 幂等命中查询：同一 clientEventId 是否已落库 */
async function findEventByClientId(exec, studentId, clientEventId) {
  const rows = await queryOn(exec,
    `SELECT id, mistake_id, result FROM mistake_events
     WHERE student_id = ? AND client_event_id = ? LIMIT 1`,
    [studentId, clientEventId]
  );
  return rows[0] || null;
}

/** 写入一条复习流水；clientEventId 撞唯一键时返回已存在的那条（幂等兜底） */
async function insertEvent(exec, { studentId, mistakeId, lessonId, result, clientEventId, answeredAt }) {
  try {
    const after = await executeOn(exec,
      `INSERT INTO mistake_events
         (student_id, mistake_id, lesson_id, result, client_event_id, answered_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [studentId, mistakeId, lessonId ?? null, result, clientEventId ?? null, answeredAt]
    );
    return { id: after.insertId, inserted: true };
  } catch (err) {
    if (clientEventId && err && err.code === 'ER_DUP_ENTRY') {
      return findEventByClientId(exec, studentId, clientEventId);
    }
    throw err;
  }
}

/** 某错词的复习流水（按时间升序，便于看复发曲线） */
async function listEvents(studentId, mistakeId, limit = 50) {
  const exists = await query(
    'SELECT id FROM mistakes WHERE id = ? AND student_id = ? LIMIT 1',
    [mistakeId, studentId]
  );
  if (!exists.length) return null;
  const rows = await query(
    `SELECT e.id, e.result, e.answered_at, e.created_at, e.client_event_id,
            e.lesson_id, l.lesson_no
     FROM mistake_events e
     LEFT JOIN lessons l ON l.id = e.lesson_id
     WHERE e.student_id = ? AND e.mistake_id = ?
     ORDER BY e.answered_at ASC, e.id ASC
     LIMIT ${Number(limit) || 50}`,
    [studentId, mistakeId]
  );
  return rows;
}

/** 未过关错词（等价 digest.md「待复习」段） */
async function findPending(studentId, limit = 50) {
  return query(
    `${BASE_SELECT} WHERE m.student_id = ? AND m.status = 'pending'
     ORDER BY m.wrong_count DESC, m.updated_at ASC
     LIMIT ${Number(limit) || 50}`,
    [studentId]
  );
}

async function stats(studentId) {
  const byStatus = await query(
    `SELECT status, COUNT(*) AS cnt FROM mistakes WHERE student_id = ? GROUP BY status`,
    [studentId]
  );
  const byType = await query(
    `SELECT error_type, COUNT(*) AS cnt FROM mistakes WHERE student_id = ? GROUP BY error_type ORDER BY cnt DESC`,
    [studentId]
  );
  const statusMap = { pending: 0, passed: 0 };
  for (const row of byStatus) statusMap[row.status] = row.cnt;
  return {
    total: statusMap.pending + statusMap.passed,
    pending: statusMap.pending,
    passed: statusMap.passed,
    byType: byType.map((r) => ({ errorType: r.error_type, count: r.cnt })),
  };
}

module.exports = {
  count, list, findById, findByIdOn, lockRow, updateReviewState, findPending, stats, pendingByType,
  findEventByClientId, insertEvent, listEvents,
};
