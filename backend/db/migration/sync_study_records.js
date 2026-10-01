'use strict';

/**
 * teach:sync —— `records/*.study-record.json` 的消费方（学习记录归档入库）
 * =============================================================================
 * 为什么需要它
 *   Amy 每上完一课都会产出 `records/lesson-NN.study-record.json`（三条时序记录：
 *   attend / grade / feedback）。但在此之前**没有任何消费方**：
 *   `db:import` 只会把 `byType` 合并进「已存在」的 grade 行，**从不创建** `study_records`，
 *   导致第 7 课的记录一直落不了库，连带卡住 G4（lastIncomplete）与 `progress.lastClassDate`。
 *   本脚本补上这条断链。
 *
 * 设计约束（Amy 在 docs/Work Alignment/status-amy.md §1.8 提的四条，全部满足）
 *   ① 幂等 + `--dry-run`：重复跑不产生新行，且可与既有三器同样先试跑；
 *   ② **输出同步报告**：逐类打印「新增 / 更新 / 跳过 / 告警」计数 —— 不接受一句「同步完成」；
 *   ③ **缺字段报错**，绝不静默跳过；未知键只告警（前向兼容，Skill 加字段不升版本）；
 *   ④ **纯 DB 直连，不走 HTTP**：不依赖后端服务在线，不与端口纪律冲突。
 *
 * 幂等怎么保证（两层，缺一不可）
 *   第一层 DB：`study_records` 于 2026-10-01 已加 `uk_study_records_dedupe (student_id, dedupe_key)`，
 *               键格式 `lesson-<lessonNo>:<record_type>`（见 db/migration/add_study_records_dedupe_key.js）。
 *               ※ 该表此前**没有任何唯一键**，ON DUPLICATE 会静默退化成 INSERT（DQ1 同型事故）。
 *   第二层应用：本脚本走显式 SELECT-then-write（`findByDedupeKey` → UPDATE / INSERT），
 *               所以「已存在」是**可控的更新或跳过**，而不是靠数据库抛异常来兜。
 *
 * 写什么 / 不写什么
 *   ✅ study_records  —— attend / grade / feedback 三条，payload **原样落库**
 *                        （★ 不走 API 侧的白名单过滤：`records/` 是机读权威，
 *                          blankCount / backfill* / newMistakes / levelBefore 等字段
 *                          不在 05 的白名单里，过滤掉就等于丢数据）
 *   ✅ progress       —— 只写 7 个教学列；`note` 是人工列，绝不触碰
 *   ⛔ lessons        —— 不改任何课程字段（计数口径归 db:import 的 syncLessonCounts）
 *   ⛔ progress_feedback —— 该表尚未建（P2 阶段），本轮不涉及
 *
 * progress 的写法（2026-10-01 与 Amy 对齐后的口径）
 *   单调守卫（取 max，回退 = 重放旧文件，必须挡住）：`last_class_date` / `current_lesson_no`
 *   以文件声明值为准覆盖（**必须允许回退**）：
 *     `current_level`          —— 「太难」要降级
 *     `easy_streak`            —— 任何非「太简单」的反馈都要清零
 *     `last_feedback`          —— 语义就是「最近一次」
 *     `upgrade_frozen_until`   —— 降级置 课号+3，升满可清
 *   缺省语义：`easyStreak` 未声明时**按规则推导**（feedback ≠ too_easy → 0），
 *             并计入报告的「推导」计数（不是静默）；`upgradeFrozenUntil` 未声明则保持不动。
 *
 * 用法
 *   node db/migration/sync_study_records.js --dry-run        # 只报告，最后整体回滚
 *   node db/migration/sync_study_records.js                  # 写库
 *   node db/migration/sync_study_records.js --lesson 7       # 只处理第 7 课
 *   node db/migration/sync_study_records.js --student Amy    # 指定学生（默认取第一个）
 *   node db/migration/sync_study_records.js --records <dir>  # 指定 records 目录
 * =============================================================================
 */

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const db = require('../../src/config/db');
const studyRecordRepository = require('../../src/repositories/studyRecord.repository');
// 复用 API 侧同一句摘要文案，避免「归档写的摘要」与「API 写的摘要」两处漂移
const { defaultSummary } = require('../../src/services/studyRecord.service');
const { FEEDBACK } = require('../../src/constants');

