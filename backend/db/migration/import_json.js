'use strict';

/**
 * M2 历史回填写库器（只读 JSON → 写库，单事务、幂等）
 * ---------------------------------------------------------------------------
 * 上游：`export_md_to_json.py` 产出的 `_snapshot.json`
 *       （md 取题面 + `records/*.json` 取判定 + `wrong-words.md` 取错词权威）
 * 本脚本：把该 JSON 里的**派生内容**写进库，使后端成为唯一真相源，
 *         前端与 Amy 不再需要读 md 散文。
 *
 * 写什么 / 不写什么
 *   ✅ lessons         —— 只补 `lesson_date IS NULL` 的行（含「同日沿用当日日期」规则），
 *                         绝不覆盖既有 `error_count` 等历史值（口径见 04-migration §五之三）
 *   ✅ lesson_sections —— 按 (lesson_id, section_type) upsert，补齐 md 原文小节
 *   ✅ lesson_exercises—— 按 (lesson_id, block_kind, block_no, exercise_no) upsert
 *   ✅ readings        —— 按天整体重建（reading 为 md 派生物，子行显式删除后重插）
 *   ✅ study_records   —— 仅把 `records.summary.byType` 合并进 grade 记录的 payload
 *   ⛔ mistakes        —— **不写**：权威是 `wrong-words.md`，库内已一致；
 *                         records 的 mistakeCandidates 与错词本有 8 条同义不同文本，
 *                         按「以错词本为准、不得新建」口径，须 amy 复核后再定
 *   ⛔ vocabulary / lesson_vocabulary —— 不写：库内已一致，只做断言比对
 *
 * 幂等保证：重复执行不产生新行；`import_json.js` 前后各表的计数与 `mistakes` md5 不变。
 * 安全保证：所有写入都以解析出的 `student_id` 为范围，绝不影响其他学生；
 *           全程单事务，任一步失败整体回滚；跑完打印前后计数对比。
 *
 * 用法：
 *   node db/migration/import_json.js                     # 写库
 *   node db/migration/import_json.js --dry-run           # 只报告，最后回滚
 *   node db/migration/import_json.js --snapshot <path>   # 指定快照
 *   node db/migration/import_json.js --student <name|id> # 指定学生（默认取第一个）
 */

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const db = require('../../src/config/db');
// 正文渲染与词数统计**复用 API 侧同一实现**：read/*.md 回填与 POST /api/readings 写入
// 必须产出完全一致的 body_md，否则 GET /api/readings/:date 会因来源不同而形状漂移。
const { renderBodyMd, countWords } = require('../../src/services/reading.service');

const DEFAULT_SNAPSHOT = path.join(__dirname, '_snapshot.json');

/** 与 schema.sql / constants.js 同源的枚举白名单，防止脏值进库被 MySQL 静默截断 */
const EXERCISE_TYPES = ['fill_blank', 'translate', 'error_correction', 'reorder', 'open', 'choice'];
const ERROR_TYPES = ['grammar', 'spelling', 'punctuation', 'word_choice', 'capitalization', 'other'];
const BLOCK_KINDS = ['homework', 'backfill'];
const SECTION_TYPES = [
  'review', 'grammar', 'vocab_table', 'examples', 'homework', 'my_answer',
  'grading', 'feedback', 'objectives', 'expected_mistakes', 'backfill',
];
/** 各列上限（严格模式下超长会直接报错，故先截断并告警，避免整批回滚） */
const LIMITS = { targetPoint: 64, selfCheck: 128, title: 255, levelCode: 16 };

const stats = {
  lessonDateFilled: 0,
  lessonDateMismatch: 0,
  sectionsWritten: 0,
  exercisesWritten: 0,
  readingDays: 0,
  readingPieces: 0,
  readingQuestions: 0,
  byTypeBackfilled: 0,
  skipped: 0,
};
const warnings = [];

// ------------------------------------------------------------------ 工具

function parseArgs(argv) {
  const args = { snapshot: DEFAULT_SNAPSHOT, dryRun: false, student: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--snapshot') args.snapshot = argv[++i];
    else if (a === '--student') args.student = argv[++i];
  }
  return args;
}

