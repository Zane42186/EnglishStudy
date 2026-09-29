'use strict';

/**
 * API 冒烟测试：逐个请求所有接口，校验统一响应包络与关键字段。
 * 用法：先 `npm start`，再另开终端 `npm run test:api`
 *      或指定地址：node scripts/smoke-test.js http://localhost:4000
 */

const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BASE = process.argv[2] || `http://localhost:${process.env.PORT || 4000}`;

function request(urlPath, { method = 'GET', body = null } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === null ? null : JSON.stringify(body);
    const headers = payload
      ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
      : {};
    const req = http.request(`${BASE}${urlPath}`, { method, headers }, (res) => {
      let chunks = '';
      res.on('data', (chunk) => { chunks += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(chunks); } catch { /* 非 JSON 响应 */ }
        resolve({ status: res.statusCode, json, raw: chunks });
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => req.destroy(new Error('请求超时')));
    if (payload) req.write(payload);
    req.end();
  });
}

/** 期望 200 且包络为 {code,message,data} */
function checkEnvelope(res) {
  if (res.status !== 200) return `HTTP ${res.status}`;
  if (!res.json || typeof res.json !== 'object') return '响应不是 JSON 对象';
  if (res.json.code !== 200) return `code=${res.json.code}`;
  if (res.json.message !== 'success') return `message=${res.json.message}`;
  if (!('data' in res.json)) return '缺少 data 字段';
  return null;
}

const CASES = [
  { name: '健康检查', path: '/api/health' },
  { name: '接口索引', path: '/api' },
  { name: '课程列表', path: '/api/lessons', verify: (d) => (Array.isArray(d.list) ? null : 'data.list 不是数组') },
  { name: '课程列表(分页)', path: '/api/lessons?page=1&size=3', verify: (d) => (d.list.length <= 3 ? null : '分页未生效') },
  { name: '课程列表(按级别)', path: '/api/lessons?level=Level%202' },
  { name: '课程列表(搜索)', path: '/api/lessons?q=%E8%BF%87%E5%8E%BB%E6%97%B6' },
  { name: '课程全量', path: '/api/lessons/all', verify: (d) => (Array.isArray(d.list) && d.list.length > 0 && 'grammarPoint' in d.list[0] ? null : 'list 缺少 grammarPoint') },
  { name: 'size 放宽到 500', path: '/api/lessons?size=200', verify: (d) => (d.size === 200 ? null : `size=${d.size} 未放宽`) },
  { name: '最近一课', path: '/api/lessons/latest', verify: (d) => (d.nextLessonNo === d.latest.lessonNo + 1 ? null : 'nextLessonNo 推导错误') },
  { name: '错误趋势', path: '/api/lessons/error-trend' },
  { name: '课程详情', path: '/api/lessons/1', verify: (d) => (Array.isArray(d.sections) && Array.isArray(d.vocabulary) ? null : '缺少 sections/vocabulary') },
  { name: '词汇列表', path: '/api/vocabulary', verify: (d) => (Array.isArray(d.list) ? null : 'data.list 不是数组') },
  { name: '词汇列表(首字母)', path: '/api/vocabulary?letter=B' },
  { name: '词汇统计', path: '/api/vocabulary/stats', verify: (d) => (typeof d.total === 'number' ? null : '缺少 total') },
  { name: '词汇详情', path: '/api/vocabulary/1' },
  { name: '错词列表', path: '/api/mistakes', verify: (d) => (Array.isArray(d.list) ? null : 'data.list 不是数组') },
  { name: '错词列表(未过关)', path: '/api/mistakes?status=pending' },
  { name: '待复习错词', path: '/api/mistakes/pending', verify: (d) => (Array.isArray(d.list) ? null : '缺少 list') },
  { name: '错词统计', path: '/api/mistakes/stats', verify: (d) => (typeof d.pending === 'number' ? null : '缺少 pending') },
  { name: '错词详情', path: '/api/mistakes/1' },
  { name: '错词复习流水', path: '/api/mistakes/1/events', verify: (d) => (Array.isArray(d.list) && typeof d.total === 'number' ? null : '缺少 list/total') },
  { name: '课程练习明细', path: '/api/lessons/1/exercises', verify: (d) => (Array.isArray(d.list) && d.summary && typeof d.summary.exerciseCount === 'number' ? null : '缺少 list/summary') },
  { name: '学习记录', path: '/api/study-records' },
  { name: '学习记录(按类型)', path: '/api/study-records?type=grade' },
  { name: '学习记录统计', path: '/api/study-records/stats' },
  { name: '学习进度', path: '/api/progress', verify: (d) => (d.currentLevel ? null : '缺少 currentLevel') },
  {
    name: '教学快照',
    path: '/api/agent/snapshot',
    verify: (d) =>
      d.deploymentMode === 'backend' &&
      Array.isArray(d.pendingMistakes) &&
      d.pendingMistakeStats &&
      typeof d.pendingMistakeStats.total === 'number' &&
      d.degradation &&
      typeof d.degradation.degraded === 'boolean'
        ? null
        : '快照关键字段缺失（deploymentMode / pendingMistakes / pendingMistakeStats / degradation）',
  },
  {
    name: '教学快照(recent=2)',
    path: '/api/agent/snapshot?recent=2',
    verify: (d) => (d.recentLessons.length <= 2 ? null : 'recent 未生效'),
  },
];

