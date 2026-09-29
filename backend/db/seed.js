'use strict';

/**
 * 种子数据：来自项目现有 Markdown 的真实学习数据（第 1—6 课 · 截至 2026-09-29）。
 * 来源：progress.md、wrong-words.md、notes/day-01-07.md、digest.md。
 * 幂等：全部使用 INSERT ... ON DUPLICATE KEY UPDATE，可重复执行。
 */

const STUDENT = {
  name: 'Zane',
  nickname: '刘凤渝',
  email: null,
  target: '能读懂并写出日常句子',
};

const PROGRESS = {
  currentLevel: 'Level 2',
  currentLessonNo: 6,
  lastFeedback: 'just_right',
  easyStreak: 0,
  upgradeFrozenUntil: 0,
  lastClassDate: '2026-09-29',
  note: '第 5、6 课错误未持续下降且老错复发，暂停加速，先做巩固纠错',
};

const LESSONS = [
  {
    lessonNo: 1, lessonDate: '2026-09-26', level: 'Level 1',
    summary: '学会「主语 + 谓语 + 宾语」的语序，能写出 I like music 这类最简单的句子',
    grammarPoint: '主语 + 谓语 + 宾语', feedback: 'too_easy', errorCount: 3, exerciseCount: 7,
    sourceFile: 'day-01-07.md',
    grammarMd: '英语最基本的句子顺序是：主语 + 谓语 + 宾语。\n\n- 主语：做这件事的人或物（I / you / we / they / Tom）\n- 谓语：动作本身，一定是动词（like / study / work / need）\n- 宾语：动作落在谁身上（music / English / help）\n\n顺序不能改。写成 Like I music 或 I music like 都是错的。',
  },
  {
    lessonNo: 2, lessonDate: '2026-09-26', level: 'Level 1',
    summary: '学会 be 动词 am / is / are，能说清楚「是谁、是什么样」',
    grammarPoint: 'be 动词 am / is / are', feedback: 'too_easy', errorCount: 4, exerciseCount: 7,
    sourceFile: 'day-01-07.md',
    grammarMd: '表示「是 / 在 / 状态」要用 be 动词，它跟着主语变：\n\n- I → am：I am a student.\n- he / she / it / 单个人名 → is：He is my teacher.\n- you / we / they / 复数 → are：We are busy.\n\n口诀：I 用 am，you 用 are，is 跟着他她它，复数全部都用 are。',
  },
  {
    lessonNo: 3, lessonDate: '2026-09-27', level: 'Level 1',
    summary: '学会主格与物主代词 I/my、he/his、she/her，能说清「谁的」',
    grammarPoint: '主格与物主代词', feedback: 'too_easy', errorCount: 2, exerciseCount: 7,
    sourceFile: 'day-01-07.md',
    grammarMd: '同一个「我」有两种写法，看它站在什么位置：\n\n- 主格（作主语）：I / you / he / she / we / they\n- 形容词性物主代词（表示「……的」，后面必须跟名词）：my / your / his / her / our / their\n\n记法：主格是「谁」，物主代词是「谁的」。',
  },
  {
    lessonNo: 4, lessonDate: '2026-09-27', level: 'Level 2',
    summary: '学会现在进行时 am/is/are + -ing，能说清「此刻正在做什么」',
    grammarPoint: '现在进行时 am/is/are + -ing', feedback: 'just_right', errorCount: 6, exerciseCount: 7,
    sourceFile: 'day-01-07.md',
    grammarMd: '表示「此刻正在做」，用 主语 + am / is / are + 动词的 -ing 形式。\n\n动词加 -ing 的三条拼写规则：\n1. 一般直接加：study → studying\n2. 以不发音的 e 结尾，去 e 再加：make → making\n3. 重读闭音节，双写末尾辅音：run → running\n\n否定：am/is/are 后加 not；疑问：把 am/is/are 提到主语前。',
  },
  {
    lessonNo: 5, lessonDate: '2026-09-28', level: 'Level 2',
    summary: '分清一般现在时与现在进行时什么时候该用哪个',
    grammarPoint: '一般现在时 vs 现在进行时', feedback: 'just_right', errorCount: 2, exerciseCount: 7,
    sourceFile: 'day-01-07.md',
    grammarMd: '两个时态的分工：\n\n- 一般现在时：习惯、事实、长期状态。标志词 every day、usually、always。\n- 现在进行时：此刻正在、暂时发生。标志词 now、right now。\n\n例外：心里状态的动词通常不用进行时 —— like、need、want、know、love。',
  },
  {
    lessonNo: 6, lessonDate: '2026-09-29', level: 'Level 2',
    summary: '学会过去时 was / were，能说清「昨天怎么样」',
    grammarPoint: '一般过去时 was / were', feedback: 'just_right', errorCount: 5, exerciseCount: 9,
    sourceFile: 'day-01-07.md',
    grammarMd: '讲昨天、上次、以前的事，be 动词要换成过去式：\n\n| 现在 | 过去 |\n|---|---|\n| I am busy. | I was busy. |\n| he / she / it is busy. | he / she / it was busy. |\n| you / we / they are busy. | you / we / they were busy. |\n\n口诀：am / is → was，are → were。\n\n- 否定：was / were 后加 not\n- 疑问：把 was / were 提到主语前\n- 时间标志词：yesterday、last night、last week、two days ago',
  },
];

