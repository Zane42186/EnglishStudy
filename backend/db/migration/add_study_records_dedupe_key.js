'use strict';

/**
 * 迁移：`study_records` 增加幂等去重键 `dedupe_key` + 唯一键
 * =============================================================================
 * 背景（为什么必须做）
 *   `study_records` 原先只有 `PRIMARY KEY(id)` + 2 个普通索引，**没有任何唯一键**。
 *   在这种表上写 `INSERT ... ON DUPLICATE KEY UPDATE`，MySQL 不会报错，
 *   只会**静默退化成普通 INSERT** —— 重跑一次行数就翻倍。
 *   这与 DQ1（`mistakes` 19 → 38）是**完全同型**的事故。
 *
 *   直接后果：一条重复的 `grade` 记录会让 `errorTrend` / `errorCount` 翻倍，
 *   而这两个计数是 Amy 教学决策的输入 —— 属于必须堵死的静默数据污染。
 *
 * 为什么不用 `(student_id, lesson_id, record_type)` 做唯一键
 *   `record_type` 是 6 值枚举（`attend` / `homework_submit` / `grade` /
 *   `review` / `feedback` / `reading`）。`review` 与 `reading` 天然是
 *   **同一节课可以有多条**的语义 —— 用它做唯一键「今天能跑、明天锁死」。
 *   故改为显式键：`dedupe_key`，由写入方声明自己的幂等标识。
 *
 * 键的格式约定
 *   课内记录：`lesson-<lessonNo>:<record_type>`，例 `lesson-7:grade`
 *   （不用零填充 —— `LPAD` 在位数超长时会**截断**，反而制造碰撞）
 *   非课内记录（如按日期的 reading）：写入方自行定义，或留 NULL 不参与去重。
 *   ※ `dedupe_key` 允许 NULL，且 MySQL 唯一键**不约束 NULL** ——
 *     多条 NULL 可以共存，这是有意为之的逃生口。
 *
 * 用法
 *   node db/migration/add_study_records_dedupe_key.js --dry-run   # 只报告
 *   node db/migration/add_study_records_dedupe_key.js             # 执行
 *   node db/migration/add_study_records_dedupe_key.js --rollback  # 回滚
 *
 * 回滚 SQL（与本文件等价，供 DBA 手工执行）
 *   ALTER TABLE study_records DROP INDEX uk_study_records_dedupe;
 *   ALTER TABLE study_records DROP COLUMN dedupe_key;
 *
 * 备份：`backend/db/backup-20261001-before-dedupe-key.sql`（结构 + 数据，未提交）
 * =============================================================================
 */

const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const db = require('../../src/config/db');

const TABLE = 'study_records';
const COLUMN = 'dedupe_key';
const INDEX = 'uk_study_records_dedupe';

/** 该列/索引是否已存在（迁移可重放的判据） */
async function columnExists() {
  const rows = await db.query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [TABLE, COLUMN]
  );
  return rows[0].n > 0;
}