const DEFAULT_RECORDS_DIR = path.join(__dirname, '..', '..', '..', 'records');

/** 三类记录的必填字段（缺一即报错退出，不写半截） */
const REQUIRED = {
  attend: ['lessonNo', 'lessonDate', 'level'],
  grade: ['lessonNo', 'exerciseCount', 'errorCount'],
  feedback: ['lessonNo', 'lessonDate', 'feedback', 'levelBefore', 'levelAfter'],
};

/** 文件顶层可作 payload 字段兜底的键 */
const TOP_LEVEL_FALLBACK = ['lessonNo', 'lessonDate', 'level'];

const stats = {
  files: 0,
  records: {},          // recordType -> { created, updated, skipped }
  progressDerived: 0,   // easy_streak 走「规则推导」的次数
  skipReasons: [],
};
const warnings = [];

// ---------------------------------------------------------------- 工具

function parseArgs(argv) {
  const args = { dryRun: false, lesson: null, student: null, recordsDir: DEFAULT_RECORDS_DIR };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--lesson') args.lesson = Number(argv[++i]);
    else if (a === '--student') args.student = argv[++i];
    else if (a === '--records') args.recordsDir = path.resolve(argv[++i]);
  }
  return args;
}

function warn(msg) {
  warnings.push(msg);
  console.log(`  ! ${msg}`);
}

function bump(type, field) {
  if (!stats.records[type]) stats.records[type] = { created: 0, updated: 0, skipped: 0 };
  stats.records[type][field] += 1;
}

/** 结构化深比较（payload 内容是否与库内一致 → 决定「跳过」还是「更新」） */
function sameJson(a, b) {
  return JSON.stringify(normalizeForCompare(a)) === JSON.stringify(normalizeForCompare(b));
}
function normalizeForCompare(v) {
  if (Array.isArray(v)) return v.map(normalizeForCompare);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = normalizeForCompare(v[k]);
    return out;
  }
  return v;
}

/** 只取日期部分做比较（库内 DATE 列 vs 文件里的 'YYYY-MM-DD'） */
function dateOnly(v) {
  if (!v) return null;
  const s = String(v);
  return s.slice(0, 10);
}

// ---------------------------------------------------------------- 读取与校验

function listRecordFiles(dir, onlyLesson) {
  if (!fs.existsSync(dir)) throw new Error(`records 目录不存在：${dir}`);
  return fs.readdirSync(dir)
    .filter((f) => /^lesson-\d+\.study-record\.json$/.test(f))
    .map((f) => path.join(dir, f))
    .filter((p) => {
      if (onlyLesson == null) return true;
      return Number(/lesson-(\d+)\./.exec(path.basename(p))[1]) === onlyLesson;
    })
    .sort((a, b) => {
      const na = Number(/lesson-(\d+)\./.exec(path.basename(a))[1]);
      const nb = Number(/lesson-(\d+)\./.exec(path.basename(b))[1]);
      return na - nb;
    });
}

/**
 * 解析并**先校验全部文件**：任一文件缺必填字段就整体中止（不写库、非零退出）。
 * 返回按 lessonNo 升序的规范对象数组。
 */
function loadAndValidate(files) {
  const errors = [];
  const docs = [];

  for (const file of files) {
    const rel = path.relative(process.cwd(), file);
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      errors.push(`${rel}：JSON 解析失败 —— ${e.message}`);
      continue;
    }
    if (!Number.isInteger(raw.lessonNo)) {
      errors.push(`${rel}：顶层缺整数 lessonNo`);
      continue;
    }
    if (!Array.isArray(raw.records) || !raw.records.length) {
      errors.push(`${rel}：顶层缺非空 records[] 数组`);
      continue;
    }

    const records = [];
    for (const item of raw.records) {
      const type = item && item.recordType;
      if (!REQUIRED[type]) {
        errors.push(`${rel}：records[].recordType 未知值 ${JSON.stringify(type)}（支持 ${Object.keys(REQUIRED).join(' / ')}）`);
        continue;
      }
      // payload 缺的字段允许用文件顶层同名键兜底（如 lessonNo / lessonDate / level）
      const payload = { ...(item.payload || {}) };
      for (const key of TOP_LEVEL_FALLBACK) {
        if (payload[key] === undefined && raw[key] !== undefined) payload[key] = raw[key];
      }
      if (payload.lessonNo === undefined) payload.lessonNo = raw.lessonNo;

      const missing = REQUIRED[type].filter((k) => payload[k] === undefined || payload[k] === null || payload[k] === '');
      if (missing.length) {
        errors.push(`${rel}：recordType=${type} 缺必填字段 ${missing.join(', ')}`);
        continue;
      }
      if (type === 'feedback' && !FEEDBACK.includes(payload.feedback)) {
        errors.push(`${rel}：payload.feedback=${JSON.stringify(payload.feedback)} 非法（须为 ${FEEDBACK.join(' / ')}）`);
        continue;
      }
      records.push({ recordType: type, payload });
    }

    // 同一文件内同一 recordType 不得重复（会撞 dedupe_key）
    const seen = new Set();
    for (const r of records) {
      if (seen.has(r.recordType)) errors.push(`${rel}：recordType=${r.recordType} 在同一文件内重复出现`);
      seen.add(r.recordType);
    }

    docs.push({ file: rel, lessonNo: raw.lessonNo, records, raw });
  }

  return { docs, errors };
}