/** 每课词汇（真实来自 notes/day-01-07.md 的词汇表） */
const LESSON_VOCAB = {
  1: [
    ['like', '/laɪk/', '喜欢', 'I like music.'],
    ['study', '/ˈstʌdi/', '学习', 'I study English.'],
    ['work', '/wɜːrk/', '工作；干活', 'I work in a small company.'],
    ['need', '/niːd/', '需要', 'We need help.'],
    ['play', '/pleɪ/', '玩；踢（球）', 'They play football.'],
    ['watch', '/wɑːtʃ/', '看（电视、电影）', 'We watch movies.'],
    ['English', '/ˈɪŋɡlɪʃ/', '英语', 'She studies English.'],
    ['music', '/ˈmjuːzɪk/', '音乐', 'I like music.'],
  ],
  2: [
    ['student', '/ˈstuːdnt/', '学生', 'I am a student.'],
    ['teacher', '/ˈtiːtʃər/', '老师', 'She is my teacher.'],
    ['friend', '/frend/', '朋友', 'He is my friend.'],
    ['busy', '/ˈbɪzi/', '忙的', 'I am busy today.'],
    ['tired', '/ˈtaɪərd/', '累的', 'We are tired.'],
    ['happy', '/ˈhæpi/', '开心的', 'They are happy.'],
    ['tall', '/tɔːl/', '高的', 'Tom is tall.'],
  ],
  3: [
    ['name', '/neɪm/', '名字', 'My name is Zane.'],
    ['book', '/bʊk/', '书', 'I like my book.'],
    ['bag', '/bæɡ/', '包；书包', 'Her bag is big.'],
    ['big', '/bɪɡ/', '大的', 'My bag is big.'],
    ['class', '/klæs/', '班级；课', 'My class is big.'],
    ['computer', '/kəmˈpjuːtər/', '电脑', 'I like my computer.'],
    ['school', '/skuːl/', '学校', 'My school is big.'],
  ],
  4: [
    ['read', '/riːd/', '读', 'He is reading a book.'],
    ['write', '/raɪt/', '写', 'I am writing an email.'],
    ['make', '/meɪk/', '做；制造', 'She is making dinner.'],
    ['cook', '/kʊk/', '做饭', 'My mother is cooking dinner.'],
    ['dinner', '/ˈdɪnər/', '晚饭', 'We are making dinner now.'],
    ['email', '/ˈiːmeɪl/', '电子邮件', 'I am writing an email now.'],
    ['sit', '/sɪt/', '坐', 'I am sitting now.'],
    ['run', '/rʌn/', '跑', 'Tom is running.'],
    ['now', '/naʊ/', '现在', 'I am busy now.'],
    ['kitchen', '/ˈkɪtʃɪn/', '厨房', 'She is in the kitchen.'],
  ],
  5: [
    ['usually', '/ˈjuːʒuəli/', '通常', 'I usually study English after work.'],
    ['sometimes', '/ˈsʌmtaɪmz/', '有时', 'We sometimes play games.'],
    ['often', '/ˈɔːfn/', '经常', 'He is often busy.'],
    ['morning', '/ˈmɔːrnɪŋ/', '早上', 'I read English every morning.'],
    ['evening', '/ˈiːvnɪŋ/', '晚上', 'We watch TV in the evening.'],
    ['weekend', '/ˈwiːkend/', '周末', 'They play football on the weekend.'],
    ['today', '/təˈdeɪ/', '今天', 'She is working today.'],
    ['office', '/ˈɔːfɪs/', '办公室', 'He works in an office.'],
    ['sleep', '/sliːp/', '睡觉', 'He is sleeping now.'],
    ['homework', '/ˈhoʊmwɜːrk/', '作业', 'Tom is doing his homework now.'],
  ],
  6: [
    ['yesterday', '/ˈjestərdeɪ/', '昨天', 'I was tired yesterday.'],
    ['last night', '/læst naɪt/', '昨晚', 'He was at home last night.'],
    ['ago', '/əˈɡoʊ/', '以前（…之前）', 'We were in Beijing two days ago.'],
    ['week', '/wiːk/', '星期；周', 'She was busy last week.'],
    ['tired', '/ˈtaɪərd/', '累的', 'I was very tired yesterday.'],
    ['late', '/leɪt/', '晚的；迟到', 'Tom was late this morning.'],
    ['sick', '/sɪk/', '生病的', 'She was sick last week.'],
    ['fine', '/faɪn/', '好的', 'I was fine yesterday.'],
    ['at home', '/ət hoʊm/', '在家', 'They were at home.'],
    ['question', '/ˈkwestʃən/', '问题', 'The question was easy.'],
  ],
};

