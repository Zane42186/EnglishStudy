-- =============================================================================
-- English Learning Platform · 后端数据库 Schema（第一阶段：数据层与 API 层）
-- -----------------------------------------------------------------------------
-- 目标库：MySQL 8.0+
-- 状态：可执行。由 `npm run db:init`（db/init.js）执行。
--
-- 第一批实体（用户指定）：students / lessons / vocabulary / mistakes /
--                        study_records / progress
-- 补充关联表（分析后判定为必要）：
--   lesson_sections    —— 课程小节正文（复习/语法/词汇/例句/作业/作答/批改/难度反馈）
--   lesson_vocabulary  —— 课程 ↔ 词汇 多对多（含本课例句）
--
-- 长期完整设计（18 表 + 2 视图：知识点地图、阅读、Skill 运行记录等）
-- 见同目录 schema.full.design.sql，将在后续阶段逐步落地。
--
-- 约定：utf8mb4 / InnoDB；时间 DATETIME；外键删除策略 RESTRICT（学习数据只增不删）
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. students —— 学生
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(50)     NOT NULL COMMENT '显示名，如 Zane',
  nickname   VARCHAR(50)     NULL     COMMENT '中文名/昵称',
  email      VARCHAR(128)    NULL,
  target     VARCHAR(255)    NULL     COMMENT '学习目标',
  status     ENUM('active','archived') NOT NULL DEFAULT 'active',
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_students_name (name),
  UNIQUE KEY uk_students_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='学生';