// ---------------------------------------------------------------- 写库

async function resolveStudent(exec, wanted) {
  const rows = wanted && /^\d+$/.test(wanted)
    ? await db.queryOn(exec, 'SELECT id, name FROM students WHERE id = ?', [Number(wanted)])
    : wanted
      ? await db.queryOn(exec, 'SELECT id, name FROM students WHERE name = ?', [wanted])
      : await db.queryOn(exec, 'SELECT id, name FROM students ORDER BY id LIMIT 1');
  if (!rows.length) throw new Error(`找不到学生：${wanted || '(students 表为空)'}`);
  return rows[0];
}

async function syncRecordsOfLesson(conn, studentId, doc, lessonIdByNo) {
  const lessonId = lessonIdByNo.get(doc.lessonNo);
  if (!lessonId) {
    warn(`第 ${doc.lessonNo} 课在 lessons 表内不存在，其 ${doc.records.length} 条记录全部跳过`);
    for (const r of doc.records) bump(r.recordType, 'skipped');
    return;
  }

  for (const { recordType, payload } of doc.records) {
    const dedupeKey = `lesson-${doc.lessonNo}:${recordType}`;

    // ⚠️ 双写预警：同课同类但如果已有一条**没有 dedupe_key** 的行
    //（= 迁移前经 API 写入的），本次会再写一条 → errorTrend 之类计数会翻倍。
    const legacy = await db.queryOn(conn,
      `SELECT id FROM study_records
        WHERE student_id = ? AND lesson_id = ? AND record_type = ? AND dedupe_key IS NULL`,
      [studentId, lessonId, recordType]
    );
    if (legacy.length) {
      warn(`第 ${doc.lessonNo} 课 ${recordType}：库内已有 ${legacy.length} 条**无 dedupe_key** 的同类记录`
        + `（疑似迁移前经 API 写入）→ 本次会新增一条，请核对是否重复计数`);
    }

    const summary = defaultSummary(recordType, doc.lessonNo, payload);
    const existing = await studyRecordRepository.findByDedupeKey(studentId, dedupeKey, conn);

    if (!existing) {
      await studyRecordRepository.insert(conn, {
        studentId, lessonId, recordType, summary, payload, dedupeKey,
      });
      bump(recordType, 'created');
      console.log(`  + 第 ${doc.lessonNo} 课 ${recordType}：新增（${dedupeKey}）`);
      continue;
    }

    const oldPayload = parseMaybeJson(existing.payload);
    if (sameJson(oldPayload, payload) && (existing.summary || null) === (summary || null)) {
      bump(recordType, 'skipped');
      stats.skipReasons.push(`第 ${doc.lessonNo} 课 ${recordType}：内容与库内一致，跳过`);
      console.log(`  = 第 ${doc.lessonNo} 课 ${recordType}：内容一致，跳过（id=${existing.id}）`);
      continue;
    }

    await studyRecordRepository.updateById(conn, existing.id, { summary, payload });
    bump(recordType, 'updated');
    console.log(`  · 第 ${doc.lessonNo} 课 ${recordType}：更新（id=${existing.id}）`);
  }
}

function parseMaybeJson(v) {
  if (v == null) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return null; }
}

