'use strict';

/**
 * 学习摘要生成器：库 → `INDEX.md` + `digest.md`
 * ---------------------------------------------------------------------------
 * 背景：`INDEX.md` / `digest.md` 原先由 Skill 的 `build_board.py` 生成；
 *      该脚本已在 **Skill v2.3.0 删除**（数据流改为「后端 → 前端 → amy → 后端」）。
 *      两个摘要文件从此**改由后端数据更新** —— 即本脚本，唯一生成方。
 *
 * 输出格式**逐条复刻** `build_board.py` 的 `build_digest()` / INDEX 生成规则
 * （规则已从 `.workbuddy/skill-backups/english-daily-v2.2.3-20260930-pre-delete/` 取回核对），
 * 差别只在**数据来源由 md 改为库内**，以及两处有意修正（见下）。
 *
 * 与旧脚本的两处有意差异
 *   1. `第 诊断 课`（旧脚本把 md 的「诊断」直接塞进「第 N 课」模板）→ 改为 `诊断`
 *   2. 第 2、4 课在库内已有 `lesson_date`（`db:import` 的「同日沿用当日日期」补齐），
 *      故列表会带出日期；旧脚本读 md 时那两课无日期，故不带
 *   ⇒ 这两处属**内容刷新**，不是 bug。
 *
 * 只读库、只写这两个 md 文件；不碰任何业务表。
 *
 * 用法：
 *   node scripts/build-summary.js              # 写 INDEX.md / digest.md
 *   node scripts/build-summary.js --dry-run    # 打到 stdout，不写文件
 *   node scripts/build-summary.js --check      # 不写，若与现有文件不一致则退出码 1
 *   node scripts/build-summary.js --root <dir> # 指定学习目录（默认仓库根）
 */

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const db = require('../src/config/db');

const GENERATED_BY = 'backend/scripts/build-summary.js';

function parseArgs(argv) {
  const args = { root: path.join(__dirname, '..', '..'), dryRun: false, check: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--check') args.check = true;
    else if (a === '--root') args.root = argv[++i];
  }
  return args;
}

