'use strict';

/**
 * 写接口正向路径验证（只碰「临时测试学生」，绝不动真实学习数据）
 * ---------------------------------------------------------------------------
 * 为什么单独一个脚本：
 *   smoke-test.js 里的写接口用例**全是负向**（非法枚举 → 400、不存在 → 404），
 *   永远不会真正落库，因此「streak 会不会 +1」「连对 2 次会不会过关」
 *   「clientEventId 幂等是否真的生效」这些**核心语义从未被测过**。
 *
 * 安全设计（三条硬保证）：
 *   1. 全程只使用 ?studentId=<临时测试学生>，真实学生（默认学生）一行不改；
 *   2. 跑完按 FK 顺序清理临时数据（finally 里兜底，失败也清）；
 *   3. 结束时对比清理前后**全库计数**，不一致即判失败 —— 用断言证明「零影响」。
 *
 * 用法：
 *   先 `npm start`，再 `npm run test:write`
 *   或：node scripts/write-api-check.js http://localhost:4000
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const db = require('../src/config/db');

const BASE = process.argv[2] || `http://localhost:${process.env.PORT || 4000}`;
const TEST_STUDENT_NAME = '__write_check__';
const TEST_LESSON_NO = 90;

let pass = 0;
let fail = 0;
const failures = [];

function check(label, ok, detail) {
  if (ok) {
    pass += 1;
    console.log(`  ✓ ${label}${detail ? '  → ' + detail : ''}`);
  } else {
    fail += 1;
    failures.push(label);
    console.log(`  ✗ ${label}${detail ? '  → ' + detail : ''}`);
  }
}

function eq(label, actual, expected) {
  check(label, JSON.stringify(actual) === JSON.stringify(expected), `实际 ${JSON.stringify(actual)}，期望 ${JSON.stringify(expected)}`);
}

async function api(method, urlPath, body) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* 非 JSON */ }
  return { status: res.status, json };
}

const get = (p) => api('GET', p);
const post = (p, body) => api('POST', p, body);

