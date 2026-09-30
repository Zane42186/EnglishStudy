'use strict';

/**
 * M2 校验步（只读）：把 export_md_to_json.py 的产物与库内数据逐项比对。
 *
 * 两个用途：
 *   1. 写库**前** —— 看清哪些数据能复现、哪些不能（历史用途，见 04-migration 五之三）；
 *   2. 写库**后** —— 作为 `import_json.js` 的回填验收：除少数口径类差异外应全绿。
 * 脚本自身**只读，不写任何表**；上游是自包含导出器，不再依赖 `build_board.py`。
 *
 * 用法：node db/migration/compare_snapshot.js [snapshotPath]
 * 成功：M2_COMPARE_OK match=<n> diff=<n> gap=<n>
 */

const path = require('path');
const fs = require('fs');
const db = require('../../src/config/db');

const SNAPSHOT =
  process.argv[2] || path.join(__dirname, '_snapshot.json');

const rows = [];
function add(level, item, expected, actual, note) {
  rows.push({ level, item, expected, actual, note });
}

/** 取默认学生（单用户） */
async function getDefaultStudent() {
  const r = await db.query('SELECT id, name FROM students ORDER BY id LIMIT 1');
  return r[0];
}

async function main() {
  if (!fs.existsSync(SNAPSHOT)) {
    console.error(`M2_COMPARE_FAIL 原因=快照文件不存在：${SNAPSHOT}`);
    process.exit(1);
  }
  const snap = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf-8'));
  const student = await getDefaultStudent();
  const sid = student.id;

  // ---- 1. lessons ----
  const dbLessons = await db.query(
    'SELECT lesson_no, lesson_date, summary FROM lessons WHERE student_id = ? ORDER BY lesson_no',
    [sid]
  );
  add(
    dbLessons.length === snap.lessons.length ? 'match' : 'diff',
    'lessons 课数',
    snap.lessons.length,
    dbLessons.length,
    ''
  );

  const dbDateByNo = new Map(dbLessons.map((r) => [r.lesson_no, r.lesson_date]));
  const dateGap = [];
  // 与 import_json.js 同款规则：md 有日期就用，没写就沿用上一课日期（第 2、4 课标题本就无日期）
  let carriedDate = null;
  for (const l of snap.lessons) {
    const expected = l.lessonDate || carriedDate;
    carriedDate = expected;
    const dbDate = dbDateByNo.get(l.lessonNo) || null;
    if (dbDate !== (expected || null)) {
      dateGap.push(`第 ${l.lessonNo} 课 解析=${expected} db=${dbDate}`);
    }
  }
  add(
    dateGap.length === 0 ? 'match' : 'gap',
    'lessons.lesson_date（含「同日沿用当日日期」）',
    '全部一致',
    dateGap.length === 0 ? '一致' : `${dateGap.length} 处不一致`,
    dateGap.join('; ') || 'md 未写日期的课次，按上一课日期沿用后与库内一致'
  );

  // ---- 2. vocabulary ----
  const dbVocab = await db.query(
    'SELECT COUNT(*) AS total FROM vocabulary WHERE student_id = ?',
    [sid]
  );
  const mdUnique = new Set();
  let mdByCourse = 0;
  for (const l of snap.lessons) {
    for (const v of l.vocabulary) {
      mdUnique.add(v.word.toLowerCase());
      mdByCourse += 1;
    }
  }
  add(
    dbVocab[0].total === mdUnique.size ? 'match' : 'diff',
    'vocabulary 去重词数',
    mdUnique.size,
    dbVocab[0].total,
    `md 按课累计 ${mdByCourse}`
  );

  const dbLV = await db.query(
    `SELECT COUNT(*) AS total FROM lesson_vocabulary lv
     JOIN lessons l ON l.id = lv.lesson_id WHERE l.student_id = ?`,
    [sid]
  );
  add(
    dbLV[0].total === mdByCourse ? 'match' : 'diff',
    'lesson_vocabulary 关联数',
    mdByCourse,
    dbLV[0].total,
    ''
  );

  // ---- 3. mistakes ----
  const dbMistakes = await db.query(
    'SELECT wrong_text, status FROM mistakes WHERE student_id = ?',
    [sid]
  );
  add(
    dbMistakes.length === snap.mistakes.length ? 'match' : 'diff',
    'mistakes 条数',
    snap.mistakes.length,
    dbMistakes.length,
    ''
  );
  const dbSet = new Set(dbMistakes.map((m) => m.wrong_text));
  const mdSet = new Set(snap.mistakes.map((m) => m.wrongText));
  const onlyDb = [...dbSet].filter((x) => !mdSet.has(x));
  const onlyMd = [...mdSet].filter((x) => !dbSet.has(x));
  add(
    onlyDb.length === 0 && onlyMd.length === 0 ? 'match' : 'diff',
    'mistakes wrong_text 集合',
    `${mdSet.size} 条`,
    `${dbSet.size} 条`,
    onlyDb.length || onlyMd.length
      ? `仅库内=${JSON.stringify(onlyDb)} 仅 md=${JSON.stringify(onlyMd)}`
      : '完全一致'
  );
  const dbSt = {
    passed: dbMistakes.filter((m) => m.status === 'passed').length,
    pending: dbMistakes.filter((m) => m.status === 'pending').length,
  };
  const mdSt = {
    passed: snap.mistakes.filter((m) => m.status === 'passed').length,
    pending: snap.mistakes.filter((m) => m.status === 'pending').length,
  };
  add(
    dbSt.passed === mdSt.passed && dbSt.pending === mdSt.pending ? 'match' : 'diff',
    'mistakes.status 分布',
    `passed ${mdSt.passed} / pending ${mdSt.pending}`,
    `passed ${dbSt.passed} / pending ${dbSt.pending}`,
    ''
  );

  // ---- 4. lesson_sections ----
  const dbSec = await db.query(
    `SELECT section_type, COUNT(*) AS total FROM lesson_sections ls
     JOIN lessons l ON l.id = ls.lesson_id WHERE l.student_id = ?
     GROUP BY section_type`,
    [sid]
  );
  const dbSecTotal = dbSec.reduce((s, r) => s + r.total, 0);
  const mdSecTotal = snap.lessons.reduce((s, l) => s + l.sections.length, 0);
  add(
    dbSecTotal === mdSecTotal ? 'match' : 'diff',
    'lesson_sections 条数',
    mdSecTotal,
    dbSecTotal,
    `md 覆盖 8 类/课 + 有补漏块的课加 1 条 section_type='backfill'；库内现有：${dbSec.map((r) => `${r.section_type}=${r.total}`).join(' ') || '（空）'}`
  );

  // ---- 5. lesson_exercises ----
  const dbEx = await db.query(
    `SELECT COUNT(*) AS total,
            SUM(block_kind = 'homework') AS homework,
            SUM(block_kind = 'backfill') AS backfill,
            SUM(is_correct IS NULL)      AS ungraded,
            SUM(is_correct = 0)          AS wrong,
            SUM(error_type IS NOT NULL)  AS with_error_type
       FROM lesson_exercises le
       JOIN lessons l ON l.id = le.lesson_id WHERE l.student_id = ?`,
    [sid]
  );
  const mdEx = snap.lessons.reduce((s, l) => s + l.exercises.length, 0);
  const mdHw = snap.lessons.reduce((s, l) => s + l.exercises.filter((e) => e.blockKind === 'homework').length, 0);
  const mdBf = mdEx - mdHw;
  // MySQL 的 SUM() 走 DECIMAL，mysql2 返回字符串——必须显式转数字，否则 "25" !== 25 会假报差异
  const dbExTotal = Number(dbEx[0].total);
  const dbExHw = Number(dbEx[0].homework);
  const dbExBf = Number(dbEx[0].backfill);
  const dbExUngraded = Number(dbEx[0].ungraded);
  const dbExWrong = Number(dbEx[0].wrong);
  const dbExWithType = Number(dbEx[0].with_error_type);
  add(
    dbExTotal === mdEx ? 'match' : 'gap',
    'lesson_exercises 条数',
    mdEx,
    dbExTotal,
    '判定来自 records/*.json（isCorrect/errorNote/revisedAnswer）；题干来自 md'
  );
  add(
    dbExHw === mdHw && dbExBf === mdBf ? 'match' : 'diff',
    'lesson_exercises 题块拆分',
    `homework ${mdHw} / backfill ${mdBf}`,
    `homework ${dbExHw} / backfill ${dbExBf}`,
    '两套题号命名空间，唯一键含 block_kind + block_no'
  );
  add(
    dbExUngraded === 0 ? 'match' : 'diff',
    'lesson_exercises 已批改覆盖',
    '全部有 is_correct',
    `未批改 ${dbExUngraded} 条`,
    `答错 ${dbExWrong} 条`
  );
  // error_type 的正误口径：**只有判错的题才有类型**，其余（正确/有备注/空题）必须保持 NULL。
  // 因此不能拿「已填 == 总数」当断言（那是旧的错误期望，会把 24 条本该 NULL 的题当成缺口）。
  // 这里改为逐题比对值：快照（来自 exercise-error-types.json）× 库内。
  const dbExTypes = await db.query(
    `SELECT l.lesson_no, le.block_kind, le.exercise_no, le.error_type
       FROM lesson_exercises le JOIN lessons l ON l.id = le.lesson_id
      WHERE l.student_id = ?`,
    [sid]
  );
  const mdTypeByKey = new Map();
  for (const l of snap.lessons) {
    for (const e of l.exercises) {
      mdTypeByKey.set(`${l.lessonNo}|${e.blockKind}|${e.exerciseNo}`, e.errorType == null ? null : e.errorType);
    }
  }
  const mdWithType = [...mdTypeByKey.values()].filter(Boolean).length;
  const typeMismatches = [];
  for (const r of dbExTypes) {
    const key = `${r.lesson_no}|${r.block_kind}|${r.exercise_no}`;
    if (!mdTypeByKey.has(key)) {
      typeMismatches.push(`${key} 库内多出`);
      continue;
    }
    const want = mdTypeByKey.get(key);
    const got = r.error_type == null ? null : r.error_type;
    if (want !== got) typeMismatches.push(`${key}: 库=${got} md=${want}`);
  }
  const typeOk = typeMismatches.length === 0 && dbExWithType === mdWithType;
  add(
    typeOk ? 'match' : 'diff',
    'lesson_exercises.error_type',
    `已填 ${mdWithType} / ${mdTypeByKey.size}（仅判错题有类型）`,
    `已填 ${dbExWithType} / ${dbExTotal}`,
    typeOk
      ? `逐题与 records/exercise-error-types.json 一致；其余 ${dbExTotal - dbExWithType} 条按口径保持 NULL`
      : `逐题不一致 ${typeMismatches.length} 处：${typeMismatches.slice(0, 6).join(' ; ')}`
  );

  // ---- 6. readings ----
  const tables = await db.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()"
  );
  const TABLE_NAMES = tables.map((t) => t.TABLE_NAME || t.table_name);
  const hasReadings = TABLE_NAMES.includes('readings');
  const mdPieces = snap.readings.reduce((s, r) => s + r.pieces.length, 0);
  const mdQuestions = snap.readings.reduce(
    (s, r) => s + r.pieces.reduce((a, p) => a + p.questions.length, 0),
    0
  );
  if (!hasReadings) {
    add('gap', 'readings 表', `md 有 ${snap.readings.length} 天 / ${mdPieces} 篇`, '表不存在', '');
  } else {
    const dbDays = await db.query(
      'SELECT COUNT(*) AS n FROM readings WHERE student_id = ?',
      [sid]
    );
    const dbPieces = await db.query(
      `SELECT COUNT(*) AS n FROM reading_pieces p
        JOIN readings r ON r.id = p.reading_id WHERE r.student_id = ?`,
      [sid]
    );
    const dbQuestions = await db.query(
      `SELECT COUNT(*) AS n FROM reading_questions q
        JOIN reading_pieces p ON p.id = q.piece_id
        JOIN readings r ON r.id = p.reading_id WHERE r.student_id = ?`,
      [sid]
    );
    add(
      dbDays[0].n === snap.readings.length ? 'match' : 'diff',
      'readings 天数',
      snap.readings.length,
      dbDays[0].n,
      '幂等键 uk_reading_day (student_id, read_date)'
    );
    add(
      dbPieces[0].n === mdPieces ? 'match' : 'diff',
      'reading_pieces 篇数',
      mdPieces,
      dbPieces[0].n,
      ''
    );
    add(
      dbQuestions[0].n === mdQuestions ? 'match' : 'diff',
      'reading_questions 题数',
      mdQuestions,
      dbQuestions[0].n,
      '题干与答案必须成对——早期解析会把 <details> 答案行误当新题（题数翻倍）'
    );
  }

  // ---- 输出 ----
  const icon = { match: '✅', diff: '⚠️', gap: '⛔' };
  let nMatch = 0;
  let nDiff = 0;
  let nGap = 0;
  console.log('M2 只读比对：导出结果 vs 库内现有数据');
  console.log('='.repeat(78));
  for (const r of rows) {
    if (r.level === 'match') nMatch += 1;
    else if (r.level === 'diff') nDiff += 1;
    else nGap += 1;
    console.log(`${icon[r.level]} ${r.item}`);
    console.log(`     md/期望: ${r.expected}   |   库内: ${r.actual}`);
    if (r.note) console.log(`     note   : ${r.note}`);
  }
  console.log('='.repeat(78));
  console.log(`一致 ${nMatch} · 差异 ${nDiff} · 缺口 ${nGap}`);
  console.log(`M2_COMPARE_OK match=${nMatch} diff=${nDiff} gap=${nGap}`);
}

main()
  .catch((err) => {
    console.error(`M2_COMPARE_FAIL 原因=${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => db.close());
