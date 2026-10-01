'use strict';

const { query, queryOn, executeOn } = require('../config/db');

const LIST_COLUMNS = `
  l.id, l.lesson_no, l.lesson_date, l.level_code, l.summary, l.grammar_point,
  l.vocab_count, l.exercise_count, l.error_count, l.feedback, l.source_file,
  l.status, l.created_at`;

/** 组装 WHERE 条件（含参数） */
function buildWhere(studentId, filters = {}) {
  const where = ['l.student_id = ?'];
  const params = [studentId];

  if (filters.level) {
    where.push('l.level_code = ?');
    params.push(filters.level);
  }
  if (filters.q) {
    where.push('(l.summary LIKE ? OR l.grammar_point LIKE ?)');
    params.push(`%${filters.q}%`, `%${filters.q}%`);
  }
  if (filters.from) {
    where.push('l.lesson_date >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    where.push('l.lesson_date <= ?');
    params.push(filters.to);
  }
  return { clause: `WHERE ${where.join(' AND ')}`, params };
}

async function count(studentId, filters = {}) {
  const { clause, params } = buildWhere(studentId, filters);
  const rows = await query(`SELECT COUNT(*) AS total FROM lessons l ${clause}`, params);
  return rows[0].total;
}

async function list(studentId, filters = {}, paging = { offset: 0, size: 20 }) {
  const { clause, params } = buildWhere(studentId, filters);
  // LIMIT/OFFSET 已在 parsePaging 中校验为整数，直接内联（prepared 不支持 LIMIT 占位）
  const sql = `
    SELECT ${LIST_COLUMNS},
           (SELECT COUNT(*) FROM lesson_vocabulary lv WHERE lv.lesson_id = l.id) AS vocab_linked
    FROM lessons l
    ${clause}
    ORDER BY l.lesson_no DESC
    LIMIT ${paging.size} OFFSET ${paging.offset}`;
  return query(sql, params);
}

/**
 * 全量课程列表（不分页）。字段与 list 完全一致（含 grammarPoint），
 * 供前端 /api/lessons/all 替代会被静默截断的 ?size=100。
 */
async function listAll(studentId, filters = {}) {
  const { clause, params } = buildWhere(studentId, filters);
  const sql = `
    SELECT ${LIST_COLUMNS},
           (SELECT COUNT(*) FROM lesson_vocabulary lv WHERE lv.lesson_id = l.id) AS vocab_linked
    FROM lessons l
    ${clause}
    ORDER BY l.lesson_no DESC`;
  return query(sql, params);
}

async function findById(id, studentId, exec = null) {
  const rows = await queryOn(exec,
    `SELECT l.id, l.lesson_no, l.lesson_date, l.level_code, l.summary, l.grammar_point,
            l.vocab_count, l.exercise_count, l.error_count, l.feedback, l.source_file,
            l.status, l.created_at, l.updated_at
     FROM lessons l
     WHERE l.id = ? AND l.student_id = ?
     LIMIT 1`,
    [id, studentId]
  );
  return rows[0] || null;
}

async function findByNo(studentId, lessonNo, exec = null) {
  const rows = await queryOn(exec,
    'SELECT id, lesson_no, lesson_date FROM lessons WHERE student_id = ? AND lesson_no = ? LIMIT 1',
    [studentId, lessonNo]
  );
  return rows[0] || null;
}

/** 写回某课的难度反馈（课不存在时影响 0 行，由调用方决定是否容忍） */
async function updateFeedback(studentId, lessonNo, feedback, exec = null) {
  const result = await executeOn(exec,
    'UPDATE lessons SET feedback = ? WHERE student_id = ? AND lesson_no = ?',
    [feedback, studentId, lessonNo]
  );
  return result.affectedRows;
}

/** 某一课的练习明细（含批改结论） */
async function findExercises(lessonId) {
  return query(
    `SELECT block_kind, block_no, exercise_no, exercise_type, prompt, self_check, reference_answer,
            target_point, user_answer, is_correct, error_type, error_note, revised_answer, order_index
     FROM lesson_exercises
     WHERE lesson_id = ?
     ORDER BY block_kind ASC, block_no ASC, order_index ASC, exercise_no ASC`,
    [lessonId]
  );
}

/** 某课首次犯错引入的错词条数（快照 recentLessons[].mistakeCount） */
async function countMistakesByLesson(studentId, lessonId) {
  const rows = await query(
    'SELECT COUNT(*) AS total FROM mistakes WHERE student_id = ? AND first_lesson_id = ?',
    [studentId, lessonId]
  );
  return rows[0].total;
}

/** 最近一课（按课号最大） */
async function findLatest(studentId) {
  const rows = await query(
    `SELECT id, lesson_no, lesson_date, level_code, summary, grammar_point, feedback, error_count
     FROM lessons WHERE student_id = ? ORDER BY lesson_no DESC LIMIT 1`,
    [studentId]
  );
  return rows[0] || null;
}

/** 某一课的小节正文 */
async function findSections(lessonId) {
  return query(
    `SELECT section_type, content_md, order_index
     FROM lesson_sections WHERE lesson_id = ? ORDER BY order_index ASC`,
    [lessonId]
  );
}

/** 某一课的词汇（含本课例句） */
async function findVocabulary(lessonId) {
  return query(
    `SELECT v.id, v.word, v.phonetic, v.meaning, lv.example, lv.is_new, lv.order_index
     FROM lesson_vocabulary lv
     JOIN vocabulary v ON v.id = lv.vocabulary_id
     WHERE lv.lesson_id = ?
     ORDER BY lv.order_index ASC, v.id ASC`,
    [lessonId]
  );
}

/** 按课号聚合错误数（错误趋势） */
async function errorTrend(studentId, limit = 5) {
  return query(
    `SELECT id, lesson_no, error_count, lesson_date
     FROM lessons WHERE student_id = ?
     ORDER BY lesson_no DESC LIMIT ${Number(limit) || 5}`,
    [studentId]
  );
}

// ===========================================================================
// 写路径：LessonRecord → lessons / lesson_sections / lesson_exercises / vocabulary
//
// 一律走 `*On(conn, …)`：由 service 在**单事务**里调用，保证「判重 → 写入」原子，
// 避免并发下两个请求都判定「课号不存在」而各建一课。
// ===========================================================================

/** lessons 允许被写接口更新的列（白名单 —— 列名不进 SQL 拼接，只有值参数化） */
const LESSON_WRITABLE_COLUMNS = [
  'lesson_date', 'level_code', 'summary', 'grammar_point', 'feedback',
  'source_file', 'status', 'vocab_count', 'exercise_count', 'error_count',
];

/**
 * 新建课程行，返回 insertId。
 * `status` 缺省取 'taught' —— 与 `db/schema.sql` 的列默认值、以及现有 1—7 课的实际值一致
 * （本项目的「归档」不等于 `status='archived'`，故不擅自改变生命周期语义）。
 */
async function insertLesson(conn, studentId, fields) {
  const result = await executeOn(
    conn,
    `INSERT INTO lessons
       (student_id, lesson_no, lesson_date, level_code, summary, grammar_point,
        vocab_count, exercise_count, error_count, feedback, source_file, status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      studentId,
      fields.lessonNo,
      fields.lessonDate ?? null,
      fields.levelCode,
      fields.summary,
      fields.grammarPoint ?? null,
      fields.vocabCount ?? 0,
      fields.exerciseCount ?? 0,
      fields.errorCount ?? 0,
      fields.feedback ?? null,
      fields.sourceFile ?? null,
      fields.status ?? 'taught',
    ]
  );
  return result.insertId;
}

/**
 * 选择性更新课程行：**只更新 `changes` 里出现的列**（键为列名，取值必须在白名单内）。
 * 「回填」语义要求「没传的字段保持原值」，所以不能整体 UPDATE 覆盖。
 */
async function updateLessonFields(conn, lessonId, changes) {
  const sets = [];
  const params = [];
  for (const col of LESSON_WRITABLE_COLUMNS) {
    if (changes[col] === undefined) continue;
    sets.push(`${col} = ?`);
    params.push(changes[col]);
  }
  if (!sets.length) return 0;
  params.push(lessonId);
  const result = await executeOn(conn, `UPDATE lessons SET ${sets.join(', ')} WHERE id = ?`, params);
  return result.affectedRows;
}

/**
 * 小节 upsert。唯一键 `uk_section = (lesson_id, section_type)` ——
 * 同课同类型最多一条，重复写即覆盖正文（与 `import_json` 同口径；
 * 多个 objectives / 多条预期错误写在同一行的 content_md 里）。
 */
async function upsertSection(conn, lessonId, sectionType, contentMd, orderIndex) {
  await executeOn(
    conn,
    `INSERT INTO lesson_sections (lesson_id, section_type, content_md, order_index)
     VALUES (?,?,?,?)
     ON DUPLICATE KEY UPDATE content_md = VALUES(content_md), order_index = VALUES(order_index)`,
    [lessonId, sectionType, contentMd, orderIndex]
  );
}

/**
 * 练习 upsert。唯一键 `uk_exercise = (lesson_id, block_kind, block_no, exercise_no)`。
 *
 * ⚠️ **本语句刻意不写 `error_type`**：该列只由 Amy 人工判定
 *    （`records/` → `db:apply-error-types`），接口既不接收也不推导
 *    （`docs/skills.md` 3.6 / `docs/ai-teacher.md` §11.5）。因此
 *    新建时为 NULL、重复写时**保持既有值** —— 这正是「回填批改不得覆盖 Amy 判定」的落地。
 *    `db/migration/import_json.js` 的同类语句会写 `error_type`，因为它吃的是
 *    Amy 已判好的 `records/exercise-error-types.json`，两者语义不同、不可合并。
 */
async function upsertExercise(conn, lessonId, ex, orderIndex) {
  await executeOn(
    conn,
    `INSERT INTO lesson_exercises
       (lesson_id, block_kind, block_no, exercise_no, exercise_type, prompt, self_check,
        reference_answer, target_point, user_answer, is_correct, error_note, revised_answer, order_index)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
       exercise_type   = VALUES(exercise_type),  prompt          = VALUES(prompt),
       self_check      = VALUES(self_check),     reference_answer = VALUES(reference_answer),
       target_point    = VALUES(target_point),   user_answer     = VALUES(user_answer),
       is_correct      = VALUES(is_correct),     error_note      = VALUES(error_note),
       revised_answer  = VALUES(revised_answer), order_index     = VALUES(order_index)`,
    [
      lessonId,
      ex.blockKind,
      ex.blockNo,
      ex.exerciseNo,
      ex.exerciseType,
      ex.prompt,
      ex.selfCheck ?? null,
      ex.referenceAnswer ?? null,
      ex.targetPoint ?? null,
      ex.userAnswer ?? null,
      ex.isCorrect === true ? 1 : ex.isCorrect === false ? 0 : null,
      ex.errorNote ?? null,
      ex.revisedAnswer ?? null,
      orderIndex,
    ]
  );
}

/**
 * 词汇 upsert + 建课次关联，返回 `vocabulary.id`。
 *
 * **`db/migration/import_json.js` 与写接口共用本函数** —— 两条路径必须产出同样的
 * `first_lesson_id` / `is_new` / 例句，否则同一批数据会因来源不同而形状漂移
 * （与阅读侧共用 `renderBodyMd` 同因）。
 * 已存在的词只补空字段、**不覆盖释义**（`COALESCE(旧值, 新值)`）。
 */
async function upsertVocabularyEntry(conn, studentId, lessonId, entry, orderIndex = 0) {
  const word = String(entry.word || '').trim();
  await executeOn(
    conn,
    `INSERT INTO vocabulary (student_id, word, phonetic, meaning, example, first_lesson_id)
     VALUES (?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
       phonetic = COALESCE(vocabulary.phonetic, VALUES(phonetic)),
       meaning  = COALESCE(vocabulary.meaning,  VALUES(meaning)),
       example  = COALESCE(vocabulary.example,  VALUES(example))`,
    [studentId, word, entry.phonetic ?? null, entry.meaning ?? null, entry.example ?? null, lessonId]
  );
  const rows = await queryOn(
    conn,
    'SELECT id, first_lesson_id FROM vocabulary WHERE student_id = ? AND word = ?',
    [studentId, word]
  );
  const row = rows[0];
  if (!row) return null;
  // 契约字段 isNew 优先；未提供时按「本课是否首次出现」推导（与导入器一致）
  const isNew = typeof entry.isNew === 'boolean'
    ? (entry.isNew ? 1 : 0)
    : (String(row.first_lesson_id) === String(lessonId) ? 1 : 0);
  await executeOn(
    conn,
    `INSERT INTO lesson_vocabulary (lesson_id, vocabulary_id, example, is_new, order_index)
     VALUES (?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
       example = VALUES(example), is_new = VALUES(is_new), order_index = VALUES(order_index)`,
    [lessonId, row.id, entry.example ?? null, isNew, orderIndex]
  );
  return row.id;
}

/** 派生三项计数所需的子表行数（vocab_count / exercise_count） */
async function countChildren(conn, lessonId) {
  const rows = await queryOn(
    conn,
    `SELECT
       (SELECT COUNT(*) FROM lesson_vocabulary WHERE lesson_id = ?) AS vocab_count,
       (SELECT COUNT(*) FROM lesson_exercises  WHERE lesson_id = ?) AS exercise_count`,
    [lessonId, lessonId]
  );
  return { vocabCount: Number(rows[0].vocab_count), exerciseCount: Number(rows[0].exercise_count) };
}

/** `error_count` 的回落口径：作业块（**不含补漏块**）中判错的题数 */
async function countHomeworkErrors(conn, lessonId) {
  const rows = await queryOn(
    conn,
    `SELECT COUNT(*) AS n FROM lesson_exercises
      WHERE lesson_id = ? AND block_kind = 'homework' AND is_correct = 0`,
    [lessonId]
  );
  return Number(rows[0].n);
}

module.exports = {
  count, list, listAll, findById, findByNo, findLatest, findSections, findVocabulary,
  errorTrend, updateFeedback, countMistakesByLesson, findExercises,
  insertLesson, updateLessonFields, upsertSection, upsertExercise, upsertVocabularyEntry,
  countChildren, countHomeworkErrors,
};
