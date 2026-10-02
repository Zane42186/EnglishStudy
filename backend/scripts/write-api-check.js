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
const put = (p, body) => api('PUT', p, body);

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
      (SELECT COUNT(*) FROM lesson_sections) AS lesson_sections,
      (SELECT COUNT(*) FROM readings)         AS readings,
      (SELECT COUNT(*) FROM reading_pieces)   AS reading_pieces,
      (SELECT COUNT(*) FROM reading_questions) AS reading_questions
  `);
  return rows[0];
}

/** 测试用阅读日期：远离真实数据的固定日期，便于清理与识别 */
const TEST_READ_DATE = '1990-01-01';

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
  // 阅读三表：questions → pieces → readings（均为 student_id 直挂或经 reading_id 间接挂）
  await db.execute(
    `DELETE q FROM reading_questions q
       JOIN reading_pieces p ON p.id = q.piece_id
       JOIN readings r ON r.id = p.reading_id
      WHERE r.student_id = ?`,
    [studentId]
  );
  await db.execute(
    `DELETE p FROM reading_pieces p
       JOIN readings r ON r.id = p.reading_id
      WHERE r.student_id = ?`,
    [studentId]
  );
  await db.execute('DELETE FROM readings        WHERE student_id = ?', [studentId]);
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
      { recordType: 'feedback', lessonNo: TEST_LESSON_NO, payload: { feedback: 'just_right', next_recommendation: 'probe: 下次先复习词形', incomplete_step: 'probe: 未完成的教学动作' } });
    check('C2 feedback 记录（snake_case 别名）→ HTTP 201', r.status === 201, `status=${r.status}`);

    r = await get(`/api/study-records?studentId=${testStudentId}&type=grade`);
    const gradeRec = r.json.data.list[0];
    eq('C3 读回 grade 记录的 payload.byType（喂 errorTrend 的关键字段）', gradeRec.payload.byType, { grammar: 2, spelling: 1 });
    eq('C3 读回 payload.errorCount', gradeRec.payload.errorCount, 3);

    r = await get(`/api/study-records?studentId=${testStudentId}&type=feedback`);
    const fbRec = r.json.data.list[0];
    eq('C4 snake_case 别名被归一化为 camelCase（nextRecommendation）',
      fbRec.payload.nextRecommendation, 'probe: 下次先复习词形');
    eq('C5 incomplete_step 别名归一化为 camelCase（incompleteStep）',
      fbRec.payload.incompleteStep, 'probe: 未完成的教学动作');

    // ---------- D. 快照 lastRecommendation 链路 ----------
    console.log('\n— D. /api/agent/snapshot 的 lastRecommendation 链路 —');
    r = await get(`/api/agent/snapshot?studentId=${testStudentId}`);
    check('D1 快照对测试学生可读', r.status === 200, `status=${r.status}`);
    const rec = r.json.data && r.json.data.lastRecommendation;
    check('D1 lastRecommendation 非 null（写接口 → 快照 链路贯通）', !!rec,
      rec ? `text="${rec.text}"` : '仍为 null');
    check('D1 形状严格为 {lessonNo, text}（契约要求，不夹带内部字段）',
      !!rec && Object.keys(rec).sort().join(',') === 'lessonNo,text',
      rec ? Object.keys(rec).join(',') : 'null');
    // G4：lastIncomplete 与 lastRecommendation 同源，但额外透传 incompleteStep（未完成的教学动作）
    const inc = r.json.data && r.json.data.lastIncomplete;
    check('D1b lastIncomplete 与 lastRecommendation 同源（lessonNo / nextRecommendation 一致）',
      !!inc && inc.lessonNo === rec.lessonNo && inc.nextRecommendation === rec.text,
      inc ? `lessonNo=${inc.lessonNo} nextRecommendation="${inc.nextRecommendation}"` : '为 null');
    eq('D1c lastIncomplete.incompleteStep 透传（G4 断更接续判据）',
      inc && inc.incompleteStep, 'probe: 未完成的教学动作');

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

    // ---------- D3. POST / PUT /api/lessons（LessonRecord 写路径，Step 2a）----------
    // 契约：docs/schemas/lesson-record.schema.json。产出者 = Skill 侧 daily-lesson 归档步。
    // 本段逐条证明：契约字段 → 四表落库 / 409 不覆盖 / 部分更新不抹字段 /
    //              接口**不推导 error_type** / 无落库点的字段须进 warnings（不静默丢弃）。
    console.log('\n— D3. POST/PUT /api/lessons（LessonRecord → 四表）—');

    const NEW_LESSON_NO = TEST_LESSON_NO + 1; // 91（临时学生的课，与真实 1—7 课无关）
    const lessonPayload = {
      lessonNo: NEW_LESSON_NO,
      lessonDate: '2026-10-02',
      levelCode: 'Level 2',
      summary: 'probe: 写接口验证课',
      grammarPoint: 'probe 语法点',
      sourceFile: 'day-08-14.md',
      sections: [
        { sectionType: 'review', contentMd: 'probe review 正文', orderIndex: 0 },
        { sectionType: 'grammar', contentMd: 'probe grammar 正文', orderIndex: 1 },
        { sectionType: 'homework', contentMd: 'probe homework 正文', orderIndex: 2 },
      ],
      vocabulary: [
        { word: 'probe lesson word', phonetic: '/prəʊb/', meaning: '探针', example: 'This is a probe.', isNew: true },
        { word: 'probe lesson word 2', meaning: '探针二', isNew: true },
      ],
      exercises: [
        { exerciseNo: 1, exerciseType: 'fill_blank', prompt: 'probe 题 1', selfCheck: '句尾标点', referenceAnswer: 'probe 答案 1', userAnswer: 'probe 作答 1', isCorrect: false, errorNote: 'probe 错因' },
        { exerciseNo: 2, exerciseType: 'translate', prompt: 'probe 题 2', referenceAnswer: 'probe 答案 2', userAnswer: 'probe 作答 2', isCorrect: true },
        // 补漏块与作业共用题号 1 —— 唯一键必须放行（(lesson_id, block_kind, block_no, exercise_no)）
        { exerciseNo: 1, blockKind: 'backfill', blockNo: 1, exerciseType: 'reorder', prompt: 'probe 补漏题 1' },
      ],
      gradeSummary: { exerciseCount: 2, errorCount: 1 },
      studyMinutes: 28,                                  // 契约内、但 lessons 无该列（G5）→ 应进 warnings
      knowledgePoints: [{ code: 'probe-kp', role: 'new' }], // 表未建（P1）→ 应进 warnings
    };

    r = await post(`/api/lessons?studentId=${testStudentId}`, lessonPayload);
    check('LW1 POST /api/lessons 首次 → 201', r.status === 201, `status=${r.status} ${JSON.stringify(r.json && r.json.data)}`);
    const lw = (r.json && r.json.data) || {};
    eq('LW2 返回计数与契约字段一致（小节 3 / 词 2 / 题 3 / 错误 1）',
      [lw.sectionCount, lw.vocabCount, lw.exerciseCount, lw.errorCount], [3, 2, 3, 1]);
    eq('LW3 status 缺省为 taught（与 schema 默认值、现有 1—7 课一致）', lw.status, 'taught');
    check('LW4 无落库点的契约字段进 warnings（不静默丢弃）',
      Array.isArray(lw.warnings) && lw.warnings.length === 2
      && lw.warnings.some((w) => /studyMinutes/.test(w)) && lw.warnings.some((w) => /knowledgePoints/.test(w)),
      JSON.stringify(lw.warnings));
    const newLessonId = lw.id;

    const lwCounts = async () => {
      const rows = await db.query(
        `SELECT (SELECT COUNT(*) FROM lessons WHERE student_id = ? AND lesson_no = ?) AS lessons,
                (SELECT COUNT(*) FROM lesson_sections  WHERE lesson_id = ?) AS sections,
                (SELECT COUNT(*) FROM lesson_exercises WHERE lesson_id = ?) AS exercises,
                (SELECT COUNT(*) FROM lesson_vocabulary WHERE lesson_id = ?) AS lesson_vocab`,
        [testStudentId, NEW_LESSON_NO, newLessonId, newLessonId, newLessonId]
      );
      return {
        lessons: Number(rows[0].lessons), sections: Number(rows[0].sections),
        exercises: Number(rows[0].exercises), lessonVocab: Number(rows[0].lesson_vocab),
      };
    };
    eq('LW5 四表落库 1 课 / 3 小节 / 3 题 / 2 词', await lwCounts(),
      { lessons: 1, sections: 3, exercises: 3, lessonVocab: 2 });

    const lwRow = (await db.query(
      'SELECT lesson_date, level_code, summary, grammar_point, source_file, status, vocab_count, exercise_count, error_count FROM lessons WHERE id = ?',
      [newLessonId]
    ))[0];
    eq('LW6 标量字段落库（日期 / 级别 / 摘要 / 语法点 / 来源 / 状态）',
      [lwRow.lesson_date, lwRow.level_code, lwRow.grammar_point, lwRow.source_file, lwRow.status],
      ['2026-10-02', 'Level 2', 'probe 语法点', 'day-08-14.md', 'taught']);
    eq('LW7 三项计数按子表派生 + gradeSummary 的作业错误处数',
      [Number(lwRow.vocab_count), Number(lwRow.exercise_count), Number(lwRow.error_count)], [2, 3, 1]);

    // 接口**不得**写 error_type：该列只由 Amy 人工判定（records → db:apply-error-types）
    const errTypes = await db.query('SELECT DISTINCT error_type FROM lesson_exercises WHERE lesson_id = ?', [newLessonId]);
    check('LW8 接口不推导 error_type（3 题全为 NULL）',
      errTypes.length === 1 && errTypes[0].error_type === null,
      JSON.stringify(errTypes.map((x) => x.error_type)));

    // selfCheck / blockKind / blockNo 三个「曾静默丢弃」的字段
    const exRows = await db.query(
      `SELECT block_kind, block_no, exercise_no, self_check, user_answer, is_correct
         FROM lesson_exercises WHERE lesson_id = ? ORDER BY block_kind, block_no, exercise_no`,
      [newLessonId]
    );
    const hw1 = exRows.find((x) => x.block_kind === 'homework' && x.exercise_no === 1);
    const bf1 = exRows.find((x) => x.block_kind === 'backfill');
    eq('LW9 selfCheck 落库（句尾标点）', hw1 && hw1.self_check, '句尾标点');
    eq('LW10 补漏块 blockKind/blockNo 落库', bf1 && [bf1.block_kind, Number(bf1.block_no)], ['backfill', 1]);
    eq('LW11 isCorrect false → 0、true → 1（不是字符串）',
      [hw1 && hw1.is_correct, exRows.find((x) => x.exercise_no === 2 && x.block_kind === 'homework').is_correct], [0, 1]);

    r = await get(`/api/lessons/${newLessonId}?studentId=${testStudentId}`);
    const detail = (r.json && r.json.data) || {};
    check('LW12 GET /api/lessons/:id 读回小节与词表',
      r.status === 200 && detail.sections && detail.sections.length === 3 && detail.vocabulary.length === 2,
      `sections=${detail.sections && detail.sections.length} vocab=${detail.vocabulary && detail.vocabulary.length}`);
    eq('LW13 词表 isNew / 例句读回', [detail.vocabulary[0].word, detail.vocabulary[0].isNew, detail.vocabulary[0].example],
      ['probe lesson word', true, 'This is a probe.']);

    r = await get(`/api/lessons/${newLessonId}/exercises?studentId=${testStudentId}`);
    check('LW14 GET /:id/exercises 读回 3 题（含补漏块）', r.status === 200 && r.json.data.list.length === 3,
      `list=${r.json.data && r.json.data.list.length}`);

    // ---- 409：POST 只新建，已存在不覆盖 ----
    r = await post(`/api/lessons?studentId=${testStudentId}`, lessonPayload);
    check('LW15 重复 POST 同课号 → 409（不静默覆盖）', r.status === 409, `status=${r.status} ${r.json && r.json.message}`);
    eq('LW16 409 未改动任何内容', await lwCounts(), { lessons: 1, sections: 3, exercises: 3, lessonVocab: 2 });

    // ---- 400：字段级校验 ----
    const badEnum = JSON.parse(JSON.stringify(lessonPayload));
    badEnum.lessonNo = NEW_LESSON_NO + 1;
    badEnum.levelCode = 'Level 9';
    badEnum.sections[0].sectionType = 'not_a_section';
    r = await post(`/api/lessons?studentId=${testStudentId}`, badEnum);
    check('LW17 非法 levelCode + 非法 sectionType → 400', r.status === 400, `status=${r.status}`);
    check('LW18 400 带字段级明细（指向 levelCode 与 sections[0].sectionType）',
      Array.isArray(r.json && r.json.data)
      && r.json.data.some((e) => e.field === 'levelCode')
      && r.json.data.some((e) => /sections\[0\]\.sectionType/.test(String(e.field))),
      JSON.stringify(r.json && r.json.data));

    const dupSection = JSON.parse(JSON.stringify(lessonPayload));
    dupSection.lessonNo = NEW_LESSON_NO + 1;
    dupSection.sections.push({ sectionType: 'grammar', contentMd: '重复类型' });
    r = await post(`/api/lessons?studentId=${testStudentId}`, dupSection);
    check('LW19 同课重复 sectionType → 400（唯一键 lesson_id + section_type 前置校验）', r.status === 400, `status=${r.status}`);

    const dupExercise = JSON.parse(JSON.stringify(lessonPayload));
    dupExercise.lessonNo = NEW_LESSON_NO + 1;
    dupExercise.exercises.push({ exerciseNo: 1, exerciseType: 'open', prompt: '重复题号' });
    r = await post(`/api/lessons?studentId=${testStudentId}`, dupExercise);
    check('LW20 同题块内重复题号 → 400（唯一键 uk_exercise 前置校验）', r.status === 400, `status=${r.status}`);

    const badBackfill = JSON.parse(JSON.stringify(lessonPayload));
    badBackfill.lessonNo = NEW_LESSON_NO + 1;
    badBackfill.exercises = [{ exerciseNo: 1, blockKind: 'backfill', exerciseType: 'open', prompt: '缺 blockNo' }];
    r = await post(`/api/lessons?studentId=${testStudentId}`, badBackfill);
    check('LW21 backfill 缺 blockNo → 400', r.status === 400, `status=${r.status}`);
    eq('LW22 三次校验失败均未写库', (await lwCounts()).lessons, 1);

    // ---- PUT：部分更新 ----
    r = await put(`/api/lessons/${newLessonId}?studentId=${testStudentId}`, {
      exercises: [
        { exerciseNo: 1, exerciseType: 'fill_blank', prompt: 'probe 题 1（改）', selfCheck: '句尾标点', userAnswer: 'probe 重交作答', isCorrect: false, errorNote: 'probe 错因（改）' },
      ],
      gradeSummary: { exerciseCount: 2, errorCount: 2 },
    });
    check('LW23 PUT 部分更新 → 200', r.status === 200, `status=${r.status} ${JSON.stringify(r.json && r.json.data)}`);
    const afterPut = (await db.query(
      'SELECT summary, level_code, exercise_count, error_count FROM lessons WHERE id = ?', [newLessonId]
    ))[0];
    eq('LW24 未提交的字段保持原值（summary / level_code 不被抹掉）',
      [afterPut.summary, afterPut.level_code], ['probe: 写接口验证课', 'Level 2']);
    eq('LW25 提交的字段生效（errorCount 1 → 2）', Number(afterPut.error_count), 2);
    const putEx = (await db.query(
      "SELECT prompt, user_answer FROM lesson_exercises WHERE lesson_id = ? AND block_kind='homework' AND exercise_no=1",
      [newLessonId]
    ))[0];
    eq('LW26 练习按唯一键 upsert（题干与作答已更新）', [putEx.prompt, putEx.user_answer], ['probe 题 1（改）', 'probe 重交作答']);
    const putErr = await db.query('SELECT error_type FROM lesson_exercises WHERE lesson_id = ?', [newLessonId]);
    check('LW27 回填批改不覆盖 error_type（仍全为 NULL）', putErr.every((x) => x.error_type === null),
      JSON.stringify(putErr.map((x) => x.error_type)));
    eq('LW28 PUT 不删除未提交的子行（仍 3 题 / 3 小节）', await lwCounts(),
      { lessons: 1, sections: 3, exercises: 3, lessonVocab: 2 });

    // ---- 计数派生只对 >=8 的课生效（第 1—6 课是 Amy 手工口径，不得覆盖）----
    const oldIns = await db.execute(
      `INSERT INTO lessons (student_id, lesson_no, lesson_date, level_code, summary, status, vocab_count, exercise_count, error_count)
       VALUES (?, 3, '2026-09-01', 'Level 1', 'probe 历史课口径保护', 'taught', 99, 99, 99)`,
      [testStudentId]
    );
    r = await put(`/api/lessons/${oldIns.insertId}?studentId=${testStudentId}`, {
      exercises: [{ exerciseNo: 1, exerciseType: 'open', prompt: 'probe 历史课题' }],
    });
    const oldRow = (await db.query('SELECT vocab_count, exercise_count, error_count FROM lessons WHERE id = ?', [oldIns.insertId]))[0];
    check('LW29 课号 <8 时不回写计数（保护 Amy 手工口径 99/99/99）',
      [Number(oldRow.vocab_count), Number(oldRow.exercise_count), Number(oldRow.error_count)].join(',') === '99,99,99',
      `${oldRow.vocab_count}/${oldRow.exercise_count}/${oldRow.error_count}`);
    check('LW30 计数跳过时给出 warnings（不静默）',
      r.status === 200 && (r.json.data.warnings || []).some((w) => /计数/.test(w)),
      JSON.stringify(r.json && r.json.data && r.json.data.warnings));

    // ---- 404：不存在 / 跨学生 ----
    r = await put(`/api/lessons/99999999?studentId=${testStudentId}`, { summary: 'probe 不存在' });
    check('LW31 PUT 不存在的 id → 404', r.status === 404, `status=${r.status}`);

    r = await put(`/api/lessons/${newLessonId}`, { summary: 'probe 跨学生篡改' });
    check('LW32 跨学生隔离：默认学生 PUT 测试学生的课 → 404', r.status === 404, `status=${r.status}`);

    r = await get(`/api/lessons/${newLessonId}`);
    check('LW33 跨学生隔离：默认学生 GET 测试学生的课 → 404', r.status === 404, `status=${r.status}`);

    // ---------- E2. POST /api/readings（R7 阅读写入）----------
    // 契约：docs/schemas/reading-set.schema.json。同一日期已存在 → 409（「当天不覆盖」硬规则），
    // 唯一例外是学生明确要求重出（显式 force=true）。此段逐条证明这些语义真的生效。
    console.log('\n— E2. POST /api/readings（ReadingSet → 三表 → GET 读回）—');

    const readingPayload = {
      date: TEST_READ_DATE,
      levelCode: 'Level 2',
      sourceFile: `${TEST_READ_DATE}-read.md`,
      pieces: [
        {
          pieceNo: 1,
          source: '自编',
          sourceUrl: null,
          title: 'probe 第一篇',
          paragraphs: [
            { en: 'I was busy yesterday.', zh: '我昨天很忙。' },
            { en: 'I am free today.', zh: null },
          ],
          vocabularyNotes: 'busy 忙的',
          questions: [
            { questionNo: 1, question: 'Was the writer busy?', answer: 'Yes, he was.' },
            { questionNo: 2, question: 'Is the writer free today?', answer: 'Yes, he is.' },
          ],
        },
        {
          pieceNo: 2,
          source: 'The Times（改写）',
          sourceUrl: 'https://example.com/news/1',
          title: 'probe 第二篇',
          levelCode: 'Level 3',
          paragraphs: [{ en: 'A short news line.', zh: '一条短新闻。' }],
          questions: [
            { questionNo: 1, question: 'Q1?', answer: 'A1.' },
            { questionNo: 2, question: 'Q2?', answer: 'A2.' },
          ],
        },
      ],
    };

    r = await post(`/api/readings?studentId=${testStudentId}`, readingPayload);
    check('RW1 首次提交返回 201', r.status === 201, `status=${r.status} ${JSON.stringify(r.json && r.json.data)}`);
    eq('RW1b 返回 {date, pieceCount}', r.json && r.json.data && [r.json.data.date, r.json.data.pieceCount], [TEST_READ_DATE, 2]);

    const cnt = async () => {
      const rows = await db.query(
        `SELECT (SELECT COUNT(*) FROM readings r WHERE r.student_id = ?) AS days,
                (SELECT COUNT(*) FROM reading_pieces p JOIN readings r ON r.id = p.reading_id WHERE r.student_id = ?) AS pieces,
                (SELECT COUNT(*) FROM reading_questions q
                   JOIN reading_pieces p ON p.id = q.piece_id
                   JOIN readings r ON r.id = p.reading_id WHERE r.student_id = ?) AS questions`,
        [testStudentId, testStudentId, testStudentId]
      );
      return { days: Number(rows[0].days), pieces: Number(rows[0].pieces), questions: Number(rows[0].questions) };
    };
    eq('RW2 三表落库 1 天 / 2 篇 / 4 题', await cnt(), { days: 1, pieces: 2, questions: 4 });

    r = await get(`/api/readings/${TEST_READ_DATE}?studentId=${testStudentId}`);
    const got = (r.json && r.json.data) || {};
    check('RW3 GET /:date 可读回，篇序按 pieceNo 升序',
      r.status === 200 && got.pieceCount === 2 && got.pieces[0].pieceNo === 1 && got.pieces[1].pieceNo === 2,
      `status=${r.status} 篇数=${got.pieceCount}`);
    eq('RW4 段落英中对照原样读回（zh 缺失段为 null）',
      got.pieces[0].paragraphs, [{ en: 'I was busy yesterday.', zh: '我昨天很忙。' }, { en: 'I am free today.', zh: null }]);
    eq('RW5 理解题成对读回', got.pieces[0].questions.length, 2);
    eq('RW6 篇级 levelCode 优先于顶层 levelCode', got.pieces[1].levelCode, 'Level 3');
    eq('RW7 sourceUrl 落库并可读回（不再静默丢弃）', got.pieces[1].sourceUrl, 'https://example.com/news/1');
    // "I was busy yesterday."(4) + "I am free today."(4) = 8
    eq('RW8 wordCount 未传时按正文自动计算', got.pieces[0].wordCount, 8);

    r = await post(`/api/readings?studentId=${testStudentId}`, readingPayload);
    check('RW9 同一日期重复提交 → 409（「当天不覆盖」）', r.status === 409, `status=${r.status} ${r.json && r.json.message}`);
    eq('RW10 409 未改动已有内容', await cnt(), { days: 1, pieces: 2, questions: 4 });

    const forced = { ...readingPayload, pieces: [readingPayload.pieces[0]] };
    r = await post(`/api/readings?studentId=${testStudentId}&force=true`, forced);
    check('RW11 force=true 显式重出 → 201 且 replaced=true',
      r.status === 201 && r.json && r.json.data && r.json.data.replaced === true,
      `status=${r.status} ${JSON.stringify(r.json && r.json.data)}`);
    eq('RW12 重出后旧篇被替换（2 → 1，题 4 → 2）', await cnt(), { days: 1, pieces: 1, questions: 2 });

    r = await post(`/api/readings?studentId=${testStudentId}`, { date: TEST_READ_DATE, levelCode: 'Level 9', pieces: [] });
    check('RW13 非法 levelCode + 空 pieces → 400', r.status === 400, `status=${r.status}`);
    check('RW13b 400 带字段级明细', Array.isArray(r.json && r.json.data) && r.json.data.length >= 2,
      JSON.stringify(r.json && r.json.data));

    // §11.10：理解题答案必填且非空 —— 空串 / 纯空白属数据缺陷，后端必须拒收（不产 null）
    const emptyAnswer = JSON.parse(JSON.stringify(readingPayload));
    emptyAnswer.date = '1990-01-02';
    emptyAnswer.pieces[0].questions[0].answer = '   ';
    r = await post(`/api/readings?studentId=${testStudentId}`, emptyAnswer);
    check('RW13c 理解题答案为空/纯空白 → 400（§11.10 答案必填）', r.status === 400, `status=${r.status}`);
    check('RW13d 失败明细指向 questions[].answer',
      Array.isArray(r.json && r.json.data) && r.json.data.some((e) => /questions\[\d+\]\.answer/.test(String(e.field))),
      JSON.stringify(r.json && r.json.data));
    eq('RW13e 校验失败未写入任何阅读', (await cnt()).days, 1);

    const threeQ = JSON.parse(JSON.stringify(readingPayload));
    threeQ.pieces[0].questions.push({ questionNo: 3, question: 'Q3?', answer: 'A3.' });
    r = await post(`/api/readings?studentId=${testStudentId}`, threeQ);
    check('RW14 每篇恰好 2 道理解题，3 道 → 400', r.status === 400, `status=${r.status}`);

    const fourPieces = JSON.parse(JSON.stringify(readingPayload));
    fourPieces.pieces.push({ ...readingPayload.pieces[0], pieceNo: 4 });
    r = await post(`/api/readings?studentId=${testStudentId}`, fourPieces);
    check('RW15 一天最多 3 篇，4 篇 → 400', r.status === 400, `status=${r.status}`);

    r = await post('/api/readings', { date: '2026-02-31', levelCode: 'Level 2', pieces: [] });
    check('RW16 不存在的日历日期（2026-02-31）→ 400', r.status === 400, `status=${r.status}`);

    // 跨学生隔离：真实学生不应看到测试学生的阅读
    r = await get(`/api/readings/${TEST_READ_DATE}`);
    check('RW17 学生隔离：默认学生读不到临时学生的阅读 → 404', r.status === 404, `status=${r.status}`);

    // ---------- G. POST /api/mistakes 批量错词写入（Step 2b） ----------
    console.log('\n— G. POST /api/mistakes 批量错词写入（R3：只喂原始条目）—');

    const cntMistakes = async () => {
      const rows = await db.query('SELECT COUNT(*) AS n FROM mistakes WHERE student_id = ?', [testStudentId]);
      return rows[0].n;
    };
    const dbMistake = async (wrongText) => {
      const rows = await db.query(
        'SELECT * FROM mistakes WHERE student_id = ? AND wrong_text = ? LIMIT 1',
        [testStudentId, wrongText]
      );
      return rows[0] || null;
    };
    const batch = (items, lessonNo = TEST_LESSON_NO) => ({ lessonNo, items });
    const MW_TEXT = 'MW go to school yesterday';
    // MW4/MW6 之后该行的落库原文已被「本次原文」覆盖（判重命中一律写本次原文）
    const MW_TEXT_STORED = 'MW  Go To School   Yesterday';

    // §11.11 夹具：`last_lesson_id` 刷新需要 ≥2 个**更大**的课号，而主夹具只有一课（90）。
    // ⚠️ 课号必须**动态取**：LW 段的 `POST /api/lessons` 会按 max+1 自动分配课号，
    //    硬编码 91/92 会撞 `uk_lessons_no`（本脚本首跑即栽在此处）。故取现最大值 +10 起。
    const [{ maxNo }] = await db.query(
      'SELECT COALESCE(MAX(lesson_no), 0) AS maxNo FROM lessons WHERE student_id = ?',
      [testStudentId]
    );
    const probeLessons = [];
    for (const offset of [10, 11, 12]) {
      const no = Number(maxNo) + offset;
      const ins = await db.execute(
        `INSERT INTO lessons (student_id, lesson_no, lesson_date, level_code, summary, status)
         VALUES (?, ?, '2026-09-30', 'Level 2', '§11.11 课号刷新夹具（临时）', 'taught')`,
        [testStudentId, no]
      );
      probeLessons.push({ no, id: ins.insertId });
    }
    const probeNoA = probeLessons[0].no;   // 首次课（新建 / 「更小课号」用）
    const probeNoB = probeLessons[1].no;   // 复发课（更大 → 应推进 last）
    const probeNoC = probeLessons[2].no;   // 更大一课：用于「判对**不**刷」的隔离断言
    const lessonIdOfNo = (no) => (probeLessons.find((l) => l.no === no) || {}).id;

    const mwBase = await cntMistakes(); // 前置 2 条（probe m1 / m2）

    // MW1 新建（未给 streak/status → 应取默认 0 / pending）
    r = await post(`/api/mistakes?studentId=${testStudentId}`, batch([
      { wrongText: MW_TEXT, correctText: 'MW went to school yesterday',
        errorType: 'grammar', errorReason: '过去式误用', wrongCount: 2, courseNo: TEST_LESSON_NO },
    ]));
    check('MW1 新建一条 → 200 且 created=1',
      r.status === 200 && r.json && r.json.data && r.json.data.created === 1,
      `status=${r.status} ${JSON.stringify(r.json && r.json.data)}`);

    // MW2 落库核对：原文 / 7 内容列 / 课号解析
    let row = await dbMistake(MW_TEXT);
    check('MW2 落库存**原始文本**（不经规范化）',
      !!row && row.wrong_text === MW_TEXT, row ? row.wrong_text : 'null');
    eq('MW2b 7 个内容列与入参一致（streak/status 取默认）',
      row && [row.correct_text, row.error_type, row.error_reason, row.streak, row.wrong_count, row.status],
      ['MW went to school yesterday', 'grammar', '过去式误用', 0, 2, 'pending']);
    eq('MW2c first/last_lesson_id 按 courseNo 解析',
      row && [row.first_lesson_id, row.last_lesson_id], [testLessonId, testLessonId]);

    // MW3 幂等：同 payload 重复提交
    r = await post(`/api/mistakes?studentId=${testStudentId}`, batch([
      { wrongText: MW_TEXT, correctText: 'MW went to school yesterday',
        errorType: 'grammar', errorReason: '过去式误用', wrongCount: 2, courseNo: TEST_LESSON_NO },
    ]));
    check('MW3 同 payload 重复提交 → created=0 / unchanged=1（幂等）',
      r.json.data.created === 0 && r.json.data.unchanged === 1, JSON.stringify(r.json.data));
    eq('MW3b 未新增行', await cntMistakes(), mwBase + 1);

    // MW4 判重键规范化：大小写 + 空白变体应命中同一行
    r = await post(`/api/mistakes?studentId=${testStudentId}`, batch([
      { wrongText: 'MW  Go To School   Yesterday', correctText: 'MW went to school yesterday',
        errorType: 'grammar', errorReason: '过去式误用', wrongCount: 2, courseNo: TEST_LESSON_NO },
    ]));
    check('MW4 规范化后同键（大小写/空白差异）→ updated=1 且不新建',
      r.json.data.created === 0 && r.json.data.updated === 1, JSON.stringify(r.json.data));
    eq('MW4b 行数未增（判重键真的生效）', await cntMistakes(), mwBase + 1);
    row = await dbMistake('MW  Go To School   Yesterday');
    check('MW4c 命中后 wrong_text 写本次原文（落库一律不经规范化）',
      !!row && row.wrong_text === 'MW  Go To School   Yesterday', row ? row.wrong_text : 'null');

    // MW5 DQ1 守卫：错误点不得夹带全角括号批注
    r = await post(`/api/mistakes?studentId=${testStudentId}`, batch([
      { wrongText: 'MW go to school（批注）', correctText: 'MW x', errorType: 'grammar', wrongCount: 1 },
    ]));
    check('MW5 wrongText 含全角括号批注 → 400（DQ1 守卫）', r.status === 400, `status=${r.status}`);
    check('MW5b 400 明细指向 wrongText',
      Array.isArray(r.json && r.json.data) && r.json.data.some((e) => /\.wrongText$/.test(String(e.field))),
      JSON.stringify(r.json && r.json.data));

    // MW6 R3：人工值为准覆盖写 + 差异逐条告警
    r = await post(`/api/mistakes?studentId=${testStudentId}`, batch([
      { wrongText: 'MW  Go To School   Yesterday', correctText: 'MW went to school yesterday',
        errorType: 'grammar', errorReason: '过去式误用', wrongCount: 5, courseNo: TEST_LESSON_NO },
    ]));
    check('MW6 wrong_count 以人工值为准覆盖写（2 → 5）', r.json.data.updated === 1, JSON.stringify(r.json.data));
    check('MW6b 与库内自动累计值不一致 → **逐条告警**（不静默改写人工判定）',
      Array.isArray(r.json.data.warnings) && r.json.data.warnings.some((w) => w.includes('≠')),
      JSON.stringify(r.json.data.warnings));
    row = await dbMistake('MW  Go To School   Yesterday');
    check('MW6c 库内 wrong_count 已按人工值落库', !!row && row.wrong_count === 5, row ? String(row.wrong_count) : 'null');

    // MW7 error_type 只取入参、服务端不推导（文本看似拼写错，仍按入参落 other）
    await post(`/api/mistakes?studentId=${testStudentId}`, batch([
      { wrongText: 'MW recieve', correctText: 'MW receive', errorType: 'other',
        errorReason: '待人工复核', wrongCount: 1, courseNo: TEST_LESSON_NO },
    ]));
    row = await dbMistake('MW recieve');
    check('MW7 error_type 取入参、不推导', !!row && row.error_type === 'other', row ? row.error_type : 'null');

    // MW8 混合批：1 更新 + 1 新建
    r = await post(`/api/mistakes?studentId=${testStudentId}`, batch([
      { wrongText: 'MW recieve', correctText: 'MW receive', errorType: 'other', errorReason: '待人工复核', wrongCount: 2 },
      { wrongText: 'MW a new one', correctText: 'MW a new one fixed', errorType: 'word_choice', wrongCount: 1 },
    ]));
    check('MW8 混合批 → created=1 / updated=1 / unchanged=0',
      r.json.data.created === 1 && r.json.data.updated === 1 && r.json.data.unchanged === 0,
      JSON.stringify(r.json.data));

    // MW9—MW12 字段级 400
    r = await post(`/api/mistakes?studentId=${testStudentId}`, { lessonNo: TEST_LESSON_NO, items: [] });
    check('MW9 items 为空 → 400', r.status === 400, `status=${r.status}`);

    r = await post(`/api/mistakes?studentId=${testStudentId}`, batch([
      { wrongText: 'MW x', correctText: 'MW x fixed', errorType: 'syntax', wrongCount: 1 },
    ]));
    check('MW10 非法 errorType → 400', r.status === 400, `status=${r.status}`);

    r = await post(`/api/mistakes?studentId=${testStudentId}`, batch([
      { wrongText: 'MW y', correctText: 'MW y fixed', errorType: 'grammar' },
    ]));
    check('MW11 缺 wrongCount → 400（人工判定值必填、不推导）', r.status === 400, `status=${r.status}`);

    r = await post(`/api/mistakes?studentId=${testStudentId}`, batch([
      { wrongText: 'MW dup', correctText: 'MW dup a', errorType: 'grammar', wrongCount: 1 },
      { wrongText: 'mw  DUP', correctText: 'MW dup b', errorType: 'grammar', wrongCount: 1 },
    ]));
    check('MW12 批内规范化同键 → 400（不静默取一条）', r.status === 400, `status=${r.status}`);

    // MW13 批内一条非法 → 整批不落库
    const beforeFail = await cntMistakes();
    r = await post(`/api/mistakes?studentId=${testStudentId}`, batch([
      { wrongText: 'MW ok', correctText: 'MW ok fixed', errorType: 'grammar', wrongCount: 1 },
      { wrongText: 'MW bad', correctText: 'MW bad fixed', errorType: 'nope', wrongCount: 1 },
    ]));
    eq('MW13 批内一条非法 → 整批 400 且一行未写', [r.status, await cntMistakes()], [400, beforeFail]);

    // MW14 课号不存在 → 仍写入，但课号置空并告警（刻意不丢词）
    r = await post(`/api/mistakes?studentId=${testStudentId}`, batch([
      { wrongText: 'MW orphan', correctText: 'MW orphan fixed', errorType: 'grammar', wrongCount: 1, courseNo: 999 },
    ]));
    row = await dbMistake('MW orphan');
    check('MW14 课号不存在 → 仍写入但 first/last_lesson_id 为空 + 告警',
      r.json.data.created === 1 && !!row && row.first_lesson_id === null
        && r.json.data.warnings.some((w) => w.includes('999')),
      `created=${r.json.data.created} first=${row && row.first_lesson_id} warn=${JSON.stringify(r.json.data.warnings)}`);

    // ---------- MW17—MW20 §11.11：`last_lesson_id` 随复发刷新、`first_lesson_id` 冻结 ----------
    // 定则：`last = max(现有课号, 本次课号)`（单调守卫）；`first` 永不改写；
    // 值为「不变」时该行仍计 `unchanged` ⇒ 重放幂等（本次课号不前进＝无变化）。
    const mwHit = (courseNo) => batch([
      { wrongText: MW_TEXT_STORED, correctText: 'MW went to school yesterday',
        errorType: 'grammar', errorReason: '过去式误用', wrongCount: 5, courseNo },
    ]);

    // MW17 命中且本次课号更大（90 → probeNoB）→ `last` 前进
    r = await post(`/api/mistakes?studentId=${testStudentId}`, mwHit(probeNoB));
    row = await dbMistake(MW_TEXT_STORED);
    check(`MW17 命中时 last_lesson_id 前进到本次课号（第 ${probeNoB} 课）`,
      r.json.data.updated === 1 && !!row && row.last_lesson_id === lessonIdOfNo(probeNoB),
      `updated=${r.json.data.updated} last=${row && row.last_lesson_id} want=${lessonIdOfNo(probeNoB)}`);
    eq('MW17b first_lesson_id **冻结**（仍为首次课，未被复发改写）',
      row && row.first_lesson_id, testLessonId);
    eq('MW17c 响应 changed 注明本次只动了课号（内容列未变）',
      r.json.data.items[0].changed, ['last_lesson_id']);

    // MW18 本次课号更小（probeNoB ← probeNoA）→ 单调守卫：`last` **不回退**
    r = await post(`/api/mistakes?studentId=${testStudentId}`, mwHit(probeNoA));
    row = await dbMistake(MW_TEXT_STORED);
    check(`MW18 本次课号更小 → last 不回退（仍 ${probeNoB}），该行计 unchanged`,
      r.json.data.updated === 0 && r.json.data.unchanged === 1
        && !!row && row.last_lesson_id === lessonIdOfNo(probeNoB),
      `u=${r.json.data.updated} un=${r.json.data.unchanged} last=${row && row.last_lesson_id}`);

    // MW19 同 payload 重放（本次课号相等）→ 幂等，`last` 稳定
    r = await post(`/api/mistakes?studentId=${testStudentId}`, mwHit(probeNoB));
    row = await dbMistake(MW_TEXT_STORED);
    check(`MW19 同 payload 重放 → 幂等（unchanged=1），last 稳定在 ${probeNoB}`,
      r.json.data.updated === 0 && r.json.data.unchanged === 1
        && !!row && row.last_lesson_id === lessonIdOfNo(probeNoB),
      `u=${r.json.data.updated} un=${r.json.data.unchanged} last=${row && row.last_lesson_id}`);

    // MW20 取值优先级：条目未给 courseNo → 取**顶层** `lessonNo` 作本次课号
    const MW_TOP = 'MW top-level lesson fallback';
    await post(`/api/mistakes?studentId=${testStudentId}`, batch([
      { wrongText: MW_TOP, correctText: 'MW top-level fixed', errorType: 'grammar', wrongCount: 1 },
    ], probeNoA));
    r = await post(`/api/mistakes?studentId=${testStudentId}`, batch([
      { wrongText: MW_TOP, correctText: 'MW top-level fixed', errorType: 'grammar', wrongCount: 1 },
    ], probeNoB));
    row = await dbMistake(MW_TOP);
    eq(`MW20 顶层 lessonNo 作默认本次课号：first 停在第 ${probeNoA} 课、last 前进到第 ${probeNoB} 课`,
      row && [row.first_lesson_id, row.last_lesson_id],
      [lessonIdOfNo(probeNoA), lessonIdOfNo(probeNoB)]);

    // ---------- MW21—MW24 §11.11 + A19：`review` **判错**也刷 `last_lesson_id` ----------
    // 语义：仅 `result === 'wrong'`（复发）时刷；同样走 `max` 单调守卫（不回退）；
    //       课号取请求的 `lessonNo`（与写入 `mistake_events.lesson_id` 同一次解析）。
    const MW_REV = 'MW review refreshes last';
    const mwRev = async () => dbMistake(MW_REV);

    await post(`/api/mistakes?studentId=${testStudentId}`, batch([
      { wrongText: MW_REV, correctText: 'MW review fixed', errorType: 'grammar', wrongCount: 1, courseNo: probeNoA },
    ]));
    let revRow = await mwRev();
    eq('MW21 前置：新建行 first=last=首次课（A19 现场实证的起始形态）',
      revRow && [revRow.first_lesson_id, revRow.last_lesson_id],
      [lessonIdOfNo(probeNoA), lessonIdOfNo(probeNoA)]);

    // MW22 判错 → last 前进到本次课号
    await post(`/api/mistakes/${revRow.id}/review?studentId=${testStudentId}`,
      { result: 'wrong', lessonNo: probeNoB, clientEventId: 'mw-rev-w1' });
    revRow = await mwRev();
    eq(`MW22 review 判错 → last 前进到第 ${probeNoB} 课（A19 缺口已修）`,
      [revRow.first_lesson_id, revRow.last_lesson_id],
      [lessonIdOfNo(probeNoA), lessonIdOfNo(probeNoB)]);

    // MW23 判错但本次课号更小 → 单调守卫，不回退
    await post(`/api/mistakes/${revRow.id}/review?studentId=${testStudentId}`,
      { result: 'wrong', lessonNo: probeNoA, clientEventId: 'mw-rev-w2' });
    revRow = await mwRev();
    eq(`MW23 review 判错但课号更小 → last 不回退（仍 ${probeNoB}）`,
      revRow.last_lesson_id, lessonIdOfNo(probeNoB));

    // MW24 判**对**且本次课号**更大** → 仍不刷（隔离「只有复发才刷」这条规则）
    await post(`/api/mistakes/${revRow.id}/review?studentId=${testStudentId}`,
      { result: 'correct', lessonNo: probeNoC, clientEventId: 'mw-rev-c1' });
    revRow = await mwRev();
    eq(`MW24 review 判对（哪怕课号更大）→ last 不动，仍 ${probeNoB}`,
      revRow.last_lesson_id, lessonIdOfNo(probeNoB));

    // MW24b 幂等：同一 clientEventId 重放 → 不重复刷
    await post(`/api/mistakes/${revRow.id}/review?studentId=${testStudentId}`,
      { result: 'correct', lessonNo: probeNoC, clientEventId: 'mw-rev-c1' });
    revRow = await mwRev();
    eq('MW24b 同 clientEventId 重放 → 幂等，last 仍不变',
      revRow.last_lesson_id, lessonIdOfNo(probeNoB));

    // ---------- MW25—MW27 A20：`review` **未传 `lessonNo`** 时回退 `progress.current_lesson_no` ----------
    // 真实调用面：全前端**唯一**调用方 `review/wrong.html:187` 只发 `{result, clientEventId}`。
    // 故本组夹具**刻意不传 `lessonNo`**（与真实前端逐字一致）—— MW21—MW24b 每条都显式传了课号，
    // 所以「测试全绿」盖不住真实链路上的死代码（A20：测试绿 ≠ 链路活）。
    // 课号来源改为把 progress 指向目标课；`probeNo*`/`lessonIdOfNo` 全部来自库内现取，不写死。
    const setProgressNo = (no) => db.execute(
      'UPDATE progress SET current_lesson_no = ? WHERE student_id = ?', [no, testStudentId]);

    // MW25 progress 指向 probeNoC（比现有 last 更大）→ 判错仍应推进 `last`（A19 在真实链路上复活）
    await setProgressNo(probeNoC);
    const rA20 = await post(`/api/mistakes/${revRow.id}/review?studentId=${testStudentId}`,
      { result: 'wrong', clientEventId: 'mw-rev-n1' });   // ← 不传 lessonNo（真实前端形态）
    revRow = await mwRev();
    check(`MW25 未传 lessonNo → 回退 progress.current_lesson_no=${probeNoC}，last 前进且 first 冻结（A20）`,
      rA20.status === 200 && revRow.last_lesson_id === lessonIdOfNo(probeNoC)
        && revRow.first_lesson_id === lessonIdOfNo(probeNoA),
      `status=${rA20.status} first=${revRow.first_lesson_id} last=${revRow.last_lesson_id} want=${lessonIdOfNo(probeNoC)}`);

    // MW26 同源：事件流水 `lesson_id` 必须与 `last_lesson_id` 指向**同一课**（不再是 NULL）
    const evA20 = (await db.query(
      'SELECT lesson_id FROM mistake_events WHERE student_id = ? AND client_event_id = ?',
      [testStudentId, 'mw-rev-n1']))[0];
    eq('MW26 事件 lesson_id 与 last_lesson_id 同源（回退后不再留 NULL）',
      [evA20 && evA20.lesson_id, !!(evA20 && evA20.lesson_id === revRow.last_lesson_id)],
      [lessonIdOfNo(probeNoC), true]);

    // MW26b 回退到的课号更小 → 单调守卫仍生效（回退 **不能** 绕过 `max` 守卫）
    await setProgressNo(probeNoA);
    await post(`/api/mistakes/${revRow.id}/review?studentId=${testStudentId}`,
      { result: 'wrong', clientEventId: 'mw-rev-n2' });
    revRow = await mwRev();
    eq(`MW26b 回退课号更小 → last 不回退（仍 ${probeNoC}）`,
      revRow.last_lesson_id, lessonIdOfNo(probeNoC));

    // MW27 回退课号在 lessons 中不存在（≈「进度表跑在实际课号之前」的中间态）→
    //      不报错、不刷 last、事件课号留空（维持「课号不可知」的既有行为）
    const staleNo = probeNoC + 1000;
    await setProgressNo(staleNo);
    const rStale = await post(`/api/mistakes/${revRow.id}/review?studentId=${testStudentId}`,
      { result: 'wrong', clientEventId: 'mw-rev-n3' });
    revRow = await mwRev();
    const evStale = (await db.query(
      'SELECT lesson_id FROM mistake_events WHERE student_id = ? AND client_event_id = ?',
      [testStudentId, 'mw-rev-n3']))[0];
    check(`MW27 回退课号 ${staleNo} 无对应课 → 200、last 不变、事件课号留空（不报错、不静默乱刷）`,
      rStale.status === 200 && revRow.last_lesson_id === lessonIdOfNo(probeNoC)
        && !!evStale && evStale.lesson_id === null,
      `status=${rStale.status} last=${revRow.last_lesson_id} evLesson=${evStale && evStale.lesson_id}`);

    // MW15 学生隔离：默认学生列表不含临时学生错词
    r = await get('/api/mistakes?size=500');
    check('MW15 学生隔离：默认学生列表不含临时学生的错词',
      r.status === 200 && !JSON.stringify(r.json).includes('MW go to school'),
      `默认学生 total=${r.json && r.json.data && r.json.data.total}`);

    // MW16 清理
    await cleanup(testStudentId);
    eq('MW16 清理后错词零残留', await cntMistakes(), 0);

    await cleanup(testStudentId);
    eq('RW18 清理后阅读三表零残留', await cnt(), { days: 0, pieces: 0, questions: 0 });

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