async function indexExists() {
  const rows = await db.query(
    `SELECT COUNT(*) AS n FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [TABLE, INDEX]
  );
  return rows[0].n > 0;
}

/** 回填前先确认按 dedupe_key 分组没有重复，否则加唯一键必然失败 */
async function findDuplicates() {
  return db.query(
    `SELECT student_id, ${COLUMN} AS dedupe, COUNT(*) AS n
       FROM ${TABLE}
      WHERE ${COLUMN} IS NOT NULL
      GROUP BY student_id, ${COLUMN}
     HAVING n > 1`
  );
}

async function report() {
  const rows = await db.query(
    `SELECT COUNT(*) AS total,
            SUM(${COLUMN} IS NOT NULL) AS withKey,
            SUM(lesson_id IS NULL)    AS noLesson
       FROM ${TABLE}`
  );
  const r = rows[0];
  console.log(`  表内 ${r.total} 行：已带 dedupe_key ${r.withKey ?? 0} · lesson_id 为 NULL ${r.noLesson ?? 0}`);
}

async function apply() {
  console.log('迁移：study_records.dedupe_key + 唯一键');
  console.log('');

  const hasCol = await columnExists();
  const hasIdx = await indexExists();

  if (hasCol && hasIdx) {
    console.log('✓ 列与唯一键均已存在，无需变更。');
    await report();
    return { changed: false };
  }

  console.log(`  1/3 加列 ${COLUMN} …… ${hasCol ? '已存在，跳过' : '执行'}`);
  if (!hasCol) {
    await db.execute(
      `ALTER TABLE ${TABLE}
         ADD COLUMN ${COLUMN} VARCHAR(64) NULL
         COMMENT '幂等去重键，如 lesson-7:grade；NULL = 不参与去重'
         AFTER lesson_id`
    );
  }

  console.log('  2/3 回填既有行（仅填 NULL，绝不覆盖已有值）……');
  const backfill = await db.execute(
    `UPDATE ${TABLE} r
       JOIN lessons l ON l.id = r.lesson_id
        SET r.${COLUMN} = CONCAT('lesson-', l.lesson_no, ':', r.record_type)
      WHERE r.${COLUMN} IS NULL
        AND r.lesson_id IS NOT NULL`
  );
  console.log(`      回填 ${backfill.affectedRows} 行（lesson_id 为 NULL 的行保持 NULL）`);

  const dups = await findDuplicates();
  if (dups.length) {
    console.error('');
    console.error('✗ 回填后仍存在重复的 dedupe_key，加唯一键会失败。请先人工决断：');
    for (const d of dups) console.error(`    student_id=${d.student_id} key=${d.dedupe} ×${d.n}`);
    throw new Error('回填后存在重复 dedupe_key，已中止（未加唯一键）');
  }
  console.log('      重复校验：0 条 ✓');

  console.log(`  3/3 加唯一键 ${INDEX} ……`);
  await db.execute(`ALTER TABLE ${TABLE} ADD UNIQUE KEY ${INDEX} (student_id, ${COLUMN})`);

  console.log('');
  console.log('完成。');
  await report();
  return { changed: true };
}

async function rollback() {
  console.log('回滚：drop 唯一键 + drop 列');
  if (await indexExists()) {
    await db.execute(`ALTER TABLE ${TABLE} DROP INDEX ${INDEX}`);
    console.log(`  ✓ 已删索引 ${INDEX}`);
  } else {
    console.log(`  · 索引 ${INDEX} 不存在，跳过`);
  }
  if (await columnExists()) {
    await db.execute(`ALTER TABLE ${TABLE} DROP COLUMN ${COLUMN}`);
    console.log(`  ✓ 已删列 ${COLUMN}`);
  } else {
    console.log(`  · 列 ${COLUMN} 不存在，跳过`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const wantRollback = args.includes('--rollback');

  if (wantRollback && dryRun) {
    console.log('[dry-run] 将执行回滚（未实际改动）');
    if (await indexExists()) console.log(`  会删索引 ${INDEX}`);
    if (await columnExists()) console.log(`  会删列 ${COLUMN}`);
    return;
  }

  if (dryRun) {
    console.log('[dry-run] 只报告，不执行 ALTER');
    const hasCol = await columnExists();
    const hasIdx = await indexExists();
    console.log(`  ${COLUMN} 列存在：${hasCol}`);
    console.log(`  ${INDEX} 索引存在：${hasIdx}`);
    if (hasCol) {
      await report();
      console.log(`  按 dedupe_key 的重复组：${(await findDuplicates()).length}`);
    } else {
      const rows = await db.query(`SELECT COUNT(*) AS total FROM ${TABLE}`);
      console.log(`  表内 ${rows[0].total} 行（列尚未创建，回填前无重复可言）`);
      console.log('  待执行：ADD COLUMN → 回填 → 校验 → ADD UNIQUE KEY');
    }
    console.log('MIGRATION_DRYRUN ok=1');
    return;
  }

  if (wantRollback) {
    await rollback();
    console.log('MIGRATION_ROLLBACK_OK');
    return;
  }

  const res = await apply();
  console.log(res.changed ? 'MIGRATION_OK' : 'MIGRATION_NOOP');
}

main()
  .then(async () => {
    await db.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('MIGRATION_FAIL', (err && err.message) || err);
    try {
      await db.close();
    } catch {
      /* ignore */
    }
    process.exit(1);
  });