/** 非空行（去首尾空白） */
function lines(text) {
  return String(text == null ? '' : text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * 语法要点：取「今日语法」段中**第一条**满足以下条件的行（复刻 build_board.py）
 *   - 去掉句末标点后长度 ≥ 8
 *   - 不以 `|` / `>` / `-` / `*` / `<` / `1.` / `2.` / `3.` 开头
 * 取前 80 字。
 */
function pickGrammarPoint(contentMd) {
  for (const raw of String(contentMd == null ? '' : contentMd).split(/\r?\n/)) {
    const text = raw.trim().replace(/[：:，,。.]+$/, '');
    if (text.length < 8) continue;
    if (/^[|>*<]/.test(text) || /^-/.test(text) || /^[123]\./.test(text)) continue;
    return text.slice(0, 80);
  }
  return null;
}

/** 课次标签：`第 N 课`；无课次（诊断/复习类）退化为 `诊断` */
function lessonLabel(lessonNo) {
  return lessonNo == null ? '诊断' : `第 ${lessonNo} 课`;
}

async function loadData() {
  const [student] = await db.query('SELECT id, name FROM students ORDER BY id LIMIT 1');
  if (!student) throw new Error('students 表为空，无法生成摘要');
  const sid = student.id;

  const [progress] = await db.query(
    'SELECT current_level, current_lesson_no, last_class_date FROM progress WHERE student_id = ?',
    [sid]
  );
  const lessons = await db.query(
    `SELECT id, lesson_no, lesson_date, level_code, summary, source_file
       FROM lessons WHERE student_id = ? ORDER BY lesson_no`,
    [sid]
  );
  const sections = await db.query(
    `SELECT s.lesson_id, s.section_type, s.content_md
       FROM lesson_sections s JOIN lessons l ON l.id = s.lesson_id
      WHERE l.student_id = ?`,
    [sid]
  );
  const vocab = await db.query(
    `SELECT lv.lesson_id, v.word
       FROM lesson_vocabulary lv
       JOIN vocabulary v ON v.id = lv.vocabulary_id
       JOIN lessons l ON l.id = lv.lesson_id
      WHERE l.student_id = ?
      ORDER BY lv.lesson_id, lv.id`,
    [sid]
  );
  const pending = await db.query(
    `SELECT m.wrong_text, m.correct_text, m.error_reason, m.streak, l.lesson_no
       FROM mistakes m LEFT JOIN lessons l ON l.id = m.first_lesson_id
      WHERE m.student_id = ? AND m.status = 'pending'
      ORDER BY (m.first_lesson_id IS NULL), m.first_lesson_id, m.id`,
    [sid]
  );
  const days = await db.query(
    `SELECT r.read_date,
            GROUP_CONCAT(p.title ORDER BY p.piece_no SEPARATOR '\u001f') AS titles_raw,
            COUNT(p.id) AS piece_count
       FROM readings r
       LEFT JOIN reading_pieces p ON p.reading_id = r.id
      WHERE r.student_id = ?
      GROUP BY r.id, r.read_date
      ORDER BY r.read_date DESC`,
    [sid]
  );
  return { student, progress, lessons, sections, vocab, pending, days };
}

function sectionMap(sections) {
  const byLesson = new Map();
  for (const s of sections) {
    if (!byLesson.has(s.lesson_id)) byLesson.set(s.lesson_id, new Map());
    byLesson.get(s.lesson_id).set(s.section_type, s.content_md);
  }
  return byLesson;
}

function vocabMap(vocab) {
  const byLesson = new Map();
  for (const v of vocab) {
    if (!byLesson.has(v.lesson_id)) byLesson.set(v.lesson_id, []);
    byLesson.get(v.lesson_id).push(v.word);
  }
  return byLesson;
}

/** INDEX.md —— 总目录 */
function buildIndex(data, reader) {
  const { lessons, progress, days } = data;
  const pieceTotal = days.reduce((a, d) => a + Number(d.piece_count), 0);
  const last = lessons[lessons.length - 1] || null;

  const out = [
    '# 英语学习总目录',
    '',
    `> 由 ${GENERATED_BY} 从库内数据生成，手工修改会在下次重建时被覆盖。`,
    '',
    `- 课程总数：${lessons.length}`,
    `- 当前级别：${progress ? progress.current_level : '（未知）'}`,
    `- 阅读文件：${days.length} 天，共 ${pieceTotal} 篇`,
  ];
  if (last) {
    out.push(`- 最近一课：第 ${last.lesson_no} 课（${last.lesson_date || '日期未标注'}） ${last.summary || ''}`.trimEnd());
  } else {
    out.push('- 最近一课：还没有课程');
  }

  // 按笔记文件分组（如 day-01-07.md / day-08-14.md）
  const groups = new Map();
  for (const l of lessons) {
    const f = l.source_file || '（未标注来源文件）';
    if (!groups.has(f)) groups.set(f, []);
    groups.get(f).push(l);
  }
  for (const [file, list] of groups) {
    const min = list[0].lesson_no;
    const max = list[list.length - 1].lesson_no;
    out.push('', `## 第 ${min}-${max + 1} 课（${file}）`, '', '————————————', '');
    for (const l of list) {
      const date = l.lesson_date ? ` · ${l.lesson_date}` : '';
      out.push(`第 ${l.lesson_no} 课${date}：${l.summary || '（缺一句话摘要）'}`);
    }
  }

  out.push('', '## 阅读文件', '', '————————————', '');
  if (reader.length) {
    for (const d of reader) {
      const titles = d.titles.join('、');
      out.push(`${d.date}：${d.piece_count} 篇（${titles}） → read\\${d.date}-read.md`);
    }
  } else {
    out.push('（还没有阅读文件）');
  }
  out.push('');
  return out.join('\n');
}

/** digest.md —— 上课时只读这一份 */
function buildDigest(data, secMap, vocMap, reader) {
  const { lessons, progress, pending } = data;
  const recent = lessons.slice(-3);

  const out = [
    '# 学习摘要',
    '',
    `> 由 ${GENERATED_BY} 从库内数据生成，每次重建时整体覆盖。手工修改会被冲掉。`,
    '> 上课时只读这一份即可，不需要读 notes 全文。',
    '',
    `- 当前级别：${progress ? progress.current_level : '（未知）'}`,
    `- 已上课数：${lessons.length}`,
    '',
  ];
  const last = lessons[lessons.length - 1];
  out.push(last ? `- 上次上课：第 ${last.lesson_no} 课（${last.lesson_date || '日期未标注'}）` : '- 上次上课：还没有课程');

  out.push('', '## 最近三课（写作业、讲新课时参考）', '');
  if (!recent.length) {
    out.push('还没有课程记录。这是第一课。', '');
  }
  for (const l of [...recent].reverse()) {
    const date = l.lesson_date ? ` · ${l.lesson_date}` : '';
    const secs = secMap.get(l.id) || new Map();
    out.push(`### 第 ${l.lesson_no} 课${date}`, '');
    out.push(`- 一句话：${l.summary || '（缺一句话摘要）'}`);
    const gp = pickGrammarPoint(secs.get('grammar'));
    if (gp) out.push(`- 语法要点：${gp}`);
    const words = vocMap.get(l.id) || [];
    if (words.length) out.push(`- 词汇：${words.join('、')}`);
    const fb = lines(secs.get('feedback'))[0];
    if (fb) out.push(`- 难度反馈：${fb}`);
    const gradedCount = lines(secs.get('grading')).length;
    out.push(`- 批改记录：${gradedCount} 条（详见 notes\\${l.source_file || 'notes'} 或看板详情页）`);
    out.push('');
  }

  out.push('## 全部课号一览', '');
  if (lessons.length) {
    for (const l of lessons) out.push(`第 ${l.lesson_no} 课：${l.summary || '（缺一句话摘要）'}`);
  } else {
    out.push('（空）');
  }

  out.push('', '## 错词本待复习项（出复习题时取用）', '');
  if (pending.length) {
    for (const r of pending) {
      out.push(
        `- ${lessonLabel(r.lesson_no)} ｜ ${r.wrong_text} → ${r.correct_text || ''} ｜ 错因：${r.error_reason || ''} ｜ 连续答对 ${r.streak}`
      );
    }
  } else {
    out.push('（无未过关项）');
  }

  out.push('', '## 阅读文件', '');
  if (reader.length) {
    for (const d of reader) out.push(`- ${d.date}：${d.piece_count} 篇（${d.titles.join('、')}）`);
  } else {
    out.push('（还没有阅读文件）');
  }
  out.push('');
  return out.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const data = await loadData();
  const secMap = sectionMap(data.sections);
  const vocMap = vocabMap(data.vocab);
  const reader = data.days.map((d) => ({
    date: d.read_date,
    piece_count: Number(d.piece_count),
    titles: String(d.titles_raw || '').split('\u001f').map((t) => t.trim()).filter(Boolean),
  }));

  const files = [
    ['INDEX.md', buildIndex(data, reader)],
    ['digest.md', buildDigest(data, secMap, vocMap, reader)],
  ];

  if (args.dryRun) {
    for (const [name, content] of files) {
      console.log(`===== ${name} =====`);
      console.log(content);
    }
    return 0;
  }

  let stale = 0;
  for (const [name, content] of files) {
    const target = path.join(args.root, name);
    const prev = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
    if (args.check) {
      const same = prev !== null && prev.replace(/\r\n/g, '\n') === content.replace(/\r\n/g, '\n');
      if (!same) {
        stale += 1;
        console.log(`STALE ${name}`);
      } else {
        console.log(`OK    ${name}`);
      }
      continue;
    }
    fs.writeFileSync(target, content, 'utf8');
    console.log(`${prev === null ? 'CREATED' : prev.replace(/\r\n/g, '\n') === content.replace(/\r\n/g, '\n') ? 'UNCHANGED' : 'UPDATED'} ${target}`);
  }

  if (args.check) {
    console.log(`${stale ? 'SUMMARY_CHECK_STALE' : 'SUMMARY_CHECK_OK'} stale=${stale}`);
    return stale ? 1 : 0;
  }
  console.log(
    `SUMMARY_OK lessons=${data.lessons.length} pendingMistakes=${data.pending.length} ` +
      `readingDays=${reader.length} pieces=${reader.reduce((a, d) => a + d.piece_count, 0)}`
  );
  return 0;
}

main()
  .then(async (code) => {
    await db.close();
    process.exit(code);
  })
  .catch(async (err) => {
    console.error('SUMMARY_FAIL', err && err.message ? err.message : err);
    try {
      await db.close();
    } catch {
      /* ignore */
    }
    process.exit(1);
  });