/** 全库计数快照（用于证明零影响） */
async function snapshotCounts() {
  const rows = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM students)        AS students,
      (SELECT COUNT(*) FROM lessons)         AS lessons,
      (SELECT COUNT(*) FROM vocabulary)      AS vocabulary,
      (SELECT COUNT(*) FROM lesson_vocabulary) AS lesson_vocabulary,
      (SELECT COUNT(*) FROM mistakes)        AS mistakes,
      (SELECT COUNT(*) FROM mistake_events)  AS mistake_events,
      (SELECT COUNT(*) FROM study_records)   AS study_records,
      (SELECT COUNT(*) FROM progress)        AS progress,
      (SELECT COUNT(*) FROM lesson_exercises) AS lesson_exercises,
      (SELECT COUNT(*) FROM lesson_sections) AS lesson_sections
  `);
  return rows[0];
}

/** 全表不变量：streak>=2 ⇔ status='passed'（双向） */
async function assertInvariant() {
  const r1 = await db.query(
    "SELECT COUNT(*) AS n FROM mistakes WHERE streak >= 2 AND status <> 'passed'"
  );
  const r2 = await db.query(
    "SELECT COUNT(*) AS n FROM mistakes WHERE streak < 2 AND status = 'passed'"
  );
  const broken = r1[0].n + r2[0].n;
  if (broken) {
    const rows = await db.query(
      'SELECT id, streak, status FROM mistakes WHERE (streak >= 2 AND status <> \'passed\') OR (streak < 2 AND status = \'passed\')'
    );
    return { ok: false, rows };
  }
  return { ok: true, rows: [] };
}

/** 按 FK 依赖顺序清理临时学生的一切痕迹 */
async function cleanup(studentId) {
  if (!studentId) return;
  await db.execute('DELETE FROM mistake_events WHERE student_id = ?', [studentId]);
  await db.execute('DELETE FROM mistakes       WHERE student_id = ?', [studentId]);
  await db.execute('DELETE FROM study_records  WHERE student_id = ?', [studentId]);
  const lessons = await db.query('SELECT id FROM lessons WHERE student_id = ?', [studentId]);
  for (const l of lessons) {
    await db.execute('DELETE FROM lesson_exercises WHERE lesson_id = ?', [l.id]);
    await db.execute('DELETE FROM lesson_sections  WHERE lesson_id = ?', [l.id]);
    await db.execute('DELETE FROM lesson_vocabulary WHERE lesson_id = ?', [l.id]);
  }
  await db.execute('UPDATE vocabulary SET first_lesson_id = NULL WHERE student_id = ?', [studentId]);
  await db.execute('DELETE FROM vocabulary     WHERE student_id = ?', [studentId]);
  await db.execute('DELETE FROM progress       WHERE student_id = ?', [studentId]);
  await db.execute('DELETE FROM lessons        WHERE student_id = ?', [studentId]);
  await db.execute('DELETE FROM students       WHERE id = ?', [studentId]);
}

(async () => {
  console.log(`写接口正向路径验证 · 目标 ${BASE}\n`);

  const before = await snapshotCounts();
  let testStudentId = null;

  try {
    await cleanup(null);

    // ---------- 0. 前置：清理上次残留 ----------
    const stale = await db.query('SELECT id FROM students WHERE name = ?', [TEST_STUDENT_NAME]);
    for (const s of stale) await cleanup(s.id);
    if (stale.length) console.log(`— 清理上次残留 ${stale.length} 个临时学生 —\n`);

    // ---------- 1. SETUP：临时的学生 / 课 / 进度 / 错词 ----------
    console.log('— 建立隔离测试数据 —');
    const insStudent = await db.execute(
      'INSERT INTO students (name, nickname, target) VALUES (?, ?, ?)',
      [TEST_STUDENT_NAME, '写接口验证（临时）', '验证用']
    );
    testStudentId = insStudent.insertId;

    const insLesson = await db.execute(
      `INSERT INTO lessons (student_id, lesson_no, lesson_date, level_code, summary, status)
       VALUES (?, ?, '2026-09-30', 'Level 2', '写接口验证用（临时）', 'taught')`,
      [testStudentId, TEST_LESSON_NO]
    );
    const testLessonId = insLesson.insertId;

    await db.execute(
      `INSERT INTO progress (student_id, current_level, current_lesson_no, last_class_date)
       VALUES (?, 'Level 2', 10, '2026-09-29')`,
      [testStudentId]
    );

    const m1 = await db.execute(
      `INSERT INTO mistakes (student_id, first_lesson_id, last_lesson_id, wrong_text, correct_text, error_type, error_reason, streak, wrong_count, status)
       VALUES (?, ?, ?, 'probe m1', 'probe m1 fixed', 'grammar', '验证用', 0, 0, 'pending')`,
      [testStudentId, testLessonId, testLessonId]
    );
    const m1Id = m1.insertId;

    const m2 = await db.execute(
      `INSERT INTO mistakes (student_id, wrong_text, correct_text, error_type, streak, wrong_count, status)
       VALUES (?, 'probe m2', 'probe m2 fixed', 'spelling', 0, 0, 'pending')`,
      [testStudentId]
    );
    const m2Id = m2.insertId;

    check('临时学生已建立', !!testStudentId, `studentId=${testStudentId}`);
    console.log(`\n— A. POST /api/mistakes/:id/review 正向路径（studentId=${testStudentId}）—`);

    // ---------- A1 答错：wrongCount+1、streak 归零 ----------
    let r = await post(`/api/mistakes/${m1Id}/review?studentId=${testStudentId}`,
      { result: 'wrong', lessonNo: TEST_LESSON_NO, clientEventId: 'evt-a1' });
    check('A1 答错 → HTTP 200', r.status === 200, `status=${r.status}`);
    eq('A1 答错后 wrongCount / streak / status', 
      [r.json.data.wrongCount, r.json.data.streak, r.json.data.status], [1, 0, 'pending']);

    // ---------- A2 答对第 1 次：streak=1，仍未过关 ----------
    r = await post(`/api/mistakes/${m1Id}/review?studentId=${testStudentId}`,
      { result: 'correct', lessonNo: TEST_LESSON_NO, clientEventId: 'evt-a2' });
    eq('A2 答对 1 次 → streak=1 且仍 pending（未提前过关）',
      [r.json.data.streak, r.json.data.status], [1, 'pending']);
    eq('A2 priority 口径 streak==1 → medium', r.json.data.priority, 'medium');

    // ---------- A3 答对第 2 次：连对 2 次 → 过关 ----------
    r = await post(`/api/mistakes/${m1Id}/review?studentId=${testStudentId}`,
      { result: 'correct', lessonNo: TEST_LESSON_NO, clientEventId: 'evt-a3' });
    eq('A3 连对 2 次 → streak=2 且 status=passed（核心过关规则）',
      [r.json.data.streak, r.json.data.status], [2, 'passed']);
    check('A3 lastReviewedAt 已回写', !!r.json.data.lastReviewedAt, String(r.json.data.lastReviewedAt));
    const rowA3 = (await db.query('SELECT last_reviewed_at FROM mistakes WHERE id = ?', [m1Id]))[0];
    check('A3 last_reviewed_at 真落库（不是只在响应里）', !!rowA3.last_reviewed_at, String(rowA3.last_reviewed_at));

    // ---------- A4 幂等：同一 clientEventId 重放 ----------
    const beforeDup = (await db.query('SELECT streak, wrong_count, status FROM mistakes WHERE id = ?', [m1Id]))[0];
    r = await post(`/api/mistakes/${m1Id}/review?studentId=${testStudentId}`,
      { result: 'correct', lessonNo: TEST_LESSON_NO, clientEventId: 'evt-a3' });
    const afterDup = (await db.query('SELECT streak, wrong_count, status FROM mistakes WHERE id = ?', [m1Id]))[0];
    eq('A4 幂等：响应与首次一致', [r.json.data.streak, r.json.data.wrongCount, r.json.data.status], [2, 1, 'passed']);
    eq('A4 幂等：DB 未被二次累加', afterDup, beforeDup);
    const evCount = (await db.query('SELECT COUNT(*) AS n FROM mistake_events WHERE mistake_id = ?', [m1Id]))[0].n;
    eq('A4 幂等：流水未重复插入（应为 3 条）', evCount, 3);

    // ---------- A5 退场可逆：过关后再答错 → 回到 pending ----------
    r = await post(`/api/mistakes/${m1Id}/review?studentId=${testStudentId}`,
      { result: 'wrong', lessonNo: TEST_LESSON_NO, clientEventId: 'evt-a5' });
    eq('A5 过关后答错 → streak 归零且退回 pending（退场规则可逆）',
      [r.json.data.streak, r.json.data.wrongCount, r.json.data.status], [0, 2, 'pending']);

    // ---------- A6 无 clientEventId 时不误判幂等 ----------
    r = await post(`/api/mistakes/${m2Id}/review?studentId=${testStudentId}`, { result: 'correct' });
    r = await post(`/api/mistakes/${m2Id}/review?studentId=${testStudentId}`, { result: 'correct' });
    eq('A6 无 clientEventId 时两次答对各自累加 → streak=2/passed',
      [r.json.data.streak, r.json.data.status], [2, 'passed']);

    // ---------- A7 跨学生隔离：真实学生读不到测试数据 ----------
    const cross = await get(`/api/mistakes/${m1Id}`);
    check('A7 跨学生隔离：默认学生访问测试错词 → 404（student_id 过滤有效）',
      cross.status === 404, `status=${cross.status}`);

    // ---------- A8 复习流水可读回 ----------
    r = await get(`/api/mistakes/${m1Id}/events?studentId=${testStudentId}`);
    check('A8 GET /mistakes/:id/events 可读回复习流水', r.status === 200 && r.json.data.total === 4,
      `total=${r.json.data && r.json.data.total}`);

    // ---------- B. POST /api/progress/feedback ----------
    console.log('\n— B. POST /api/progress/feedback 升降级 —');
    r = await post(`/api/progress/feedback?studentId=${testStudentId}`,
      { lessonNo: 10, feedback: 'just_right' });
    eq('B1 just_right → 连击清零、级别不变',
      [r.json.data.levelBefore, r.json.data.levelAfter, r.json.data.easyStreak], ['Level 2', 'Level 2', 0]);

    r = await post(`/api/progress/feedback?studentId=${testStudentId}`,
      { lessonNo: 10, feedback: 'too_easy' });
    eq('B2 too_easy 第 1 次 → 连击 1/2、暂不升级',
      [r.json.data.levelAfter, r.json.data.easyStreak], ['Level 2', 1]);

    r = await post(`/api/progress/feedback?studentId=${testStudentId}`,
      { lessonNo: 10, feedback: 'too_easy' });
    eq('B3 too_easy 第 2 次 → 升 1 级并清零（升级规则核心）',
      [r.json.data.levelBefore, r.json.data.levelAfter, r.json.data.easyStreak], ['Level 2', 'Level 3', 0]);

    r = await post(`/api/progress/feedback?studentId=${testStudentId}`,
      { lessonNo: 10, feedback: 'too_hard' });
    eq('B4 too_hard → 降 1 级并冻结到第 lessonNo+3 课',
      [r.json.data.levelBefore, r.json.data.levelAfter, r.json.data.upgradeFrozenUntil], ['Level 3', 'Level 2', 13]);

    r = await post(`/api/progress/feedback?studentId=${testStudentId}`,
      { lessonNo: 10, feedback: 'just_right', nextRecommendation: 'probe: 下一课继续练一般过去时' });
    check('B5 feedback 可携带 nextRecommendation 并落库', r.status === 200, `status=${r.status}`);

    const progRow = (await db.query('SELECT current_level, easy_streak FROM progress WHERE student_id = ?', [testStudentId]))[0];
    eq('B6 进度已真实持久化', [progRow.current_level, progRow.easy_streak], ['Level 2', 0]);

    // ---------- C. POST /api/study-records ----------
    console.log('\n— C. POST /api/study-records —');
    r = await post(`/api/study-records?studentId=${testStudentId}`,
      { recordType: 'grade', lessonNo: TEST_LESSON_NO, payload: { errorCount: 3, byType: { grammar: 2, spelling: 1 } } });
    check('C1 grade 记录 → HTTP 201 且返回 id', r.status === 201 && !!r.json.data.id, `status=${r.status} id=${r.json.data && r.json.data.id}`);

    r = await post(`/api/study-records?studentId=${testStudentId}`,
      { recordType: 'feedback', lessonNo: TEST_LESSON_NO, payload: { feedback: 'just_right', next_recommendation: 'probe: 下次先复习词形' } });
    check('C2 feedback 记录（snake_case 别名）→ HTTP 201', r.status === 201, `status=${r.status}`);

    r = await get(`/api/study-records?studentId=${testStudentId}&type=grade`);
    const gradeRec = r.json.data.list[0];
    eq('C3 读回 grade 记录的 payload.byType（喂 errorTrend 的关键字段）', gradeRec.payload.byType, { grammar: 2, spelling: 1 });
    eq('C3 读回 payload.errorCount', gradeRec.payload.errorCount, 3);

    r = await get(`/api/study-records?studentId=${testStudentId}&type=feedback`);
    const fbRec = r.json.data.list[0];
    eq('C4 snake_case 别名被归一化为 camelCase（nextRecommendation）',
      fbRec.payload.nextRecommendation, 'probe: 下次先复习词形');

    // ---------- D. 快照 lastRecommendation 链路 ----------
    console.log('\n— D. /api/agent/snapshot 的 lastRecommendation 链路 —');
    r = await get(`/api/agent/snapshot?studentId=${testStudentId}`);
    check('D1 快照对测试学生可读', r.status === 200, `status=${r.status}`);
    const rec = r.json.data && r.json.data.lastRecommendation;
    check('D1 lastRecommendation 非 null（写接口 → 快照 链路贯通）', !!rec,
      rec ? `text="${rec.text}"` : '仍为 null');

    // ---------- D2. selfCheck + blockKind/blockNo 契约链 ----------
    // exercise-set.schema.json 的 ExerciseItem.selfCheck 曾因 LessonRecord.ExerciseRecord
    // 与 lesson_exercises 表都没有对应字段而**静默丢弃**；补漏块又因与作业共用题号
    // 会撞 uk_exercise。此段证明两条链路都已闭合。
    console.log('\n— D2. selfCheck 与 blockKind/blockNo 契约链（exercise-set → lesson_exercises → GET exercises）—');
    // 作业 #1 与补漏块 #1 用同一个 exercise_no=1 —— 旧唯一键会撞车，新键必须放行
    await db.execute(
      `INSERT INTO lesson_exercises
         (lesson_id, block_kind, block_no, exercise_no, exercise_type, prompt, self_check, reference_answer, target_point, order_index)
       VALUES (?, 'homework', 0, 1, 'fill_blank', 'probe 作业题干', '句尾标点', 'probe 作业答案', 'probe 知识点', 0),
              (?, 'backfill', 1, 1, 'translate', 'probe 补漏题干', null, 'probe 补漏答案', 'probe 知识点', 0)`,
      [testLessonId, testLessonId]
    );
    r = await get(`/api/lessons/${testLessonId}/exercises?studentId=${testStudentId}`);
    check('SC1 练习明细可读', r.status === 200, `status=${r.status}`);
    const list = (r.json.data && r.json.data.list) || [];
    check('SC2 同课同题号可共存于不同题块（新唯一键生效）', list.length === 2,
      `实际 ${list.length} 条：${list.map((x) => `${x.blockKind}#${x.blockNo}-${x.exerciseNo}`).join(' ')}`);
    const hw = list.find((x) => x.blockKind === 'homework');
    const bf = list.find((x) => x.blockKind === 'backfill');
    eq('SC3 作业题 blockKind/blockNo/exerciseNo', hw && [hw.blockKind, hw.blockNo, hw.exerciseNo], ['homework', 0, 1]);
    eq('SC4 补漏块题 blockKind/blockNo/exerciseNo', bf && [bf.blockKind, bf.blockNo, bf.exerciseNo], ['backfill', 1, 1]);
    eq('SC5 selfCheck 落库后能被读出（不再静默丢弃）', hw && hw.selfCheck, '句尾标点');
    check('SC6 其余字段未受影响（答案 / 未批改）',
      hw && hw.referenceAnswer === 'probe 作业答案' && hw.isCorrect === null && hw.exerciseType === 'fill_blank',
      `type=${hw && hw.exerciseType} isCorrect=${hw && hw.isCorrect}`);
    // 同一题块内重复题号必须被唯一键拦下
    let dupBlocked = false;
    try {
      await db.execute(
        `INSERT INTO lesson_exercises (lesson_id, block_kind, block_no, exercise_no, exercise_type, prompt)
         VALUES (?, 'homework', 0, 1, 'fill_blank', '重复题号')`,
        [testLessonId]
      );
    } catch (e) {
      dupBlocked = e && e.code === 'ER_DUP_ENTRY';
    }
    check('SC7 同一题块内重复题号被唯一键拦下', dupBlocked, dupBlocked ? 'ER_DUP_ENTRY' : '未被拦截（唯一键失效）');
    await db.execute('DELETE FROM lesson_exercises WHERE lesson_id = ?', [testLessonId]);
    const exLeft = await db.query('SELECT COUNT(*) AS n FROM lesson_exercises WHERE lesson_id = ?', [testLessonId]);
    check('SC8 测试练习已清理', exLeft[0].n === 0, `残留 ${exLeft[0].n} 行`);

    // ---------- E. 全表不变量 ----------
    console.log('\n— E. 不变量断言（streak>=2 ⇔ passed，双向）—');
    const inv = await assertInvariant();
    check('E1 全表无违反不变量的行', inv.ok, inv.ok ? '0 行违规' : JSON.stringify(inv.rows));

    // ---------- F. 清理 + 零影响证明 ----------
    console.log('\n— F. 清理与「零影响」证明 —');
    await cleanup(testStudentId);
    const leftover = await db.query('SELECT COUNT(*) AS n FROM students WHERE name = ?', [TEST_STUDENT_NAME]);
    check('F1 临时学生及其数据已清理干净', leftover[0].n === 0, `残留 ${leftover[0].n} 行`);

    const after = await snapshotCounts();
    const diff = Object.keys(before).filter((k) => before[k] !== after[k]);
    check('F2 真实数据计数清理前后完全一致（零影响）', diff.length === 0,
      diff.length ? diff.map((k) => `${k}: ${before[k]}→${after[k]}`).join('; ') : Object.entries(before).map(([k, v]) => `${k}=${v}`).join(' '));
  } catch (err) {
    fail += 1;
    failures.push('脚本异常');
    console.log(`\n✗ 脚本异常：${err.message}`);
    console.log(err.stack);
  } finally {
    try { await cleanup(testStudentId); } catch (e) { console.log('清理兜底失败：' + e.message); }
    await db.close();
  }

  console.log(`\n结果：通过 ${pass} · 失败 ${fail}`);
  if (failures.length) console.log('失败项：\n  - ' + failures.join('\n  - '));
  process.exit(fail === 0 ? 0 : 1);
})();
