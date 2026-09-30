'use strict';

/**
 * `lesson_exercises.error_type` 逐题回填器
 * ---------------------------------------------------------------------------
 * 输入：`records/exercise-error-types.json`（Amy 产出，逐题错误类型映射）
 *       结构见 `records/README.md` §5.3 与 `docs/ai-teacher.md` §11.5。
 *
 * 为什么单独一个脚本：
 *   `error_type` 一题只有一个值，且**只能由教学侧判定**（用词 vs 语法判不出靠文本匹配）。
 *   故它不是 `db:import` 能推出来的派生字段 —— 必须由 Amy 给出逐题映射后单独回填。
 *
 * 定位键：(课号, block_kind, 题号)
 *   - JSON 的 `kind` 与库内 `block_kind` **同值**（homework / backfill）
 *   - JSON 不含 `blockNo`，但同一 kind 内 `exerciseNo` 唯一，故三元组足以唯一定位
 *
 * 两条硬校验（不通过即告警，不静默写库）
 *   1. JSON `errorType != null`  ⇔  库内 `is_correct = 0`（判错才可能有错误类型）
 *   2. JSON `errorType == null` ⟹  库内保持 NULL（正确 / 有备注 / 空题都不落类型）
 *
 * 幂等：重复执行第二次起 `updated=0`。
 * 用法：
 *   node db/migration/apply_error_types.js --dry-run
 *   node db/migration/apply_error_types.js
 *   node db/migration/apply_error_types.js --json <path> --student <name|id>
 */

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const db = require('../../src/config/db');

const DEFAULT_JSON = path.join(__dirname, '..', '..', '..', 'records', 'exercise-error-types.json');

/** 与 schema.sql / constants.js 同源的枚举白名单 */
const ERROR_TYPES = ['grammar', 'spelling', 'punctuation', 'word_choice', 'capitalization', 'other'];
const BLOCK_KINDS = ['homework', 'backfill'];

const warnings = [];

function warn(msg) {
  warnings.push(msg);
  console.log(`  ! ${msg}`);
}

function parseArgs(argv) {
  const args = { json: DEFAULT_JSON, dryRun: false, student: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--json') args.json = argv[++i];
    else if (a === '--student') args.student = argv[++i];
  }
  return args;
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.json)) throw new Error(`映射文件不存在：${args.json}`);
  const doc = JSON.parse(fs.readFileSync(args.json, 'utf8'));
  const rows = doc.rows || [];

  console.log(`映射：${args.json}`);
  console.log(`来源：${doc.generatedBy || '?'} @ ${doc.generatedAt || '?'}　目标列：${doc.targetField || '?'}`);
  console.log(`行数：${rows.length}（其中 errorType 非空 ${rows.filter((r) => r.errorType).length}）`);
  if (args.dryRun) console.log('模式：--dry-run（结束时整体回滚，只报告不改库）');
  console.log('');

  const stats = { updated: 0, unchanged: 0, missing: 0, mismatchVerdict: 0 };

  await db.withTransaction(async (conn) => {
    const student = await resolveStudentId(conn, args.student);
    const lessonRows = await db.queryOn(conn, 'SELECT id, lesson_no FROM lessons WHERE student_id = ?', [student.id]);
    const lessonIdByNo = new Map(lessonRows.map((r) => [r.lesson_no, r.id]));

    const ex = await db.queryOn(
      conn,
      `SELECT e.id, e.lesson_id, l.lesson_no, e.block_kind, e.exercise_no, e.is_correct, e.error_type
         FROM lesson_exercises e JOIN lessons l ON l.id = e.lesson_id
        WHERE l.student_id = ?`,
      [student.id]
    );
    const byKey = new Map(ex.map((r) => [`${r.lesson_no}|${r.block_kind}|${r.exercise_no}`, r]));
    console.log(`库内练习题：${ex.length} 条（学生 id=${student.id} ${student.name}）`);
    console.log('');

    for (const r of rows) {
      const kind = BLOCK_KINDS.includes(r.kind) ? r.kind : null;
      if (!kind) {
        warn(`第 ${r.lessonNo} 课 kind=${JSON.stringify(r.kind)} 不在白名单，已跳过`);
        stats.missing += 1;
        continue;
      }
      const want = r.errorType == null ? null : r.errorType;
      if (want != null && !ERROR_TYPES.includes(want)) {
        warn(`第 ${r.lessonNo} 课 ${kind} 第 ${r.exerciseNo} 题 errorType=${JSON.stringify(want)} 非法，已跳过`);
        stats.missing += 1;
        continue;
      }
      const row = byKey.get(`${r.lessonNo}|${kind}|${r.exerciseNo}`);
      if (!row) {
        warn(`第 ${r.lessonNo} 课 ${kind} 第 ${r.exerciseNo} 题在库内找不到，已跳过`);
        stats.missing += 1;
        continue;
      }

      // 硬校验 1：判错 ⇔ 有类型
      const isCorrect = row.is_correct === null ? null : Number(row.is_correct) === 1;
      if (isCorrect === false && want == null) {
        stats.mismatchVerdict += 1;
        warn(`第 ${r.lessonNo} 课 ${kind} 第 ${r.exerciseNo} 题库内判错（is_correct=0）但映射未给类型 —— 保持 NULL，请 Amy 补定`);
      }
      if (isCorrect === true && want != null) {
        stats.mismatchVerdict += 1;
        warn(`第 ${r.lessonNo} 课 ${kind} 第 ${r.exerciseNo} 题库内判对（is_correct=1）但映射给了 ${want} —— 仍按映射写入，请核对`);
      }

      const cur = row.error_type == null ? null : row.error_type;
      if (cur === want) {
        stats.unchanged += 1;
        continue;
      }
      await db.executeOn(conn, 'UPDATE lesson_exercises SET error_type = ? WHERE id = ?', [want, row.id]);
      stats.updated += 1;
      console.log(`  ${cur == null ? '∅' : cur} → ${want == null ? 'NULL' : want}　(L${r.lessonNo} ${kind}#${r.exerciseNo}, id=${row.id}, is_correct=${row.is_correct})`);
    }

    if (args.dryRun) throw Object.assign(new Error('__DRY_RUN_ROLLBACK__'), { dryRun: true });
  }).catch((err) => {
    if (err && err.dryRun) return;
    throw err;
  });

  console.log('');
  console.log(`回填统计：更新 ${stats.updated} · 未变 ${stats.unchanged} · 定位不到 ${stats.missing} · 判定冲突 ${stats.mismatchVerdict}`);
  if (warnings.length) console.log(`告警 ${warnings.length} 条（见上）`);
  console.log('');
  console.log(
    `${args.dryRun ? 'ERROR_TYPES_DRYRUN' : 'ERROR_TYPES_OK'} rows=${rows.length} updated=${stats.updated} unchanged=${stats.unchanged} missing=${stats.missing} warnings=${warnings.length}`
  );
}

main()
  .then(async () => {
    await db.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('ERROR_TYPES_FAIL', err && err.message ? err.message : err);
    try {
      await db.close();
    } catch {
      /* ignore */
    }
    process.exit(1);
  });