/**
 * 汇总所有文件 → 写 progress 7 列。
 * 聚合口径：课号/日期取最大（单调）；反馈取**课号最大**那条文件里的 feedback 记录。
 */
async function syncProgress(conn, studentId, docs) {
  const [row] = await db.queryOn(conn,
    `SELECT current_level, current_lesson_no, last_feedback, easy_streak,
            upgrade_frozen_until, last_class_date, note
       FROM progress WHERE student_id = ?`, [studentId]);
  if (!row) throw new Error('progress 表内没有该学生的行（无法写入进度）');

  const before = {
    current_level: row.current_level,
    current_lesson_no: row.current_lesson_no,
    last_feedback: row.last_feedback,
    easy_streak: row.easy_streak,
    upgrade_frozen_until: row.upgrade_frozen_until,
    last_class_date: dateOnly(row.last_class_date),
  };

  // 聚合
  let maxLessonNo = before.current_lesson_no || 0;
  let maxLessonDate = before.last_class_date;
  let latest = null; // 课号最大的 feedback
  let latestLevel = null;
  for (const doc of docs) {
    if (doc.lessonNo > maxLessonNo) maxLessonNo = doc.lessonNo;
    const date = dateOnly(doc.raw.lessonDate
      || (doc.records.find((r) => r.payload.lessonDate) || { payload: {} }).payload.lessonDate);
    if (date && (!maxLessonDate || date > maxLessonDate)) maxLessonDate = date;
    for (const r of doc.records) {
      if (r.recordType === 'feedback') {
        if (!latest || doc.lessonNo >= latest.lessonNo) latest = { lessonNo: doc.lessonNo, payload: r.payload };
      }
      if (r.recordType === 'attend' && r.payload.level) {
        if (!latestLevel || doc.lessonNo >= latestLevel.lessonNo) latestLevel = { lessonNo: doc.lessonNo, level: r.payload.level };
      }
    }
  }

  const next = { ...before };

  // ① 单调守卫（取 max）：回退 = 重放旧文件，必须挡住
  next.current_lesson_no = Math.max(before.current_lesson_no || 0, maxLessonNo);
  if (maxLessonDate && (!before.last_class_date || maxLessonDate > before.last_class_date)) {
    next.last_class_date = maxLessonDate;
  }

  // ② 以文件声明值为准（允许回退/清零）
  if (latest) {
    const p = latest.payload;
    next.current_level = p.levelAfter || before.current_level;
    next.last_feedback = p.feedback;
    if (p.easyStreak !== undefined && p.easyStreak !== null) {
      next.easy_streak = p.easyStreak;
    } else {
      // 缺省推导：任何非「太简单」的反馈都归零；「太简单」则保持原值
      next.easy_streak = p.feedback === 'too_easy' ? before.easy_streak : 0;
      stats.progressDerived += 1;
      console.log(`  ~ easy_streak 未在文件声明 → 按规则推导为 ${next.easy_streak}（feedback=${p.feedback}）`);
    }
    if (p.upgradeFrozenUntil !== undefined && p.upgradeFrozenUntil !== null) {
      next.upgrade_frozen_until = p.upgradeFrozenUntil;
    }
  } else if (latestLevel) {
    next.current_level = latestLevel.level;
  }

  // 只写真正变化的列（note 不在列内 = 人工列永不触碰）
  const changes = [];
  for (const col of Object.keys(before)) {
    if (String(before[col] ?? '') !== String(next[col] ?? '')) {
      changes.push(`${col}: ${before[col] ?? '∅'} → ${next[col] ?? '∅'}`);
    }
  }
  if (!changes.length) {
    console.log('  = progress：7 个教学列均无变化，跳过');
    return { changed: false, before, after: next };
  }

  await db.executeOn(conn,
    `UPDATE progress
        SET current_level = ?, current_lesson_no = ?, last_feedback = ?,
            easy_streak = ?, upgrade_frozen_until = ?, last_class_date = ?
      WHERE student_id = ?`,
    [
      next.current_level, next.current_lesson_no, next.last_feedback,
      next.easy_streak, next.upgrade_frozen_until, next.last_class_date,
      studentId,
    ]
  );
  for (const c of changes) console.log(`  · progress ${c}`);
  return { changed: true, before, after: next };
}