// 期望返回 4xx 的错误路径用例
const ERROR_CASES = [
  { name: '课程不存在 → 404', path: '/api/lessons/99999', expectStatus: 404 },
  { name: '错词不存在 → 404', path: '/api/mistakes/99999', expectStatus: 404 },
  { name: '分页参数非法 → 400', path: '/api/lessons?page=abc', expectStatus: 400 },
  { name: '枚举值非法 → 400', path: '/api/mistakes?status=xxx', expectStatus: 400 },
  { name: '路由不存在 → 404', path: '/api/not-exist', expectStatus: 404 },
  { name: '复习 result 非法 → 400', path: '/api/mistakes/1/review', method: 'POST', body: { result: 'maybe' }, expectStatus: 400 },
  { name: '复习错词不存在 → 404', path: '/api/mistakes/99999/review', method: 'POST', body: { result: 'correct' }, expectStatus: 404 },
  { name: '反馈枚举非法 → 400', path: '/api/progress/feedback', method: 'POST', body: { lessonNo: 7, feedback: 'bad' }, expectStatus: 400 },
  { name: '反馈缺 lessonNo → 400', path: '/api/progress/feedback', method: 'POST', body: { feedback: 'just_right' }, expectStatus: 400 },
  { name: '记录类型非法 → 400', path: '/api/study-records', method: 'POST', body: { recordType: 'nope' }, expectStatus: 400 },
  { name: '快照 recent 越界 → 400', path: '/api/agent/snapshot?recent=99', expectStatus: 400 },
  { name: '错词流水不存在 → 404', path: '/api/mistakes/99999/events', expectStatus: 404 },
  { name: '课程练习不存在 → 404', path: '/api/lessons/99999/exercises', expectStatus: 404 },
];

(async () => {
  console.log(`API 冒烟测试 · 目标 ${BASE}\n`);

  let pass = 0;
  let fail = 0;

  console.log('— 正常路径 —');
  for (const c of CASES) {
    let res;
    try {
      res = await request(c.path);
    } catch (err) {
      console.log(`  ✗ ${c.name.padEnd(18)} 请求失败：${err.message}`);
      fail += 1;
      continue;
    }
    const envErr = checkEnvelope(res);
    const bizErr = !envErr && c.verify ? c.verify(res.json.data) : null;
    const err = envErr || bizErr;
    if (err) {
      console.log(`  ✗ ${c.name.padEnd(18)} ${err}`);
      fail += 1;
    } else {
      const size = Array.isArray(res.json.data.list) ? `list=${res.json.data.list.length}` : 'ok';
      console.log(`  ✓ ${c.name.padEnd(18)} ${c.path}  (${size})`);
      pass += 1;
    }
  }

  console.log('\n— 错误路径（统一错误包络）—');
  for (const c of ERROR_CASES) {
    let res;
    try {
      res = await request(c.path, { method: c.method, body: c.body });
    } catch (err) {
      console.log(`  ✗ ${c.name.padEnd(18)} 请求失败：${err.message}`);
      fail += 1;
      continue;
    }
    const okStatus = res.status === c.expectStatus;
    const okShape =
      res.json && res.json.code === c.expectStatus && typeof res.json.message === 'string' && 'data' in res.json;
    if (okStatus && okShape) {
      console.log(`  ✓ ${c.name.padEnd(18)} ${res.status} · ${res.json.message}`);
      pass += 1;
    } else {
      console.log(`  ✗ ${c.name.padEnd(18)} 期望 ${c.expectStatus}，实际 ${res.status}；包络 ${okShape ? '正常' : '异常'}`);
      fail += 1;
    }
  }

  console.log(`\n结果：通过 ${pass} · 失败 ${fail}`);
  process.exit(fail === 0 ? 0 : 1);
})();
