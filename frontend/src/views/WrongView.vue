<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { API } from '../api.js';
import ApiErrorBar from '../components/ApiErrorBar.vue';
import MistakeCard from '../components/MistakeCard.vue';
import { label } from '../utils/labels.js';

/* 错词本 · API 驱动 + 复习打卡（P3）—— 对应 review/wrong.html（2026-10-02 全站迁移）
 *
 * 列表：GET /api/mistakes/stats + GET /api/mistakes（全量）
 * 复习：GET /api/mistakes/pending（默认优先级序，前端**不重排**）→ POST /api/mistakes/:id/review
 *       （clientEventId 幂等）。题量按 Amy 断更规则（D≤2→5、3—6→7、≥7→8）；
 *       答后文案为 Amy §B.3.1 原文，非百分制。
 * 筛选：状态 tab + 类型 tab + 关键词，**用 v-show**（保持 .mcard 总数不变、
 *       未命中的 computed display = none，与原生版 .hide 语义等价）。
 */
const errMsg = ref('');
const stats = reactive({ total: null, pending: null, passed: null });
const byType = ref([]);
const mistakes = ref([]);
const loading = ref(true);

const state = reactive({ status: '', type: '' });
const keyword = ref('');

/* 复习题量（Amy amy-teaching-plan §B.3.1 / §2.5）：D = 距上次上课天数 */
const SIZE_RULES = { normal: 5, gap: 7, longGap: 8 };
function queueSize() {
  return API.get('/progress').then(function (p) {
    const D = API.daysSince(p && p.lastClassDate);
    if (D == null || D <= 2) { return SIZE_RULES.normal; }
    if (D <= 6) { return SIZE_RULES.gap; }
    return SIZE_RULES.longGap;
  }).catch(function () { return SIZE_RULES.normal; });
}

/* 答后反馈文案：固定句式、不用百分制（Amy §B.3.1 L616—618 原文） */
function feedbackLines(result, m, d) {
  const lines = [];
  if (result === 'correct') {
    lines.push('✅ 答对了 · 连续答对 ' + d.streak + '/2');
    if (d.streak >= 2) { lines.push('—— 已过关，退出复习队列'); }
  } else {
    lines.push('❌ 又错了 · 连续答对清零');
    const src = m.lastLessonNo ? ('第 ' + m.lastLessonNo + ' 课') : '诊断';
    lines.push('这是第 ' + d.wrongCount + ' 次犯，上次在' + src);
  }
  return lines;
}

function errTextOf(e) {
  let msg = (e && e.message) || String(e);
  if (e && e.code === 0) { msg += '（请确认后端服务是否在运行）'; }
  return msg;
}
function partError(part, e) { errMsg.value = part + '加载失败：' + errTextOf(e); }

/* ---- 统计 + 类型 tab + 列表 ---- */
function loadStats() {
  return API.get('/mistakes/stats').then(function (d) {
    stats.total = d.total; stats.pending = d.pending; stats.passed = d.passed;
    byType.value = d.byType || [];
  }).catch(function (e) { partError('错词统计', e); });
}
function loadList() {
  loading.value = true;
  return API.getAll('/mistakes', { size: 100 }).then(function (d) {
    mistakes.value = d.list || [];
    loading.value = false;
  }).catch(function (e) { mistakes.value = []; loading.value = false; partError('错词列表', e); });
}
function loadAll() {
  errMsg.value = '';
  return Promise.all([loadStats(), loadList()]);
}

const typeTabs = computed(function () {
  return [{ errorType: '', count: null }].concat(byType.value || []);
});
function typeTabLabel(t) {
  const name = t.errorType ? label('errorType', t.errorType) : '全部类型';
  return name + (t.count != null ? '（' + t.count + '）' : '');
}