-- -----------------------------------------------------------------------------
-- 2. lessons —— 课程（每课一行）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lessons (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id     BIGINT UNSIGNED NOT NULL,
  lesson_no      INT UNSIGNED    NOT NULL COMMENT '课号（断更不断号）',
  lesson_date    DATE            NULL     COMMENT '上课日期',
  level_code     VARCHAR(10)     NOT NULL COMMENT '上课时级别，如 Level 2',
  summary        VARCHAR(255)    NOT NULL COMMENT '一句话摘要',
  grammar_point  VARCHAR(128)    NULL     COMMENT '本课语法点',
  vocab_count    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  exercise_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  error_count    SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '作业错误处数（不折算百分制）',
  feedback       ENUM('too_easy','just_right','too_hard') NULL COMMENT '难度反馈',
  source_file    VARCHAR(64)     NULL     COMMENT '来源笔记文件，如 day-01-07.md',
  status         ENUM('planned','taught','archived') NOT NULL DEFAULT 'taught',
  created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_lessons_no (student_id, lesson_no),
  KEY idx_lessons_date (student_id, lesson_date),
  CONSTRAINT fk_lessons_student FOREIGN KEY (student_id) REFERENCES students (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='课程';

-- -----------------------------------------------------------------------------
-- 3. lesson_sections —— 课程小节正文（保留原始 Markdown）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lesson_sections (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lesson_id    BIGINT UNSIGNED NOT NULL,
  section_type ENUM('review','grammar','vocab_table','examples',
                    'homework','my_answer','grading','feedback',
                    'objectives','expected_mistakes','backfill') NOT NULL
               COMMENT '课程小节类型。objectives / expected_mistakes 为 2026-09-29 S1 新增（D-10 批准）；backfill 为 2026-09-30 新增（补漏块整段正文，见 docs/skills.md 2.5）；新值一律追加在末尾，避免既有权重索引错位',
  content_md   MEDIUMTEXT      NOT NULL COMMENT '原始 Markdown 正文',
  order_index  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_section (lesson_id, section_type),
  CONSTRAINT fk_section_lesson FOREIGN KEY (lesson_id) REFERENCES lessons (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='课程小节原文';

-- -----------------------------------------------------------------------------
-- 4. vocabulary —— 词汇库（学生内单词唯一）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vocabulary (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id      BIGINT UNSIGNED NOT NULL,
  word            VARCHAR(64)     NOT NULL,
  phonetic        VARCHAR(64)     NULL COMMENT '音标',
  meaning         VARCHAR(255)    NULL COMMENT '中文释义',
  example         VARCHAR(255)    NULL COMMENT '例句',
  first_lesson_id BIGINT UNSIGNED NULL COMMENT '首次出现课',
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_vocab_word (student_id, word),
  KEY idx_vocab_prefix (student_id, word),
  CONSTRAINT fk_vocab_student FOREIGN KEY (student_id) REFERENCES students (id),
  CONSTRAINT fk_vocab_lesson  FOREIGN KEY (first_lesson_id) REFERENCES lessons (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='词汇库';

-- -----------------------------------------------------------------------------
-- 5. lesson_vocabulary —— 课程 ↔ 词汇
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lesson_vocabulary (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lesson_id     BIGINT UNSIGNED NOT NULL,
  vocabulary_id BIGINT UNSIGNED NOT NULL,
  example       VARCHAR(255)    NULL COMMENT '本课例句',
  is_new        TINYINT(1)      NOT NULL DEFAULT 1 COMMENT '本课是否首次出现',
  order_index   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_lesson_vocab (lesson_id, vocabulary_id),
  KEY idx_lv_vocab (vocabulary_id),
  CONSTRAINT fk_lv_lesson FOREIGN KEY (lesson_id)     REFERENCES lessons (id),
  CONSTRAINT fk_lv_vocab  FOREIGN KEY (vocabulary_id) REFERENCES vocabulary (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='课程与词汇关联';

-- -----------------------------------------------------------------------------
-- 6. mistakes —— 错词本
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mistakes (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id       BIGINT UNSIGNED NOT NULL,
  first_lesson_id  BIGINT UNSIGNED NULL COMMENT '首次犯错课',
  last_lesson_id   BIGINT UNSIGNED NULL COMMENT '最近犯错课',
  wrong_text       VARCHAR(512)    NOT NULL COMMENT '错误点',
  correct_text     VARCHAR(512)    NOT NULL COMMENT '正确形式',
  error_type       ENUM('grammar','spelling','punctuation','word_choice','capitalization','other')
                   NOT NULL DEFAULT 'other',
  error_reason     VARCHAR(512)    NULL COMMENT '错因',
  streak           SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '连续答对次数，≥2 判过关',
  wrong_count      SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '累计犯错次数',
  status           ENUM('pending','passed') NOT NULL DEFAULT 'pending',
  last_reviewed_at DATETIME        NULL,
  created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- DQ1 根治：业务判重键。没有它，seed.js 的 ON DUPLICATE KEY UPDATE 永不触发，
  -- 重跑 npm run db:init 会让 mistakes 直接翻倍（实测 19 → 38、20 → 40）。
  -- 判重口径：同一学生下「错误点(wrong_text)」唯一 —— 与 wrong-words.md 的
  -- 「同一错词保留一行、跨课归并」语义一致（如 play game 第 4/6 课归并为 1 条）。
  UNIQUE KEY uk_mistakes_text (student_id, wrong_text),
  KEY idx_mistakes_status (student_id, status),
  KEY idx_mistakes_type (student_id, error_type),
  CONSTRAINT fk_mistakes_student FOREIGN KEY (student_id) REFERENCES students (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='错词本';

-- -----------------------------------------------------------------------------
-- 7. study_records —— 学习记录（行为流水）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS study_records (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id  BIGINT UNSIGNED NOT NULL,
  lesson_id   BIGINT UNSIGNED NULL,
  record_type ENUM('attend','homework_submit','grade','review','feedback','reading') NOT NULL,
  summary     VARCHAR(255)    NULL COMMENT '一行摘要，便于列表展示',
  payload     JSON            NULL COMMENT '结构化细节',
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_records_time (student_id, created_at),
  KEY idx_records_type (student_id, record_type),
  CONSTRAINT fk_records_student FOREIGN KEY (student_id) REFERENCES students (id),
  CONSTRAINT fk_records_lesson  FOREIGN KEY (lesson_id)  REFERENCES lessons (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='学习记录';

-- -----------------------------------------------------------------------------
-- 8. progress —— 学习进度（每生一行）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS progress (
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id           BIGINT UNSIGNED NOT NULL,
  current_level        VARCHAR(10)     NOT NULL DEFAULT 'Level 1' COMMENT '当前级别',
  current_lesson_no    INT UNSIGNED    NOT NULL DEFAULT 0,
  last_feedback        ENUM('too_easy','just_right','too_hard') NULL,
  easy_streak          TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '「太简单」连击计数',
  upgrade_frozen_until INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '冻结升级至该课号',
  last_class_date      DATE            NULL,
  note                 VARCHAR(512)    NULL,
  updated_at           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_progress_student (student_id),
  CONSTRAINT fk_progress_student FOREIGN KEY (student_id) REFERENCES students (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='学习进度';

-- -----------------------------------------------------------------------------
-- 9. lesson_exercises —— 课程练习明细（第二批新增 2026-09-29）
--    没有它，批改结果只能停在对话里，「错了什么」在库内不可追溯。
--    字段对齐 docs/schemas/lesson-record.schema.json 的 ExerciseRecord，
--    并含 FE-1 的 revised_answer（开放题完整改后版，D-11 已批准）。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lesson_exercises (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lesson_id        BIGINT UNSIGNED NOT NULL,
  block_kind       ENUM('homework','backfill') NOT NULL DEFAULT 'homework'
                   COMMENT '题集类型：作业 / 补漏块（同课两套题号命名空间，故必须参与唯一键）',
  block_no         SMALLINT UNSIGNED NOT NULL DEFAULT 0
                   COMMENT '补漏块编号 N；0 = 作业题，不属于补漏块。必须 NOT NULL——MySQL 唯一键不约束 NULL，留空会失去去重能力',
  exercise_no      SMALLINT UNSIGNED NOT NULL COMMENT '块内题号，从 1 开始（作业与补漏块各自独立编号）',
  exercise_type    ENUM('fill_blank','translate','error_correction','reorder','open','choice')
                   NOT NULL DEFAULT 'fill_blank' COMMENT '题型，与 common.schema.json 同源',
  prompt           TEXT            NOT NULL COMMENT '题干',
  self_check       VARCHAR(128)    NULL     COMMENT '本题点名的强制自查项（exercise-set.schema.json selfCheck）',
  reference_answer TEXT            NULL     COMMENT '标准答案',
  target_point     VARCHAR(64)     NULL     COMMENT '考查知识点（设计稿无此列，建表时新增）',
  user_answer      TEXT            NULL     COMMENT '学生作答',
  is_correct       TINYINT(1)      NULL     COMMENT '是否答对；NULL = 未批改',
  error_type       ENUM('grammar','spelling','punctuation','word_choice','capitalization','other')
                   NULL COMMENT '错误类型，复用 mistakes 同一套 ENUM（同源不漂移）',
  error_note       TEXT            NULL     COMMENT '错因批注',
  revised_answer   TEXT            NULL     COMMENT '开放题完整改后版（与 reference_answer 语义不同）',
  order_index      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_exercise (lesson_id, block_kind, block_no, exercise_no),
  KEY idx_ex_lesson (lesson_id),
  CONSTRAINT fk_ex_lesson FOREIGN KEY (lesson_id) REFERENCES lessons (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='课程练习明细';

-- -----------------------------------------------------------------------------
-- 10. mistake_events —— 错词复习流水（第二批新增 2026-09-29）
--     每次判对/判错插一条，用于回放「这个错是慢慢变好还是反复」。
--     client_event_id 提供写入幂等；NULL 可重复（MySQL 唯一键不约束 NULL）。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mistake_events (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id      BIGINT UNSIGNED NOT NULL,
  mistake_id      BIGINT UNSIGNED NOT NULL,
  lesson_id       BIGINT UNSIGNED NULL COMMENT '发生复习的课，可空',
  result          ENUM('correct','wrong') NOT NULL,
  client_event_id VARCHAR(64)     NULL COMMENT '客户端事件 id，用于幂等去重',
  answered_at     DATETIME        NOT NULL COMMENT '本次复习时间',
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_me_client (student_id, client_event_id),
  KEY idx_me_mistake (mistake_id, answered_at),
  CONSTRAINT fk_me_student FOREIGN KEY (student_id) REFERENCES students (id),
  CONSTRAINT fk_me_mistake FOREIGN KEY (mistake_id) REFERENCES mistakes (id),
  CONSTRAINT fk_me_lesson  FOREIGN KEY (lesson_id)  REFERENCES lessons (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='错词复习流水';

-- -----------------------------------------------------------------------------
-- 数据导入规则（DQ1 落地，2026-09-29）：
--   错词本导入必须跳过「非错题」行 —— 满足以下任一即不导入：
--     · correct_text 为占位符（NULL / 空串 / '-' / '—'）
--     · wrong_count = 0
--   依据：mistakes.id=19（correct_text='—'、wrong_count=0、status='passed'）曾误入，
--   造成库内 20 条与 wrong-words.md 19 条不一致（且 byType 多出 other=1）。
--   该行已按 D-7 删除；M2 迁移脚本须固化此规则，否则重跑仍会带回来。
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 11. readings / reading_pieces / reading_questions —— 阅读（第三批新增 2026-09-30）
--     数据源：read/YYYY-MM-DD-read.md；写库器 backend/db/migration/import_json.js。
--     一天一行（uk_reading_day 提供幂等键），一篇一行，一题一行。
--     注意：设计稿 schema.full.design.sql §10—§12 用的是已废弃的 users/user_id 命名，
--     此处按在线约定改为 students/student_id，重跑 db:init 也能建出这三张表。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS readings (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id  BIGINT UNSIGNED NOT NULL,
  read_date   DATE            NOT NULL COMMENT '阅读日（一天一行）',
  source_file VARCHAR(64)     NULL COMMENT '来源 md 文件名，如 2026-09-29-read.md',
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_reading_day (student_id, read_date),
  CONSTRAINT fk_reading_student FOREIGN KEY (student_id) REFERENCES students (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='阅读日（一天一行）';

CREATE TABLE IF NOT EXISTS reading_pieces (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reading_id       BIGINT UNSIGNED NOT NULL,
  piece_no         SMALLINT UNSIGNED NOT NULL COMMENT '当天第几篇，从 1 开始',
  level_code       VARCHAR(16)     NULL COMMENT '如 Level 1',
  source           VARCHAR(128)    NULL COMMENT '自编 / 新闻来源',
  title            VARCHAR(255)    NULL,
  body_md          MEDIUMTEXT      NOT NULL COMMENT '正文（英中对照，逐段）',
  vocabulary_notes TEXT            NULL COMMENT '生词注释',
  word_count       SMALLINT UNSIGNED NULL COMMENT '英文词数（导出时计算）',
  order_index      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_piece (reading_id, piece_no),
  CONSTRAINT fk_piece_reading FOREIGN KEY (reading_id) REFERENCES readings (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='阅读篇';

CREATE TABLE IF NOT EXISTS reading_questions (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  piece_id    BIGINT UNSIGNED NOT NULL,
  question_no SMALLINT UNSIGNED NOT NULL COMMENT '篇内题号，从 1 开始',
  question    TEXT            NOT NULL,
  answer      TEXT            NULL,
  order_index SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_rq (piece_id, question_no),
  CONSTRAINT fk_rq_piece FOREIGN KEY (piece_id) REFERENCES reading_pieces (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='阅读理解题';

-- -----------------------------------------------------------------------------
-- 视图：看板统计（等价 review/index.html 顶部统计卡）
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_dashboard_stats AS
SELECT
  s.id AS student_id,
  s.name AS student_name,
  (SELECT COUNT(*) FROM lessons l WHERE l.student_id = s.id)                    AS lesson_count,
  (SELECT p.current_level FROM progress p WHERE p.student_id = s.id)           AS current_level,
  (SELECT COUNT(*) FROM vocabulary v WHERE v.student_id = s.id)                AS vocab_total,
  (SELECT COUNT(*) FROM mistakes m WHERE m.student_id = s.id AND m.status='pending') AS pending_mistake_count,
  (SELECT COUNT(*) FROM reading_pieces rp
     JOIN readings r ON r.id = rp.reading_id WHERE r.student_id = s.id)             AS reading_piece_count,
  (SELECT COUNT(*) FROM readings r WHERE r.student_id = s.id)                       AS reading_day_count
FROM students s;

-- -----------------------------------------------------------------------------
-- 视图：未过关错词（等价 digest.md「待复习」段）
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_pending_mistakes AS
SELECT m.id, m.student_id, m.wrong_text, m.correct_text, m.error_type,
       m.error_reason, m.streak, m.wrong_count, m.last_reviewed_at
FROM mistakes m
WHERE m.status = 'pending'
ORDER BY m.wrong_count DESC, m.updated_at ASC;