/**
 * 错词本（真实来自 wrong-words.md，共 21 条）。
 * lessonNo 为 null 表示来源是「诊断」而非某课。
 */
const MISTAKES = [
  { wrong: 'We see movie', correct: 'We watch movies', type: 'word_choice', reason: '「看电视/电影」用 watch 不用 see；movie 是可数名词，单数不能裸用', streak: 2, wrongCount: 1, status: 'passed', lessonNo: 1 },
  { wrong: 'ask for my teacher', correct: 'ask my teacher for help', type: 'word_choice', reason: 'ask for 表示「要某物」，向人请教要说 ask sb (for help)', streak: 2, wrongCount: 1, status: 'passed', lessonNo: 1 },
  { wrong: 'Tv', correct: 'TV', type: 'capitalization', reason: '缩写词两个字母都要大写', streak: 2, wrongCount: 1, status: 'passed', lessonNo: 1 },
  { wrong: 'Tom play soccer', correct: 'Tom plays soccer', type: 'grammar', reason: '主语是第三人称单数时一般现在时动词要加 -s', streak: 1, wrongCount: 1, status: 'pending', lessonNo: 2 },
  { wrong: 'now,liked my teacher', correct: 'and I like my teacher ／ 用句号断开', type: 'punctuation', reason: '逗号不能连接两个完整句子；要用句号或加 and', streak: 1, wrongCount: 3, status: 'pending', lessonNo: 2 },
  { wrong: 'she always is busy', correct: 'she is always busy', type: 'grammar', reason: '频度副词要放在 be 动词之后；busy 别拼成 bush（灌木）', streak: 1, wrongCount: 2, status: 'pending', lessonNo: 2 },
  { wrong: 'zane（人名小写）', correct: 'Zane', type: 'capitalization', reason: '人名、地名首字母一律大写', streak: 0, wrongCount: 1, status: 'pending', lessonNo: 2 },
  { wrong: 'Do you like coffee.（句号结尾）', correct: 'Do you like coffee?', type: 'punctuation', reason: '疑问句结尾必须用问号', streak: 0, wrongCount: 3, status: 'pending', lessonNo: null },
  { wrong: 'An book on the table.', correct: 'There is a book on the table.', type: 'grammar', reason: '「某处有某物」要用 there is / there are；an 只用于元音音素开头的词', streak: 2, wrongCount: 2, status: 'passed', lessonNo: null },
  { wrong: 'I reading a book.', correct: 'I am reading a book.', type: 'grammar', reason: '现在进行时必须有 be 动词 am / is / are', streak: 1, wrongCount: 1, status: 'pending', lessonNo: 4 },
  { wrong: 'my grandpa and me', correct: 'my grandpa and I', type: 'grammar', reason: '作主语用主格 I，me 是宾格；别人在前，I 在后', streak: 0, wrongCount: 1, status: 'pending', lessonNo: 4 },
  { wrong: 'play game（第 3 次犯：第 6 课写 were playing game）', correct: 'play games', type: 'grammar', reason: '可数名词单数不能裸用，用复数或 a + 单数', streak: 0, wrongCount: 3, status: 'pending', lessonNo: 4, lastLessonNo: 6 },
  { wrong: 'I am very busy.（题目要求「我们很忙」）', correct: 'We are busy.', type: 'word_choice', reason: '中文「我们」要用 we，后面配 are；I 只代表「我」', streak: 1, wrongCount: 1, status: 'pending', lessonNo: 6 },
  { wrong: 'those are their bags.（句首小写）', correct: 'Those are their bags.', type: 'capitalization', reason: '句首单词首字母必须大写', streak: 1, wrongCount: 2, status: 'pending', lessonNo: 5 },
  { wrong: 'Theri school is very big', correct: 'Their school is very big', type: 'spelling', reason: '拼写：their（他们的）字母顺序写反成 theri', streak: 0, wrongCount: 1, status: 'pending', lessonNo: 6 },
  { wrong: 'at yesterday（I was busy at yesterday）', correct: 'yesterday（不加 at）', type: 'grammar', reason: 'yesterday / today / tomorrow 前面不加介词', streak: 0, wrongCount: 2, status: 'pending', lessonNo: 6 },
  { wrong: 'What were you yesterday.（问「昨天怎么样」）', correct: 'How were you yesterday?', type: 'word_choice', reason: '问「身体 / 状态怎么样」用 how，不用 what；句尾必须是问号', streak: 0, wrongCount: 1, status: 'pending', lessonNo: 6 },
  { wrong: 'I teached my friend to use AI', correct: 'I taught my friend to use AI', type: 'grammar', reason: 'teach 是不规则动词，过去式 taught 不是加 -ed', streak: 0, wrongCount: 1, status: 'pending', lessonNo: 6 },
  { wrong: 'I was busy yesterday.（翻译题「我昨天很忙」正确）', correct: '—', type: 'other', reason: '已掌握，第 6 课答对', streak: 1, wrongCount: 0, status: 'passed', lessonNo: 6 },
  { wrong: 'what do you do?（问「正在做什么」时）', correct: 'What are you doing?', type: 'grammar', reason: 'What do you do? 问的是职业；问此刻在做的事用进行时', streak: 0, wrongCount: 1, status: 'pending', lessonNo: 4 },
];