// ---------------------------------------------------------------- 主流程

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const files = listRecordFiles(args.recordsDir, args.lesson);

  console.log('teach:sync —— records/*.study-record.json → study_records + progress');
  console.log(`records 目录：${args.recordsDir}`);
  console.log(`匹配文件：${files.length} 个${args.lesson != null ? `（仅第 ${args.lesson} 课）` : ''}`);
  if (args.dryRun) console.log('模式：--dry-run（结束时整体回滚，只报告不改库）');
  console.log('');

  if (!files.length) {
    console.log('TEACH_SYNC_NOOP 没有匹配的 study-record 文件');
    return;
  }

  const { docs, errors } = loadAndValidate(files);
  if (errors.length) {
    console.error(`校验失败 ${errors.length} 项 —— 缺字段即报错，不写半截：`);
    for (const e of errors) console.error(`  ✗ ${e}`);
    throw new Error(`study-record 校验未通过（${errors.length} 项）`);
  }
  console.log(`校验通过：${docs.length} 个文件 / ${docs.reduce((a, d) => a + d.records.length, 0)} 条记录`);
  console.log('');

  const before = await db.query('SELECT COUNT(*) AS n FROM study_records');
  let progressResult = null;

  await db.withTransaction(async (conn) => {
    const student = await resolveStudent(conn, args.student);
    console.log(`目标学生：id=${student.id} name=${student.name}`);
    console.log('');

    const lessonRows = await db.queryOn(conn, 'SELECT id, lesson_no FROM lessons WHERE student_id = ?', [student.id]);
    const lessonIdByNo = new Map(lessonRows.map((r) => [r.lesson_no, r.id]));

    for (const doc of docs) {
      stats.files += 1;
      await syncRecordsOfLesson(conn, student.id, doc, lessonIdByNo);
    }

    console.log('');
    progressResult = await syncProgress(conn, student.id, docs);

    if (args.dryRun) {
      throw Object.assign(new Error('__DRY_RUN_ROLLBACK__'), { dryRun: true });
    }
  }).catch((err) => {
    if (err && err.dryRun) return; // dry-run 的正常出口
    throw err;
  });

  const after = args.dryRun ? before : await db.query('SELECT COUNT(*) AS n FROM study_records');

  // ---------------- 同步报告（Amy 条件 ②：不接受一句「同步完成」）
  console.log('');
  console.log('─'.repeat(56));
  console.log('同步报告');
  console.log('─'.repeat(56));
  const types = ['attend', 'grade', 'feedback'];
  let tC = 0; let tU = 0; let tS = 0;
  for (const t of types) {
    const s = stats.records[t] || { created: 0, updated: 0, skipped: 0 };
    tC += s.created; tU += s.updated; tS += s.skipped;
    console.log(`  ${t.padEnd(9)} 新增 ${s.created} · 更新 ${s.updated} · 跳过 ${s.skipped}`);
  }
  console.log(`  ${'合计'.padEnd(8)} 新增 ${tC} · 更新 ${tU} · 跳过 ${tS}`);
  console.log(`  study_records 行数：${before[0].n} → ${args.dryRun ? before[0].n + '（dry-run 未写）' : after[0].n}`);
  console.log(`  progress：${progressResult && progressResult.changed ? '已更新' : '无变化'}`
    + `${stats.progressDerived ? `（含推导 ${stats.progressDerived} 项）` : ''}`);
  console.log(`  告警：${warnings.length} 条`);
  console.log('─'.repeat(56));

  if (tS) {
    console.log('');
    console.log('跳过明细（逐条打日志，满足条件 ②）：');
    for (const r of stats.skipReasons) console.log(`  = ${r}`);
  }
  if (warnings.length) {
    console.log('');
    console.log(`告警明细 ${warnings.length} 条：`);
    warnings.forEach((w, i) => console.log(`  ! ${i + 1}. ${w}`));
  }

  console.log('');
  if (args.dryRun) {
    console.log(`TEACH_SYNC_DRYRUN files=${stats.files} created=${tC} updated=${tU} skipped=${tS} warnings=${warnings.length}`);
  } else {
    console.log(`TEACH_SYNC_OK files=${stats.files} created=${tC} updated=${tU} skipped=${tS} warnings=${warnings.length}`);
  }
}

main()
  .then(async () => {
    await db.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('TEACH_SYNC_FAIL', (err && err.message) || err);
    try { await db.close(); } catch { /* ignore */ }
    process.exit(1);
  });
