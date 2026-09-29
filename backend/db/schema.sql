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
                    'homework','my_answer','grading','feedback') NOT NULL,
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
-- 视图：看板统计（等价 review/index.html 顶部统计卡）
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_dashboard_stats AS
SELECT
  s.id AS student_id,
  s.name AS student_name,
  (SELECT COUNT(*) FROM lessons l WHERE l.student_id = s.id)                    AS lesson_count,
  (SELECT p.current_level FROM progress p WHERE p.student_id = s.id)           AS current_level,
  (SELECT COUNT(*) FROM vocabulary v WHERE v.student_id = s.id)                AS vocab_total,
  (SELECT COUNT(*) FROM mistakes m WHERE m.student_id = s.id AND m.status='pending') AS pending_mistake_count
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
