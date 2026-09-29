'use strict';

const studyRecordRepository = require('../repositories/studyRecord.repository');

/** MySQL JSON 列在 mysql2 下已自动解析为对象，这里做一次兜底 */
function parsePayload(payload) {
  if (payload === null || payload === undefined) return null;
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }
  return payload;
}

function mapRecord(row) {
  return {
    id: row.id,
    recordType: row.record_type,
    summary: row.summary,
    payload: parsePayload(row.payload),
    lessonId: row.lesson_id,
    lessonNo: row.lesson_no ?? null,
    lessonDate: row.lesson_date ?? null,
    createdAt: row.created_at,
  };
}

async function listRecords(studentId, filters, paging) {
  const [total, rows] = await Promise.all([
    studyRecordRepository.count(studentId, filters),
    studyRecordRepository.list(studentId, filters, paging),
  ]);
  return { list: rows.map(mapRecord), total };
}

/** 按记录类型聚合（Amy / 学情分析用） */
async function getStats(studentId) {
  const rows = await studyRecordRepository.statsByType(studentId);
  const byType = {};
  let total = 0;
  for (const row of rows) {
    byType[row.record_type] = row.cnt;
    total += row.cnt;
  }
  return { total, byType };
}

module.exports = { listRecords, getStats, mapRecord };