/** 写入全部种子数据 */
async function seed(conn) {
  // 1) 学生
  await conn.execute(
    `INSERT INTO students (id, name, nickname, email, target, status)
     VALUES (1, ?, ?, ?, ?, 'active')
     ON DUPLICATE KEY UPDATE nickname = VALUES(nickname), target = VALUES(target)`,
    [STUDENT.name, STUDENT.nickname, STUDENT.email, STUDENT.target]
  );
  const [[student]] = await conn.execute('SELECT id FROM students WHERE name = ?', [STUDENT.name]);
  const studentId = student.id;

  // 2) 进度
  await conn.execute(
    `INSERT INTO progress
       (student_id, current_level, current_lesson_no, last_feedback, easy_streak,
        upgrade_frozen_until, last_class_date, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       current_level = VALUES(current_level), current_lesson_no = VALUES(current_lesson_no),
       last_feedback = VALUES(last_feedback), easy_streak = VALUES(easy_streak),
       upgrade_frozen_until = VALUES(upgrade_frozen_until),
       last_class_date = VALUES(last_class_date), note = VALUES(note)`,
    [
      studentId, PROGRESS.currentLevel, PROGRESS.currentLessonNo, PROGRESS.lastFeedback,
      PROGRESS.easyStreak, PROGRESS.upgradeFrozenUntil, PROGRESS.lastClassDate, PROGRESS.note,
    ]
  );

  // 3) 课程 + 小节 + 学习记录
  // 学习记录是流水，不做 upsert（会重复）。仅在该学生尚无流水时写入一次。
  const [[recordCount]] = await conn.execute(
    'SELECT COUNT(*) AS cnt FROM study_records WHERE student_id = ?',
    [studentId]
  );
  const shouldSeedRecords = recordCount.cnt === 0;

  const lessonIdByNo = {};
  for (const lesson of LESSONS) {
    const vocabList = LESSON_VOCAB[lesson.lessonNo] || [];
    await conn.execute(
      `INSERT INTO lessons
         (student_id, lesson_no, lesson_date, level_code, summary, grammar_point,
          vocab_count, exercise_count, error_count, feedback, source_file, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'taught')
       ON DUPLICATE KEY UPDATE
         lesson_date = VALUES(lesson_date), level_code = VALUES(level_code),
         summary = VALUES(summary), grammar_point = VALUES(grammar_point),
         vocab_count = VALUES(vocab_count), exercise_count = VALUES(exercise_count),
         error_count = VALUES(error_count), feedback = VALUES(feedback),
         source_file = VALUES(source_file)`,
      [
        studentId, lesson.lessonNo, lesson.lessonDate, lesson.level, lesson.summary,
        lesson.grammarPoint, vocabList.length, lesson.exerciseCount, lesson.errorCount,
        lesson.feedback, lesson.sourceFile,
      ]
    );
    const [[row]] = await conn.execute(
      'SELECT id FROM lessons WHERE student_id = ? AND lesson_no = ?',
      [studentId, lesson.lessonNo]
    );
    lessonIdByNo[lesson.lessonNo] = row.id;

    // 小节：今日语法 + 难度反馈
    await conn.execute(
      `INSERT INTO lesson_sections (lesson_id, section_type, content_md, order_index)
       VALUES (?, 'grammar', ?, 1)
       ON DUPLICATE KEY UPDATE content_md = VALUES(content_md)`,
      [row.id, lesson.grammarMd]
    );
    await conn.execute(
      `INSERT INTO lesson_sections (lesson_id, section_type, content_md, order_index)
       VALUES (?, 'feedback', ?, 7)
       ON DUPLICATE KEY UPDATE content_md = VALUES(content_md)`,
      [row.id, `难度反馈：${lesson.feedback === 'too_easy' ? '太简单' : lesson.feedback === 'too_hard' ? '太难' : '刚好'}`]
    );

    // 学习记录：上课 / 批改 / 难度反馈（仅在无流水时写入，避免重复累加）
    if (shouldSeedRecords) {
      await conn.execute(
        `INSERT INTO study_records (student_id, lesson_id, record_type, summary, payload)
         VALUES (?, ?, 'attend', ?, ?)`,
        [studentId, row.id, `第 ${lesson.lessonNo} 课上课`, JSON.stringify({ lessonNo: lesson.lessonNo, level: lesson.level })]
      );
      await conn.execute(
        `INSERT INTO study_records (student_id, lesson_id, record_type, summary, payload)
         VALUES (?, ?, 'grade', ?, ?)`,
        [
          studentId, row.id, `第 ${lesson.lessonNo} 课作业批改：错误 ${lesson.errorCount} 处`,
          JSON.stringify({ lessonNo: lesson.lessonNo, errorCount: lesson.errorCount, exerciseCount: lesson.exerciseCount }),
        ]
      );
      await conn.execute(
        `INSERT INTO study_records (student_id, lesson_id, record_type, summary, payload)
         VALUES (?, ?, 'feedback', ?, ?)`,
        [
          studentId, row.id, `第 ${lesson.lessonNo} 课反馈：${lesson.feedback}`,
          JSON.stringify({ lessonNo: lesson.lessonNo, feedback: lesson.feedback }),
        ]
      );
    }
  }

  // 4) 词汇：全局去重 + 课程关联
  const vocabIdByWord = {};
  const seenWords = new Set(); // 按课号顺序遍历，首次出现即 is_new
  for (const lesson of LESSONS) {
    const lessonId = lessonIdByNo[lesson.lessonNo];
    const list = LESSON_VOCAB[lesson.lessonNo] || [];
    for (let i = 0; i < list.length; i += 1) {
      const [word, phonetic, meaning, example] = list[i];
      const key = word.toLowerCase();
      const isNew = !seenWords.has(key);
      seenWords.add(key);

      let vocabId = vocabIdByWord[key];
      if (!vocabId) {
        await conn.execute(
          `INSERT INTO vocabulary (student_id, word, phonetic, meaning, example, first_lesson_id)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE phonetic = VALUES(phonetic), meaning = VALUES(meaning)`,
          [studentId, word, phonetic, meaning, example, lessonId]
        );
        const [[vrow]] = await conn.execute(
          'SELECT id FROM vocabulary WHERE student_id = ? AND word = ?',
          [studentId, word]
        );
        vocabId = vrow.id;
        vocabIdByWord[key] = vocabId;
      }

      await conn.execute(
        `INSERT INTO lesson_vocabulary (lesson_id, vocabulary_id, example, is_new, order_index)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE example = VALUES(example), order_index = VALUES(order_index)`,
        [lessonId, vocabId, example, isNew ? 1 : 0, i + 1]
      );
    }
  }

  // 5) 错词本
  for (const m of MISTAKES) {
    const firstId = m.lessonNo ? lessonIdByNo[m.lessonNo] : null;
    const lastId = m.lastLessonNo ? lessonIdByNo[m.lastLessonNo] : firstId;
    await conn.execute(
      `INSERT INTO mistakes
         (student_id, first_lesson_id, last_lesson_id, wrong_text, correct_text,
          error_type, error_reason, streak, wrong_count, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         error_type = VALUES(error_type), error_reason = VALUES(error_reason),
         streak = VALUES(streak), wrong_count = VALUES(wrong_count), status = VALUES(status)`,
      [
        studentId, firstId, lastId, m.wrong, m.correct, m.type, m.reason,
        m.streak, m.wrongCount, m.status,
      ]
    );
  }

  return {
    studentId,
    lessons: LESSONS.length,
    lessonVocab: Object.values(LESSON_VOCAB).reduce((n, arr) => n + arr.length, 0),
    uniqueVocab: Object.keys(vocabIdByWord).length,
    mistakes: MISTAKES.length,
  };
}

module.exports = { seed, STUDENT, PROGRESS, LESSONS, LESSON_VOCAB, MISTAKES };