function warn(msg) {
  warnings.push(msg);
  console.log(`  ! ${msg}`);
}

/** 超长即截断并告警（比让 MySQL 抛 1406 导致整批回滚更友好） */
function clip(value, max, label) {
  if (value == null) return null;
  const s = String(value);
  if (s.length <= max) return s;
  warn(`${label} 超过 ${max} 字符，已截断：${s.slice(0, 30)}…`);
  return s.slice(0, max);
}

function asEnum(value, allowed, fallback, label) {
  if (value == null || value === '') return fallback;
  if (allowed.includes(value)) return value;
  warn(`${label} 出现未知枚举值 ${JSON.stringify(value)}，已回退为 ${fallback}`);
  return fallback;
}

function parseJsonColumn(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * 「同日沿用当日日期」：md 写了日期就用它，没写就沿用上一课已解析出的日期。
 * （第 2、4 课的标题就是 `## 第 2 课`，本就没有日期。）
 */
function resolveLessonDates(lessons) {
  const out = new Map();
  let last = null;
  for (const l of lessons) {
    const date = l.lessonDate || last;
    last = date;
    out.set(l.lessonNo, { date, fromMd: Boolean(l.lessonDate) });
  }
  return out;
}

// ------------------------------------------------------------------ 主流程

async function countTables(executor) {
  const sql = `
    SELECT
      (SELECT COUNT(*) FROM lessons)          AS lessons,
      (SELECT COUNT(*) FROM lesson_sections)  AS sections,
      (SELECT COUNT(*) FROM lesson_exercises) AS exercises,
      (SELECT COUNT(*) FROM readings)         AS readings,
      (SELECT COUNT(*) FROM reading_pieces)   AS pieces,
      (SELECT COUNT(*) FROM reading_questions)AS questions,
      (SELECT COUNT(*) FROM mistakes)         AS mistakes,
      (SELECT MD5(GROUP_CONCAT(id,'|',wrong_text,'|',status,'|',wrong_count,'|',streak
                               ORDER BY id SEPARATOR ';')) FROM mistakes) AS mistakesMd5`;
  const rows = await db.queryOn(executor, sql);
  return rows[0];
}

async function resolveStudentId(executor, wanted) {
  const rows = wanted && /^\d+$/.test(wanted)
    ? await db.queryOn(executor, 'SELECT id, name FROM students WHERE id = ?', [Number(wanted)])
    : wanted
      ? await db.queryOn(executor, 'SELECT id, name FROM students WHERE name = ?', [wanted])
      : await db.queryOn(executor, 'SELECT id, name FROM students ORDER BY id LIMIT 1');
  if (!rows.length) throw new Error(`找不到学生：${wanted || '(默认取第一个，但 students 表为空)'}`);
  return rows[0];
}

async function syncLessons(executor, studentId, lessons, dates) {
  for (const l of lessons) {
    const rows = await db.queryOn(
      executor,
      'SELECT id, lesson_date, level_code, error_count FROM lessons WHERE student_id = ? AND lesson_no = ?',
      [studentId, l.lessonNo]
    );
    if (!rows.length) {
      stats.skipped += 1;
      warn(`第 ${l.lessonNo} 课在库内不存在，跳过（level_code 为 NOT NULL 且快照无该字段，无法凭空造行）`);
      continue;
    }
    const row = rows[0];
    const { date, fromMd } = dates.get(l.lessonNo);
    if (!date) {
      warn(`第 ${l.lessonNo} 课解析不出日期，且库内已有值，保持不动`);
      continue;
    }
    if (row.lesson_date == null) {
      await db.executeOn(executor, 'UPDATE lessons SET lesson_date = ? WHERE id = ?', [date, row.id]);
      stats.lessonDateFilled += 1;
      console.log(`  · 第 ${l.lessonNo} 课补 lesson_date = ${date}${fromMd ? '' : '（沿用上一课日期）'}`);
    } else if (row.lesson_date !== date) {
      stats.lessonDateMismatch += 1;
      warn(`第 ${l.lessonNo} 课日期不一致：库内 ${row.lesson_date} vs 解析 ${date} —— **保留库内值**，不覆盖`);
    }
  }
}

async function syncSections(executor, lessonIdByNo, lessons) {
  for (const l of lessons) {
    const lessonId = lessonIdByNo.get(l.lessonNo);
    if (!lessonId) continue;
    for (const s of l.sections || []) {
      const type = asEnum(s.sectionType, SECTION_TYPES, null, `第 ${l.lessonNo} 课 section_type`);
      if (!type) continue;
      const content = (s.contentMd || '').trim();
      if (!content) continue;
      await db.executeOn(
        executor,
        `INSERT INTO lesson_sections (lesson_id, section_type, content_md, order_index)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE content_md = VALUES(content_md), order_index = VALUES(order_index)`,
        [lessonId, type, content, Number.isInteger(s.orderIndex) ? s.orderIndex : 0]
      );
      stats.sectionsWritten += 1;
    }
  }
}

async function syncExercises(executor, lessonIdByNo, lessons) {
  for (const l of lessons) {
    const lessonId = lessonIdByNo.get(l.lessonNo);
    if (!lessonId) continue;
    const list = l.exercises || [];
    for (let i = 0; i < list.length; i += 1) {
      const e = list[i];
      const blockKind = asEnum(e.blockKind, BLOCK_KINDS, 'homework', `第 ${l.lessonNo} 课 block_kind`);
      const blockNo = Number.isInteger(e.blockNo) ? e.blockNo : 0;
      const exerciseType = asEnum(e.exerciseType, EXERCISE_TYPES, 'fill_blank', `第 ${l.lessonNo} 课 exercise_type`);
      if (blockKind === 'homework' && blockNo !== 0) {
        warn(`第 ${l.lessonNo} 课作业题 block_no 应为 0，实际 ${blockNo}，已按 0 写入`);
      }
      await db.executeOn(
        executor,
        `INSERT INTO lesson_exercises
           (lesson_id, block_kind, block_no, exercise_no, exercise_type, prompt, self_check,
            reference_answer, target_point, user_answer, is_correct, error_type, error_note,
            revised_answer, order_index)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           exercise_type  = VALUES(exercise_type),  prompt         = VALUES(prompt),
           self_check     = VALUES(self_check),     reference_answer = VALUES(reference_answer),
           target_point   = VALUES(target_point),   user_answer    = VALUES(user_answer),
           is_correct     = VALUES(is_correct),     error_type     = VALUES(error_type),
           error_note     = VALUES(error_note),     revised_answer = VALUES(revised_answer),
           order_index    = VALUES(order_index)`,
        [
          lessonId,
          blockKind,
          blockKind === 'homework' ? 0 : blockNo,
          Number.isInteger(e.exerciseNo) ? e.exerciseNo : i + 1,
          exerciseType,
          e.prompt || '',
          clip(e.selfCheck, LIMITS.selfCheck, `第 ${l.lessonNo} 课 self_check`),
          e.referenceAnswer ?? null,
          clip(e.targetPoint, LIMITS.targetPoint, `第 ${l.lessonNo} 课 target_point`),
          e.userAnswer ?? null,
          e.isCorrect === true ? 1 : e.isCorrect === false ? 0 : null,
          asEnum(e.errorType, ERROR_TYPES, null, `第 ${l.lessonNo} 课 exercise.error_type`),
          e.errorNote ?? null,
          e.revisedAnswer ?? null,
          i,
        ]
      );
      stats.exercisesWritten += 1;
    }
  }
}

async function syncReadings(executor, studentId, readings) {
  for (const day of readings || []) {
    await db.executeOn(
      executor,
      `INSERT INTO readings (student_id, read_date, source_file)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE source_file = VALUES(source_file)`,
      [studentId, day.date, day.sourceFile ?? null]
    );
    const [row] = await db.queryOn(
      executor,
      'SELECT id FROM readings WHERE student_id = ? AND read_date = ?',
      [studentId, day.date]
    );
    if (!row) throw new Error(`reading 行写入后读不回：${day.date}`);
    const readingId = row.id;

    // 派生内容按天整体重建：先删子行（questions → pieces），再插入，避免残留旧篇/旧题
    await db.executeOn(
      executor,
      `DELETE q FROM reading_questions q
         JOIN reading_pieces p ON p.id = q.piece_id
        WHERE p.reading_id = ?`,
      [readingId]
    );
    await db.executeOn(executor, 'DELETE FROM reading_pieces WHERE reading_id = ?', [readingId]);

    stats.readingDays += 1;
    for (let i = 0; i < (day.pieces || []).length; i += 1) {
      const p = day.pieces[i];
      const body = renderBodyMd(p.paragraphs);
      if (!body) {
        warn(`${day.date} 第 ${p.pieceNo} 篇正文为空，已跳过`);
        continue;
      }
      const result = await db.executeOn(
        executor,
        `INSERT INTO reading_pieces
           (reading_id, piece_no, level_code, source, title, body_md, vocabulary_notes,
            word_count, order_index)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          readingId,
          Number.isInteger(p.pieceNo) ? p.pieceNo : i + 1,
          clip(p.levelCode, LIMITS.levelCode, `${day.date} level_code`),
          p.source ?? null,
          clip(p.title, LIMITS.title, `${day.date} title`),
          body,
          (p.vocabularyNotes || '').trim() || null,
          countWords(p.paragraphs),
          i,
        ]
      );
      stats.readingPieces += 1;
      const pieceId = result.insertId;

      for (let q = 0; q < (p.questions || []).length; q += 1) {
        const item = p.questions[q];
        const question = (item.question || '').trim();
        if (!question) continue; // 题干为空的行不是题（防御历史脏解析）
        await db.executeOn(
          executor,
          `INSERT INTO reading_questions (piece_id, question_no, question, answer, order_index)
           VALUES (?,?,?,?,?)`,
          [
            pieceId,
            Number.isInteger(item.questionNo) ? item.questionNo : q + 1,
            question,
            (item.answer || '').trim() || null,
            q,
          ]
        );
        stats.readingQuestions += 1;
      }
    }
  }
}

async function syncGradeByType(executor, studentId, lessonIdByNo, lessons) {
  for (const l of lessons) {
    const lessonId = lessonIdByNo.get(l.lessonNo);
    if (!lessonId) continue;
    const homework = (l.recordsSummary || {}).homework;
    const byType = homework && homework.byType;
    if (!byType || typeof byType !== 'object' || Array.isArray(byType) || !Object.keys(byType).length) continue;

    const rows = await db.queryOn(
      executor,
      `SELECT id, payload FROM study_records
        WHERE student_id = ? AND lesson_id = ? AND record_type = 'grade'
        ORDER BY id DESC`,
      [studentId, lessonId]
    );
    if (!rows.length) {
      warn(`第 ${l.lessonNo} 课无 grade 学习记录，byType 无处回填`);
      continue;
    }
    const target = rows.find((r) => {
      const payload = parseJsonColumn(r.payload) || {};
      return !payload.byType;
    }) || null;
    if (!target) continue; // 已有 byType，保持原值
    const payload = parseJsonColumn(target.payload) || {};
    const merged = { ...payload, lessonNo: payload.lessonNo ?? l.lessonNo, byType };
    await db.executeOn(executor, 'UPDATE study_records SET payload = ? WHERE id = ?', [
      JSON.stringify(merged),
      target.id,
    ]);
    stats.byTypeBackfilled += 1;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.snapshot)) {
    throw new Error(
      `快照不存在：${args.snapshot}\n` +
        '请先运行：python backend/db/migration/export_md_to_json.py --root . --out backend/db/migration/_snapshot.json'
    );
  }
  const snapshot = JSON.parse(fs.readFileSync(args.snapshot, 'utf8'));
  const lessons = snapshot.lessons || [];
  const readings = snapshot.readings || [];
  const dates = resolveLessonDates(lessons);

  console.log(`快照：${args.snapshot}`);
  console.log(`来源：notes=${(snapshot.generatedFrom || {}).notes} records=${((snapshot.generatedFrom || {}).records || []).length} 个`);
  if (args.dryRun) console.log('模式：--dry-run（结束时整体回滚，只报告不改库）');
  console.log('');

  const before = await countTables(null);

  await db.withTransaction(async (conn) => {
    const student = await resolveStudentId(conn, args.student);
    console.log(`目标学生：id=${student.id} name=${student.name}`);
    console.log('');

    await syncLessons(conn, student.id, lessons, dates);

    const lessonRows = await db.queryOn(conn, 'SELECT id, lesson_no FROM lessons WHERE student_id = ?', [student.id]);
    const lessonIdByNo = new Map(lessonRows.map((r) => [r.lesson_no, r.id]));

    await syncSections(conn, lessonIdByNo, lessons);
    await syncExercises(conn, lessonIdByNo, lessons);
    await syncReadings(conn, student.id, readings);
    await syncGradeByType(conn, student.id, lessonIdByNo, lessons);

    // 只读断言：库内已一致的资产不重写，不一致就告警（不中断）
    const [wwRow] = await db.queryOn(conn, 'SELECT COUNT(*) AS n FROM mistakes WHERE student_id = ?', [student.id]);
    if (wwRow.n !== (snapshot.mistakes || []).length) {
      warn(`mistakes 库内 ${wwRow.n} 条 vs 快照 ${(snapshot.mistakes || []).length} 条，不一致；按「以错词本为准」口径不自动写库`);
    }
    const [vRow] = await db.queryOn(conn, 'SELECT COUNT(*) AS n FROM vocabulary WHERE student_id = ?', [student.id]);
    // 库内按 word 全局去重；快照 vocabulary 是按课列出的，故先跨课求并集再比
    const wordsGlobal = new Set();
    for (const l of lessons) for (const v of l.vocabulary || []) if (v && v.word) wordsGlobal.add(v.word);
    if (vRow.n !== wordsGlobal.size) {
      warn(`vocabulary 库内 ${vRow.n} 个去重词 vs 快照 ${wordsGlobal.size} 个，不一致（仅提示，不自动写库）`);
    }

    if (args.dryRun) {
      throw Object.assign(new Error('__DRY_RUN_ROLLBACK__'), { dryRun: true });
    }
  }).catch((err) => {
    if (err && err.dryRun) return; // dry-run 的正常出口
    throw err;
  });

  const after = args.dryRun ? before : await countTables(null);

  console.log('');
  console.log('写入统计：');
  console.log(`  lesson_date 补齐 ${stats.lessonDateFilled} · 日期冲突(保留库内) ${stats.lessonDateMismatch}`);
  console.log(`  lesson_sections ${stats.sectionsWritten} · lesson_exercises ${stats.exercisesWritten}`);
  console.log(`  readings ${stats.readingDays} 天 / ${stats.readingPieces} 篇 / ${stats.readingQuestions} 题`);
  console.log(`  study_records.byType 回填 ${stats.byTypeBackfilled} 课 · 跳过 ${stats.skipped}`);
  console.log('');
  console.log('计数对比：');
  const keys = ['lessons', 'sections', 'exercises', 'readings', 'pieces', 'questions', 'mistakes'];
  for (const k of keys) {
    const flag = before[k] === after[k] ? '±0' : `${before[k]} → ${after[k]}`;
    console.log(`  ${k.padEnd(10)} ${flag}`);
  }
  console.log(`  mistakes md5  ${before.mistakesMd5 === after.mistakesMd5 ? '未变' : '已变（异常！）'}`);
  console.log('');
  if (warnings.length) {
    console.log(`告警 ${warnings.length} 条（见上）`);
  }

  const pieces = (snapshot.readings || []).reduce((a, d) => a + (d.pieces || []).length, 0);
  if (args.dryRun) {
    console.log(`M2_IMPORT_DRYRUN lessons=${lessons.length} exercises=${stats.exercisesWritten} readings=${readings.length}(pieces=${pieces}) warnings=${warnings.length}`);
  } else {
    console.log(`M2_IMPORT_OK lessons=${lessons.length} sections=${stats.sectionsWritten} exercises=${stats.exercisesWritten} readings=${stats.readingDays}(pieces=${stats.readingPieces},questions=${stats.readingQuestions}) byType=${stats.byTypeBackfilled} warnings=${warnings.length}`);
  }
}

main()
  .then(async () => {
    await db.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('M2_IMPORT_FAIL', err && err.message ? err.message : err);
    try {
      await db.close();
    } catch {
      /* ignore */
    }
    process.exit(1);
  });
