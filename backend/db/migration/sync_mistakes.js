'use strict';

/**
 * 错词本 → 库 同步器（单向：错词本是权威，本脚本只是把权威搬进库）
 * ---------------------------------------------------------------------------
 * 为什么需要它：
 *   `db:import`（import_json.js）**按约定不写 `mistakes`**（见其文件头 ⛔ 段），
 *   因此错词本每次改动，库内都不会自动跟上，只能靠人工 SQL —— 这既易错又不可复跑。
 *   本脚本把这条「错词本 → 库」路径**显式化、幂等化**：独立通道，人工显式触发。
 *   ⇒ 约定不变：`db:import` 仍不写 mistakes；写 mistakes 只走本脚本。
 *
 * 输入：`_snapshot.json` 的 `mistakes[]`（由 `export_md_to_json.py` 解析 `wrong-words.md` 得到）。
 *       **本脚本不解析 md 散文**，只读 JSON —— 与「后端只读 JSON」口径一致。
 *
 * 写入规则（按 `records/README.md` §5.2 与 `wrong-words.md` 的列口径）
 *   - 匹配键：`wrongText` 规范化（去括号批注 + 折叠空白 + 转小写）后比对
 *     ⇒ 库内旧格式 `zane（人名小写）` 能与 md 的 `zane` 正确配对，不会误判为新行
 *   - 命中 → 同步 7 个内容列：wrong_text / correct_text / error_reason /
 *            error_type / streak / wrong_count / status（**不动 first/last_lesson_id**）
 *   - 未命中 → INSERT（first_lesson_id = last_lesson_id = 该行 firstLessonNo）
 *   - 全部在**单事务**内完成；`--dry-run` 整体回滚，只报告
 *
 * 幂等：重复执行第二次起 `updated=0 inserted=0`。
 *
 * 用法：
 *   node db/migration/sync_mistakes.js --dry-run
 *   node db/migration/sync_mistakes.js
 *   node db/migration/sync_mistakes.js --snapshot <path> --student <name|id>
 */

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const db = require('../../src/config/db');
// 判重键**唯一实现**：与写接口 `POST /api/mistakes` 共用同一份，
// 两条「错词本 → 库」路径对「同一行」的判断必须逐字一致（否则即 DQ1 成因）。
const { normKey } = require('../../src/utils/mistakeKey');
// 枚举白名单**只从 src/constants.js 取**（唯一来源，与 schema.sql 的 ENUM 同源）。
// 原先本文件内联了 2 份局部数组，与 constants 各存一份 —— 改枚举时极易只改一处而漂移。
const {
  ERROR_TYPE: ERROR_TYPES,
  MISTAKE_STATUS: STATUSES,
} = require('../../src/constants');

const DEFAULT_SNAPSHOT = path.join(__dirname, '_snapshot.json');

const CONTENT_COLS = [
  'wrong_text', 'correct_text', 'error_reason', 'error_type', 'streak', 'wrong_count', 'status',
];

const warnings = [];

function warn(msg) {
  warnings.push(msg);
  console.log(`  ! ${msg}`);
}

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

function asEnum(value, allowed, label) {
  if (allowed.includes(value)) return value;
  warn(`${label} 出现非法枚举值 ${JSON.stringify(value)}，已跳过该行`);
  return null;
}

function toInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
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
  if (!fs.existsSync(args.snapshot)) {
    throw new Error(
      `快照不存在：${args.snapshot}\n请先运行：npm run db:export`
    );
  }
  const snapshot = JSON.parse(fs.readFileSync(args.snapshot, 'utf8'));
  const wanted = snapshot.mistakes || [];

  console.log(`快照：${args.snapshot}`);
  console.log(`错词本行数：${wanted.length}`);
  if (args.dryRun) console.log('模式：--dry-run（结束时整体回滚，只报告不改库）');
  console.log('');

  const stats = { updated: 0, inserted: 0, unchanged: 0, skipped: 0 };
  const details = [];

  await db.withTransaction(async (conn) => {
    const student = await resolveStudentId(conn, args.student);
    console.log(`目标学生：id=${student.id} name=${student.name}`);

    const lessonRows = await db.queryOn(conn, 'SELECT id, lesson_no FROM lessons WHERE student_id = ?', [student.id]);
    const lessonIdByNo = new Map(lessonRows.map((r) => [r.lesson_no, r.id]));

    const dbRows = await db.queryOn(
      conn,
      `SELECT id, first_lesson_id, last_lesson_id, ${CONTENT_COLS.join(', ')}
         FROM mistakes WHERE student_id = ?`,
      [student.id]
    );
    const dbByKey = new Map();
    for (const r of dbRows) {
      const k = normKey(r.wrong_text);
      if (dbByKey.has(k)) warn(`库内有两条规范化后同键的错词：${r.wrong_text} —— 取 id 较小者`);
      else dbByKey.set(k, r);
    }

    console.log(`库内行数：${dbRows.length}`);
    console.log('');

    for (const w of wanted) {
      const key = normKey(w.wrongText);
      if (!key) {
        stats.skipped += 1;
        warn('错词本有一行 wrongText 为空，已跳过');
        continue;
      }
      const errorType = asEnum(w.errorType, ERROR_TYPES, `错词本「${w.wrongText}」的 error_type`);
      const status = asEnum(w.status, STATUSES, `错词本「${w.wrongText}」的 status`);
      if (!errorType || !status) {
        stats.skipped += 1;
        continue;
      }
      const target = {
        wrong_text: w.wrongText,
        correct_text: w.correctText ?? null,
        error_reason: w.errorReason ?? null,
        error_type: errorType,
        streak: toInt(w.streak) ?? 0,
        wrong_count: toInt(w.wrongCount) ?? 1,
        status,
      };

      const existing = dbByKey.get(key);

      if (!existing) {
        const lessonId = lessonIdByNo.get(w.firstLessonNo) ?? null;
        if (w.firstLessonNo != null && lessonId == null) {
          stats.skipped += 1;
          warn(`「${w.wrongText}」找不到第 ${w.firstLessonNo} 课，已跳过`);
          continue;
        }
        await db.executeOn(
          conn,
          `INSERT INTO mistakes
             (student_id, first_lesson_id, last_lesson_id, wrong_text, correct_text,
              error_type, error_reason, streak, wrong_count, status)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [
            student.id, lessonId, lessonId, target.wrong_text, target.correct_text,
            target.error_type, target.error_reason, target.streak, target.wrong_count, target.status,
          ]
        );
        stats.inserted += 1;
        details.push(`+ 新增 L${w.firstLessonNo ?? '-'} ｜ ${target.wrong_text} ｜ ${target.error_type} ｜ wc=${target.wrong_count} ${target.status}`);
        continue;
      }

      const diffs = CONTENT_COLS.filter((c) => String(existing[c] ?? '') !== String(target[c] ?? ''));
      if (!diffs.length) {
        stats.unchanged += 1;
        continue;
      }
      await db.executeOn(
        conn,
        `UPDATE mistakes SET ${CONTENT_COLS.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
        [...CONTENT_COLS.map((c) => target[c]), existing.id]
      );
      stats.updated += 1;
      details.push(`~ 更新 id=${existing.id} ｜ ${diffs.map((c) => `${c}: "${existing[c] ?? ''}" → "${target[c] ?? ''}"`).join(' ; ')}`);
    }

    if (args.dryRun) throw Object.assign(new Error('__DRY_RUN_ROLLBACK__'), { dryRun: true });
  }).catch((err) => {
    if (err && err.dryRun) return;
    throw err;
  });

  if (details.length) {
    console.log('变更明细：');
    for (const d of details) console.log(`  ${d}`);
    console.log('');
  }
  console.log(`同步统计：新增 ${stats.inserted} · 更新 ${stats.updated} · 未变 ${stats.unchanged} · 跳过 ${stats.skipped}`);
  if (warnings.length) console.log(`告警 ${warnings.length} 条（见上）`);
  console.log('');
  console.log(
    `${args.dryRun ? 'MISTAKES_SYNC_DRYRUN' : 'MISTAKES_SYNC_OK'} ` +
      `book=${wanted.length} inserted=${stats.inserted} updated=${stats.updated} unchanged=${stats.unchanged} warnings=${warnings.length}`
  );
}

main()
  .then(async () => {
    await db.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('MISTAKES_SYNC_FAIL', err && err.message ? err.message : err);
    try {
      await db.close();
    } catch {
      /* ignore */
    }
    process.exit(1);
  });