const visibleIds = computed(function () {
  const kw = keyword.value.trim().toLowerCase();
  const set = new Set();
  mistakes.value.forEach(function (m) {
    const hitStatus = !state.status || m.status === state.status;
    const hitType = !state.type || m.errorType === state.type;
    const src = m.firstLessonNo ? ('第 ' + m.firstLessonNo + ' 课') : '诊断';
    const hitText = !kw || [m.wrongText, m.correctText, m.errorReason, src].join('  ').toLowerCase().indexOf(kw) !== -1;
    if (hitStatus && hitType && hitText) { set.add(m.id); }
  });
  return set;
});
const showFilterEmpty = computed(function () {
  return mistakes.value.length > 0 && visibleIds.value.size === 0;
});

/* ---- 复习打卡（P3） ---- */
const review = reactive({
  stage: 'idle',      // idle | loading | empty | question | done
  queue: [],
  qi: 0,
  right: 0,
  wrong: 0,
  lines: [],
  submitted: false,
  err: ''
});
const reviewCur = computed(function () { return review.queue[review.qi] || null; });
const reviewSrc = computed(function () {
  const m = reviewCur.value;
  return m && m.firstLessonNo ? ('第 ' + m.firstLessonNo + ' 课') : '诊断';
});
const nextLabel = computed(function () {
  return review.qi + 1 < review.queue.length ? '下一题' : '完成本轮';
});

function startReview() {
  errMsg.value = '';
  review.stage = 'loading';
  review.lines = [];
  review.submitted = false;
  review.err = '';
  queueSize().then(function (n) {
    return API.get('/mistakes/pending?limit=' + n);
  }).then(function (d) {
    review.queue = d.list || [];
    review.qi = 0; review.right = 0; review.wrong = 0;
    review.stage = review.queue.length ? 'question' : 'empty';
  }).catch(function (e) {
    review.stage = 'idle';
    review.err = '复习队列加载失败：' + e.message;
    partError('复习队列', e);
  });
}

function submit(result) {
  const m = reviewCur.value;
  if (!m) { return; }
  const cid = 'fe-' + Date.now() + '-' + m.id + '-' + (review.qi + 1);   // 幂等键，避免重复提交
  review.submitting = true;
  API.post('/mistakes/' + m.id + '/review', { result: result, clientEventId: cid }).then(function (d) {
    if (result === 'correct') { review.right += 1; } else { review.wrong += 1; }
    review.lines = feedbackLines(result, m, d);
    review.submitted = true;
    review.submitting = false;
  }).catch(function (e) {
    review.submitting = false;
    partError('提交复习结果', e);
  });
}

function nextQuestion() {
  review.qi += 1;
  if (review.qi < review.queue.length) {
    review.submitted = false;
    review.lines = [];
  } else {
    review.stage = 'done';
    loadAll();   // 刷新统计与列表，反映最新 streak/status
  }
}

function againReview() { startReview(); }
function closeReview() { review.stage = 'idle'; review.queue = []; }

onMounted(loadAll);
</script>

