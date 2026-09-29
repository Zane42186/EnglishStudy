-- =============================================================================
-- English Learning Platform · 后端数据库设计稿（MySQL 8.0+）
-- -----------------------------------------------------------------------------
-- 状态：DESIGN ONLY —— 仅为设计稿，尚未在任何数据库执行。
-- 落地前请先与我确认 root 密码，再执行本文件。
--
-- 约定：
--   * 字符集 utf8mb4 / 排序规则 utf8mb4_unicode_ci（兼容 emoji 与多语言）
--   * 存储引擎 InnoDB，行格式 DYNAMIC
--   * 时间统一 DATETIME，禁止用字符串存日期
--   * 表名小写下划线、语义单数；主键 id BIGINT UNSIGNED AUTO_INCREMENT
--   * 外键命名 <referenced_table>_id；删除策略默认 RESTRICT（学习数据只增不删）
--   * 正文类字段用 MEDIUMTEXT 保存原始 Markdown，保证信息不丢失
-- =============================================================================

SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS english_platform
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE english_platform;

-- -----------------------------------------------------------------------------
-- 0. 级别字典（Level 1—5，对应 references/level-map.md）
-- -----------------------------------------------------------------------------
CREATE TABLE levels (
  id          TINYINT UNSIGNED NOT NULL COMMENT '级别序号，如 1',
  code        VARCHAR(10)      NOT NULL COMMENT '级别代码，如 Level 1',
  title       VARCHAR(64)      NOT NULL COMMENT '级别标题',
  order_index TINYINT UNSIGNED NOT NULL COMMENT '排序',
  PRIMARY KEY (id),
  UNIQUE KEY uk_levels_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='级别字典';

-- -----------------------------------------------------------------------------
-- 1. 用户
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(50)     NOT NULL COMMENT '显示名，如 Zane',
  nickname   VARCHAR(50)     NULL,
  email      VARCHAR(128)    NULL,
  status     ENUM('active','archived') NOT NULL DEFAULT 'active',
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='用户（当前单用户，保留多用户扩展）';

-- -----------------------------------------------------------------------------
-- 2. 用户进度（等价 progress.md 头部 + 连击计数，每人一行）
-- -----------------------------------------------------------------------------
CREATE TABLE user_progress (
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id              BIGINT UNSIGNED NOT NULL,
  current_level        VARCHAR(10)     NOT NULL DEFAULT 'Level 1' COMMENT '当前级别 code',
  current_course_no    INT UNSIGNED    NOT NULL DEFAULT 0     COMMENT '当前课号',
  last_feedback        ENUM('too_easy','just_right','too_hard') NULL COMMENT '最近一次难度反馈',
  easy_streak          TINYINT UNSIGNED NOT NULL DEFAULT 0    COMMENT '「太简单」连击计数',
  upgrade_frozen_until INT UNSIGNED    NOT NULL DEFAULT 0     COMMENT '冻结升级至该课号（FeedbackTooHard 触发）',
  last_class_date      DATE            NULL                   COMMENT '上次上课日期',
  updated_at           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_progress_user (user_id),
  CONSTRAINT fk_progress_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='用户当前学习进度（单行状态）';

-- -----------------------------------------------------------------------------
-- 3. 知识点（Level 1—5 的知识点地图，含「待补」标记）
-- -----------------------------------------------------------------------------
CREATE TABLE knowledge_points (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  level_code  VARCHAR(10)     NOT NULL COMMENT '所属级别',
  code        VARCHAR(64)     NOT NULL COMMENT '知识点唯一代码，如 be_verb_am_is_are',
  title       VARCHAR(128)    NOT NULL COMMENT '知识点名称',
  is_backlog  TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '是否为 Level 1 待补点',
  order_index INT             NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_kp_code (code),
  KEY idx_kp_level (level_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='知识点地图';

-- -----------------------------------------------------------------------------
-- 4. 课程（对应「第 N 课」）
-- -----------------------------------------------------------------------------
CREATE TABLE courses (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  lesson_no   INT UNSIGNED    NOT NULL COMMENT '课号（每人内唯一，断更不断号）',
  lesson_date DATE            NULL     COMMENT '上课日期（同日第二课可为空，沿用当日）',
  level_code  VARCHAR(10)     NOT NULL COMMENT '上课时级别',
  summary     VARCHAR(255)    NOT NULL COMMENT '一句话摘要',
  study_minutes TINYINT UNSIGNED NULL  COMMENT '本次时长（分钟）',
  source_file VARCHAR(64)     NULL     COMMENT '来源 md 文件名，如 day-01-07.md（迁移溯源）',
  status      ENUM('planned','taught','archived') NOT NULL DEFAULT 'taught',
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_course_no (user_id, lesson_no),
  KEY idx_course_date (user_id, lesson_date),
  CONSTRAINT fk_course_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='课程（每课一行）';

-- -----------------------------------------------------------------------------
-- 5. 课程小节正文（复习/今日语法/例句/作业/我的作答/批改/难度反馈 的原始 md）
--    词汇不在此表，见 vocabulary + course_vocabulary
-- -----------------------------------------------------------------------------
CREATE TABLE course_sections (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id    BIGINT UNSIGNED NOT NULL,
  section_type ENUM('review','grammar','vocab_table','examples',
                    'homework','my_answer','grading','feedback') NOT NULL,
  content_md   MEDIUMTEXT      NOT NULL COMMENT '原始 Markdown 正文',
  order_index  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_section (course_id, section_type),
  CONSTRAINT fk_section_course FOREIGN KEY (course_id) REFERENCES courses (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='课程小节原文（保留 Markdown，结构由 section_type 表达）';

-- -----------------------------------------------------------------------------
-- 6. 课程 ↔ 知识点
-- -----------------------------------------------------------------------------
CREATE TABLE course_knowledge_points (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id   BIGINT UNSIGNED NOT NULL,
  kp_id       BIGINT UNSIGNED NOT NULL,
  role        ENUM('new','review','backfill') NOT NULL DEFAULT 'new' COMMENT '新授/复习/补漏',
  PRIMARY KEY (id),
  UNIQUE KEY uk_ckp (course_id, kp_id, role),
  CONSTRAINT fk_ckp_course FOREIGN KEY (course_id) REFERENCES courses (id),
  CONSTRAINT fk_ckp_kp     FOREIGN KEY (kp_id)     REFERENCES knowledge_points (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='课程与知识点的多对多关联';

-- -----------------------------------------------------------------------------
-- 7. 词汇（全局词典，每人内单词唯一 —— 用于「累计生词数」统计）
-- -----------------------------------------------------------------------------
CREATE TABLE vocabulary (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  word       VARCHAR(64)     NOT NULL,
  phonetic   VARCHAR(64)     NULL COMMENT '音标',
  meaning    VARCHAR(255)    NULL COMMENT '中文释义',
  first_seen_course_id BIGINT UNSIGNED NULL COMMENT '首次出现课',
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_vocab_word (user_id, word),
  KEY idx_vocab_letter (user_id, word),
  CONSTRAINT fk_vocab_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='词汇词典（全局）';

-- -----------------------------------------------------------------------------
-- 8. 课程 ↔ 词汇（含每课例句，可随课不同）
-- -----------------------------------------------------------------------------
CREATE TABLE course_vocabulary (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id      BIGINT UNSIGNED NOT NULL,
  vocabulary_id  BIGINT UNSIGNED NOT NULL,
  example        VARCHAR(255)    NULL COMMENT '本课例句',
  is_new         TINYINT(1)      NOT NULL DEFAULT 1 COMMENT '本课是否首次出现',
  order_index    SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '本课词汇表顺序',
  PRIMARY KEY (id),
  UNIQUE KEY uk_cv (course_id, vocabulary_id),
  KEY idx_cv_course (course_id),
  CONSTRAINT fk_cv_course FOREIGN KEY (course_id)     REFERENCES courses (id),
  CONSTRAINT fk_cv_vocab  FOREIGN KEY (vocabulary_id) REFERENCES vocabulary (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='课程与词汇的多对多关联';

-- -----------------------------------------------------------------------------
-- 9. 练习题（作业结构化；答案/作答/对错可回填）
-- -----------------------------------------------------------------------------
CREATE TABLE exercises (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id     BIGINT UNSIGNED NOT NULL,
  exercise_no   SMALLINT UNSIGNED NOT NULL COMMENT '题号',
  exercise_type ENUM('fill_blank','translate','error_correction',
                     'reorder','open','choice') NOT NULL,
  prompt        TEXT            NOT NULL COMMENT '题干',
  reference_answer TEXT         NULL     COMMENT '参考答案',
  user_answer   TEXT            NULL     COMMENT '学员作答',
  is_correct    TINYINT(1)      NULL     COMMENT '批改结论，NULL=未批改',
  error_note    VARCHAR(512)    NULL     COMMENT '批改说明/错误类型',
  order_index   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_exercise (course_id, exercise_no),
  CONSTRAINT fk_exercise_course FOREIGN KEY (course_id) REFERENCES courses (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='练习题（作业与批改）';

-- -----------------------------------------------------------------------------
-- 10. 阅读日（对应 read/YYYY-MM-DD-read.md）
-- -----------------------------------------------------------------------------
CREATE TABLE readings (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  read_date   DATE            NOT NULL,
  source_file VARCHAR(64)     NULL COMMENT '来源 md 文件名',
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_reading_day (user_id, read_date),
  CONSTRAINT fk_reading_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='阅读日（一天一行）';

-- -----------------------------------------------------------------------------
-- 11. 阅读篇
-- -----------------------------------------------------------------------------
CREATE TABLE reading_pieces (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reading_id       BIGINT UNSIGNED NOT NULL,
  piece_no         SMALLINT UNSIGNED NOT NULL COMMENT '当天第几篇',
  level_code       VARCHAR(10)     NULL,
  source           VARCHAR(128)    NULL COMMENT '自编 / 新闻来源',
  title            VARCHAR(255)    NULL,
  body_md          MEDIUMTEXT      NOT NULL COMMENT '正文（英中对照，逐段）',
  vocabulary_notes TEXT            NULL COMMENT '生词注释',
  word_count       SMALLINT UNSIGNED NULL COMMENT '词数',
  order_index      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_piece (reading_id, piece_no),
  CONSTRAINT fk_piece_reading FOREIGN KEY (reading_id) REFERENCES readings (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='阅读篇';

-- -----------------------------------------------------------------------------
-- 12. 阅读理解题
-- -----------------------------------------------------------------------------
CREATE TABLE reading_questions (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  piece_id    BIGINT UNSIGNED NOT NULL,
  question_no SMALLINT UNSIGNED NOT NULL,
  question    TEXT            NOT NULL,
  answer      TEXT            NULL,
  order_index SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_rq (piece_id, question_no),
  CONSTRAINT fk_rq_piece FOREIGN KEY (piece_id) REFERENCES reading_pieces (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='阅读理解题';

-- -----------------------------------------------------------------------------
-- 13. 错词本（核心：Amy 判断「错过什么、掌握什么」的依据）
-- -----------------------------------------------------------------------------
CREATE TABLE mistakes (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id          BIGINT UNSIGNED NOT NULL,
  first_course_id  BIGINT UNSIGNED NULL COMMENT '首次犯错课',
  last_course_id   BIGINT UNSIGNED NULL COMMENT '最近犯错课',
  wrong_text       VARCHAR(512)    NOT NULL COMMENT '错误点',
  correct_text     VARCHAR(512)    NOT NULL COMMENT '正确形式',
  error_type       ENUM('grammar','spelling','punctuation',
                        'word_choice','capitalization','other') NOT NULL DEFAULT 'other',
  error_reason     VARCHAR(512)    NULL COMMENT '错因说明',
  streak           SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '连续答对次数，≥2 判过关',
  wrong_count      SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '累计犯错次数',
  status           ENUM('pending','passed') NOT NULL DEFAULT 'pending',
  last_reviewed_at DATETIME        NULL,
  created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mistake_status (user_id, status),
  KEY idx_mistake_type (user_id, error_type),
  CONSTRAINT fk_mistake_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='错词/错题本（含掌握度状态）';

-- -----------------------------------------------------------------------------
-- 14. 错题事件流水（每次犯 / 每次答对，用于趋势分析）
-- -----------------------------------------------------------------------------
CREATE TABLE mistake_events (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  mistake_id BIGINT UNSIGNED NOT NULL,
  course_id  BIGINT UNSIGNED NULL COMMENT '发生在哪一课',
  result     ENUM('wrong','correct') NOT NULL,
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_me_mistake (mistake_id, created_at),
  CONSTRAINT fk_me_mistake FOREIGN KEY (mistake_id) REFERENCES mistakes (id),
  CONSTRAINT fk_me_course  FOREIGN KEY (course_id)  REFERENCES courses (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='错题事件流水';

-- -----------------------------------------------------------------------------
-- 15. 难度反馈记录（对应 progress.md 的反馈表 + 升级记录）
-- -----------------------------------------------------------------------------
CREATE TABLE progress_feedback (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      BIGINT UNSIGNED NOT NULL,
  course_id    BIGINT UNSIGNED NULL,
  feedback     ENUM('too_easy','just_right','too_hard') NOT NULL,
  level_before VARCHAR(10)     NULL,
  level_after  VARCHAR(10)     NULL,
  note         VARCHAR(512)    NULL,
  created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pf_user (user_id, created_at),
  CONSTRAINT fk_pf_user   FOREIGN KEY (user_id)   REFERENCES users (id),
  CONSTRAINT fk_pf_course FOREIGN KEY (course_id) REFERENCES courses (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='难度反馈与升降级记录';

-- -----------------------------------------------------------------------------
-- 16. 学习记录（行为流水：上课/交作业/批改/复习/反馈）
-- -----------------------------------------------------------------------------
CREATE TABLE study_records (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  course_id   BIGINT UNSIGNED NULL,
  record_type ENUM('attend','homework_submit','grade','review','feedback','reading') NOT NULL,
  payload     JSON            NULL COMMENT '结构化细节（题目数、用时、错误数等）',
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sr_user_time (user_id, created_at),
  KEY idx_sr_type (user_id, record_type),
  CONSTRAINT fk_sr_user   FOREIGN KEY (user_id)   REFERENCES users (id),
  CONSTRAINT fk_sr_course FOREIGN KEY (course_id) REFERENCES courses (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='学习行为流水（时间线）';

-- -----------------------------------------------------------------------------
-- 17. Skill 定义与执行记录（「Skill 数据」）
-- -----------------------------------------------------------------------------
CREATE TABLE skills (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(64)     NOT NULL COMMENT '如 english-daily',
  version     VARCHAR(32)     NULL,
  description VARCHAR(255)    NULL,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_skill_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Skill 注册表';

CREATE TABLE skill_runs (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  skill_id   BIGINT UNSIGNED NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  course_id  BIGINT UNSIGNED NULL,
  input      JSON            NULL,
  output     JSON            NULL,
  status     ENUM('success','failed','partial') NOT NULL DEFAULT 'success',
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_srun (skill_id, created_at),
  CONSTRAINT fk_srun_skill  FOREIGN KEY (skill_id)  REFERENCES skills (id),
  CONSTRAINT fk_srun_user   FOREIGN KEY (user_id)   REFERENCES users (id),
  CONSTRAINT fk_srun_course FOREIGN KEY (course_id) REFERENCES courses (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Skill 执行记录';

-- -----------------------------------------------------------------------------
-- 18. 视图：未过关错词（等价 digest.md 里的「待复习」段）
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_pending_mistakes AS
SELECT m.id, m.user_id, m.wrong_text, m.correct_text, m.error_type,
       m.error_reason, m.streak, m.wrong_count, m.last_reviewed_at
FROM mistakes m
WHERE m.status = 'pending'
ORDER BY m.wrong_count DESC, m.updated_at ASC;

-- -----------------------------------------------------------------------------
-- 19. 视图：看板统计（等价 review/index.html 顶部 5 个统计卡）
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_dashboard_stats AS
SELECT
  u.id AS user_id,
  (SELECT COUNT(*) FROM courses c WHERE c.user_id = u.id)               AS course_count,
  (SELECT p.current_level FROM user_progress p WHERE p.user_id = u.id)  AS current_level,
  (SELECT COUNT(*) FROM vocabulary v WHERE v.user_id = u.id)            AS vocab_total,
  (SELECT COUNT(*) FROM reading_pieces rp
     JOIN readings r ON r.id = rp.reading_id WHERE r.user_id = u.id)    AS reading_piece_count,
  (SELECT COUNT(*) FROM mistakes m WHERE m.user_id = u.id AND m.status='pending') AS pending_mistake_count
FROM users u;

-- =============================================================================
-- 初始化数据（seed）——级别字典与当前单用户，正式种子见 db/seed.sql
-- =============================================================================
INSERT INTO levels (id, code, title, order_index) VALUES
  (1, 'Level 1', '零基础：主谓宾 / be 动词 / 代词', 1),
  (2, 'Level 2', '时态入门：进行时 / 一般现在 / 过去时', 2),
  (3, 'Level 3', '日常场景：短文阅读与扩展', 3),
  (4, 'Level 4', '新闻改写：当日英文新闻分级改写', 4),
  (5, 'Level 5', '进阶表达：长句与篇章', 5)
ON DUPLICATE KEY UPDATE title = VALUES(title), order_index = VALUES(order_index);

INSERT INTO users (name, nickname) VALUES ('Zane', '刘凤渝')
ON DUPLICATE KEY UPDATE nickname = VALUES(nickname);

INSERT INTO user_progress (user_id, current_level, current_course_no, easy_streak)
SELECT id, 'Level 2', 6, 0 FROM users WHERE name = 'Zane'
ON DUPLICATE KEY UPDATE current_level = VALUES(current_level);
