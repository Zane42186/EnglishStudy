'use strict';

/**
 * M2 第二步（只读）：把 export_md_to_json.py 的产物与库内现有数据逐项比对。
 *
 * 目的：在「写库」之前先证明——复用 build_board.py 的解析规则能复现哪些数据、
 * 哪些复现不了。**只读，不写任何表**。
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
  for (const l of snap.lessons) {
    const dbDate = dbDateByNo.get(l.lessonNo);
    const mdDate = l.lessonDate;
    if ((dbDate || null) !== (mdDate || null)) {
      dateGap.push(`第 ${l.lessonNo} 课 md=${mdDate} db=${dbDate}`);
    }
  }
  add(
    dateGap.length === 0 ? 'match' : 'gap',
    'lessons.lesson_date',
    '全部一致',
    dateGap.length === 0 ? '一致' : `${dateGap.length} 处不一致`,
    dateGap.join('; ') || '（无日期课次两侧均为 NULL）'
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
    `md 覆盖 8 类/课；库内现有：${dbSec.map((r) => `${r.section_type}=${r.total}`).join(' ')}`
  );

  // ---- 5. lesson_exercises ----
  const dbEx = await db.query(
    `SELECT COUNT(*) AS total FROM lesson_exercises le
     JOIN lessons l ON l.id = le.lesson_id WHERE l.student_id = ?`,
    [sid]
  );
  const mdEx = snap.lessons.reduce((s, l) => s + l.exercises.length, 0);
  add(
    dbEx[0].total === mdEx ? 'match' : 'gap',
    'lesson_exercises 条数',
    mdEx,
    dbEx[0].total,
    'md 中 isCorrect/errorType/errorNote/selfCheck 均需 amy 判定，暂为 null'
  );

  // ---- 6. readings ----
  const tables = await db.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()"
  );
  const hasReadings = tables.some((t) => /^readings$/.test(t.TABLE_NAME || t.table_name));
  const mdPieces = snap.readings.reduce((s, r) => s + r.pieces.length, 0);
  add(
    hasReadings ? 'match' : 'gap',
    'readings 表',
    `md 有 ${snap.readings.length} 天 / ${mdPieces} 篇`,
    hasReadings ? '表已建' : '表不存在',
    'P1 表未建 → 看板「阅读篇数」恒为 —'
  );

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
