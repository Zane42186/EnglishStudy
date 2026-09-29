'use strict';

const { query, execute } = require('../config/db');

async function findByStudentId(studentId) {
  const rows = await query(
    `SELECT id, student_id, current_level, current_lesson_no, last_feedback,
            easy_streak, upgrade_frozen_until, last_class_date, note, updated_at
     FROM progress WHERE student_id = ? LIMIT 1`,
    [studentId]
  );
  return rows[0] || null;
}

/** 不存在则插入，存在则更新（幂等初始化用） */
async function upsert(studentId, data) {
  await execute(
    `INSERT INTO progress
       (student_id, current_level, current_lesson_no, last_feedback, easy_streak,
        upgrade_frozen_until, last_class_date, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       current_level = VALUES(current_level),
       current_lesson_no = VALUES(current_lesson_no),
       last_feedback = VALUES(last_feedback),
       easy_streak = VALUES(easy_streak),
       upgrade_frozen_until = VALUES(upgrade_frozen_until),
       last_class_date = VALUES(last_class_date),
       note = VALUES(note)`,
    [
      studentId,
      data.currentLevel,
      data.currentLessonNo,
      data.lastFeedback ?? null,
      data.easyStreak ?? 0,
      data.upgradeFrozenUntil ?? 0,
      data.lastClassDate ?? null,
      data.note ?? null,
    ]
  );
}

module.exports = { findByStudentId, upsert };