<template>
  <p class="sub">每张卡列出四项硬指标：累计犯错次数、连续答对进度、优先级、错误类型，以及来源课号。</p>

  <ApiErrorBar :msg="errMsg" @retry="loadAll" />

  <div class="stats">
    <div class="stat"><b id="stTotal" :class="{ pending: stats.total == null }">{{ stats.total == null ? '…' : stats.total }}</b><span>错词总数</span></div>
    <div class="stat"><b id="stPending" :class="{ pending: stats.pending == null }">{{ stats.pending == null ? '…' : stats.pending }}</b><span>未过关</span></div>
    <div class="stat"><b id="stPassed" :class="{ pending: stats.passed == null }">{{ stats.passed == null ? '…' : stats.passed }}</b><span>已过关</span></div>
  </div>

  <p><button class="btn" type="button" id="startReview" @click="startReview">开始复习（未过关错词）</button></p>
  <div id="reviewPanel">
    <p v-if="review.stage === 'loading'" class="state loading">正在准备复习…</p>
    <p v-else-if="review.stage === 'empty'" class="state">当前没有未过关的错词，先休息一下。</p>
    <p v-else-if="review.err" class="state">{{ review.err }}</p>

    <div v-else-if="review.stage === 'question'" class="review">
      <div class="rhead">
        <b>复习</b>
        <span class="rprog">第 {{ review.qi + 1 }} / {{ review.queue.length }} 题</span>
        <span class="rprog">来源 {{ reviewSrc }}　第 {{ reviewCur.wrongCount || 0 }} 次犯</span>
      </div>
      <div class="qtext">{{ reviewCur.wrongText || '' }}</div>
      <p class="why">错因：{{ reviewCur.errorReason || '' }}</p>
      <div class="acts">
        <button class="btn ok" type="button" data-r="correct" :disabled="review.submitting" @click="submit('correct')">我答对了</button>
        <button class="btn no" type="button" data-r="wrong" :disabled="review.submitting" @click="submit('wrong')">又错了</button>
      </div>
      <div v-if="review.submitted" class="feedback">
        <p v-for="(t, i) in review.lines" :key="i">{{ t }}</p>
        <div class="acts">
          <button class="btn" type="button" id="nextQ" @click="nextQuestion">{{ nextLabel }}</button>
        </div>
      </div>
    </div>

    <div v-else-if="review.stage === 'done'" class="review">
      <div class="rhead"><b>本轮完成</b></div>
      <p>共 {{ review.queue.length }} 题：答对 {{ review.right }}，答错 {{ review.wrong }}。</p>
      <div class="acts">
        <button class="btn" type="button" id="againReview" @click="againReview">再来一轮</button>
        <button class="btn" type="button" id="closeReview" @click="closeReview">收起</button>
      </div>
    </div>
  </div>

  <div class="tabs" id="statusTabs">
    <button type="button" data-status="" :class="{ on: state.status === '' }" @click="state.status = ''">全部</button>
    <button type="button" data-status="pending" :class="{ on: state.status === 'pending' }" @click="state.status = 'pending'">未过关</button>
    <button type="button" data-status="passed" :class="{ on: state.status === 'passed' }" @click="state.status = 'passed'">已过关</button>
  </div>
  <div class="tabs" id="typeTabs">
    <button v-for="t in typeTabs" :key="t.errorType || '__all__'" type="button" :data-type="t.errorType"
      :class="{ on: t.errorType === state.type }" @click="state.type = t.errorType">{{ typeTabLabel(t) }}</button>
  </div>

  <input id="q" v-model="keyword" placeholder="搜索错误点、正确形式或错因，输入关键词即时过滤">
  <div id="mistakeList">
    <p v-if="loading" class="state loading">正在加载错词…</p>
    <p v-else-if="!mistakes.length" class="state">暂无错词记录</p>
    <template v-else>
      <MistakeCard v-for="m in mistakes" v-show="visibleIds.has(m.id)" :key="m.id" :m="m" />
      <p v-if="showFilterEmpty" class="state filter-empty">没有匹配的错词，换个筛选条件或关键词试试</p>
    </template>
  </div>

  <footer>提示：连续答对 2 次即过关。复习队列按服务端默认优先级排序（前端不改顺序）。</footer>
</template>

<style scoped>
/* 本页特有：复习面板（与原生 wrong.html 页内样式一致） */
.review { background: #fff; border: 1px solid #c9dcef; border-radius: 12px; padding: 14px 16px; margin: 12px 0; }
.review .rhead { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.review .rprog { color: #6b6b66; font-size: 13px; }
.review .qtext { font-size: 17px; font-weight: 600; color: #a5392f; margin: 10px 0 6px; }
.review .acts { display: flex; gap: 10px; margin-top: 10px; }
.review .acts .ok { border-color: #c6e0c9; color: #2f6b3c; background: #eef7ef; }
.review .acts .no { border-color: #e0aca7; color: #a5392f; background: #fdf1f0; }
.review .feedback { margin-top: 10px; padding-top: 10px; border-top: 1px dashed #e3e2dc; }
.review .feedback p { margin: 2px 0; font-size: 14px; }
</style>
